import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { performOCRFromBuffer } from "./ocr/ocr.js";
import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: envFile });

const app = express();
const upload = multer({ dest: 'uploads/' });

const CLIENT_URL = process.env.CLIENT_URL
const MODEL_URL = process.env.MODEL_URL;
const PORT = 3001;
const HOST = process.env.HOST || 'localhost';

if (app.get('env') === 'development') {
  console.log('Running in dev mode');
} else {
  console.log('Running in production');
}

console.log(`CLIENT_URL: ${CLIENT_URL}`);

if(CLIENT_URL !== '*') {
  console.log(`CORS enabled for ${CLIENT_URL}`);
  app.use(cors({
    origin: CLIENT_URL,
  }));
} else {
  app.use(cors());
}

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Pokémon Card Price Checker Backend is Running!');
});

app.post('/predict', upload.single('file'), async (req, res) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(req.file.path));

  try {
    const response = await fetch(`${MODEL_URL}/predict`, {
      method: 'POST',
      body: form,
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  } finally {
    fs.unlinkSync(req.file.path); // delete temp file
  }
});

app.post("/ocr", upload.array("images", 10), async (req, res) => {
  try {
    const results = [];
    const names = [];
    const hps = [];
    const setIdentifiers = [];
    const regexPatterns = [/(\d{1,3}\/\d{1,3})/];
    //, /[A-Z]{1,3}\d{1,4}/
    for (const file of req.files) {
      const buffer = fs.readFileSync(file.path);
      let text_OR = await performOCRFromBuffer(buffer);
      let text = text_OR.replace(/[^A-Za-z0-9 /]+/g, "");
      text = text_OR.replace(/\s+/g, " ").trim();

      for (const pattern of regexPatterns) {
        const match = text.match(pattern);
        if (match) setIdentifiers.push(match[0]);
      }

      results.push({ filename: file.originalname, text, text_OR });

      // Clean up the file after processing
      fs.unlinkSync(file.path);

      // Clean + split text into words
      const words = text
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 0);

      let numbers = [];
      let longestWord = "";

      for (const word of words) {
        // Look for numbers inside the word, even if it's like "w70" or "hp70"
        const numMatch = word.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          if (!isNaN(num)) {
            numbers.push(num);
          }
        }

        // Find the longest alphabetic word (pure letters)
        if (word.length > longestWord.length && /^[A-Za-z]+$/.test(word)) {
          longestWord = word;
        }
      }

      // Get the largest number found (if any)
      let foundHp = null;
      if (numbers.length > 0) {
        let maxNum = Math.max(...numbers);
        if (maxNum < 30) { foundHp = null;} // current min HP value (5/15/2025)
        if (maxNum <= 340) { // Current max HP value (5/15/2025)
          foundHp = maxNum; 
        } else {
          const candidates = [Math.floor(maxNum / 10), maxNum % 1000];
          const validCandidates = candidates.filter(n => n <= 340 && n % 10 === 0);
          if (validCandidates.length > 0) {
            foundHp = Math.max(...validCandidates);
          }
        }
      }

      if (longestWord) names.push(longestWord);
      if (foundHp !== null) hps.push(foundHp.toString());
    }

    // Majority vote logic
    function majorityVote(arr) {
      const count = {};
      for (const item of arr) {
        count[item] = (count[item] || 0) + 1;
      }
      return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }

    const votedName = majorityVote(names);
    const votedHp = majorityVote(hps);
    const votedSetId = majorityVote(setIdentifiers);

    res.json({
      ocr_results: results,
      majority_vote: {
        name: votedName,
        hp: votedHp,
        set_id: votedSetId,
      },
      votes: {
        all_names: names,
        all_hps: hps,
        all_set_ids: setIdentifiers,
      },
    });
  } catch (err) {
    console.error("OCR route failed:", err);
    res.status(500).json({ error: "Failed to process OCR" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});