/**
 * src/services/backupService.js
 * 
 * Collects, packages, and executes manual backups of LinguaFlow.
 * Gathers persistent data from:
 * - IndexedDB Text Documents (LinguaFlow_TextDocuments_DB)
 * - IndexedDB YouTube Transcripts (LinguaFlow_Transcripts_DB)
 * - localStorage user learning data & preferences
 * 
 * STRICT SECURITY:
 * Never includes session tokens, Google auth tokens, or API keys.
 */

import { getAllTextDocuments } from './textLibraryStorage.js';
import { getAllSavedTranscripts } from './transcriptLibraryStorage.js';
import {
  requestDriveAccessToken,
  getOrCreateBackupFolder,
  uploadBackupFile,
  listBackupFiles,
  downloadBackupContent,
  isDriveConnected
} from './googleDriveService.js';

export const BACKUP_FORMAT = 'linguaflow-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const STORAGE_KEY_LAST_BACKUP = 'linguaflow_last_backup_meta';

/**
 * Reads metadata of the last successful backup stored locally.
 */
export function getLastBackupMeta() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_BACKUP);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

/**
 * Saves metadata of the last successful backup.
 */
export function saveLastBackupMeta(meta) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_LAST_BACKUP, JSON.stringify(meta));
    }
  } catch (e) {}
}

/**
 * Gathers all chat conversations from localStorage (keys matching 'linguaflow_chat_*').
 */
function gatherChatHistory() {
  const chatHistory = {};
  if (typeof window === 'undefined' || !window.localStorage) return chatHistory;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('linguaflow_chat_')) {
        const langCode = key.replace('linguaflow_chat_', '');
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              chatHistory[langCode] = parsed;
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return chatHistory;
}

/**
 * Gathers cached YouTube gloss maps from localStorage (keys matching 'linguaflow_yt_gloss_v3_*').
 */
function gatherCachedGlosses() {
  const glossMap = {};
  if (typeof window === 'undefined' || !window.localStorage) return glossMap;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('linguaflow_yt_gloss_v3_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            glossMap[key] = JSON.parse(raw);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return glossMap;
}

/**
 * Gathers user settings and preferences, stripping all sensitive secrets and tokens.
 */
function gatherCleanSettings() {
  const settings = {
    siteLang: 'es',
    targetLang: 'pl',
    nativeLang: 'es',
    theme: 'system',
    speechRate: 1.0,
    autoPlayAi: false,
    autoPlayTextReader: false,
    config: {
      provider: 'groq',
      level: 'A2/B1',
      speechRate: 0.95
    }
  };

  if (typeof window === 'undefined' || !window.localStorage) return settings;

  try {
    const siteLang = localStorage.getItem('linguaflow_site_lang');
    if (siteLang) settings.siteLang = siteLang;

    const targetLang = localStorage.getItem('linguaflow_target_lang');
    if (targetLang) settings.targetLang = targetLang;

    const nativeLang = localStorage.getItem('linguaflow_native_lang');
    if (nativeLang) settings.nativeLang = nativeLang;

    const theme = localStorage.getItem('linguaflow-theme');
    if (theme) settings.theme = theme;

    const speechRate = localStorage.getItem('linguaflow_global_speech_rate');
    if (speechRate) settings.speechRate = parseFloat(speechRate) || 1.0;

    const autoPlayAi = localStorage.getItem('linguaflow_auto_play_ai');
    if (autoPlayAi !== null) settings.autoPlayAi = autoPlayAi === 'true';

    const autoPlayReader = localStorage.getItem('linguaflow_auto_play_text_reader');
    if (autoPlayReader !== null) settings.autoPlayTextReader = autoPlayReader === 'true';

    const configRaw = localStorage.getItem('linguaflow_config');
    if (configRaw) {
      try {
        const parsed = JSON.parse(configRaw);
        // Strictly omit any apiKey!
        settings.config = {
          provider: parsed.provider || 'groq',
          level: parsed.level || 'A2/B1',
          speechRate: parsed.speechRate || 0.95
        };
      } catch (e) {}
    }
  } catch (e) {}

  return settings;
}

/**
 * Creates the complete portable, versioned LinguaFlow backup payload.
 * 
 * @param {object} user - Current authenticated user
 * @returns {Promise<object>} Complete backup data object
 */
export async function createBackupPayload(user = null) {
  // 1. IndexedDB Text Documents
  const textLibrary = await getAllTextDocuments();

  // 2. IndexedDB YouTube Transcripts
  const youtubeTranscripts = await getAllSavedTranscripts();

  // 3. Saved Words from localStorage
  let savedWords = [];
  try {
    const rawWords = localStorage.getItem('linguaflow_saved_words');
    if (rawWords) savedWords = JSON.parse(rawWords);
  } catch (e) {}

  // 4. Call history
  let callHistory = [];
  try {
    const rawCalls = localStorage.getItem('linguaflow_call_history');
    if (rawCalls) callHistory = JSON.parse(rawCalls);
  } catch (e) {}

  // 5. Active Text Reader Draft (Minimal session metadata)
  let activeTextDraft = null;
  try {
    const rawActiveDoc = localStorage.getItem('linguaflow_active_text_doc_v1');
    if (rawActiveDoc) {
      const parsed = JSON.parse(rawActiveDoc);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.paragraphs)) {
          // Compact legacy bloated draft if found
          activeTextDraft = {
            id: parsed.id || null,
            title: parsed.title || '',
            author: parsed.author || '',
            sourceType: parsed.sourceType || parsed.format || 'txt',
            format: parsed.format || parsed.sourceType || 'txt',
            targetLang: parsed.targetLang || 'zh',
            nativeLang: parsed.nativeLang || 'es',
            paragraphsCount: parsed.paragraphs.length,
            lastAudioPosition: parsed.lastAudioPosition || null,
            lastReadingPosition: parsed.lastReadingPosition || null,
            createdAt: parsed.createdAt || null,
            updatedAt: parsed.updatedAt || null,
            isMinimalDraft: true
          };
        } else {
          activeTextDraft = parsed;
        }
      }
    }
  } catch (e) {}

  // 6. Active YouTube Session
  let activeYoutubeSession = null;
  try {
    const rawYtSession = localStorage.getItem('linguaflow_yt_session_v1');
    if (rawYtSession) activeYoutubeSession = JSON.parse(rawYtSession);
  } catch (e) {}

  // 7. Chats and gloss caches
  const chatHistory = gatherChatHistory();
  const cachedGlosses = gatherCachedGlosses();
  const settings = gatherCleanSettings();

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: '1.0.0',
    user: {
      email: user?.email || '',
      displayName: user?.displayName || ''
    },
    counts: {
      textDocumentsCount: textLibrary.length,
      youtubeTranscriptsCount: youtubeTranscripts.length,
      savedWordsCount: savedWords.length,
      chatConversationsCount: Object.keys(chatHistory).length,
      callSessionsCount: callHistory.length
    },
    data: {
      settings,
      savedWords,
      chatHistory,
      callHistory,
      activeSessions: {
        textDraft: activeTextDraft,
        youtubeSession: activeYoutubeSession
      },
      cachedGlosses,
      textLibrary,
      youtubeTranscripts
    }
  };
}

/**
 * Performs a complete manual backup: generates payload, obtains Google Drive authorization,
 * locates or creates "LinguaFlow Backups" folder, and uploads the JSON file.
 * 
 * @param {object} user - Current authenticated user
 * @param {function} onProgress - Progress status callback
 * @returns {Promise<object>} Uploaded file result and local metadata
 */
export async function performManualBackup(user, onProgress = () => {}) {
  if (!user || !user.email) {
    throw new Error('Debes iniciar sesión con Google antes de realizar una copia de seguridad.');
  }

  // 1. Authorize Google Drive
  onProgress({ step: 'auth', message: 'Conectando con Google Drive...' });
  const accessToken = await requestDriveAccessToken(user.email);

  // 2. Prepare payload
  onProgress({ step: 'preparing', message: 'Recopilando datos y biblioteca...' });
  const backupPayload = await createBackupPayload(user);
  const jsonString = JSON.stringify(backupPayload, null, 2);

  // 3. Locate or create backup folder
  onProgress({ step: 'folder', message: 'Verificando carpeta en Google Drive...' });
  const folderId = await getOrCreateBackupFolder(accessToken);

  // 4. Generate filename with date
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `linguaflow-backup-${dateStr}.json`;

  // 5. Upload file
  onProgress({ step: 'uploading', message: 'Subiendo copia a Google Drive...' });
  const uploadResult = await uploadBackupFile(accessToken, folderId, fileName, jsonString);

  // 6. Save metadata of last successful backup
  const lastBackupMeta = {
    fileId: uploadResult.id,
    fileName: uploadResult.name,
    createdAt: now.toISOString(),
    size: uploadResult.size || jsonString.length,
    counts: backupPayload.counts
  };
  saveLastBackupMeta(lastBackupMeta);

  onProgress({ step: 'done', message: 'Copia de seguridad completada con éxito.' });
  return lastBackupMeta;
}

/**
 * Fetches available backups from Google Drive folder.
 * 
 * @param {string} userEmail
 * @returns {Promise<Array<object>>}
 */
export async function getAvailableBackups(userEmail) {
  const accessToken = await requestDriveAccessToken(userEmail);
  const folderId = await getOrCreateBackupFolder(accessToken);
  return await listBackupFiles(accessToken, folderId);
}

/**
 * Downloads a backup from Google Drive.
 * 
 * @param {string} userEmail
 * @param {string} fileId
 * @returns {Promise<object>} Parsed backup payload
 */
export async function fetchBackupPayload(userEmail, fileId) {
  const accessToken = await requestDriveAccessToken(userEmail);
  const rawText = await downloadBackupContent(accessToken, fileId);
  return JSON.parse(rawText);
}
