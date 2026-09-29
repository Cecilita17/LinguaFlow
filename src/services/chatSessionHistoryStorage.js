/**
 * src/services/chatSessionHistoryStorage.js
 *
 * Manages persistent storage of completed/archived chat conversations in LinguaFlow.
 * Explicitly separate from active working chat threads (linguaflow_chat_<lang>).
 */

export const STORAGE_KEY_CHAT_SESSION_HISTORY = 'linguaflow_chat_session_history';

const DURABLE_DB_NAME = 'linguaflow_completed_chat_sessions';
const DURABLE_STORE_NAME = 'sessions';
const DURABLE_DB_VERSION = 1;

function openDurableSessionDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DURABLE_DB_NAME, DURABLE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DURABLE_STORE_NAME)) {
        db.createObjectStore(DURABLE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDurableChatSession(session) {
  if (!session?.id) return false;
  try {
    const db = await openDurableSessionDatabase();
    if (!db) return false;
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DURABLE_STORE_NAME, 'readwrite');
      transaction.objectStore(DURABLE_STORE_NAME).put(session);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    return true;
  } catch (error) {
    console.warn('[ChatSessionStorage] Failed to save durable session:', error);
    return false;
  }
}

export async function getDurableChatSessions() {
  try {
    const db = await openDurableSessionDatabase();
    if (!db) return [];
    const sessions = await new Promise((resolve, reject) => {
      const transaction = db.transaction(DURABLE_STORE_NAME, 'readonly');
      const request = transaction.objectStore(DURABLE_STORE_NAME).getAll();
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return sessions.sort((a, b) => new Date(b.endedAt || 0) - new Date(a.endedAt || 0));
  } catch (error) {
    console.warn('[ChatSessionStorage] Failed to read durable sessions:', error);
    return [];
  }
}

export async function deleteDurableChatSession(sessionId) {
  if (!sessionId) return false;
  try {
    const db = await openDurableSessionDatabase();
    if (!db) return false;
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DURABLE_STORE_NAME, 'readwrite');
      transaction.objectStore(DURABLE_STORE_NAME).delete(sessionId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    return true;
  } catch (error) {
    console.warn('[ChatSessionStorage] Failed to delete durable session:', error);
    return false;
  }
}

/**
 * Deep clones messages array to guarantee an immutable snapshot.
 */
function cloneMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return JSON.parse(JSON.stringify(messages));
}

/**
 * Loads all completed chat sessions from localStorage.
 * Returns an array sorted by endedAt / timestamp descending (most recent first).
 */
export function getChatSessionHistory() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHAT_SESSION_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => {
          const timeA = a.endedAt ? new Date(a.endedAt).getTime() : (a.timestamp || 0);
          const timeB = b.endedAt ? new Date(b.endedAt).getTime() : (b.timestamp || 0);
          return timeB - timeA;
        });
      }
    }
  } catch (e) {
    console.warn('[ChatSessionStorage] Failed to read session history:', e);
  }
  return [];
}

/**
 * Saves a completed chat session.
 * Prepends the session to local storage immediately and dispatches a sync event.
 *
 * @param {object} session
 * @returns {object} The saved session object
 */
export function saveChatSession(session) {
  if (!session || typeof session !== 'object') return null;
  const history = getChatSessionHistory();
  const existingIdx = history.findIndex(s => s.id === session.id);

  const cleanSession = {
    id: session.id || `chat_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'chat',
    targetLang: String(session.targetLang || 'zh').toLowerCase().split('-')[0],
    nativeLang: String(session.nativeLang || 'es').toLowerCase().split('-')[0],
    startedAt: session.startedAt || new Date().toISOString(),
    endedAt: session.endedAt || new Date().toISOString(),
    messages: cloneMessages(session.messages || []),
    messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
    metadata: {
      version: 1,
      level: session.metadata?.level || 'A2/B1',
      ...(session.metadata || {})
    }
  };

  let updated;
  if (existingIdx >= 0) {
    updated = [...history];
    updated[existingIdx] = cleanSession;
  } else {
    updated = [cleanSession, ...history];
  }

  try {
    localStorage.setItem(STORAGE_KEY_CHAT_SESSION_HISTORY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('linguaflow-chat-session-sync'));
    }
  } catch (e) {
    console.warn('[ChatSessionStorage] Failed to save session to localStorage:', e);
  }

  return cleanSession;
}

/**
 * Deletes a session by ID.
 *
 * @param {string} sessionId
 * @returns {boolean} True if successfully deleted
 */
export function deleteChatSession(sessionId) {
  if (!sessionId) return false;
  void deleteDurableChatSession(sessionId);
  const history = getChatSessionHistory();
  const filtered = history.filter(s => s.id !== sessionId);
  if (filtered.length !== history.length) {
    try {
      localStorage.setItem(STORAGE_KEY_CHAT_SESSION_HISTORY, JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('linguaflow-chat-session-sync'));
      }
      return true;
    } catch (e) {
      console.warn('[ChatSessionStorage] Failed to delete session from localStorage:', e);
    }
  }
  return false;
}

/**
 * Retrieves a session by ID.
 *
 * @param {string} sessionId
 * @returns {object|null}
 */
export function getChatSessionById(sessionId) {
  if (!sessionId) return null;
  const history = getChatSessionHistory();
  return history.find(s => s.id === sessionId) || null;
}

/**
 * Clears all chat session history.
 */
export function clearChatSessionHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY_CHAT_SESSION_HISTORY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('linguaflow-chat-session-sync'));
    }
  } catch (e) {}
}
