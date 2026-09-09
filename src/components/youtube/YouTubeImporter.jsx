import React, { useState } from 'react';
import { validateYouTubeUrl } from '../../services/youtubeService.js';
import { Youtube, Search, AlertCircle, Globe, Check } from 'lucide-react';

const SUPPORTED_VIDEO_LANGUAGES = [
  { code: 'auto', name: 'Auto-detectar' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh', name: '中文 (Chino)' },
  { code: 'ar', name: 'العربية (Árabe)' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語 (Japonés)' }
];

export function YouTubeImporter({
  onImportVideo,
  initialUrl = '',
  selectedLanguage = 'auto',
  onLanguageChange
}) {
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [error, setError] = useState(null);
  const [justImported, setJustImported] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    const validation = validateYouTubeUrl(urlInput);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    if (onImportVideo) {
      onImportVideo(validation.videoId, urlInput.trim());
      setJustImported(true);
      setTimeout(() => setJustImported(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#32170f]/90 border border-[#52271a] shadow-lg shadow-black/30">
      <div className="flex items-center space-x-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-xs">
          <Youtube className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">YouTube Reader</h3>
          <p className="text-xs text-rose-200/70">Aprende idiomas leyendo vídeos con subtítulos sincronizados</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="yt-url-input" className="block text-xs font-semibold text-rose-200/90 mb-1.5">
            Pegá el enlace de YouTube
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                id="yt-url-input"
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://www.youtube.com/watch?v=... o youtu.be/..."
                className="w-full bg-[#1e0f0a] text-white text-xs sm:text-sm font-medium rounded-xl px-3.5 py-2.5 border border-[#5a2e20] placeholder-rose-300/30 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all shadow-inner"
              />
            </div>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-md flex-shrink-0 ${
                justImported
                  ? 'bg-emerald-600 text-white shadow-emerald-900/40'
                  : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950 active:scale-95'
              }`}
            >
              {justImported ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Vídeo cargado!</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Importar vídeo</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center space-x-1.5 mt-2 text-xs font-semibold text-amber-300 bg-amber-950/60 p-2 rounded-xl border border-amber-800/80 animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Video Language Preference Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#482519]/70 text-xs">
          <div className="flex items-center space-x-1.5 text-rose-200/80">
            <Globe className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-medium">Idioma del vídeo:</span>
          </div>

          <select
            value={selectedLanguage}
            onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
            className="bg-[#24120c] text-white font-semibold rounded-lg px-2.5 py-1.5 shadow-xs border border-[#5a2e20] outline-none focus:ring-2 focus:ring-rose-400 text-xs"
          >
            {SUPPORTED_VIDEO_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#24120c] text-white">
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </form>
    </div>
  );
}

export default YouTubeImporter;
