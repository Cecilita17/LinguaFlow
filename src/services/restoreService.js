/**
 * src/services/restoreService.js
 * 
 * Validates and restores LinguaFlow backups from portable JSON payloads.
 * Restores:
 * - IndexedDB Text Documents via saveTextDocument()
 * - IndexedDB YouTube Transcripts via saveTranscriptToLibrary()
 * - localStorage user learning data & settings
 * 
 * ATOMIC INTEGRITY GUARANTEE:
 * If a backup is invalid, malformed, or has an incompatible version,
 * validation fails immediately and ZERO local data is touched or removed.
 */

import { saveTextDocument } from './textLibraryStorage.js';
import { saveTranscriptToLibrary } from './transcriptLibraryStorage.js';
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION } from './backupService.js';

/**
 * Validates the backup payload structure and version.
 * Throws a descriptive error if invalid or incompatible.
 * 
 * @param {object} payload - Parsed backup JSON
 * @returns {boolean} True if valid
 */
export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('El archivo de copia de seguridad no es un objeto JSON válido.');
  }

  if (payload.format !== BACKUP_FORMAT) {
    throw new Error(`Formato de copia desconocido o no compatible ("${payload.format || 'ninguno'}"). Debe ser "${BACKUP_FORMAT}".`);
  }

  if (typeof payload.version !== 'number' || payload.version > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Versión de copia no compatible (${payload.version}). La versión máxima soportada es ${BACKUP_SCHEMA_VERSION}.`);
  }

  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('El archivo de copia no contiene la sección principal de datos ("data").');
  }

  return true;
}

/**
 * Restores all components from a verified backup payload into their corresponding stores.
 * 
 * @param {object} payload - Verified backup object
 * @returns {Promise<object>} Summary of restored items
 */
export async function restoreBackupData(payload) {
  validateBackupPayload(payload);

  const { data } = payload;
  const summary = {
    textDocumentsRestored: 0,
    youtubeTranscriptsRestored: 0,
    savedWordsRestored: 0,
    chatConversationsRestored: 0,
    settingsRestored: false
  };

  // 1. Restore IndexedDB Text Documents
  if (Array.isArray(data.textLibrary) && data.textLibrary.length > 0) {
    for (const doc of data.textLibrary) {
      if (doc && doc.id) {
        try {
          await saveTextDocument(doc);
          summary.textDocumentsRestored++;
        } catch (err) {
          console.warn('[RestoreService] Error restoring text document:', doc.id, err);
        }
      }
    }
  }

  // 2. Restore IndexedDB YouTube Transcripts
  if (Array.isArray(data.youtubeTranscripts) && data.youtubeTranscripts.length > 0) {
    for (const transcript of data.youtubeTranscripts) {
      if (transcript && transcript.videoId && Array.isArray(transcript.subtitles)) {
        try {
          await saveTranscriptToLibrary(transcript);
          summary.youtubeTranscriptsRestored++;
        } catch (err) {
          console.warn('[RestoreService] Error restoring YouTube transcript:', transcript.id, err);
        }
      }
    }
  }

  // 3. Restore localStorage: Saved Words
  if (Array.isArray(data.savedWords)) {
    try {
      localStorage.setItem('linguaflow_saved_words', JSON.stringify(data.savedWords));
      summary.savedWordsRestored = data.savedWords.length;
    } catch (e) {}
  }

  // 4. Restore localStorage: Call History
  if (Array.isArray(data.callHistory)) {
    try {
      localStorage.setItem('linguaflow_call_history', JSON.stringify(data.callHistory));
    } catch (e) {}
  }

  // 5. Restore localStorage: Chat conversations
  if (data.chatHistory && typeof data.chatHistory === 'object') {
    Object.entries(data.chatHistory).forEach(([langCode, messages]) => {
      if (Array.isArray(messages) && messages.length > 0) {
        try {
          localStorage.setItem(`linguaflow_chat_${langCode}`, JSON.stringify(messages));
          summary.chatConversationsRestored++;
        } catch (e) {}
      }
    });
  }

  // 6. Restore localStorage: Active drafts / sessions
  if (data.activeSessions && typeof data.activeSessions === 'object') {
    if (data.activeSessions.textDraft) {
      try {
        localStorage.setItem('linguaflow_active_text_doc_v1', JSON.stringify(data.activeSessions.textDraft));
      } catch (e) {}
    }
    if (data.activeSessions.youtubeSession) {
      try {
        localStorage.setItem('linguaflow_yt_session_v1', JSON.stringify(data.activeSessions.youtubeSession));
      } catch (e) {}
    }
  }

  // 7. Restore localStorage: Cached glosses
  if (data.cachedGlosses && typeof data.cachedGlosses === 'object') {
    Object.entries(data.cachedGlosses).forEach(([key, glossMap]) => {
      try {
        localStorage.setItem(key, JSON.stringify(glossMap));
      } catch (e) {}
    });
  }

  // 8. Restore localStorage: User settings (preserving existing auth tokens and API keys)
  if (data.settings && typeof data.settings === 'object') {
    const s = data.settings;
    try {
      if (s.siteLang) localStorage.setItem('linguaflow_site_lang', s.siteLang);
      if (s.targetLang) localStorage.setItem('linguaflow_target_lang', s.targetLang);
      if (s.nativeLang) localStorage.setItem('linguaflow_native_lang', s.nativeLang);
      if (s.theme) localStorage.setItem('linguaflow-theme', s.theme);
      if (s.speechRate) localStorage.setItem('linguaflow_global_speech_rate', String(s.speechRate));
      if (typeof s.autoPlayAi === 'boolean') {
        localStorage.setItem('linguaflow_auto_play_ai', s.autoPlayAi ? 'true' : 'false');
      }
      if (typeof s.autoPlayTextReader === 'boolean') {
        localStorage.setItem('linguaflow_auto_play_text_reader', s.autoPlayTextReader ? 'true' : 'false');
      }

      // Merge config carefully: preserve existing client apiKey if present in local storage
      if (s.config && typeof s.config === 'object') {
        let currentApiKey = '';
        try {
          const currentConfigRaw = localStorage.getItem('linguaflow_config');
          if (currentConfigRaw) {
            const parsed = JSON.parse(currentConfigRaw);
            currentApiKey = parsed.apiKey || '';
          }
        } catch (_) {}

        const mergedConfig = {
          provider: s.config.provider || 'groq',
          level: s.config.level || 'A2/B1',
          speechRate: s.config.speechRate || 0.95,
          apiKey: currentApiKey
        };
        localStorage.setItem('linguaflow_config', JSON.stringify(mergedConfig));
      }

      summary.settingsRestored = true;
    } catch (e) {}
  }

  return summary;
}
