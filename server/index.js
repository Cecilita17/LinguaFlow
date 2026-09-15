import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleHealth, handleLanguages, handleChat, handlePedagogicalCorrect, handleLookupWord, handleTranscribe, handleSentenceBreakdown, handleBatchGloss } from './handlers.js';
import { handleGoogleAuth, handleGetSession, handleLogout } from './authHandlers.js';
import { handleRealtimeSession } from './realtimeHandlers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth Routes (Backend-verified Google OAuth & Session Management)
app.post('/api/auth/google', handleGoogleAuth);
app.post('/auth/google', handleGoogleAuth);

app.get('/api/auth/me', handleGetSession);
app.get('/auth/me', handleGetSession);

app.post('/api/auth/logout', handleLogout);
app.post('/auth/logout', handleLogout);

// Routes supported both with /api prefix and without
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

app.get('/api/languages', handleLanguages);
app.get('/languages', handleLanguages);

app.post('/api/chat', handleChat);
app.post('/chat', handleChat);

app.post('/api/pedagogical-correct', handlePedagogicalCorrect);
app.post('/pedagogical-correct', handlePedagogicalCorrect);

app.post('/api/lookup-word', handleLookupWord);
app.post('/lookup-word', handleLookupWord);

app.post('/api/transcribe', handleTranscribe);
app.post('/transcribe', handleTranscribe);

app.post('/api/sentence-breakdown', handleSentenceBreakdown);
app.post('/sentence-breakdown', handleSentenceBreakdown);

app.post('/api/batch-gloss', handleBatchGloss);
app.post('/batch-gloss', handleBatchGloss);

// OpenAI Realtime WebRTC Session creation
app.post('/api/realtime/session', handleRealtimeSession);
app.post('/realtime/session', handleRealtimeSession);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 LinguaFlow Server running on http://localhost:${PORT}`);
  });
}

export default app;
