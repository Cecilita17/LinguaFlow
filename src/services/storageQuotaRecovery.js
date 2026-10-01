import { migrateLegacyChatHistoriesFromLocalStorage } from './chatHistoryStorage.js';
import { migrateLegacyChatSessionHistory } from './chatSessionHistoryStorage.js';
import { cleanupVerifiedLegacyGlossCaches } from './subtitleGlossService.js';

let recoveryPromise = null;

function getLocalStorageUsage() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const rows = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    const value = localStorage.getItem(key) || '';
    rows.push({ key, bytes: (key.length + value.length) * 2 });
  }
  return rows.sort((a, b) => b.bytes - a.bytes);
}

// Safely reclaims only known duplicated/regenerable data. Each migrator verifies
// IndexedDB before removing its legacy key; preferences and learning data remain.
export function recoverLocalStorageQuota() {
  if (recoveryPromise) return recoveryPromise;
  recoveryPromise = (async () => {
    const [activeChats, completedSessions, glossCaches] = await Promise.all([
      migrateLegacyChatHistoriesFromLocalStorage(),
      migrateLegacyChatSessionHistory(),
      cleanupVerifiedLegacyGlossCaches()
    ]);

    if (import.meta.env.DEV) {
      const largest = getLocalStorageUsage().slice(0, 10)
        .map(({ key, bytes }) => `[Storage] ${key}: ${(bytes / 1024).toFixed(1)} KB`);
      if (largest.length) console.info(largest.join('\n'));
    }
    return { activeChats, completedSessions, glossCaches };
  })().catch((error) => {
    console.warn('[Storage] Conservative quota recovery could not finish:', error);
    return { activeChats: 0, completedSessions: 0, glossCaches: 0 };
  });
  return recoveryPromise;
}

