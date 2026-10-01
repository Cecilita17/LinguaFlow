const DB_NAME = 'linguaflow_chat_history';
const STORE_NAME = 'conversations';
const DB_VERSION = 1;
const LEGACY_CHAT_PREFIX = 'linguaflow_chat_';

function normalizeLanguage(value) {
  return String(value || '').toLowerCase().split('-')[0].trim();
}

function openChatHistoryDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'language' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages.filter((message) => message && typeof message === 'object' && (message.text || message.tokens || message.sender))
    : [];
}

export async function saveDurableChatHistory(language, messages, { replace = false } = {}) {
  const normalized = normalizeMessages(messages);
  if (!language || normalized.length === 0) return false;

  const database = await openChatHistoryDatabase();
  if (!database) return false;

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const existingRequest = store.get(language);
      existingRequest.onsuccess = () => {
        const existing = normalizeMessages(existingRequest.result?.messages);
        // A temporary localStorage regression must never overwrite a longer
        // durable conversation with only its greeting or first message.
        if (!replace && existing.length > normalized.length) return;
        store.put({
          language,
          messages: normalized,
          updatedAt: Date.now()
        });
      };
      existingRequest.onerror = () => {
        store.put({
          language,
          messages: normalized,
          updatedAt: Date.now()
        });
      };
      transaction.oncomplete = () => {
        database.close();
        resolve(true);
      };
      transaction.onerror = () => {
        database.close();
        resolve(false);
      };
      transaction.onabort = () => {
        database.close();
        resolve(false);
      };
    } catch (_) {
      database.close();
      resolve(false);
    }
  });
}

export async function getDurableChatHistory(language) {
  if (!language) return null;
  const database = await openChatHistoryDatabase();
  if (!database) return null;

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(language);
      request.onsuccess = () => {
        const messages = normalizeMessages(request.result?.messages);
        database.close();
        resolve(messages.length ? {
          messages,
          updatedAt: Number(request.result?.updatedAt) || 0
        } : null);
      };
      request.onerror = () => {
        database.close();
        resolve(null);
      };
    } catch (_) {
      database.close();
      resolve(null);
    }
  });
}

export async function getAllDurableChatHistories() {
  const database = await openChatHistoryDatabase();
  if (!database) return [];

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const records = (Array.isArray(request.result) ? request.result : [])
          .map((record) => ({
            language: normalizeLanguage(record?.language),
            messages: normalizeMessages(record?.messages),
            updatedAt: Number(record?.updatedAt) || 0
          }))
          .filter((record) => record.language && record.messages.length > 0);
        database.close();
        resolve(records);
      };
      request.onerror = () => {
        database.close();
        resolve([]);
      };
    } catch (_) {
      database.close();
      resolve([]);
    }
  });
}

// One-time compatible migration for the large legacy mirrors. A key is removed
// only after IndexedDB confirms the same messages were written successfully.
export async function migrateLegacyChatHistoriesFromLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  const candidates = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(LEGACY_CHAT_PREFIX)) continue;
      const language = key.slice(LEGACY_CHAT_PREFIX.length);
      if (!language || language.startsWith('start_') || language.startsWith('session_') || language.startsWith('voice_')) continue;
      const raw = localStorage.getItem(key);
      let messages = [];
      try { messages = normalizeMessages(JSON.parse(raw || '[]')); } catch (_) {}
      if (messages.length > 0) candidates.push({ key, language: normalizeLanguage(language), messages });
    }
  } catch (_) {
    return 0;
  }

  let migrated = 0;
  for (const candidate of candidates) {
    const saved = await saveDurableChatHistory(candidate.language, candidate.messages);
    if (!saved) continue;
    try {
      localStorage.removeItem(candidate.key);
      migrated += 1;
    } catch (_) {}
  }
  return migrated;
}

export async function deleteDurableChatHistory(language) {
  if (!language) return false;
  const database = await openChatHistoryDatabase();
  if (!database) return false;

  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(language);
      transaction.oncomplete = () => {
        database.close();
        resolve(true);
      };
      transaction.onerror = () => {
        database.close();
        resolve(false);
      };
    } catch (_) {
      database.close();
      resolve(false);
    }
  });
}
