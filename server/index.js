import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleHealth, handleLanguages, handleChat, handleLookupWord } from './handlers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes supported both with /api prefix and without
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

app.get('/api/languages', handleLanguages);
app.get('/languages', handleLanguages);

app.post('/api/chat', handleChat);
app.post('/chat', handleChat);

app.post('/api/lookup-word', handleLookupWord);
app.post('/lookup-word', handleLookupWord);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 LinguaFlow Server running on http://localhost:${PORT}`);
  });
}

export default app;
