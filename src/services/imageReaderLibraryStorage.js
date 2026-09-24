/**
 * Persistent Image Reader Library Storage (IndexedDB)
 * 
 * Provides robust, persistent storage for Image Reader documents:
 * - Compressed image payload (base64 / dataUrl)
 * - Pedagogical description and title
 * - Linguistic tokens, Pinyin, Arabic transliteration, glosses
 * - Paragraph translations requested by the user
 * - Target language, native language, CEFR level, model metadata
 * 
 * Completely separate from Text Documents and YouTube Transcripts databases.
 * Guarantees zero-cost ($0) Groq reuse when reopening saved images.
 */

import { requestAutoBackup } from './autoBackupService.js';

const DB_NAME = 'LinguaFlow_ImageDocuments_DB';
const DB_VERSION = 1;
const STORE_NAME = 'saved_image_documents';

// In-memory fallback if IndexedDB is unavailable, blocked, or running in SSR/testing environment
const memoryStore = new Map();

// Event listeners notified strictly after an image document is successfully saved/persisted
const saveListeners = new Set();

export function onImageDocumentSaved(listener) {
  if (typeof listener === 'function') {
    saveListeners.add(listener);
  }
  return () => {
    saveListeners.delete(listener);
  };
}

function notifyImageDocumentSaved(savedDoc) {
  if (!savedDoc) return;
  saveListeners.forEach(listener => {
    try {
      listener(savedDoc);
    } catch (err) {
      console.warn('[ImageLibraryStorage] Error in save listener:', err);
    }
  });
}

function isIndexedDBAvailable() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

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
        console.warn('[ImageLibraryStorage] IndexedDB open error, falling back to memory store:', event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[ImageLibraryStorage] IndexedDB initialization exception:', err);
      resolve(null);
    }
  });
}

/**
 * Normalizes an image document before persistence to ensure all required fields are valid.
 */
export function normalizeImageDocument(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') {
    throw new Error('El documento de imagen no es un objeto válido.');
  }

  const now = new Date().toISOString();
  const id = rawDoc.id || `img_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const title = (rawDoc.title || '').trim() || 'Imagen sin título';
  const description = (rawDoc.description || '').trim();
  const targetLang = rawDoc.targetLang || 'zh';
  const nativeLang = rawDoc.nativeLang || 'es';
  const level = rawDoc.level || 'B1';
  const model = rawDoc.model || 'qwen/qwen3.8-27b';
  const imageBase64 = rawDoc.imageBase64 || rawDoc.dataUrl || rawDoc.image || '';
  const mimeType = rawDoc.mimeType || 'image/jpeg';
  const paragraphs = Array.isArray(rawDoc.paragraphs) ? rawDoc.paragraphs : [];
  const paragraphTranslations = (rawDoc.paragraphTranslations && typeof rawDoc.paragraphTranslations === 'object')
    ? rawDoc.paragraphTranslations
    : {};

  return {
    id,
    title,
    description,
    targetLang,
    nativeLang,
    level,
    model,
    imageBase64,
    mimeType,
    paragraphs,
    paragraphTranslations,
    createdAt: rawDoc.createdAt || now,
    updatedAt: now
  };
}

/**
 * Saves or updates an image document in IndexedDB.
 * 
 * @param {object} imageDoc - The document object to persist
 * @returns {Promise<object>} The normalized saved document
 */
export async function saveImageDocument(imageDoc) {
  const normalized = normalizeImageDocument(imageDoc);
  const db = await openDatabase();

  if (!db) {
    memoryStore.set(normalized.id, normalized);
    notifyImageDocumentSaved(normalized);
    try {
      requestAutoBackup({ type: 'image-document', id: normalized.id, reason: 'save', deleted: false });
    } catch (e) {}
    return normalized;
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(normalized);

      request.onsuccess = () => {
        notifyImageDocumentSaved(normalized);
        try {
          requestAutoBackup({ type: 'image-document', id: normalized.id, reason: 'save', deleted: false });
        } catch (e) {}
        resolve(normalized);
      };

      request.onerror = (event) => {
        console.error('[ImageLibraryStorage] IndexedDB put error:', event.target.error);
        memoryStore.set(normalized.id, normalized);
        resolve(normalized);
      };
    } catch (err) {
      console.warn('[ImageLibraryStorage] Transaction error, using memory fallback:', err);
      memoryStore.set(normalized.id, normalized);
      resolve(normalized);
    }
  });
}

/**
 * Retrieves a single image document by its ID.
 * 
 * @param {string} id - Document ID
 * @returns {Promise<object|null>}
 */
export async function getImageDocumentById(id) {
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

      request.onsuccess = () => {
        resolve(request.result || memoryStore.get(id) || null);
      };

      request.onerror = () => {
        resolve(memoryStore.get(id) || null);
      };
    } catch (err) {
      resolve(memoryStore.get(id) || null);
    }
  });
}

/**
 * Retrieves all saved image documents, sorted by updatedAt descending.
 * 
 * @returns {Promise<Array<object>>}
 */
export async function getAllImageDocuments() {
  const db = await openDatabase();

  if (!db) {
    return Array.from(memoryStore.values()).sort(
      (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    );
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const idbItems = request.result || [];
        const memoryItems = Array.from(memoryStore.values());
        const mergedMap = new Map();

        memoryItems.forEach(item => mergedMap.set(item.id, item));
        idbItems.forEach(item => mergedMap.set(item.id, item));

        const sorted = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        );
        resolve(sorted);
      };

      request.onerror = () => {
        resolve(Array.from(memoryStore.values()));
      };
    } catch (err) {
      resolve(Array.from(memoryStore.values()));
    }
  });
}

/**
 * Deletes an image document from the library by ID.
 * 
 * @param {string} id - Document ID
 * @returns {Promise<boolean>}
 */
export async function deleteImageDocument(id) {
  if (!id) return false;
  memoryStore.delete(id);
  const db = await openDatabase();

  if (!db) {
    try {
      requestAutoBackup({ type: 'image-document', id, reason: 'delete', deleted: true });
    } catch (e) {}
    return true;
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        try {
          requestAutoBackup({ type: 'image-document', id, reason: 'delete', deleted: true });
        } catch (e) {}
        resolve(true);
      };

      request.onerror = (event) => {
        console.error('[ImageLibraryStorage] IndexedDB delete error:', event.target.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('[ImageLibraryStorage] Delete transaction error:', err);
      resolve(false);
    }
  });
}

/**
 * Updates an image document's title without affecting its analysis or content.
 * 
 * @param {string} id - Document ID
 * @param {string} newTitle - New title
 * @returns {Promise<object|null>}
 */
export async function updateImageDocumentTitle(id, newTitle) {
  if (!id || typeof newTitle !== 'string') return null;
  const doc = await getImageDocumentById(id);
  if (!doc) return null;

  doc.title = newTitle.trim() || doc.title;
  doc.updatedAt = new Date().toISOString();

  return await saveImageDocument(doc);
}

/**
 * Returns the count of saved image documents.
 * 
 * @returns {Promise<number>}
 */
export async function getImageDocumentsCount() {
  const all = await getAllImageDocuments();
  return all.length;
}
