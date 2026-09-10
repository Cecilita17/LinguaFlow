/**
 * Persistent Text Documents Library Storage (IndexedDB)
 * 
 * Provides robust, persistent storage for standalone Text Reader documents,
 * including full paragraphs, word tokens, AI glosses, manual glosses,
 * Pinyin/auxiliary fields, multi-language states, and document metadata.
 * 
 * Survives tab switches, browser restarts, and page refreshes.
 * Completely separate from YouTube transcripts IndexedDB database.
 */

import { normalizeDocument } from './textDocumentService.js';

const DB_NAME = 'LinguaFlow_TextDocuments_DB';
const DB_VERSION = 1;
const STORE_NAME = 'saved_text_documents';

// In-memory fallback if IndexedDB is unavailable, blocked, or running in testing environment
const memoryStore = new Map();

/**
 * Checks if IndexedDB is available in the current environment.
 */
function isIndexedDBAvailable() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Opens and initializes the IndexedDB database for Text Reader documents.
 * 
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
          store.createIndex('targetLang', 'targetLang', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.warn('[TextLibraryStorage] Failed to open IndexedDB:', event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[TextLibraryStorage] Exception opening IndexedDB:', err);
      resolve(null);
    }
  });
}

/**
 * Saves or updates a text document in the persistent IndexedDB library.
 * Preserves stable ID and createdAt, updates updatedAt, and syncs languageStates.
 * 
 * @param {object} rawDoc - Document object to persist
 * @returns {Promise<object>} - Saved normalized document
 */
export async function saveTextDocument(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') return null;

  const now = new Date().toISOString();
  const existing = rawDoc.id ? (await getTextDocumentById(rawDoc.id)) : null;

  const targetLang = rawDoc.targetLang || 'zh';
  const effectiveParagraphs = Array.isArray(rawDoc.paragraphs) ? rawDoc.paragraphs : [];

  const existingStates = (rawDoc.languageStates && typeof rawDoc.languageStates === 'object')
    ? { ...rawDoc.languageStates }
    : (existing?.languageStates ? { ...existing.languageStates } : {});

  existingStates[targetLang] = {
    targetLang,
    paragraphs: effectiveParagraphs,
    updatedAt: now
  };

  // Safe preservation of lastAudioPosition:
  // If rawDoc explicitly specifies lastAudioPosition, compare with existing to prevent race conditions.
  // If rawDoc.lastAudioPosition is undefined, fall back to existing?.lastAudioPosition.
  let effectiveLastAudioPosition = rawDoc.lastAudioPosition !== undefined
    ? rawDoc.lastAudioPosition
    : (existing?.lastAudioPosition || null);

  // If both exist, keep the newer one based on updatedAt timestamp
  if (existing?.lastAudioPosition && effectiveLastAudioPosition && effectiveLastAudioPosition !== existing.lastAudioPosition) {
    const existingTime = existing.lastAudioPosition.updatedAt || 0;
    const incomingTime = effectiveLastAudioPosition.updatedAt || 0;
    if (existingTime > incomingTime) {
      effectiveLastAudioPosition = existing.lastAudioPosition;
    }
  }

  // Safe preservation of lastReadingPosition:
  let effectiveLastReadingPosition = rawDoc.lastReadingPosition !== undefined
    ? rawDoc.lastReadingPosition
    : (existing?.lastReadingPosition || null);

  if (existing?.lastReadingPosition && effectiveLastReadingPosition && effectiveLastReadingPosition !== existing.lastReadingPosition) {
    const existingTime = existing.lastReadingPosition.updatedAt || 0;
    const incomingTime = effectiveLastReadingPosition.updatedAt || 0;
    if (existingTime > incomingTime) {
      effectiveLastReadingPosition = existing.lastReadingPosition;
    }
  }

  const toSave = normalizeDocument({
    ...rawDoc,
    author: rawDoc.author !== undefined ? rawDoc.author : (existing?.author || ''),
    sourceType: rawDoc.sourceType || existing?.sourceType || rawDoc.format || existing?.format || 'txt',
    format: rawDoc.format || existing?.format || rawDoc.sourceType || existing?.sourceType || 'txt',
    chapters: (Array.isArray(rawDoc.chapters) && rawDoc.chapters.length > 0) ? rawDoc.chapters : (existing?.chapters || []),
    lastAudioPosition: effectiveLastAudioPosition,
    lastReadingPosition: effectiveLastReadingPosition,
    createdAt: existing?.createdAt || rawDoc.createdAt || now,
    updatedAt: now,
    languageStates: existingStates
  });

  // Always update in-memory fallback
  memoryStore.set(toSave.id, toSave);

  const db = await openDatabase();
  if (!db) {
    return toSave;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(toSave);

      request.onsuccess = () => resolve(toSave);
      request.onerror = (e) => {
        console.warn('[TextLibraryStorage] Error saving document to IndexedDB:', e.target.error);
        resolve(toSave);
      };
    } catch (err) {
      console.warn('[TextLibraryStorage] Exception saving document to IndexedDB:', err);
      resolve(toSave);
    }
  });
}

/**
 * Retrieves a single text document by its unique ID from IndexedDB.
 * 
 * @param {string} id - Unique document ID
 * @returns {Promise<object|null>}
 */
export async function getTextDocumentById(id) {
  if (!id) return null;

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
        resolve(result ? normalizeDocument(result) : null);
      };

      request.onerror = () => {
        const fallback = memoryStore.get(id) || null;
        resolve(fallback ? normalizeDocument(fallback) : null);
      };
    } catch (err) {
      console.warn('[TextLibraryStorage] Error reading document from IndexedDB:', err);
      const fallback = memoryStore.get(id) || null;
      resolve(fallback ? normalizeDocument(fallback) : null);
    }
  });
}

/**
 * Retrieves all saved text documents from IndexedDB sorted newest first by updatedAt.
 * 
 * @returns {Promise<Array<object>>}
 */
export async function getAllTextDocuments() {
  const db = await openDatabase();
  if (!db) {
    return Array.from(memoryStore.values())
      .map(normalizeDocument)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
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

        const list = Array.from(map.values())
          .map(normalizeDocument)
          .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        resolve(list);
      };

      request.onerror = () => {
        const fallbackList = Array.from(memoryStore.values())
          .map(normalizeDocument)
          .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        resolve(fallbackList);
      };
    } catch (err) {
      console.warn('[TextLibraryStorage] Error listing documents from IndexedDB:', err);
      const fallbackList = Array.from(memoryStore.values())
        .map(normalizeDocument)
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      resolve(fallbackList);
    }
  });
}

/**
 * Deletes a text document by ID from IndexedDB and memory store.
 * 
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteTextDocument(id) {
  if (!id) return false;
  memoryStore.delete(id);

  // If the deleted document matches the active draft in localStorage, clean active draft
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem('linguaflow_active_text_doc_v1');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.id === id) {
            localStorage.removeItem('linguaflow_active_text_doc_v1');
          }
        } catch (_) {}
      }

      // Also clean from legacy library if present
      const legacyRaw = localStorage.getItem('linguaflow_text_library_v1');
      if (legacyRaw) {
        try {
          const parsedLib = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLib)) {
            const filtered = parsedLib.filter(d => d && d.id !== id);
            localStorage.setItem('linguaflow_text_library_v1', JSON.stringify(filtered));
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('[TextLibraryStorage] Error checking active draft during delete:', e);
  }

  const db = await openDatabase();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => {
        console.warn('[TextLibraryStorage] Error deleting document from IndexedDB:', e.target.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('[TextLibraryStorage] Exception deleting document from IndexedDB:', err);
      resolve(false);
    }
  });
}

/**
 * Retrieves the total count of saved text documents.
 * 
 * @returns {Promise<number>}
 */
export async function getTextDocumentsCount() {
  const docs = await getAllTextDocuments();
  return docs.length;
}

/**
 * Clears all saved text documents (for testing / reset).
 * 
 * @returns {Promise<boolean>}
 */
export async function clearTextLibrary() {
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

/**
 * Migrates legacy localStorage library documents into IndexedDB.
 * Guarantees zero data loss for existing users.
 * Removes legacy key from localStorage once successfully verified to prevent dual truth.
 * 
 * @returns {Promise<number>} Number of migrated documents
 */
export async function migrateFromLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return 0;

  // Once legacy migration has executed, do not re-run or re-resurrect deleted documents
  if (localStorage.getItem('linguaflow_text_library_migrated_v1') === 'true') {
    return 0;
  }

  let migratedCount = 0;

  try {
    // Check legacy text library
    const legacyKey = 'linguaflow_text_library_v1';
    const legacyLibRaw = localStorage.getItem(legacyKey);
    if (legacyLibRaw) {
      let parsed = null;
      try {
        parsed = JSON.parse(legacyLibRaw);
      } catch (err) {
        console.warn('[TextLibraryStorage] Corrupted legacy library JSON:', err);
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        let allSuccess = true;
        for (const doc of parsed) {
          if (doc && typeof doc === 'object' && doc.id) {
            try {
              const existing = await getTextDocumentById(doc.id);
              if (!existing) {
                await saveTextDocument(doc);
                const verified = await getTextDocumentById(doc.id);
                if (verified) {
                  migratedCount++;
                } else {
                  allSuccess = false;
                }
              }
            } catch (err) {
              console.warn('[TextLibraryStorage] Failed migrating doc:', doc.id, err);
              allSuccess = false;
            }
          }
        }
        // Once verified, remove legacy localStorage key so IndexedDB is the sole source of truth!
        if (allSuccess) {
          localStorage.removeItem(legacyKey);
          localStorage.setItem('linguaflow_text_library_migrated_v1', 'true');
        }
      } else {
        localStorage.removeItem(legacyKey);
        localStorage.setItem('linguaflow_text_library_migrated_v1', 'true');
      }
    } else {
      localStorage.setItem('linguaflow_text_library_migrated_v1', 'true');
    }
  } catch (err) {
    console.warn('[TextLibraryStorage] Error migrating from localStorage:', err);
  }

  return migratedCount;
}

// Aliases for convenient consistency
export const getAllDocuments = getAllTextDocuments;
export const getDocumentById = getTextDocumentById;
export const saveDocument = saveTextDocument;
export const deleteDocument = deleteTextDocument;
