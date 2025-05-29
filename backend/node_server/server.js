import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
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

app.listen(PORT, HOST, () => {
  console.log(`Server is running at http://${HOST}:${PORT}`);
});