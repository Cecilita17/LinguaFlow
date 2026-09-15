import React from 'react';
import {
  ArrowLeft,
  User,
  ShieldCheck,
  CheckCircle2,
  Cloud,
  BookmarkCheck,
  Smartphone,
  LogOut,
  Sparkles,
  Info,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

export function AccountSettingsView({ onBack }) {
  const { user, isAuthenticated, isLoading, error, loginWithGoogle, logout, clearError } = useAuth();
  const { t, isSpanish } = useSiteLanguage();

  return (
    <div className="space-y-6 animate-fade-in text-[var(--text-primary)]">
      {/* Top Bar with Back to Settings button */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_settings')}</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/40">
            <User className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-wide">
            {t('account_title')}
          </h2>
        </div>

        <div className="w-20" />
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-xs font-bold underline cursor-pointer hover:opacity-80"
          >
            {isSpanish ? 'Cerrar' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* MAIN CONTENT CARD */}
      {isAuthenticated && user ? (
        /* ==================== AUTHENTICATED STATE ==================== */
        <div className="space-y-6">
          {/* User Profile Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left">
              {/* Profile Avatar */}
              <div className="relative shrink-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google Profile'}
                    className="w-20 h-20 rounded-full border-2 border-rose-500/60 object-cover shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-rose-500/60 shadow-lg">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                {/* Google Icon Badge on avatar */}
                <div
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-stone-900 border border-[var(--border-primary)] flex items-center justify-center shadow-md"
                  title="Google"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
              </div>

              {/* Profile Details */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
                    {user.displayName || 'Usuario LinguaFlow'}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>{t('account_status_active')}</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-mono truncate">
                  {user.email}
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('account_google_connected')}</span>
                  </span>
                  <span>•</span>
                  <span>{t('account_sync_ready_note')}</span>
                </div>
              </div>
            </div>

            {/* Sign Out Action */}
            <div className="mt-6 pt-5 border-t border-[var(--border-primary)]/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-muted)]">
                {isSpanish
                  ? 'Puedes cerrar sesión en cualquier momento. Tu progreso local se mantendrá intacto en este navegador.'
                  : 'You can sign out at any time. Your local learning data remains safe on this browser.'}
              </span>
              <button
                type="button"
                onClick={logout}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('account_logout')}</span>
              </button>
            </div>
          </div>

          {/* Account Status / Cloud Sync Foundation Card */}
          <div className="p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
              <Cloud className="w-4 h-4 text-rose-500" />
              <span>{isSpanish ? 'Estado de Sincronización' : 'Sync Status'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] space-y-1">
                <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs">
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>{isSpanish ? 'Vocabulario' : 'Vocabulary'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isSpanish ? 'Guardado localmente y listo para nube' : 'Locally stored & ready for cloud'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] space-y-1">
                <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSpanish ? 'Historial Chat' : 'Chat History'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isSpanish ? 'Asociado a tu sesión de usuario' : 'Linked to your user session'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] space-y-1">
                <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{isSpanish ? 'Multi-dispositivo' : 'Multi-device'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isSpanish ? 'Compatible con móvil y escritorio' : 'Desktop and mobile ready'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== UNAUTHENTICATED STATE ==================== */
        <div className="space-y-6">
          {/* Welcome & Google Sign-in Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/40">
              <User className="w-7 h-7" />
            </div>

            <div className="space-y-1.5 max-w-lg mx-auto">
              <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                {isSpanish ? 'Accede a tu cuenta de LinguaFlow' : 'Sign in to your LinguaFlow Account'}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {isSpanish
                  ? 'Inicia sesión de forma rápida y segura con Google para guardar tu progreso, sincronizar tu vocabulario y acceder desde cualquier lugar.'
                  : 'Sign in quickly and securely with Google to keep your learning progress, vocabulary, and preferences across devices.'}
              </p>
            </div>

            {/* Google Sign-in Button */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={loginWithGoogle}
                disabled={isLoading}
                className="w-full sm:w-auto min-w-[260px] px-6 py-3.5 rounded-2xl bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-300 dark:border-stone-700 shadow-md hover:shadow-lg flex items-center justify-center gap-3 font-semibold text-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{isLoading ? (isSpanish ? 'Iniciando...' : 'Connecting...') : t('account_login_google')}</span>
              </button>
            </div>

            {/* Privacy note */}
            <div className="pt-2 text-[11px] text-[var(--text-muted)] max-w-md mx-auto leading-relaxed flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>{t('account_privacy_notice')}</span>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span>{t('account_benefits_title')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                  <BookmarkCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    {isSpanish ? 'Vocabulario' : 'Vocabulary'}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {t('account_benefit_sync')}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    {isSpanish ? 'Historial y Textos' : 'History & Texts'}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {t('account_benefit_history')}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    {isSpanish ? 'Multi-dispositivo' : 'Multi-device'}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {t('account_benefit_devices')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountSettingsView;
