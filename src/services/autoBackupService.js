/**
 * src/services/autoBackupService.js
 * 
 * Manages incremental, resource-based background automatic backups for LinguaFlow.
 * 
 * CORE RULES:
 * 1. Incremental Sync: Syncs only modified resources (text-document, youtube-transcript,
 *    saved-words, chat-history, call-history, habit-tracker, settings) instead of monolithic snapshots.
 * 2. Update vs Create: Uses stable filenames in the "auto" subfolder ('LinguaFlow Backups/auto/').
 *    If a remote resource exists, it is UPDATED via Drive PATCH; if not, it is CREATED via POST.
 * 3. Silent & Non-Disruptive: Never opens OAuth popups. If Drive is not connected or token
 *    is expired, sync is silently skipped without interrupting the user.
 * 4. Debounce & Coalescing: Waits 30 seconds (AUTO_BACKUP_SETTLE_MS) of quiet time after changes.
 *    Multiple changes to one or more resources coalesce into a single batch sync.
 * 5. Concurrency Protection: While an upload is active, new incoming changes accumulate in
 *    `pendingResources` and are automatically processed in a follow-up run without losing changes.
 * 6. Resource Fingerprints: Uses deterministic chunked hashing per resource. If a resource's
 *    fingerprint matches the already synced version, the upload is skipped.
 * 7. Safe Deletions: If a resource is deleted locally, it is safely removed from Google Drive
 *    and the manifest without aggressive or unintended wipes.
 * 8. Manual Backup Isolation: Manual backups ('linguaflow-backup-*.json') remain completely
 *    untouched and independent in the root backup folder.
 */

import { waitForPendingSaves, getTextDocumentById } from './textLibraryStorage.js';
import { findTranscriptsByVideoId } from './transcriptLibraryStorage.js';
import { getImageDocumentById } from './imageReaderLibraryStorage.js';
import { loadActiveDocumentDraft } from './textDocumentService.js';
import { gatherAllHabitTrackerData } from './habitTrackerService.js';
import {
  serializeBackupToBlob,
  saveLastBackupMeta,
  computeResourceFingerprint,
  getResourceFingerprint,
  saveResourceFingerprint,
  createResourcePayload,
  gatherChatHistory,
  gatherCleanSettings
} from './backupService.js';
import {
  isDriveConnected,
  isDriveAuthorized,
  requestDriveAccessToken,
  getOrCreateBackupFolder,
  getOrCreateAutoBackupFolder,
  findDriveFile,
  uploadDriveResource,
  updateDriveResource,
  deleteDriveFile,
  downloadBackupPayload
} from './googleDriveService.js';

// Configuration Constants
export const AUTO_BACKUP_SETTLE_MS = 30000; // 30 seconds quiet/coalescing period after content exit
export const AUTO_BACKUP_FILE_PREFIX = 'linguaflow-autobackup-';
export const MANIFEST_FILE_NAME = 'manifest.json';

// Internal Singleton State
let currentUser = null;
let isUploading = false;
let debounceTimer = null;
const pendingResources = new Map(); // key -> { type, id, reason, deleted, requestedAt }

const statusListeners = new Set();

let autoBackupStatus = {
  status: 'idle', // 'idle' | 'debouncing' | 'uploading' | 'success' | 'partial' | 'error'
  lastSuccessAt: null,
  lastAttemptAt: null,
  error: null,
  counts: null
};

/**
 * Formats error messages safely for user notifications, stripping technical traces.
 */
function formatSafeBackupError(err) {
  const msg = typeof err === 'string' ? err : (err?.message || '');
  if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network Error')) {
    return 'Google Drive no disponible';
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('token') || msg.includes('auth')) {
    return 'Sesión expirada';
  }
  if (msg.includes('validation')) {
    return 'Error de validación de datos';
  }
  const clean = msg.split('\n')[0].replace(/https?:\/\/[^\s]+/g, '').trim();
  return clean.length > 50 ? `${clean.slice(0, 47)}...` : clean || 'Error en backup';
}

/**
 * Reads the current auto-backup status.
 */
export function getAutoBackupStatus() {
  return { ...autoBackupStatus };
}

/**
 * Subscribes to auto-backup status changes (for UI in Settings and Toast).
 * 
 * @param {function} listener
 * @returns {function} Unsubscribe callback
 */
export function onAutoBackupStatusChanged(listener) {
  if (typeof listener === 'function') {
    statusListeners.add(listener);
  }
  return () => {
    statusListeners.delete(listener);
  };
}

function updateStatus(newStatus) {
  autoBackupStatus = { ...autoBackupStatus, ...newStatus };
  statusListeners.forEach(listener => {
    try {
      listener(getAutoBackupStatus());
    } catch (e) {}
  });
}

/**
 * Initializes the auto-backup service with the current authenticated user.
 * 
 * @param {object} user - Current authenticated user
 */
export function initAutoBackupService(user) {
  currentUser = user;
}

/**
 * Stops auto-backup service and clears pending timers and queue.
 */
export function stopAutoBackupService() {
  currentUser = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingResources.clear();
  updateStatus({ status: 'idle', error: null });
}

/**
 * Generates the stable unique cache key for a resource.
 * 
 * @param {string} type
 * @param {string|null} id
 * @returns {string} e.g. 'text-document:123', 'youtube-transcript:abc', 'saved-words'
 */
export function getResourceKey(type, id) {
  if (type === 'text-document' && id) {
    return `text-document:${id}`;
  }
  if (type === 'youtube-transcript' && id) {
    return `youtube-transcript:${id}`;
  }
  return type || 'generic';
}

/**
 * Generates the stable remote file name for a resource inside 'auto/'.
 * 
 * @param {string} type
 * @param {string|null} id
 * @returns {string} e.g. 'text-document-123.json', 'saved-words.json'
 */
export function getResourceFileName(type, id) {
  if (type === 'text-document' && id) {
    const cleanId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `text-document-${cleanId}.json`;
  }
  if (type === 'youtube-transcript' && id) {
    const cleanId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `youtube-transcript-${cleanId}.json`;
  }
  if (type === 'image-document' && id) {
    const cleanId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `image-document-${cleanId}.json`;
  }
  return `${type}.json`;
}

/**
 * Normalizes an incoming requestAutoBackup argument into an array of resource descriptors.
 * 
 * @param {*} param
 * @returns {Array<{ type: string, id: string|null, reason: string, deleted: boolean }>}
 */
function normalizeResourceRequests(param) {
  if (!param) return [];

  if (Array.isArray(param)) {
    return param.map(p => normalizeResourceRequests(p)).flat();
  }

  if (typeof param === 'object') {
    const type = param.type || 'unknown';
    const id = param.id ? String(param.id).trim() : (type !== 'text-document' && type !== 'youtube-transcript' && type !== 'image-document' ? type : null);
    const reason = param.reason || 'content-exit';
    const deleted = Boolean(param.deleted);
    return [{ type, id, reason, deleted }];
  }

  if (typeof param === 'string') {
    const reason = param;
    if (reason === 'live-call-end') {
      return [{ type: 'call-history', id: 'call-history', reason, deleted: false }];
    }
    if (reason === 'chat-exit') {
      return [{ type: 'chat-history', id: 'chat-history', reason, deleted: false }];
    }
    if (reason === 'text-reader-exit' || reason === 'text-reader-unmount') {
      const draft = loadActiveDocumentDraft();
      if (draft && draft.id) {
        return [{ type: 'text-document', id: draft.id, reason, deleted: false }];
      }
    }
    if (reason === 'youtube-reader-exit' || reason === 'youtube-reader-unmount') {
      try {
        const rawYt = localStorage.getItem('linguaflow_yt_session_v1');
        if (rawYt) {
          const parsed = JSON.parse(rawYt);
          if (parsed && parsed.videoId && parsed.videoId !== 'novideo') {
            return [{ type: 'youtube-transcript', id: parsed.videoId, reason, deleted: false }];
          }
        }
      } catch (e) {}
    }
    if (reason === 'tab-change') {
      const draft = loadActiveDocumentDraft();
      if (draft && draft.id) {
        return [{ type: 'text-document', id: draft.id, reason, deleted: false }];
      }
    }
    return [{ type: 'generic', id: null, reason, deleted: false }];
  }

  return [];
}

/**
 * Requests an automatic background backup for one or more modified resources.
 * 
 * @param {object|string|Array} [resourceOrReason='content-exit']
 *   - Object: { type: 'text-document', id: documentId, reason: 'text-reader-exit' }
 *   - Array of objects
 *   - String: legacy reason string
 */
export function requestAutoBackup(resourceOrReason = 'content-exit') {
  // Silent check: If Drive is neither connected nor authorized, or user is not signed in, do nothing!
  if (!currentUser || (!isDriveConnected() && !isDriveAuthorized(currentUser.email))) {
    return;
  }

  const descriptors = normalizeResourceRequests(resourceOrReason);
  if (descriptors.length === 0) return;

  for (const desc of descriptors) {
    const key = getResourceKey(desc.type, desc.id);
    pendingResources.set(key, {
      ...desc,
      requestedAt: Date.now()
    });
    console.log(`[AutoBackup] Queued resource: ${key} (${desc.reason}, settle in 30s)`);
  }

  // Deduplicate and coalesce rapid events into a single 30s debounce window
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  updateStatus({ status: 'debouncing' });

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    executeAutoBackup();
  }, AUTO_BACKUP_SETTLE_MS);
}

/**
 * Retrieves the local data for a specific resource type and id.
 * 
 * @param {string} type
 * @param {string|null} id
 * @returns {Promise<*>}
 */
async function fetchLocalResourceData(type, id) {
  switch (type) {
    case 'text-document': {
      if (!id) return null;
      return await getTextDocumentById(id);
    }
    case 'youtube-transcript': {
      if (!id) return [];
      return await findTranscriptsByVideoId(id);
    }
    case 'image-document': {
      if (!id) return null;
      return await getImageDocumentById(id);
    }
    case 'saved-words': {
      try {
        const raw = localStorage.getItem('linguaflow_saved_words');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
    case 'chat-history': {
      return gatherChatHistory();
    }
    case 'call-history': {
      try {
        const raw = localStorage.getItem('linguaflow_call_history');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
    case 'habit-tracker': {
      return gatherAllHabitTrackerData();
    }
    case 'settings': {
      return gatherCleanSettings();
    }
    default:
      return null;
  }
}

/**
 * Executes a single incremental background auto-backup run for all pending resources.
 */
async function executeAutoBackup() {
  // Silent check: if Drive not connected/authorized or no user, abort silently
  if (!currentUser || (!isDriveConnected() && !isDriveAuthorized(currentUser.email))) {
    updateStatus({ status: 'idle' });
    return;
  }

  if (pendingResources.size === 0) {
    updateStatus({ status: 'idle' });
    return;
  }

  // Concurrency check: If an upload is already running, wait for it to finish.
  // The items will remain in pendingResources and will be synced in the follow-up run.
  if (isUploading) {
    console.log('[AutoBackup] sync already in progress, resources remain queued');
    return;
  }

  isUploading = true;
  const now = new Date();
  updateStatus({ status: 'uploading', lastAttemptAt: now.toISOString(), error: null });

  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;
  let lastError = null;

  try {
    // 1. Authorize Google Drive silently
    const accessToken = await requestDriveAccessToken(currentUser.email, { silentOnly: true });

    // 2. Wait for any active IndexedDB write operations to settle
    await waitForPendingSaves();

    // 3. Locate or create root 'LinguaFlow Backups' folder and 'auto/' subfolder
    const rootFolderId = await getOrCreateBackupFolder(accessToken);
    const autoFolderId = await getOrCreateAutoBackupFolder(accessToken, rootFolderId);

    // 4. Load remote manifest from 'auto/' subfolder if it exists
    let manifestFile = await findDriveFile(accessToken, autoFolderId, MANIFEST_FILE_NAME);
    let manifest = {
      version: 1,
      updatedAt: now.toISOString(),
      user: currentUser.email,
      resources: {}
    };

    if (manifestFile) {
      try {
        const remoteManifest = await downloadBackupPayload(accessToken, manifestFile.id);
        if (remoteManifest && typeof remoteManifest.resources === 'object') {
          manifest = remoteManifest;
        }
      } catch (manifestReadErr) {
        console.warn('[AutoBackup] Notice reading remote manifest, starting fresh index:', manifestReadErr);
      }
    }

    if (!manifest.resources) {
      manifest.resources = {};
    }

    // 5. Take a snapshot of the pending resources to process in this batch
    const resourcesToProcess = Array.from(pendingResources.entries());

    for (const [resourceKey, desc] of resourcesToProcess) {
      try {
        const fileName = getResourceFileName(desc.type, desc.id);

        // A. Handle deletion
        if (desc.deleted) {
          console.log(`[AutoBackup] Deleting remote resource: ${resourceKey}`);
          let fileIdToDelete = manifest.resources[resourceKey]?.fileId;
          if (!fileIdToDelete) {
            const existingFile = await findDriveFile(accessToken, autoFolderId, fileName);
            if (existingFile) fileIdToDelete = existingFile.id;
          }

          if (fileIdToDelete) {
            await deleteDriveFile(accessToken, fileIdToDelete);
          }

          delete manifest.resources[resourceKey];
          saveResourceFingerprint(currentUser.email, resourceKey, null);
          pendingResources.delete(resourceKey);
          successCount++;
          continue;
        }

        // B. Handle synchronization (Update or Create)
        const localData = await fetchLocalResourceData(desc.type, desc.id);

        // If resource doesn't exist locally and was not marked deleted, skip
        if (localData === null || localData === undefined) {
          console.log(`[AutoBackup] ${resourceKey} not found locally, skipping`);
          pendingResources.delete(resourceKey);
          continue;
        }

        // Compute fingerprint for this specific resource
        const currentFingerprint = await computeResourceFingerprint(desc.type, localData);
        const remoteFingerprint = manifest.resources[resourceKey]?.fingerprint;
        const localFingerprint = getResourceFingerprint(currentUser.email, resourceKey);
        const previousFingerprint = remoteFingerprint || localFingerprint;

        // Skip upload if content has not changed
        if (currentFingerprint && previousFingerprint && currentFingerprint === previousFingerprint) {
          console.log(`[AutoBackup] ${resourceKey} skipped: no changes`);
          skippedCount++;
          pendingResources.delete(resourceKey);
          continue;
        }

        console.log(`[AutoBackup] Uploading incremental resource: ${resourceKey} (${fileName})`);

        // Prepare portable payload and blob
        const resourcePayload = createResourcePayload(desc.type, desc.id, localData, currentUser);
        const resourceBlob = serializeBackupToBlob(resourcePayload);

        // Find existing fileId from manifest or Drive search
        let existingFileId = manifest.resources[resourceKey]?.fileId;
        if (!existingFileId) {
          const remoteFound = await findDriveFile(accessToken, autoFolderId, fileName);
          if (remoteFound) {
            existingFileId = remoteFound.id;
          }
        }

        let uploadResult = null;
        if (existingFileId) {
          // UPDATE existing remote file via Drive PATCH
          uploadResult = await updateDriveResource(accessToken, existingFileId, resourceBlob);
        } else {
          // CREATE new remote file in 'auto/'
          uploadResult = await uploadDriveResource(accessToken, autoFolderId, fileName, resourceBlob);
        }

        if (uploadResult && uploadResult.id) {
          manifest.resources[resourceKey] = {
            fileName,
            fileId: uploadResult.id,
            fingerprint: currentFingerprint,
            updatedAt: now.toISOString()
          };
          saveResourceFingerprint(currentUser.email, resourceKey, currentFingerprint);
          pendingResources.delete(resourceKey);
          successCount++;
        } else {
          throw new Error(`Google Drive no confirmó la subida de ${resourceKey}`);
        }
      } catch (resErr) {
        console.warn(`[AutoBackup] Failed syncing resource ${resourceKey}:`, resErr?.message || resErr);
        failCount++;
        lastError = resErr;
      }
    }

    // 6. Save updated manifest.json if any resources were modified or deleted
    if (successCount > 0) {
      try {
        manifest.updatedAt = now.toISOString();
        const manifestBlob = serializeBackupToBlob(manifest);
        if (manifestFile && manifestFile.id) {
          await updateDriveResource(accessToken, manifestFile.id, manifestBlob);
        } else {
          manifestFile = await uploadDriveResource(accessToken, autoFolderId, MANIFEST_FILE_NAME, manifestBlob);
        }

        // Save metadata of last auto-sync
        saveLastBackupMeta({
          fileId: manifestFile.id,
          fileName: MANIFEST_FILE_NAME,
          createdAt: now.toISOString(),
          isAutoBackup: true
        });
      } catch (manifestSaveErr) {
        console.warn('[AutoBackup] Notice updating manifest.json:', manifestSaveErr);
      }
    }

    // 7. Update service status
    if (failCount === 0) {
      if (successCount > 0) {
        console.log(`[AutoBackup] Sync complete: ${successCount} updated, ${skippedCount} skipped`);
        updateStatus({
          status: 'success',
          lastSuccessAt: now.toISOString(),
          error: null
        });
      } else {
        updateStatus({ status: 'idle', error: null });
      }
    } else if (successCount > 0) {
      console.warn(`[AutoBackup] Sync partial: ${successCount} updated, ${failCount} failed`);
      updateStatus({
        status: 'partial',
        lastSuccessAt: now.toISOString(),
        error: formatSafeBackupError(lastError)
      });
    } else {
      updateStatus({
        status: 'error',
        error: formatSafeBackupError(lastError)
      });
    }
  } catch (err) {
    console.warn('[AutoBackup] Background auto-sync notice:', err?.message || err);
    updateStatus({
      status: 'error',
      error: formatSafeBackupError(err)
    });
  } finally {
    isUploading = false;

    // 8. If new changes arrived while uploading, schedule follow-up sync
    if (pendingResources.size > 0) {
      console.log(`[AutoBackup] ${pendingResources.size} pending resources remain, scheduling follow-up in 30s`);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        executeAutoBackup();
      }, AUTO_BACKUP_SETTLE_MS);
    }
  }
}
