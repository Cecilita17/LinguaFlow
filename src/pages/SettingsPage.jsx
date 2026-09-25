import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Globe,
  Palette,
  Sparkles,
  Zap,
  Server,
  Info,
  Gauge,
  Volume2,
  Mic,
  MicOff,
  Type,
  RotateCcw,
  Check,
  Save,
  Sun,
  Moon,
  Monitor,
  Languages,
  User,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL } from '../services/chatService.js';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAudioSettings, SPEECH_RATE_OPTIONS } from '../context/AudioSettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { SiteLanguageToggle } from '../components/SiteLanguageToggle.jsx';
import { AccountSettingsView } from '../components/settings/AccountSettingsView.jsx';
import { GoogleDriveBackupSection } from '../components/settings/GoogleDriveBackupSection.jsx';
import { CallVoiceSettingsSection } from '../components/settings/CallVoiceSettingsSection.jsx';
import { NATIVE_LANG_OPTIONS } from '../constants/languages.js';

export function SettingsPage({
  onBack,
  config = {},
  onSaveConfig,
  targetLang,
  setTargetLang,
  nativeLang,
  setNativeLang,
  languages = [],
  showTransliteration,
  setShowTransliteration,
  handsFree,
  setHandsFree,
  onResetChat
}) {
  const { siteLang, setSiteLang, isSpanish, t } = useSiteLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const {
    speechRate: globalSpeechRate,
    setSpeechRate: setGlobalSpeechRate,
    autoPlayAi,
    setAutoPlayAi,
    autoPlayTextReader,
    setAutoPlayTextReader
  } = useAudioSettings();

  const [activeSubView, setActiveSubView] = useState('main'); // 'main' | 'account'
  const [level, setLevel] = useState(config.level || 'A2/B1');
  const [speechRate, setSpeechRate] = useState(globalSpeechRate || config.speechRate || 1.0);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (config.level) setLevel(config.level);
    if (globalSpeechRate) setSpeechRate(globalSpeechRate);
  }, [config, globalSpeechRate]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus({
          success: true,
          message: isSpanish
            ? `¡Conexión exitosa con el backend de LinguaFlow! Modelo activo: ${data.model || 'openai/gpt-oss-120b'}.`
            : `Successful connection to LinguaFlow backend! Active model: ${data.model || 'openai/gpt-oss-120b'}.`
        });
      } else {
        setConnectionStatus({
          success: false,
          message: isSpanish
            ? `El servidor respondió con estado HTTP ${res.status}.`
            : `Server responded with HTTP status ${res.status}.`
        });
      }
    } catch (e) {
      setConnectionStatus({
        success: false,
        message: isSpanish
          ? `Error de conexión con el backend: ${e.message}. Asegúrate de que el servidor esté en ejecución.`
          : `Connection error with backend: ${e.message}. Make sure server is running.`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleLevelChange = (newLevel) => {
    setLevel(newLevel);
    if (onSaveConfig) {
      onSaveConfig({ ...config, level: newLevel });
      triggerNotice();
    }
  };

  const handleRateChange = (newRate) => {
    setSpeechRate(newRate);
    setGlobalSpeechRate(newRate);
    if (onSaveConfig) {
      onSaveConfig({ ...config, speechRate: newRate });
      triggerNotice();
    }
  };

  const triggerNotice = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  if (activeSubView === 'account') {
    return (
      <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)]">
        <AccountSettingsView onBack={() => setActiveSubView('main')} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)]">
      {/* Top Header with Back to Home Button */}
      <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isSpanish ? 'Inicio' : 'Home'}</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/40">
            <SettingsIcon className="w-4 h-4" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-wide">
            {isSpanish ? 'Ajustes de LinguaFlow' : 'LinguaFlow Settings'}
          </h1>
        </div>

        {/* Auto-save notification badge */}
        <div className="w-20 flex justify-end">
          {savedNotice && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-fade-in">
              <Check className="w-3 h-3" />
              {isSpanish ? 'Guardado' : 'Saved'}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 pb-28 sm:pb-32">
        {/* SECTION 0: CUENTA / ACCOUNT */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/70 dark:bg-[#241009]/85 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm">
          <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-rose-500" />
            <span>{t('account_title')}</span>
          </h2>

          <button
            type="button"
            onClick={() => setActiveSubView('account')}
            className="w-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/5 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between text-left transition-all cursor-pointer active:scale-[0.99] group shadow-xs"
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              {isAuthenticated && user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google Profile'}
                  className="w-10 h-10 rounded-full border border-rose-500/50 object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-sm font-bold text-sm">
                  {isAuthenticated && user?.displayName ? user.displayName[0].toUpperCase() : <User className="w-5 h-5" />}
                </div>
              )}

              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] group-hover:text-rose-500 transition-colors truncate">
                    {isAuthenticated && user ? user.displayName || user.email : t('account_not_logged_in')}
                  </span>
                  {isAuthenticated ? (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full font-bold">
                      Google
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px] text-[var(--text-muted)] block truncate">
                  {isAuthenticated && user
                    ? user.email
                    : (isSpanish ? 'Inicia sesión con Google para sincronizar y guardar tu progreso' : 'Sign in with Google to sync and save your progress')}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0 pl-2 text-[var(--text-secondary)] group-hover:text-rose-500 transition-colors">
              <span className="text-xs font-semibold hidden sm:inline">
                {t('account_enter_section')}
              </span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>

        {/* SECTION 0.5: GOOGLE DRIVE BACKUP & RESTORE */}
        <GoogleDriveBackupSection onNavigateToAccount={() => setActiveSubView('account')} />

        {/* SECTION 1: IDIOMA Y TEMA */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md">
          <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-rose-500" />
            <span>{isSpanish ? 'Idioma y Apariencia' : 'Language & Appearance'}</span>
          </h2>

          <div className="space-y-4">
            {/* Website Language */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                {isSpanish ? 'Idioma del Sitio Web (UI)' : 'Website Language (UI)'}
              </label>
              <SiteLanguageToggle variant="segmented" />
            </div>

            {/* Target & Native Languages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  {isSpanish ? 'Idioma a Aprender (Target)' : 'Study Language (Target)'}
                </label>
                <LanguageSelectDropdown
                  value={targetLang}
                  onChange={setTargetLang}
                  options={languages}
                  variant="card"
                  align="left"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  {isSpanish ? 'Tu Idioma (Nativo / Traducciones)' : 'Your Native Language'}
                </label>
                <LanguageSelectDropdown
                  value={nativeLang}
                  onChange={setNativeLang}
                  options={NATIVE_LANG_OPTIONS}
                  variant="card"
                  align="left"
                  className="w-full"
                />
              </div>
            </div>

            {/* Theme Selection */}
            <div className="pt-2 border-t border-[var(--border-primary)]/60">
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-rose-500" />
                  <span>{isSpanish ? 'Tema Visual' : 'Theme'}</span>
                </span>
                <span className="text-[11px] text-rose-600 dark:text-rose-300 font-mono">
                  {theme === 'system' ? (isSpanish ? 'Sistema' : 'System') : theme === 'dark' ? (isSpanish ? 'Oscuro' : 'Dark') : (isSpanish ? 'Claro' : 'Light')}
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-white shadow-xs'
                      : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isSpanish ? 'Claro' : 'Light'}</span>
                  {theme === 'light' && <Check className="w-3 h-3 text-rose-500 dark:text-rose-400 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-white shadow-xs'
                      : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>{isSpanish ? 'Oscuro' : 'Dark'}</span>
                  {theme === 'dark' && <Check className="w-3 h-3 text-rose-500 dark:text-rose-400 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    theme === 'system'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-white shadow-xs'
                      : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                  <span>{isSpanish ? 'Sistema' : 'System'}</span>
                  {theme === 'system' && <Check className="w-3 h-3 text-rose-500 dark:text-rose-400 ml-0.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: VOZ Y REPRODUCCIÓN */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md">
          <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-rose-500" />
            <span>{isSpanish ? 'Voz y Reproducción' : 'Voice & Playback'}</span>
          </h2>

          <div className="space-y-3.5">
            {/* Transliteration */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-[var(--surface-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-rose-500 dark:text-rose-400 font-serif font-bold text-xs">
                  T
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    {t('transliteration')}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {isSpanish ? 'Pinyin / Romaji sobre palabras' : 'Pinyin / Romaji above words'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransliteration(!showTransliteration)}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-0.5 cursor-pointer ${
                  showTransliteration
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end pr-1.5'
                    : 'bg-[var(--surface-tertiary)] border border-[var(--border-primary)] justify-start pl-0.5'
                }`}
              >
                {showTransliteration ? (
                  <span className="text-[10px] font-bold text-white tracking-wide">ON</span>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                )}
              </button>
            </div>

            {/* Hands Free */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-full bg-[var(--surface-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-rose-500 dark:text-rose-400">
                  <Mic className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    {t('hands_free')}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {isSpanish ? 'Conversación por voz continua sin pulsar botones' : 'Continuous speech without pressing buttons'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHandsFree(!handsFree)}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-0.5 cursor-pointer ${
                  handsFree
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end pr-1.5'
                    : 'bg-[var(--surface-tertiary)] border border-[var(--border-primary)] justify-start pl-0.5'
                }`}
              >
                {handsFree ? (
                  <span className="text-[10px] font-bold text-white tracking-wide">ON</span>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                )}
              </button>
            </div>

            {/* Auto Play AI Responses */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
              <div className="flex items-center space-x-3 pr-2">
                <div className="w-7 h-7 rounded-full bg-[var(--surface-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block leading-snug">
                    {t('auto_play_ai_title')}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t('auto_play_ai_desc')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoPlayAi(!autoPlayAi)}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-0.5 shrink-0 cursor-pointer ${
                  autoPlayAi
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end pr-1.5'
                    : 'bg-[var(--surface-tertiary)] border border-[var(--border-primary)] justify-start pl-0.5'
                }`}
              >
                {autoPlayAi ? (
                  <span className="text-[10px] font-bold text-white tracking-wide">ON</span>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                )}
              </button>
            </div>

            {/* Auto Play Text Reader */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
              <div className="flex items-center space-x-3 pr-2">
                <div className="w-7 h-7 rounded-full bg-[var(--surface-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block leading-snug">
                    Auto-play Text Reader
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {isSpanish
                      ? 'Reproducir automáticamente el siguiente párrafo al terminar el actual.'
                      : 'Automatically play the next paragraph when current finishes.'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoPlayTextReader(!autoPlayTextReader)}
                className={`w-12 h-6 rounded-full transition-all flex items-center px-0.5 shrink-0 cursor-pointer ${
                  autoPlayTextReader
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end pr-1.5'
                    : 'bg-[var(--surface-tertiary)] border border-[var(--border-primary)] justify-start pl-0.5'
                }`}
              >
                {autoPlayTextReader ? (
                  <span className="text-[10px] font-bold text-white tracking-wide">ON</span>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                )}
              </button>
            </div>

            {/* Speech Rate Selector */}
            <div className="p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t('speech_playback_speed')}</span>
                </span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {Number(speechRate).toFixed(2)}×
                </span>
              </div>
              <select
                value={speechRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value) || 1.0)}
                aria-label={t('speech_playback_speed')}
                className="w-full bg-[var(--surface-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                {SPEECH_RATE_OPTIONS.map((rate) => (
                  <option key={rate} value={rate} className="bg-[var(--surface-primary)] text-[var(--text-primary)]">
                    {rate.toFixed(2)}×
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2.5: VOCES PARA LLAMADAS (CARTESIA) */}
        <CallVoiceSettingsSection onPreferencesChange={triggerNotice} />

        {/* SECTION 3: INTELIGENCIA ARTIFICIAL Y BACKEND */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md">
          <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-500" />
            <span>{isSpanish ? 'Inteligencia Artificial y Conexión' : 'AI & Backend'}</span>
          </h2>

          <div className="space-y-4">
            {/* Active Model */}
            <div className="p-3 bg-[var(--surface-secondary)] border border-[var(--border-primary)] rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">Groq Cloud AI</div>
                  <div className="text-[11px] text-rose-600 dark:text-rose-300 font-mono">openai/gpt-oss-120b</div>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                ⚡ {isSpanish ? 'Ultra Rápido' : 'Ultra Fast'}
              </span>
            </div>

            {/* Proficiency Level */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-rose-500" />
                <span>{isSpanish ? 'Nivel de Dificultad del Tutor' : 'Tutor Proficiency Level'}</span>
              </label>
              <select
                value={level}
                onChange={(e) => handleLevelChange(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs sm:text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-rose-500 font-medium cursor-pointer shadow-xs"
              >
                <option value="A1">{isSpanish ? 'A1 - Principiante (frases muy simples y cortas)' : 'A1 - Beginner (simple, short sentences)'}</option>
                <option value="A2/B1">{isSpanish ? 'A2 / B1 - Intermedio cotidiano (Recomendado)' : 'A2 / B1 - Everyday Intermediate (Recommended)'}</option>
                <option value="B2/C1">{isSpanish ? 'B2 / C1 - Advanced and fluent' : 'B2 / C1 - Advanced and fluent'}</option>
              </select>
            </div>

            {/* Backend Status Check */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-rose-500" />
                  <span>{isSpanish ? 'Estado del Backend' : 'Backend Status'}</span>
                </span>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold underline disabled:opacity-50 cursor-pointer"
                >
                  {testingConnection ? (isSpanish ? 'Comprobando...' : 'Checking...') : (isSpanish ? 'Verificar conexión' : 'Test connection')}
                </button>
              </div>

              {connectionStatus && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 border mb-2 ${
                    connectionStatus.success
                      ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border-rose-500/30'
                  }`}
                >
                  <span className="mt-0.5">{connectionStatus.success ? '✅' : '⚠️'}</span>
                  <span className="font-medium leading-relaxed">{connectionStatus.message}</span>
                </div>
              )}

              <div className="flex items-start space-x-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-secondary)] p-3 rounded-2xl border border-[var(--border-primary)]">
                <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p>
                    <strong className="text-[var(--text-primary)]">{isSpanish ? 'Seguridad:' : 'Security:'}</strong> {isSpanish ? 'La clave' : 'The'} <code className="bg-[var(--surface-tertiary)] px-1 py-0.5 rounded border border-[var(--border-primary)] text-rose-600 dark:text-rose-300 font-mono">GROQ_API_KEY</code> {isSpanish ? 'se administra exclusivamente en el servidor backend para proteger tus credenciales.' : 'is managed securely on the backend server.'}
                  </p>
                  <p className="text-[var(--text-muted)]">
                    {isSpanish ? 'Modelo activo:' : 'Active model:'} <code className="font-mono text-rose-600 dark:text-rose-300 font-semibold">openai/gpt-oss-120b</code> {isSpanish ? 'con transcripción Whisper V3.' : 'with Whisper V3 multilingual transcription.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: ACCIONES */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md">
          <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-500" />
            <span>{isSpanish ? 'Acciones' : 'Actions'}</span>
          </h2>

          <button
            type="button"
            onClick={() => {
              if (onResetChat) onResetChat();
              triggerNotice();
            }}
            className="w-full bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] rounded-2xl p-3.5 flex items-center space-x-3 text-left transition-colors cursor-pointer active:scale-98"
          >
            <RotateCcw className="w-4 h-4 text-rose-500 shrink-0" />
            <div>
              <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] block">
                {t('reset_conv')}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {isSpanish ? 'Reinicia la conversación del chat para el idioma seleccionado' : 'Reset chat conversation for the selected language'}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
