import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { performOCRFromBuffer } from "./ocr/ocr.js";

const app = express();
const port = 3001;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Pokémon Card Price Checker Backend is Running!');
});

app.post('/predict', upload.single('file'), async (req, res) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(req.file.path));

  try {
    const response = await fetch('http://0.0.0.0:5000/predict', {
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

    for (const file of req.files) {
      const buffer = fs.readFileSync(file.path);
      const text = await performOCRFromBuffer(buffer);
      results.push({ filename: file.originalname, text });

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
      let foundHp = numbers.length > 0 ? Math.max(...numbers) : null;

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

    res.json({
      ocr_results: results,
      majority_vote: {
        name: votedName,
        hp: votedHp,
      },
      votes: {
        all_names: names,
        all_hps: hps,
      },
    });
  } catch (err) {
    console.error("OCR route failed:", err);
    res.status(500).json({ error: "Failed to process OCR" });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on: ${port}`);
});
