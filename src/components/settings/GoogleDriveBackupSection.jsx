/**
 * src/components/settings/GoogleDriveBackupSection.jsx
 * 
 * Google Drive Backup & Restore Section for Settings.
 * Supports:
 * - Connecting Google Drive with drive.file scope via GIS
 * - Manual "Back up now" execution with progress status
 * - Displaying last successful backup timestamp & details
 * - "Restore backup" modal listing available backups with confirmation warning
 * - Atomic validation preventing local data corruption
 * - Dark & Light mode compatible with LinguaFlow styling
 * - Full Spanish & English internationalization
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  FileJson,
  X,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import {
  isDriveConnected,
  requestDriveAccessToken,
  disconnectDrive
} from '../../services/googleDriveService.js';
import {
  performManualBackup,
  getLastBackupMeta,
  getAvailableBackups,
  fetchBackupPayload
} from '../../services/backupService.js';
import { restoreBackupData } from '../../services/restoreService.js';

export function GoogleDriveBackupSection({ onNavigateToAccount }) {
  const { user, isAuthenticated } = useAuth();
  const { t, isSpanish } = useSiteLanguage();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatusMessage, setBackupStatusMessage] = useState('');
  const [lastBackup, setLastBackup] = useState(null);

  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text: '' }
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [availableBackups, setAvailableBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Initialize last backup meta from localStorage
  useEffect(() => {
    const meta = getLastBackupMeta();
    if (meta) {
      setLastBackup(meta);
    }
    setConnected(isDriveConnected());
  }, []);

  // Sync connected state with auth
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectDrive();
      setConnected(false);
    } else {
      setConnected(isDriveConnected());
    }
  }, [isAuthenticated]);

  const showNotification = useCallback((type, text) => {
    setNotice({ type, text });
    if (type === 'success') {
      setTimeout(() => setNotice(null), 5000);
    }
  }, []);

  // Format date helper
  const formatDateTime = (isoString) => {
    if (!isoString) return t('backup_never');
    try {
      const d = new Date(isoString);
      return d.toLocaleString(isSpanish ? 'es-ES' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Format bytes helper
  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    const num = parseInt(bytes, 10);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 1. Connect Google Drive
  const handleConnectDrive = async () => {
    if (!isAuthenticated || !user) {
      if (onNavigateToAccount) {
        onNavigateToAccount();
      }
      return;
    }

    setConnecting(true);
    setNotice(null);
    try {
      await requestDriveAccessToken(user.email);
      setConnected(true);
      showNotification('success', isSpanish ? 'Google Drive conectado correctamente.' : 'Connected to Google Drive successfully.');
    } catch (err) {
      console.warn('Connect Drive failed:', err);
      showNotification('error', err.message || (isSpanish ? 'Error al conectar con Google Drive.' : 'Failed to connect to Google Drive.'));
    } finally {
      setConnecting(false);
    }
  };

  // 2. Perform Manual Backup
  const handleBackUpNow = async () => {
    if (!isAuthenticated || !user) {
      showNotification('error', t('backup_require_login'));
      return;
    }

    setBackupLoading(true);
    setNotice(null);
    setBackupStatusMessage(t('backup_preparing'));

    try {
      const meta = await performManualBackup(user, ({ message }) => {
        setBackupStatusMessage(message);
      });

      setLastBackup(meta);
      setConnected(true);
      showNotification('success', t('backup_success'));
    } catch (err) {
      console.error('Manual backup failed:', err);
      showNotification('error', err.message || (isSpanish ? 'Error al realizar la copia de seguridad.' : 'Manual backup failed.'));
    } finally {
      setBackupLoading(false);
      setBackupStatusMessage('');
    }
  };

  // 3. Open Restore Modal and Fetch Available Backups
  const handleOpenRestoreModal = async () => {
    if (!isAuthenticated || !user) {
      showNotification('error', t('backup_require_login'));
      return;
    }

    setRestoreModalOpen(true);
    setLoadingBackups(true);
    setAvailableBackups([]);
    setSelectedBackupId('');
    setNotice(null);

    try {
      const files = await getAvailableBackups(user.email);
      setAvailableBackups(files);
      setConnected(true);
      if (files.length > 0) {
        setSelectedBackupId(files[0].id);
      }
    } catch (err) {
      console.error('Error fetching backups list:', err);
      showNotification('error', err.message || (isSpanish ? 'Error al obtener la lista de copias en Google Drive.' : 'Error fetching backups from Google Drive.'));
    } finally {
      setLoadingBackups(false);
    }
  };

  // 4. Confirm and Execute Restore
  const handleConfirmRestore = async () => {
    if (!selectedBackupId || !user) return;

    setRestoring(true);
    try {
      // Step A: Download
      const payload = await fetchBackupPayload(user.email, selectedBackupId);

      // Step B: Validate & Restore (Atomic guarantee: errors throw before modifying state)
      await restoreBackupData(payload);

      showNotification('success', t('backup_restore_success'));
      setRestoreModalOpen(false);

      // Step C: Refresh React application state by soft reloading or triggering storage events
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1200);
    } catch (err) {
      console.error('Restore error:', err);
      showNotification('error', err.message || (isSpanish ? 'Error al restaurar la copia de seguridad.' : 'Failed to restore backup.'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
          <Cloud className="w-4 h-4 text-rose-500" />
          <span>{t('backup_section_title')}</span>
        </h2>

        {/* Status Badge */}
        {connected ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('backup_status_connected')}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface-secondary)] border border-[var(--border-primary)] px-2.5 py-0.5 rounded-full">
            <span>{t('backup_status_not_connected')}</span>
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
        {t('backup_section_desc')}
      </p>

      {/* Alert banner if notice present */}
      {notice && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center justify-between border ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-bold underline cursor-pointer ml-2 hover:opacity-80"
          >
            {isSpanish ? 'Cerrar' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] space-y-4">
        {/* Last backup metadata row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-primary)]/70 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Clock className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-medium">{t('backup_last_backup')}</span>
            <strong className="text-[var(--text-primary)] font-semibold">
              {formatDateTime(lastBackup?.createdAt)}
            </strong>
          </div>

          {lastBackup && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
              {lastBackup.size && <span>{formatBytes(lastBackup.size)}</span>}
              {lastBackup.counts && (
                <span>
                  • {lastBackup.counts.textDocumentsCount || 0} {isSpanish ? 'textos' : 'texts'}, {lastBackup.counts.savedWordsCount || 0} {isSpanish ? 'palabras' : 'words'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isAuthenticated ? (
          /* User Not Signed In with Google */
          <div className="space-y-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{t('backup_require_login')}</span>
            </p>
            {onNavigateToAccount && (
              <button
                type="button"
                onClick={onNavigateToAccount}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] cursor-pointer transition-all active:scale-98 shadow-xs"
              >
                {t('account_enter_section')}
              </button>
            )}
          </div>
        ) : !connected ? (
          /* Signed in, but Google Drive not connected */
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                {isSpanish ? 'Autorizar acceso a Google Drive' : 'Authorize Google Drive Access'}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {isSpanish
                  ? 'Permite guardar copias en tu carpeta privada "LinguaFlow Backups" de Google Drive.'
                  : 'Allows storing backups in your private "LinguaFlow Backups" folder in Google Drive.'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={connecting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-950/20 disabled:opacity-50 shrink-0"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              <span>{connecting ? (isSpanish ? 'Conectando...' : 'Connecting...') : t('backup_connect_btn')}</span>
            </button>
          </div>
        ) : (
          /* Connected State: Back up now & Restore backup */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Back up now Button */}
              <button
                type="button"
                onClick={handleBackUpNow}
                disabled={backupLoading}
                className="flex-1 min-w-[160px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-950/20 disabled:opacity-50"
              >
                {backupLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                <span>
                  {backupLoading
                    ? (backupStatusMessage || t('backup_preparing'))
                    : t('backup_now_btn')}
                </span>
              </button>

              {/* Restore backup Button */}
              <button
                type="button"
                onClick={handleOpenRestoreModal}
                disabled={backupLoading}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xs disabled:opacity-50"
              >
                <CloudDownload className="w-4 h-4 text-rose-500" />
                <span>{t('backup_restore_btn')}</span>
              </button>
            </div>

            {/* Privacy and scope note */}
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>
                {isSpanish
                  ? 'Usa el permiso seguro "drive.file": LinguaFlow solo puede leer y crear copias dentro de su propia carpeta.'
                  : 'Uses the secure "drive.file" scope: LinguaFlow can only create and access files in its own backup folder.'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* RESTORE MODAL */}
      {restoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-5 sm:p-6 shadow-2xl space-y-5 text-[var(--text-primary)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
                  <CloudDownload className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                  {t('backup_restore_confirm_title')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                disabled={restoring}
                className="w-8 h-8 rounded-full hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Message */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{t('backup_restore_confirm_desc')}</span>
            </div>

            {/* Backups List */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                {t('backup_select_to_restore')}
              </label>

              {loadingBackups ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                  <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                  <span>{isSpanish ? 'Cargando copias de Google Drive...' : 'Loading backups from Google Drive...'}</span>
                </div>
              ) : availableBackups.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-primary)]">
                  <HardDrive className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-1 opacity-50" />
                  <p>{t('backup_no_backups_found')}</p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {availableBackups.map((file) => (
                    <label
                      key={file.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedBackupId === file.id
                          ? 'bg-rose-500/15 border-rose-500 text-[var(--text-primary)] shadow-xs'
                          : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="radio"
                          name="backup-selection"
                          value={file.id}
                          checked={selectedBackupId === file.id}
                          onChange={() => setSelectedBackupId(file.id)}
                          className="accent-rose-500 shrink-0 cursor-pointer"
                        />
                        <FileJson className="w-4 h-4 text-rose-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate text-[var(--text-primary)]">
                            {formatDateTime(file.createdTime || file.modifiedTime)}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono block truncate">
                            {file.name}
                          </span>
                        </div>
                      </div>

                      {file.size && (
                        <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0 pl-2">
                          {formatBytes(file.size)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[var(--border-primary)]">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                disabled={restoring}
                className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('backup_cancel')}
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={!selectedBackupId || restoring || loadingBackups || availableBackups.length === 0}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-950/20 disabled:opacity-50"
              >
                {restoring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{restoring ? t('backup_restoring') : t('backup_confirm_restore')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoogleDriveBackupSection;
