import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  Volume2,
  Play,
  Square,
  Loader2,
  Sparkles,
  Info,
  Check,
  Globe
} from 'lucide-react';
import { LANGUAGE_METADATA } from '../../constants/languages.js';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

export const CALL_VOICE_STORAGE_KEY = 'linguaflow_call_voice_preferences';

// Supported call languages in order of display
const CALL_LANGUAGES = [
  'es', 'en', 'fr', 'de', 'it', 'pt', 'ru', 'pl', 'nl', 'tr', 'zh', 'ar', 'ja', 'ko'
];

const PREVIEW_PHRASES = {
  es: 'Hola, soy LinguaFlow. Vamos a practicar español juntos.',
  en: "Hello, I'm LinguaFlow. Let's practice English together.",
  fr: 'Bonjour, je suis LinguaFlow. Pratiquons le français ensemble.',
  de: 'Hallo, ich bin LinguaFlow. Lass uns zusammen Deutsch üben.',
  it: "Ciao, sono LinguaFlow. Pratichiamo l'italiano insieme.",
  pt: 'Olá, eu sou o LinguaFlow. Vamos praticar português juntos.',
  ru: 'Привет, я LinguaFlow. Давай вместе попрактикуем русский язык.',
  pl: 'Cześć, jestem LinguaFlow. Ćwiczmy razem język polski.',
  nl: 'Hallo, ik ben LinguaFlow. Laten we samen Nederlands oefenen.',
  tr: 'Merhaba, ben LinguaFlow. Birlikte Türkçe pratik yapalım.',
  zh: '你好，我是 LinguaFlow。我们一起来练习中文吧。',
  ar: 'مرحباً، أنا LinguaFlow. دعنا نتدرب معاً على اللغة العربية.',
  ja: 'こんにちは、LinguaFlowです。一緒に日本語を練習しましょう。',
  ko: '안녕하세요, LinguaFlow입니다. 함께 한국어를 연습해 봅시다.'
};

export function getStoredCallVoicePreferences() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(CALL_VOICE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

export function saveStoredCallVoicePreferences(prefs) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CALL_VOICE_STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch (e) {}
}

export function CallVoiceSettingsSection({ onPreferencesChange }) {
  const { isSpanish } = useSiteLanguage();
  const [voices, setVoices] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [preferences, setPreferences] = useState(getStoredCallVoicePreferences);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [loadingLang, setLoadingLang] = useState(null);
  const [playingLang, setPlayingLang] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const currentAudioRef = useRef(null);
  const currentObjectUrlRef = useRef(null);

  // Stop any active audio preview
  const stopAudioPreview = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (e) {}
      currentAudioRef.current = null;
    }
    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      } catch (e) {}
      currentObjectUrlRef.current = null;
    }
    setPlayingLang(null);
    setLoadingLang(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioPreview();
    };
  }, [stopAudioPreview]);

  // Load available Cartesia voices from backend
  useEffect(() => {
    let cancelled = false;

    async function fetchVoices() {
      try {
        setLoadingVoices(true);
        const res = await fetch('/api/pipeline/voices');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data) {
            if (Array.isArray(data.voices)) setVoices(data.voices);
            if (data.defaults && typeof data.defaults === 'object') setDefaults(data.defaults);
          }
        }
      } catch (err) {
        console.warn('[CallVoiceSettings] Could not fetch Cartesia voices:', err);
      } finally {
        if (!cancelled) setLoadingVoices(false);
      }
    }

    fetchVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle voice selection change for a specific language
  const handleVoiceSelect = (langCode, voiceId) => {
    const next = { ...preferences };
    if (!voiceId) {
      delete next[langCode];
    } else {
      next[langCode] = voiceId;
    }
    setPreferences(next);
    saveStoredCallVoicePreferences(next);
    if (onPreferencesChange) {
      onPreferencesChange(next);
    }
  };

  // Test voice with Cartesia TTS
  const handleTestVoice = async (langCode) => {
    // If already playing this language, stop it
    if (playingLang === langCode) {
      stopAudioPreview();
      return;
    }

    stopAudioPreview();
    setLoadingLang(langCode);
    setPreviewError(null);

    const effectiveVoiceId = preferences[langCode] || defaults[langCode]?.voiceId || '';
    const sampleText = PREVIEW_PHRASES[langCode] || PREVIEW_PHRASES.en;

    try {
      const res = await fetch('/api/pipeline/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voice: effectiveVoiceId,
          targetLang: langCode
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error ${res.status}: ${errText.slice(0, 100)}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        stopAudioPreview();
      };
      audio.onerror = (e) => {
        console.error('[CallVoiceSettings] Audio playback error:', e);
        stopAudioPreview();
        setPreviewError(isSpanish ? 'Error al reproducir audio de prueba.' : 'Error playing preview audio.');
      };

      await audio.play();
      setLoadingLang(null);
      setPlayingLang(langCode);
    } catch (err) {
      console.error('[CallVoiceSettings] Preview TTS error:', err);
      stopAudioPreview();
      setPreviewError(
        isSpanish
          ? 'No se pudo generar el audio de prueba. Verifica la conexión con el backend.'
          : 'Could not generate preview audio. Check backend connection.'
      );
    }
  };

  // Separate owned / cloned voices from standard Cartesia voices
  const myVoices = voices.filter(v => v.is_owner);
  const cartesiaVoices = voices.filter(v => !v.is_owner);

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
          <Mic className="w-4 h-4 text-rose-500" />
          <span>{isSpanish ? '🎙️ Voces para llamadas' : '🎙️ Call Voices'}</span>
        </h2>
        {loadingVoices && (
          <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
            <span>{isSpanish ? 'Cargando voces...' : 'Loading voices...'}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
        {isSpanish
          ? 'Seleccioná la voz de Cartesia que utilizará LinguaFlow AI durante las llamadas de voz. Estas voces afectan únicamente las Live Calls.'
          : 'Choose the Cartesia voice LinguaFlow AI will use during voice calls. These voices affect only Live Calls.'}
      </p>

      {previewError && (
        <div className="mb-3.5 p-2.5 rounded-xl text-xs bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/30 flex items-center gap-2">
          <span>⚠️</span>
          <span>{previewError}</span>
        </div>
      )}

      {/* Grid of Languages */}
      <div className="space-y-2.5">
        {CALL_LANGUAGES.map((langCode) => {
          const meta = LANGUAGE_METADATA[langCode] || { name: langCode.toUpperCase(), flag: '🌐' };
          const selectedVoiceId = preferences[langCode] || '';
          const defaultVoiceInfo = defaults[langCode] || {};
          const isPlaying = playingLang === langCode;
          const isLoading = loadingLang === langCode;

          return (
            <div
              key={langCode}
              className="p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-[var(--border-hover)] transition-all"
            >
              {/* Language Name & Flag */}
              <div className="flex items-center gap-2.5 min-w-[130px] shrink-0">
                <span className="text-lg select-none">{meta.flag}</span>
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    {meta.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {langCode.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Voice Select & Test Button */}
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <div className="relative flex-1 max-w-[260px]">
                  <select
                    value={selectedVoiceId}
                    onChange={(e) => handleVoiceSelect(langCode, e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-rose-500 font-medium cursor-pointer shadow-xs truncate"
                  >
                    <option value="">
                      {isSpanish ? 'Voz recomendada por defecto' : 'Default recommended voice'}
                    </option>

                    {myVoices.length > 0 && (
                      <optgroup label={isSpanish ? '⭐ Mis voces clonadas' : '⭐ My cloned voices'}>
                        {myVoices.map((v) => (
                          <option key={`my-${v.id}`} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label={isSpanish ? 'Voces de Cartesia' : 'Cartesia voices'}>
                      {cartesiaVoices.map((v) => (
                        <option key={`pub-${v.id}`} value={v.id}>
                          {v.name} {v.description ? `(${v.description.slice(0, 30)}...)` : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Test Button */}
                <button
                  type="button"
                  onClick={() => handleTestVoice(langCode)}
                  disabled={isLoading}
                  title={isSpanish ? 'Probar cómo suena esta voz' : 'Test how this voice sounds'}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs ${
                    isPlaying
                      ? 'bg-rose-600 text-white border border-rose-500 animate-pulse'
                      : 'bg-[var(--surface-tertiary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-primary)]'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                  ) : isPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>{isSpanish ? 'Detener' : 'Stop'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current text-rose-500" />
                      <span>{isSpanish ? 'Probar' : 'Test'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start space-x-2 text-xs text-[var(--text-secondary)] bg-[var(--surface-secondary)] p-3 rounded-2xl border border-[var(--border-primary)]">
        <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed text-[var(--text-muted)]">
          {isSpanish ? (
            <p>
              Tus preferencias se guardan automáticamente por idioma. Las voces clonadas en tu cuenta de Cartesia aparecen identificadas con estrella (⭐) para fácil selección.
            </p>
          ) : (
            <p>
              Your preferences are saved automatically per language. Cloned voices on your Cartesia account are marked with a star (⭐) for easy selection.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallVoiceSettingsSection;
