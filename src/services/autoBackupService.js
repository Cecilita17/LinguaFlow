/**
 * src/services/autoBackupService.js
 * 
 * Manages background automatic backups for LinguaFlow while the user reads or edits in Text Reader.
 * 
 * CORE RULES:
 * 1. Source of Truth: IndexedDB is local source of truth. Auto-backup executes ONLY AFTER
 *    document persistence is confirmed by IndexedDB.
 * 2. Silent & Non-Disruptive: Never opens OAuth popups while reading. If Drive is not connected
 *    or token is expired, auto-backup is silently skipped without interrupting the user.
 * 3. Debounce & Coalescing: Waits 30 seconds (configurable AUTO_BACKUP_DEBOUNCE_MS) of quiet time
 *    after document persistence before generating a snapshot. Multiple quick edits coalesce into ONE backup.
 * 4. Concurrency Protection: Only one upload runs at a time. If changes occur during an active upload,
 *    `hasPendingChange` is set to queue a follow-up snapshot when the current upload completes.
 * 5. Retention: Keeps strictly the LATEST 3 valid auto-backups (`linguaflow-autobackup-*.json`).
 *    Deletion of old auto-backups occurs ONLY AFTER the new upload succeeds and is confirmed.
 *    Manual backups (`linguaflow-backup-*.json`) are NEVER touched or deleted.
 * 6. Error Safety: Upload failures never delete existing backups, never revert IndexedDB,
 *    and never block Text Reader.
 */

import { onDocumentSaved } from './textLibraryStorage.js';
import {
  createBackupPayload,
  serializeBackupToBlob,
  saveLastBackupMeta
} from './backupService.js';
import {
  isDriveConnected,
  requestDriveAccessToken,
  getOrCreateBackupFolder,
  uploadBackupFile,
  listBackupFiles,
  deleteDriveFile
} from './googleDriveService.js';
import { validateBackupPayload } from './restoreService.js';

// Configuration Constants
export const AUTO_BACKUP_DEBOUNCE_MS = 30000; // 30 seconds quiet period after last save
export const MAX_AUTO_BACKUP_RETENTION = 3; // Keep latest 3 auto-backups
export const AUTO_BACKUP_FILE_PREFIX = 'linguaflow-autobackup-';

// Internal Singleton State
let currentUser = null;
let isUploading = false;
let hasPendingChange = false;
let debounceTimer = null;
let unsubscribeSaveListener = null;

const statusListeners = new Set();

let autoBackupStatus = {
  status: 'idle', // 'idle' | 'debouncing' | 'uploading' | 'error'
  lastSuccessAt: null,
  lastAttemptAt: null,
  error: null
};

/**
 * Reads the current auto-backup status.
 */
export function getAutoBackupStatus() {
  return { ...autoBackupStatus };
}

/**
 * Subscribes to auto-backup status changes (for UI in Settings).
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
 * Subscribes to document persistence events from textLibraryStorage.js.
 * 
 * @param {object} user - Current authenticated user
 */
export function initAutoBackupService(user) {
  currentUser = user;

  if (!unsubscribeSaveListener) {
    unsubscribeSaveListener = onDocumentSaved(handleDocumentPersisted);
  }
}

/**
 * Stops auto-backup service, clears timers, and unsubscribes from events.
 */
export function stopAutoBackupService() {
  currentUser = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (unsubscribeSaveListener) {
    unsubscribeSaveListener();
    unsubscribeSaveListener = null;
  }
  updateStatus({ status: 'idle', error: null });
}

/**
 * Called automatically when IndexedDB confirms a document has been saved.
 */
function handleDocumentPersisted() {
  // SILENT CHECK: If Drive is not connected or user is not signed in, do nothing!
  // Never trigger OAuth popups or prompt during reading.
  if (!currentUser || !isDriveConnected()) {
    return;
  }

  // Clear existing debounce timer if new changes keep coming (coalescing)
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  updateStatus({ status: 'debouncing', error: null });

  // Schedule auto-backup execution after quiet period
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    executeAutoBackup();
  }, AUTO_BACKUP_DEBOUNCE_MS);
}

/**
 * Executes a single background auto-backup run.
 */
async function executeAutoBackup() {
  // Silent check: if Drive not connected or no user, abort silently
  if (!currentUser || !isDriveConnected()) {
    updateStatus({ status: 'idle' });
    return;
  }

  // Concurrency check: If upload is already in progress, mark pending change and exit
  if (isUploading) {
    hasPendingChange = true;
    return;
  }

  isUploading = true;
  hasPendingChange = false;
  const now = new Date();
  updateStatus({ status: 'uploading', lastAttemptAt: now.toISOString(), error: null });

  try {
    // 1. Double-check token is valid without prompting popup
    const accessToken = await requestDriveAccessToken(currentUser.email);

    // 2. Read full persisted state and build backup snapshot
    const backupPayload = await createBackupPayload(currentUser);

    // 3. Validate snapshot before uploading (protect against corrupt/empty state)
    validateBackupPayload(backupPayload);

    if (!backupPayload.data || !Array.isArray(backupPayload.data.textLibrary)) {
      throw new Error('Snapshot validation failed: textLibrary is not an array');
    }

    // 4. Serialize to Blob
    const backupBlob = serializeBackupToBlob(backupPayload);

    // 5. Get or create LinguaFlow Backups folder in Drive
    const folderId = await getOrCreateBackupFolder(accessToken);

    // 6. Generate distinct auto-backup filename
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${AUTO_BACKUP_FILE_PREFIX}${dateStr}.json`;

    // 7. Upload file to Google Drive
    const uploadResult = await uploadBackupFile(accessToken, folderId, fileName, backupBlob);

    if (!uploadResult || !uploadResult.id) {
      throw new Error('Google Drive no devolvió confirmación del archivo subido.');
    }

    // 8. RETENTION CLEANUP (ONLY EXECUTED AFTER SUCCESSFUL UPLOAD CONFIRMATION)
    try {
      const allFiles = await listBackupFiles(accessToken, folderId);

      // STRICT RETENTION RULE:
      // Filter ONLY auto-backup files (starting with 'linguaflow-autobackup-').
      // MANUAL BACKUPS ('linguaflow-backup-*.json') ARE NEVER TOUCHED OR DELETED.
      const autoBackupFiles = allFiles.filter(f => f && f.name && f.name.startsWith(AUTO_BACKUP_FILE_PREFIX));

      // Sorted newest first by createdTime / modifiedTime
      autoBackupFiles.sort((a, b) => {
        const timeA = new Date(a.createdTime || a.modifiedTime || 0).getTime();
        const timeB = new Date(b.createdTime || b.modifiedTime || 0).getTime();
        return timeB - timeA;
      });

      // Keep latest 3 auto-backups; delete any older excess auto-backup files
      if (autoBackupFiles.length > MAX_AUTO_BACKUP_RETENTION) {
        const excessFiles = autoBackupFiles.slice(MAX_AUTO_BACKUP_RETENTION);
        for (const excessFile of excessFiles) {
          await deleteDriveFile(accessToken, excessFile.id);
        }
      }
    } catch (retentionErr) {
      // Retention cleanup failure is non-fatal: log warning, keep backup
      console.warn('[AutoBackup] Retention cleanup notice:', retentionErr);
    }

    // 9. Update last backup metadata
    const lastBackupMeta = {
      fileId: uploadResult.id,
      fileName: uploadResult.name,
      createdAt: now.toISOString(),
      size: uploadResult.size || backupBlob.size,
      counts: backupPayload.counts,
      isAutoBackup: true
    };
    saveLastBackupMeta(lastBackupMeta);

    updateStatus({
      status: 'idle',
      lastSuccessAt: now.toISOString(),
      error: null
    });
  } catch (err) {
    // SILENT ERROR HANDLING FOR TEXT READER UX:
    // Log to dev console for auditability, update status, but never throw to caller or block UI!
    console.warn('[AutoBackup] Background auto-backup notice:', err.message || err);
    updateStatus({
      status: 'error',
      error: err.message || 'Error en backup automático en segundo plano.'
    });
  } finally {
    isUploading = false;

    // If changes occurred while uploading, schedule follow-up backup after 5s pause
    if (hasPendingChange) {
      hasPendingChange = false;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        executeAutoBackup();
      }, 5000);
    }
  }
}
