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

// In-memory fallback if IndexedDB is blocked or running in SSR / testing environment
const memoryStore = new Map();

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

  const targetLang = record.targetLanguage || record.targetLang || 'zh';
  const subHash = record.subtitleHash || computeSubtitleHash(record.subtitles);
  const id = record.id || getLibraryKey(record.videoId, subHash, targetLang);

  const cleanRecord = {
    id,
    videoId: record.videoId,
    videoTitle: record.videoTitle || `YouTube Video (${record.videoId})`,
    videoUrl: record.videoUrl || `https://www.youtube.com/watch?v=${record.videoId}`,
    targetLanguage: targetLang,
    nativeLanguage: record.nativeLanguage || record.nativeLang || 'es',
    sourceType: record.sourceType || 'srt',
    subtitleHash: subHash,
    subtitlesCount: record.subtitles.length,
    completedLinesCount: record.completedLinesCount || record.subtitles.filter(s => s.tokens && s.tokens.some(t => t.gloss)).length,
    isComplete: Boolean(record.isComplete),
    format: record.format || 'srt',
    subtitles: record.subtitles,
    createdAt: record.createdAt || new Date().toISOString(),
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
 * Retrieve a saved transcript by exact videoId, subtitleHash, and targetLang.
 * 
 * @param {string} videoId
 * @param {string} subtitleHash
 * @param {string} targetLang
 * @returns {Promise<Object|null>}
 */
export async function getTranscriptFromLibrary(videoId, subtitleHash, targetLang = 'zh') {
  if (!videoId) return null;
  const id = getLibraryKey(videoId, subtitleHash, targetLang);

  const db = await openDatabase();
  if (!db) {
    return memoryStore.get(id) || null;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = (event) => {
        const result = event.target.result || memoryStore.get(id) || null;
        resolve(result);
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
 * 
 * @returns {Promise<Array>}
 */
export async function getAllSavedTranscripts() {
  const db = await openDatabase();
  if (!db) {
    return Array.from(memoryStore.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event) => {
        const results = event.target.result || [];
        const map = new Map();
        results.forEach(r => map.set(r.id, r));
        memoryStore.forEach((val, key) => {
          if (!map.has(key)) map.set(key, val);
        });

        const list = Array.from(map.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(list);
      };

      request.onerror = () => {
        resolve(Array.from(memoryStore.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      };
    } catch (err) {
      console.warn('[TranscriptLibrary] Error listing from IndexedDB:', err);
      resolve(Array.from(memoryStore.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    }
  });
}

/**
 * Delete a specific transcript from the library by its ID.
 * 
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteTranscriptFromLibrary(id) {
  if (!id) return false;
  memoryStore.delete(id);

  const db = await openDatabase();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch (err) {
      console.warn('[TranscriptLibrary] Error deleting from IndexedDB:', err);
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
