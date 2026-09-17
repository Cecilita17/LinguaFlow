/**
 * Persistent Transcript & Gloss Library Storage (IndexedDB)
 * 
 * Provides robust, persistent storage for full subtitle transcripts, AI-generated glosses,
 * Pinyin/auxiliary fields, timestamps, and metadata.
 * Survives video switches, browser restarts, and page refreshes.
 * Ensures zero-cost ($0) Groq reuse for previously processed content.
 */

const DB_NAME = 'LinguaFlow_Transcripts_DB';
const DB_VERSION = 1;
const STORE_NAME = 'saved_transcripts';
const SHARED_PLAYBACK_STORAGE_KEY = 'linguaflow_yt_playback_positions_v1';

// In-memory fallback if IndexedDB is blocked or running in SSR / testing environment
const memoryStore = new Map();
// In-memory fallback for shared video playback positions
const sharedPlaybackMemory = new Map();

/**
 * Retrieves the shared playback position for a given videoId across all languages.
 * @param {string} videoId
 * @returns {{ videoId: string, lastPlaybackTime: number, lastSubtitleId: string|null, updatedAt: string } | null}
 */
export function getSharedPlaybackPosition(videoId) {
  if (!videoId) return null;
  const cleanId = String(videoId).trim();
  
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SHARED_PLAYBACK_STORAGE_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        if (map && map[cleanId]) {
          return map[cleanId];
        }
      }
    } catch (e) {
      // Fall back to memory
    }
  }
  return sharedPlaybackMemory.get(cleanId) || null;
}

/**
 * Saves or updates the shared playback position for a given videoId.
 * @param {string} videoId
 * @param {string|null} subtitleHash
 * @param {number} playbackTime
 * @param {string|null} subtitleId
 */
export function saveSharedPlaybackPosition(videoId, subtitleHash = null, playbackTime = 0, subtitleId = null) {
  if (!videoId) return;
  const cleanId = String(videoId).trim();
  const time = typeof playbackTime === 'number' && !isNaN(playbackTime) ? Math.max(0, playbackTime) : 0;
  const subId = subtitleId ? String(subtitleId) : null;
  const now = new Date().toISOString();

  const posData = {
    videoId: cleanId,
    subtitleHash: subtitleHash || null,
    lastPlaybackTime: time,
    lastSubtitleId: subId,
    updatedAt: now
  };

  sharedPlaybackMemory.set(cleanId, posData);

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SHARED_PLAYBACK_STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[cleanId] = {
        ...map[cleanId],
        ...posData
      };
      localStorage.setItem(SHARED_PLAYBACK_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('[TranscriptLibrary] Failed to save shared playback position:', e);
    }
  }
}

/**
 * Computes a fast, stable 32-bit FNV-1a hash from subtitle lines.
 * Guarantees that identical subtitle files/texts produce the exact same hash,
 * while any edit or different file produces a distinct hash.
 * 
 * @param {Array} subtitles - Array of subtitle line objects
 * @returns {string} 8-character hex hash string
 */
export function computeSubtitleHash(subtitles = []) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return 'empty';

  let str = subtitles
    .map(s => `${s.id || ''}:${Math.round((s.startTime || 0) * 100)}:${(s.text || '').trim()}`)
    .join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates compound key for a saved transcript.
 */
export function getLibraryKey(videoId = 'generic', subtitleHash = 'nohash', targetLang = 'zh') {
  const cleanId = (videoId || 'generic').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${cleanId}_${subtitleHash}_${targetLang}`;
}

/**
 * Parses a compound library key into its component parts: { videoId, subtitleHash, targetLang }.
 * Accurately supports videoIds containing hyphens and underscores.
 * 
 * @param {string} compoundKey
 * @returns {{ videoId: string, subtitleHash: string, targetLang: string }}
 */
export function parseLibraryKey(compoundKey) {
  if (!compoundKey) return { videoId: '', subtitleHash: '', targetLang: '' };
  const str = String(compoundKey).trim();
  const lastUnderscore = str.lastIndexOf('_');
  if (lastUnderscore === -1) return { videoId: str, subtitleHash: '', targetLang: '' };

  const targetLang = str.slice(lastUnderscore + 1);
  const remaining = str.slice(0, lastUnderscore);
  const secondLastUnderscore = remaining.lastIndexOf('_');
  if (secondLastUnderscore === -1) {
    return { videoId: remaining, subtitleHash: '', targetLang };
  }

  const subtitleHash = remaining.slice(secondLastUnderscore + 1);
  const videoId = remaining.slice(0, secondLastUnderscore);

  return { videoId: videoId || str, subtitleHash, targetLang };
}

/**
 * Checks if IndexedDB is available in the current environment.
 */
function isIndexedDBAvailable() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Opens and initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase|null>}
 */
function openDatabase() {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('videoId', 'videoId', { unique: false });
          store.createIndex('targetLanguage', 'targetLanguage', { unique: false });
          store.createIndex('subtitleHash', 'subtitleHash', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.warn('[TranscriptLibrary] Failed to open IndexedDB:', event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[TranscriptLibrary] Exception opening IndexedDB:', err);
      resolve(null);
    }
  });
}

/**
 * Save or update a transcript record in the persistent library.
 * 
 * @param {Object} record
 * @returns {Promise<boolean>}
 */
export async function saveTranscriptToLibrary(record) {
  if (!record || !record.videoId || !Array.isArray(record.subtitles)) {
    return false;
  }

  const cleanVideoId = String(record.videoId).trim();
  const targetLang = record.targetLanguage || record.targetLang || 'zh';
  const subHash = record.subtitleHash || computeSubtitleHash(record.subtitles);
  const id = record.id || getLibraryKey(cleanVideoId, subHash, targetLang);

  const existingMemory = memoryStore.get(id);
  const sharedPos = getSharedPlaybackPosition(cleanVideoId);

  // Preserve existing lastPlaybackTime / lastSubtitleId or use shared playback position
  let effectivePlaybackTime = 0;
  if (typeof record.lastPlaybackTime === 'number' && !isNaN(record.lastPlaybackTime)) {
    effectivePlaybackTime = Math.max(0, record.lastPlaybackTime);
  } else if (typeof existingMemory?.lastPlaybackTime === 'number') {
    effectivePlaybackTime = existingMemory.lastPlaybackTime;
  } else if (sharedPos && typeof sharedPos.lastPlaybackTime === 'number') {
    effectivePlaybackTime = sharedPos.lastPlaybackTime;
  }

  // If incoming was 0 but shared had progress, preserve shared progress
  if (effectivePlaybackTime === 0 && sharedPos && typeof sharedPos.lastPlaybackTime === 'number' && sharedPos.lastPlaybackTime > 0) {
    effectivePlaybackTime = sharedPos.lastPlaybackTime;
  }

  const effectiveSubtitleId = record.lastSubtitleId !== undefined
    ? (record.lastSubtitleId ? String(record.lastSubtitleId) : null)
    : (existingMemory?.lastSubtitleId || sharedPos?.lastSubtitleId || null);

  if (effectivePlaybackTime > 0 || effectiveSubtitleId) {
    saveSharedPlaybackPosition(cleanVideoId, subHash, effectivePlaybackTime, effectiveSubtitleId);
  }

  const cleanRecord = {
    id,
    videoId: cleanVideoId,
    videoTitle: record.videoTitle || `YouTube Video (${cleanVideoId})`,
    videoUrl: record.videoUrl || `https://www.youtube.com/watch?v=${cleanVideoId}`,
    targetLanguage: targetLang,
    nativeLanguage: record.nativeLanguage || record.nativeLang || 'es',
    sourceType: record.sourceType || 'srt',
    subtitleHash: subHash,
    subtitlesCount: record.subtitles.length,
    completedLinesCount: record.completedLinesCount || record.subtitles.filter(s => s.tokens && s.tokens.some(t => t.gloss)).length,
    isComplete: Boolean(record.isComplete),
    format: record.format || 'srt',
    subtitles: record.subtitles,
    lastPlaybackTime: effectivePlaybackTime,
    lastSubtitleId: effectiveSubtitleId,
    lastUpdatedAt: record.lastUpdatedAt || new Date().toISOString(),
    createdAt: record.createdAt || existingMemory?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Always update in-memory fallback
  memoryStore.set(id, cleanRecord);

  const db = await openDatabase();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cleanRecord);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => {
        console.warn('[TranscriptLibrary] Error saving to IndexedDB:', e.target.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('[TranscriptLibrary] Exception saving to IndexedDB:', err);
      resolve(false);
    }
  });
}

/**
 * Fast, lightweight updater for last playback position and subtitle marker.
 * Persists lastPlaybackTime and lastSubtitleId across all target languages for this video.
 * 
 * @param {string} idOrVideoId - Transcript record ID (e.g. videoId_hash_targetLang) or raw videoId
 * @param {number} playbackTime - Current playback time in seconds
 * @param {string|null} subtitleId - Active subtitle line ID
 * @returns {Promise<boolean>}
 */
export async function updateTranscriptPlaybackPosition(idOrVideoId, playbackTime, subtitleId = null) {
  if (!idOrVideoId) return false;
  const time = typeof playbackTime === 'number' && !isNaN(playbackTime) ? Math.max(0, playbackTime) : 0;
  const subId = subtitleId ? String(subtitleId) : null;
  const now = new Date().toISOString();

  const mem = memoryStore.get(idOrVideoId);
  const cleanVideoId = mem?.videoId || parseLibraryKey(idOrVideoId).videoId || String(idOrVideoId).trim();

  // 1. Save to shared playback storage
  saveSharedPlaybackPosition(cleanVideoId, null, time, subId);

  // 2. Update memoryStore for all records matching this videoId or exact ID
  for (const [key, item] of memoryStore.entries()) {
    if (key === idOrVideoId || item.videoId === cleanVideoId) {
      item.lastPlaybackTime = time;
      item.lastSubtitleId = subId;
      item.lastUpdatedAt = now;
      item.updatedAt = now;
    }
  }

  // 3. Persist to IndexedDB
  const db = await openDatabase();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      if (store.indexNames.contains('videoId')) {
        const index = store.index('videoId');
        const req = index.openCursor(IDBKeyRange.only(cleanVideoId));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const record = cursor.value;
            record.lastPlaybackTime = time;
            record.lastSubtitleId = subId;
            record.lastUpdatedAt = now;
            record.updatedAt = now;
            cursor.update(record);
            cursor.continue();
          }
        };
      } else {
        const getReq = store.get(idOrVideoId);
        getReq.onsuccess = (e) => {
          const record = e.target.result;
          if (record) {
            record.lastPlaybackTime = time;
            record.lastSubtitleId = subId;
            record.lastUpdatedAt = now;
            record.updatedAt = now;
            store.put(record);
          }
        };
      }

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch (err) {
      console.warn('[TranscriptLibrary] Error updating playback position:', err);
      resolve(false);
    }
  });
}

/**
 * Retrieve a saved transcript by exact videoId, subtitleHash, and targetLang.
 * 
 * @param {string} videoId
 * @param {string} subtitleHash
 * @param {string} targetLang
 * @returns {Promise<Object|null>}
 */
export async function getTranscriptFromLibrary(videoId, subtitleHash, targetLang = 'zh') {
  if (!videoId) return null;
  const cleanVideoId = String(videoId).trim();
  const id = getLibraryKey(cleanVideoId, subtitleHash, targetLang);

  const db = await openDatabase();
  let result = null;

  if (!db) {
    result = memoryStore.get(id) || null;
  } else {
    result = await new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => {
          const res = event.target.result || memoryStore.get(id) || null;
          resolve(res);
        };

        request.onerror = () => {
          resolve(memoryStore.get(id) || null);
        };
      } catch (err) {
        console.warn('[TranscriptLibrary] Error reading from IndexedDB:', err);
        resolve(memoryStore.get(id) || null);
      }
    });
  }

  if (result) {
    const sharedPos = getSharedPlaybackPosition(cleanVideoId);
    if (sharedPos && typeof sharedPos.lastPlaybackTime === 'number') {
      result.lastPlaybackTime = Math.max(result.lastPlaybackTime || 0, sharedPos.lastPlaybackTime);
      if (sharedPos.lastSubtitleId && !result.lastSubtitleId) {
        result.lastSubtitleId = sharedPos.lastSubtitleId;
      }
    }
  }

  return result;
}

/**
 * Find all saved transcripts for a given videoId and optional targetLang.
 * Useful for auto-restoring or showing existing transcripts for a video.
 * 
 * @param {string} videoId
 * @param {string} targetLang
 * @returns {Promise<Array>}
 */
export async function findTranscriptsByVideoId(videoId, targetLang = null) {
  if (!videoId) return [];
  const cleanId = videoId.trim();

  const all = await getAllSavedTranscripts();
  return all.filter(item => {
    const matchVid = item.videoId === cleanId;
    if (!matchVid) return false;
    if (targetLang) return item.targetLanguage === targetLang;
    return true;
  });
}

/**
 * Get all saved transcripts in the library sorted newest first.
 * Enriched with shared playback position across languages.
 * 
 * @returns {Promise<Array>}
 */
export async function getAllSavedTranscripts() {
  const db = await openDatabase();
  let results = [];

  if (!db) {
    results = Array.from(memoryStore.values());
  } else {
    results = await new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
          const raw = event.target.result || [];
          memoryStore.clear();
          for (const item of raw) {
            if (item && item.id) {
              memoryStore.set(item.id, item);
            }
          }
          resolve(raw);
        };

        request.onerror = (e) => {
          console.warn('[TranscriptLibrary] Error listing from IndexedDB:', e.target?.error);
          resolve(Array.from(memoryStore.values()));
        };
      } catch (err) {
        console.warn('[TranscriptLibrary] Error listing from IndexedDB:', err);
        resolve(Array.from(memoryStore.values()));
      }
    });
  }

  const enrichedList = results.map(item => {
    if (!item) return item;
    const sharedPos = getSharedPlaybackPosition(item.videoId);
    if (sharedPos && typeof sharedPos.lastPlaybackTime === 'number') {
      const effectiveTime = Math.max(item.lastPlaybackTime || 0, sharedPos.lastPlaybackTime);
      return {
        ...item,
        lastPlaybackTime: effectiveTime,
        lastSubtitleId: sharedPos.lastSubtitleId || item.lastSubtitleId
      };
    }
    return item;
  });

  return enrichedList.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

/**
 * Delete a specific transcript from the library by its ID.
 * Waits for the IndexedDB transaction to fully complete before resolving.
 * 
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteTranscriptFromLibrary(id) {
  if (!id) return false;
  const cleanId = String(id);
  memoryStore.delete(id);
  memoryStore.delete(cleanId);

  const db = await openDatabase();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);
      if (cleanId !== id) {
        store.delete(cleanId);
      }

      transaction.oncomplete = () => {
        memoryStore.delete(id);
        memoryStore.delete(cleanId);
        resolve(true);
      };

      transaction.onerror = (e) => {
        console.warn('[TranscriptLibrary] Error deleting from IndexedDB:', e.target?.error);
        resolve(false);
      };

      transaction.onabort = (e) => {
        console.warn('[TranscriptLibrary] Transaction aborted deleting from IndexedDB:', e.target?.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('[TranscriptLibrary] Exception deleting from IndexedDB:', err);
      resolve(false);
    }
  });
}

/**
 * Retrieve total number of saved transcripts.
 * 
 * @returns {Promise<number>}
 */
export async function getSavedTranscriptsCount() {
  const all = await getAllSavedTranscripts();
  return all.length;
}

/**
 * Clear all saved transcripts (for testing / reset).
 */
export async function clearTranscriptLibrary() {
  memoryStore.clear();
  sharedPlaybackMemory.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(SHARED_PLAYBACK_STORAGE_KEY);
    } catch (e) {}
  }

  const db = await openDatabase();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}
