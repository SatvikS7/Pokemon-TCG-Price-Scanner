import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
const { performOCRFromBuffer } = require("./ocr/ocr");


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
    const response = await fetch('http://localhost:5000/predict', {
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

    for (const file of req.files) {
      const buffer = fs.readFileSync(file.path);
      const text = await performOCRFromBuffer(buffer);
      results.push({ filename: file.originalname, text });

      fs.unlinkSync(file.path); // cleanup
    }

    res.json({ ocr_results: results });
  } catch (err) {
    console.error("OCR route failed:", err);
    res.status(500).json({ error: "Failed to process OCR" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
