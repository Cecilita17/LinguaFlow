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
import { gatherAllHabitTrackerData } from './habitTrackerService.js';
import {
  requestDriveAccessToken,
  getOrCreateBackupFolder,
  uploadBackupFile,
  listBackupFiles,
  downloadBackupContent,
  downloadBackupPayload,
  isDriveConnected
} from './googleDriveService.js';

export const BACKUP_FORMAT = 'linguaflow-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const STORAGE_KEY_LAST_BACKUP = 'linguaflow_last_backup_meta';
export const STORAGE_KEY_LAST_BACKUP_FINGERPRINT = 'linguaflow_last_backup_fingerprint';

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
 * Reads the last successful backup fingerprint for a specific user from localStorage.
 * @param {string} userEmail
 * @returns {string|null}
 */
export function getLastSuccessfulFingerprint(userEmail) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && userEmail) {
      const raw = localStorage.getItem(`${STORAGE_KEY_LAST_BACKUP_FINGERPRINT}_${userEmail}`);
      return raw || null;
    }
  } catch (e) {}
  return null;
}

/**
 * Saves the last successful backup fingerprint for a specific user in localStorage.
 * @param {string} userEmail
 * @param {string} fingerprint
 */
export function saveLastSuccessfulFingerprint(userEmail, fingerprint) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && userEmail && fingerprint) {
      localStorage.setItem(`${STORAGE_KEY_LAST_BACKUP_FINGERPRINT}_${userEmail}`, fingerprint);
    }
  } catch (e) {}
}

/**
 * Fast deterministic canonical JSON stringifier for small objects or chunks.
 * Sorts object keys recursively to ensure consistent hashing across runs.
 * Note: Must ONLY be called on small objects or batches, NEVER on the entire backup payload!
 * 
 * @param {*} val
 * @returns {string}
 */
export function fastCanonicalJson(val) {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val !== 'object') {
    return JSON.stringify(val) ?? 'null';
  }
  if (Array.isArray(val)) {
    return '[' + val.map(fastCanonicalJson).join(',') + ']';
  }
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + fastCanonicalJson(val[k])).join(',') + '}';
}

// Backward-compatibility alias
export const canonicalStringify = fastCanonicalJson;

/**
 * Computes a SHA-256 hash (or FNV-1a fallback) for an individual string chunk.
 * 
 * @param {string} str
 * @returns {Promise<string>} Hex hash string
 */
async function hashStringChunk(str) {
  if (!str) return '0000000000000000';
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fall through to fast 64-bit FNV-1a hash
    }
  }

  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Removes transient timestamps (updatedAt, timestamp) from reading/audio positions.
 */
function cleanPosition(pos) {
  if (!pos || typeof pos !== 'object') return null;
  const { updatedAt, timestamp, ...rest } = pos;
  return rest;
}

async function hashSettings(settings) {
  if (!settings || typeof settings !== 'object') return 'empty';
  return await hashStringChunk(fastCanonicalJson(settings));
}

async function hashHabitTracker(habitTracker) {
  if (!habitTracker || typeof habitTracker !== 'object') return 'empty';
  return await hashStringChunk(fastCanonicalJson(habitTracker));
}

async function hashActiveSessions(activeSessions) {
  if (!activeSessions || typeof activeSessions !== 'object') return 'empty';
  const cleanActive = {
    textDraft: activeSessions.textDraft ? {
      ...activeSessions.textDraft,
      lastReadingPosition: cleanPosition(activeSessions.textDraft.lastReadingPosition),
      lastAudioPosition: cleanPosition(activeSessions.textDraft.lastAudioPosition)
    } : null,
    youtubeSession: activeSessions.youtubeSession || null
  };
  return await hashStringChunk(fastCanonicalJson(cleanActive));
}

async function hashSavedWords(savedWords) {
  if (!Array.isArray(savedWords) || savedWords.length === 0) return 'empty';
  const sorted = [...savedWords].sort((a, b) => {
    const keyA = String(a?.id || a?.word || '');
    const keyB = String(b?.id || b?.word || '');
    return keyA.localeCompare(keyB);
  });

  const chunkHashes = [];
  const CHUNK_SIZE = 100;
  for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
    const slice = sorted.slice(i, i + CHUNK_SIZE);
    chunkHashes.push(await hashStringChunk(fastCanonicalJson(slice)));
  }
  return await hashStringChunk(chunkHashes.join(':'));
}

async function hashChatHistory(chatHistory) {
  if (!chatHistory || typeof chatHistory !== 'object') return 'empty';
  const langs = Object.keys(chatHistory).sort();
  if (langs.length === 0) return 'empty';

  const langHashes = [];
  for (const lang of langs) {
    const messages = chatHistory[lang] || [];
    const msgChunkHashes = [];
    const CHUNK_SIZE = 50;
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const slice = messages.slice(i, i + CHUNK_SIZE);
      msgChunkHashes.push(await hashStringChunk(fastCanonicalJson(slice)));
    }
    const combinedMsgs = await hashStringChunk(msgChunkHashes.join(':'));
    langHashes.push(`${lang}=${combinedMsgs}`);
  }
  return await hashStringChunk(langHashes.join(';'));
}

async function hashCallHistory(callHistory) {
  if (!Array.isArray(callHistory) || callHistory.length === 0) return 'empty';
  const sorted = [...callHistory].sort((a, b) => {
    const keyA = String(a?.id || a?.startedAt || '');
    const keyB = String(b?.id || b?.startedAt || '');
    return keyA.localeCompare(keyB);
  });

  const chunkHashes = [];
  const CHUNK_SIZE = 50;
  for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
    const slice = sorted.slice(i, i + CHUNK_SIZE);
    chunkHashes.push(await hashStringChunk(fastCanonicalJson(slice)));
  }
  return await hashStringChunk(chunkHashes.join(':'));
}

async function hashCachedGlosses(cachedGlosses) {
  if (!cachedGlosses || typeof cachedGlosses !== 'object') return 'empty';
  const keys = Object.keys(cachedGlosses).sort();
  if (keys.length === 0) return 'empty';

  const entryHashes = [];
  for (const key of keys) {
    const entryHash = await hashStringChunk(key + '=' + fastCanonicalJson(cachedGlosses[key]));
    entryHashes.push(entryHash);
  }
  return await hashStringChunk(entryHashes.join(';'));
}

async function hashTextLibrary(textLibrary) {
  if (!Array.isArray(textLibrary) || textLibrary.length === 0) return 'empty';

  const sortedDocs = [...textLibrary].sort((a, b) => {
    const idA = String(a?.id || '');
    const idB = String(b?.id || '');
    return idA.localeCompare(idB);
  });

  const docHashes = [];
  for (const doc of sortedDocs) {
    if (!doc) continue;
    const { paragraphs = [], lastReadingPosition, lastAudioPosition, ...otherDocProps } = doc;
    const cleanDocMeta = {
      ...otherDocProps,
      lastReadingPosition: cleanPosition(lastReadingPosition),
      lastAudioPosition: cleanPosition(lastAudioPosition)
    };
    const metaHash = await hashStringChunk(fastCanonicalJson(cleanDocMeta));

    // Chunk paragraphs in small batches (50 per chunk) to avoid large contiguous allocations
    const paragraphChunkHashes = [];
    const CHUNK_SIZE = 50;
    for (let p = 0; p < paragraphs.length; p += CHUNK_SIZE) {
      const slice = paragraphs.slice(p, p + CHUNK_SIZE);
      paragraphChunkHashes.push(await hashStringChunk(fastCanonicalJson(slice)));
    }
    const paragraphsHash = paragraphChunkHashes.length > 0
      ? await hashStringChunk(paragraphChunkHashes.join(':'))
      : 'no_paragraphs';

    const docHash = await hashStringChunk(`${doc.id || 'noid'}|${metaHash}|${paragraphsHash}`);
    docHashes.push(docHash);
  }

  return await hashStringChunk(docHashes.join(';'));
}

async function hashYoutubeTranscripts(youtubeTranscripts) {
  if (!Array.isArray(youtubeTranscripts) || youtubeTranscripts.length === 0) return 'empty';

  const sortedTranscripts = [...youtubeTranscripts].sort((a, b) => {
    const idA = String(a?.videoId || a?.id || '');
    const idB = String(b?.videoId || b?.id || '');
    return idA.localeCompare(idB);
  });

  const transcriptHashes = [];
  for (const item of sortedTranscripts) {
    if (!item) continue;
    const { subtitles = [], segments = [], ...otherProps } = item;
    const lines = subtitles.length > 0 ? subtitles : segments;
    const metaHash = await hashStringChunk(fastCanonicalJson(otherProps));

    // Chunk subtitle lines in small batches (50 lines per chunk)
    const lineChunkHashes = [];
    const CHUNK_SIZE = 50;
    for (let s = 0; s < lines.length; s += CHUNK_SIZE) {
      const slice = lines.slice(s, s + CHUNK_SIZE);
      lineChunkHashes.push(await hashStringChunk(fastCanonicalJson(slice)));
    }
    const linesHash = lineChunkHashes.length > 0
      ? await hashStringChunk(lineChunkHashes.join(':'))
      : 'no_lines';

    const itemHash = await hashStringChunk(`${item.videoId || item.id || 'noid'}|${metaHash}|${linesHash}`);
    transcriptHashes.push(itemHash);
  }

  return await hashStringChunk(transcriptHashes.join(';'));
}

/**
 * Computes a deterministic composite SHA-256 fingerprint for a backup payload.
 * Processes data section-by-section and chunk-by-chunk without ever creating a monolithic string of the backup.
 * 
 * @param {object} payload
 * @returns {Promise<string|null>} Hex hash string, or null on unexpected failure
 */
export async function computePayloadFingerprint(payload) {
  try {
    if (!payload || !payload.data) return null;
    const data = payload.data;

    const [
      settingsHash,
      savedWordsHash,
      chatHistoryHash,
      callHistoryHash,
      habitTrackerHash,
      activeSessionsHash,
      cachedGlossesHash,
      textLibraryHash,
      youtubeTranscriptsHash
    ] = await Promise.all([
      hashSettings(data.settings),
      hashSavedWords(data.savedWords),
      hashChatHistory(data.chatHistory),
      hashCallHistory(data.callHistory),
      hashHabitTracker(data.habitTracker),
      hashActiveSessions(data.activeSessions),
      hashCachedGlosses(data.cachedGlosses),
      hashTextLibrary(data.textLibrary),
      hashYoutubeTranscripts(data.youtubeTranscripts)
    ]);

    const masterDescriptor = [
      `settings:${settingsHash}`,
      `savedWords:${savedWordsHash}`,
      `chatHistory:${chatHistoryHash}`,
      `callHistory:${callHistoryHash}`,
      `habitTracker:${habitTrackerHash}`,
      `activeSessions:${activeSessionsHash}`,
      `cachedGlosses:${cachedGlossesHash}`,
      `textLibrary:${textLibraryHash}`,
      `youtubeTranscripts:${youtubeTranscriptsHash}`
    ].join('|');

    return await hashStringChunk(masterDescriptor);
  } catch (err) {
    console.warn('[BackupService] computePayloadFingerprint error handled safely:', err);
    return null;
  }
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

    const callVoicePreferences = localStorage.getItem('linguaflow_call_voice_preferences');
    if (callVoicePreferences) {
      try {
        settings.callVoicePreferences = JSON.parse(callVoicePreferences);
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

  // 7. Chats, gloss caches, and habit tracker data
  const chatHistory = gatherChatHistory();
  const cachedGlosses = gatherCachedGlosses();
  const habitTracker = gatherAllHabitTrackerData();
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
      callSessionsCount: callHistory.length,
      habitTrackerKeysCount: Object.keys(habitTracker).length
    },
    data: {
      settings,
      savedWords,
      chatHistory,
      callHistory,
      habitTracker,
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
 * Safely serializes the backup payload into a Blob.
 * Uses compact JSON (avoiding 3x-5x indentation expansion).
 * If monolithic stringify fails or exceeds V8 memory limits,
 * safely falls back to chunked Blob serialization without throwing "Invalid string length".
 * 
 * @param {object} payload - Complete backup data structure
 * @returns {Blob} Valid JSON Blob
 */
export function serializeBackupToBlob(payload) {
  try {
    // Standard compact serialization (3x-5x smaller than pretty JSON)
    const jsonString = JSON.stringify(payload);
    return new Blob([jsonString], { type: 'application/json' });
  } catch (err) {
    console.warn('[BackupService] Monolithic JSON stringify failed, falling back to chunked Blob serialization:', err);
    try {
      const parts = [];
      parts.push('{"format":' + JSON.stringify(payload.format || BACKUP_FORMAT) + ',');
      parts.push('"version":' + JSON.stringify(payload.version || BACKUP_SCHEMA_VERSION) + ',');
      parts.push('"createdAt":' + JSON.stringify(payload.createdAt || new Date().toISOString()) + ',');
      parts.push('"appVersion":' + JSON.stringify(payload.appVersion || '1.0.0') + ',');
      parts.push('"user":' + JSON.stringify(payload.user || {}) + ',');
      parts.push('"counts":' + JSON.stringify(payload.counts || {}) + ',');
      parts.push('"data":{');

      const dataObj = payload.data || {};
      const dataKeys = Object.keys(dataObj);

      for (let i = 0; i < dataKeys.length; i++) {
        const key = dataKeys[i];
        parts.push(JSON.stringify(key) + ':');
        const val = dataObj[key];

        if (Array.isArray(val)) {
          parts.push('[');
          for (let j = 0; j < val.length; j++) {
            parts.push(JSON.stringify(val[j]));
            if (j < val.length - 1) parts.push(',');
          }
          parts.push(']');
        } else if (val && typeof val === 'object') {
          const subKeys = Object.keys(val);
          parts.push('{');
          for (let k = 0; k < subKeys.length; k++) {
            const subKey = subKeys[k];
            parts.push(JSON.stringify(subKey) + ':' + JSON.stringify(val[subKey]));
            if (k < subKeys.length - 1) parts.push(',');
          }
          parts.push('}');
        } else {
          parts.push(JSON.stringify(val));
        }

        if (i < dataKeys.length - 1) parts.push(',');
      }

      parts.push('}}');
      return new Blob(parts, { type: 'application/json' });
    } catch (chunkErr) {
      console.error('[BackupService] Chunked serialization failed:', chunkErr);
      throw new Error('La cantidad de datos acumulados es demasiado grande para la memoria del navegador. Cierra pestañas no utilizadas e intenta nuevamente.');
    }
  }
}

/**
 * Performs a complete manual backup: generates payload, obtains Google Drive authorization,
 * locates or creates "LinguaFlow Backups" folder, and uploads the JSON file as a stream/blob.
 * 
 * @param {object} user - Current authenticated user
 * @param {function} onProgress - Progress status callback
 * @returns {Promise<object>} Uploaded file result and local metadata
 */
export async function performManualBackup(user, onProgress = () => {}) {
  if (!user || !user.email) {
    throw new Error('Debes iniciar sesión con Google antes de realizar una copia de seguridad.');
  }

  try {
    // 1. Authorize Google Drive
    onProgress({ step: 'auth', message: 'Conectando con Google Drive...' });
    const accessToken = await requestDriveAccessToken(user.email);

    // 2. Prepare payload
    onProgress({ step: 'preparing', message: 'Recopilando datos y biblioteca...' });
    const backupPayload = await createBackupPayload(user);
    const backupBlob = serializeBackupToBlob(backupPayload);

    // 3. Locate or create backup folder
    onProgress({ step: 'folder', message: 'Verificando carpeta en Google Drive...' });
    const folderId = await getOrCreateBackupFolder(accessToken);

    // 4. Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `linguaflow-backup-${dateStr}.json`;

    // 5. Upload file (streams blob natively, using resumable upload if large)
    onProgress({ step: 'uploading', message: 'Subiendo copia a Google Drive...' });
    const uploadResult = await uploadBackupFile(accessToken, folderId, fileName, backupBlob);

    // 6. Save metadata of last successful backup and update fingerprint
    const lastBackupMeta = {
      fileId: uploadResult.id,
      fileName: uploadResult.name,
      createdAt: now.toISOString(),
      size: uploadResult.size || backupBlob.size,
      counts: backupPayload.counts
    };
    saveLastBackupMeta(lastBackupMeta);

    try {
      const fingerprint = await computePayloadFingerprint(backupPayload);
      if (fingerprint) {
        saveLastSuccessfulFingerprint(user.email, fingerprint);
      }
    } catch (fpErr) {
      console.warn('[BackupService] Failed to compute/save fingerprint after manual backup:', fpErr);
    }

    onProgress({ step: 'done', message: 'Copia de seguridad completada con éxito.' });
    return lastBackupMeta;
  } catch (err) {
    if (err && err.name === 'RangeError' && /Invalid string length/i.test(err.message)) {
      throw new Error('El tamaño total del backup excede la capacidad de memoria contigua del navegador. Intenta reiniciar la pestaña para liberar memoria.');
    }
    throw err;
  }
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
  try {
    return await downloadBackupPayload(accessToken, fileId);
  } catch (err) {
    const rawText = await downloadBackupContent(accessToken, fileId);
    return JSON.parse(rawText);
  }
}
