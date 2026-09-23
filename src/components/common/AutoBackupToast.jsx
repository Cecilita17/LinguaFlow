/**
 * src/components/common/AutoBackupToast.jsx
 * 
 * Floating, unobtrusive top toast banner for background automatic backups.
 * Displays real-time auto-backup status:
 * - Uploading ("Guardando cambios...")
 * - Success ("Backup completado") -> auto-dismiss after 4s
 * - Error ("Error al guardar los cambios — [mensaje]") -> auto-dismiss after 8s or manual close
 * - Partial ("Backup parcial...")
 * 
 * Silent & Invisible when idle or debouncing (zero noise when no backup work is being performed).
 */

import React, { useState, useEffect } from 'react';
import { CloudUpload, CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  getAutoBackupStatus,
  onAutoBackupStatusChanged
} from '../../services/autoBackupService.js';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

export function AutoBackupToast() {
  const { isSpanish } = useSiteLanguage();
  const [autoStatus, setAutoStatus] = useState(getAutoBackupStatus());
  const [visible, setVisible] = useState(false);
  const [dismissedAttemptAt, setDismissedAttemptAt] = useState(null);

  useEffect(() => {
    // Sync initial state
    const current = getAutoBackupStatus();
    setAutoStatus(current);

    const unsub = onAutoBackupStatusChanged((newStatus) => {
      setAutoStatus(newStatus);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const { status, lastAttemptAt } = autoStatus;
    const currentAttemptKey = lastAttemptAt || status;

    if (status === 'uploading') {
      if (!currentAttemptKey || currentAttemptKey !== dismissedAttemptAt) {
        setVisible(true);
      }
    } else if (status === 'success') {
      if (!currentAttemptKey || currentAttemptKey !== dismissedAttemptAt) {
        setVisible(true);
      }
      const timer = setTimeout(() => {
        setVisible(false);
      }, 4000);
      return () => clearTimeout(timer);
    } else if (status === 'error' || status === 'partial') {
      if (!currentAttemptKey || currentAttemptKey !== dismissedAttemptAt) {
        setVisible(true);
      }
      const timer = setTimeout(() => {
        setVisible(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [autoStatus, dismissedAttemptAt]);

  const currentAttemptKey = autoStatus.lastAttemptAt || autoStatus.status;

  if (
    !visible ||
    autoStatus.status === 'idle' ||
    autoStatus.status === 'debouncing' ||
    (dismissedAttemptAt && dismissedAttemptAt === currentAttemptKey)
  ) {
    return null;
  }

  const { status, error, counts } = autoStatus;
  const isError = status === 'error';
  const isPartial = status === 'partial';
  const isSuccess = status === 'success';
  const isUploading = status === 'uploading';

  // Construct label message
  const getMessage = () => {
    if (isUploading) {
      return isSpanish ? 'Guardando cambios...' : 'Saving changes...';
    }
    if (isSuccess) {
      return isSpanish ? 'Backup completado' : 'Backup completed';
    }
    if (isPartial) {
      return isSpanish
        ? `Backup parcial${error ? ` — ${error}` : ''}`
        : `Partial backup${error ? ` — ${error}` : ''}`;
    }
    if (isError) {
      return isSpanish
        ? `Error al guardar los cambios${error ? ` — ${error}` : ''}`
        : `Failed to save changes${error ? ` — ${error}` : ''}`;
    }
    return '';
  };

  return (
    <div
      role={isError || isPartial ? 'alert' : 'status'}
      aria-live="polite"
      className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[calc(100%-2rem)] sm:w-auto px-4 py-2.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-fade-in flex items-center justify-between gap-3 bg-[var(--surface-primary)] border-[var(--border-primary)] text-[var(--text-primary)]"
    >
      <div className="flex items-center gap-2.5 text-xs font-semibold">
        {isUploading && (
          <CloudUpload className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
        )}
        {isSuccess && (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        )}
        {isPartial && (
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        {isError && (
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
        )}
        <span className="truncate max-w-[240px] sm:max-w-[300px]">
          {getMessage()}
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setDismissedAttemptAt(autoStatus.lastAttemptAt || autoStatus.status);
        }}
        className="p-1 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
        title={isSpanish ? 'Cerrar' : 'Dismiss'}
        aria-label={isSpanish ? 'Cerrar notificación' : 'Dismiss notification'}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default AutoBackupToast;
