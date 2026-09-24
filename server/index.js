import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleHealth, handleLanguages, handleChat, handlePedagogicalCorrect, handleLookupWord, handleTranscribe, handleTranscribeTicket, handleSentenceBreakdown, handleBatchGloss, handleGenerateText, handleTranslateText, handleAudioStream, handleImageDescription } from './handlers.js';
import { handleGoogleAuth, handleGetSession, handleLogout } from './authHandlers.js';
import { handlePipelineChatStream, handlePipelineTTS, handleListCartesiaVoices } from './pipelineHandlers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '35mb' }));

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

app.post('/api/transcribe-ticket', handleTranscribeTicket);
app.post('/transcribe-ticket', handleTranscribeTicket);

app.post('/api/transcribe', handleTranscribe);
app.post('/transcribe', handleTranscribe);

app.get('/api/audio-stream', handleAudioStream);
app.get('/audio-stream', handleAudioStream);
app.head('/api/audio-stream', handleAudioStream);
app.head('/audio-stream', handleAudioStream);

app.post('/api/sentence-breakdown', handleSentenceBreakdown);
app.post('/sentence-breakdown', handleSentenceBreakdown);

app.post('/api/batch-gloss', handleBatchGloss);
app.post('/batch-gloss', handleBatchGloss);

app.post('/api/generate-text', handleGenerateText);
app.post('/generate-text', handleGenerateText);

app.post('/api/translate-text', handleTranslateText);
app.post('/translate-text', handleTranslateText);

app.post('/api/image-description', handleImageDescription);
app.post('/image-description', handleImageDescription);

// Voice Call Endpoints (Pipeline Architecture: STT + Groq LLM + Cartesia Sonic TTS)
app.post('/api/pipeline/chat-stream', handlePipelineChatStream);
app.post('/pipeline/chat-stream', handlePipelineChatStream);

app.post('/api/pipeline/tts', handlePipelineTTS);
app.post('/pipeline/tts', handlePipelineTTS);

app.get('/api/pipeline/voices', handleListCartesiaVoices);
app.get('/pipeline/voices', handleListCartesiaVoices);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 LinguaFlow Server running on http://localhost:${PORT}`);
  });
}

export default app;
