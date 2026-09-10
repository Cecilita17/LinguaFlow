import React, { useState, useEffect, useCallback } from 'react';
import { YouTubePlayer } from '../components/youtube/YouTubePlayer.jsx';
import { YouTubeImporter } from '../components/youtube/YouTubeImporter.jsx';
import { SubtitleImporter } from '../components/youtube/SubtitleImporter.jsx';
import { Transcript } from '../components/youtube/Transcript.jsx';
import { TranscriptControls } from '../components/youtube/TranscriptControls.jsx';
import { enrichSubtitlesWithGlosses } from '../services/subtitleGlossService.js';
import { Youtube, Sparkles, FileText, CheckCircle2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';

const SESSION_STORAGE_KEY = 'linguaflow_youtube_reader_session';

export function YouTubeReaderPage({ targetLang = 'zh', nativeLang = 'es', apiKey = '' }) {
  const { isSpanish } = useSiteLanguage();
  // Session state with localStorage persistence
  const [videoId, setVideoId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLanguage, setVideoLanguage] = useState('auto');
  const [subtitles, setSubtitles] = useState([]);
  const [subtitleFormat, setSubtitleFormat] = useState(null);
  const [subtitleSource, setSubtitleSource] = useState('');
  const [glossProgress, setGlossProgress] = useState(null);

  // Player & synchronization state
  const [currentTime, setCurrentTime] = useState(0);
  const [seekToTime, setSeekToTime] = useState(null);

  // Transcript view preferences
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg' | 'xl'
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [interlinearMode, setInterlinearMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUrlImporterOpen, setIsUrlImporterOpen] = useState(false);

  // 1. Restore previous session on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.videoId) setVideoId(parsed.videoId);
        if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
        if (parsed.videoLanguage) setVideoLanguage(parsed.videoLanguage);
        if (Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
          const enriched = enrichSubtitlesWithGlosses({
            subtitles: parsed.subtitles,
            targetLang,
            nativeLang,
            apiKey,
            videoId: parsed.videoId,
            onUpdate: (updated) => setSubtitles(updated),
            onProgress: (p) => setGlossProgress(p)
          });
          setSubtitles(enriched);
        }
        if (parsed.subtitleFormat) setSubtitleFormat(parsed.subtitleFormat);
        if (parsed.subtitleSource) setSubtitleSource(parsed.subtitleSource);
        if (parsed.preferences) {
          if (typeof parsed.preferences.autoScroll === 'boolean') {
            setAutoScroll(parsed.preferences.autoScroll);
          }
          if (parsed.preferences.fontSize) {
            setFontSize(parsed.preferences.fontSize);
          }
          if (typeof parsed.preferences.showTimestamps === 'boolean') {
            setShowTimestamps(parsed.preferences.showTimestamps);
          }
          if (typeof parsed.preferences.interlinearMode === 'boolean') {
            setInterlinearMode(parsed.preferences.interlinearMode);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load YouTube Reader session from storage:', e);
    }
  }, [targetLang, nativeLang]);

  // 2. Persist session when critical state changes
  useEffect(() => {
    try {
      const sessionData = {
        videoId,
        videoUrl,
        videoLanguage,
        subtitles,
        subtitleFormat,
        subtitleSource,
        preferences: {
          autoScroll,
          fontSize,
          showTimestamps,
          interlinearMode
        }
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Failed to save YouTube Reader session to storage:', e);
    }
  }, [videoId, videoUrl, videoLanguage, subtitles, subtitleFormat, subtitleSource, autoScroll, fontSize, showTimestamps, interlinearMode]);

  // Handlers
  const handleImportVideo = (newVideoId, newUrl) => {
    setVideoId(newVideoId);
    setVideoUrl(newUrl);
    setCurrentTime(0);
    setIsUrlImporterOpen(false);
  };

  const handleSubtitlesLoaded = (newSubtitles, format, sourceName) => {
    setSubtitleFormat(format);
    setSubtitleSource(sourceName);
    const enriched = enrichSubtitlesWithGlosses({
      subtitles: newSubtitles,
      targetLang,
      nativeLang,
      apiKey,
      videoId,
      onUpdate: (updated) => setSubtitles(updated),
      onProgress: (p) => setGlossProgress(p)
    });
    setSubtitles(enriched);
  };

  const handleClearSubtitles = () => {
    setSubtitles([]);
    setSubtitleFormat(null);
    setSubtitleSource('');
    setGlossProgress(null);
  };

  const handleResetSession = () => {
    setVideoId('');
    setVideoUrl('');
    setSubtitles([]);
    setSubtitleFormat(null);
    setSubtitleSource('');
    setCurrentTime(0);
    setSearchQuery('');
    setGlossProgress(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}
  };

  const handleSeek = (timeInSeconds) => {
    setSeekToTime({ time: timeInSeconds, autoPlay: true });
  };

  const handleResetToStart = () => {
    handleSeek(0);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-3 overflow-hidden text-white">
      {/* 1. Header: YouTube Reader + AI Glossing Control */}
      <div className="flex-shrink-0 space-y-2 pb-1">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#200d07] rounded-xl border border-[#482015] shadow-xs text-xs">
          {/* Left: Brand & Target Language */}
          <div className="flex items-center space-x-2 truncate">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Youtube className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-bold text-white tracking-wide text-xs sm:text-sm truncate">
              YouTube Reader
            </h2>
            <span className="text-[10px] bg-[#140603] text-rose-300 px-1.5 py-0.5 rounded border border-[#482015] font-mono shrink-0">
              {targetLang === 'zh' ? '🇨🇳 Chino' : targetLang.toUpperCase()}
            </span>
          </div>

          {/* Right: AI Glossing Toggle + Video Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* AI GLOSSING TOGGLE (Compact in header next to YouTube Reader) */}
            <button
              type="button"
              onClick={() => setInterlinearMode(!interlinearMode)}
              title={
                interlinearMode
                  ? (isSpanish ? 'Glosado IA activo: clic para subtítulos tradicionales' : 'AI Glossing active: click for plain subtitles')
                  : (isSpanish ? 'Activar glosado IA e interlineal' : 'Enable AI Glossing and interlinear breakdown')
              }
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs ${
                interlinearMode
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-400 shadow-rose-950/40'
                  : 'bg-[#2a1209] hover:bg-[#38180d] text-stone-300 border-[#4a2014]'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${interlinearMode ? 'text-white fill-white' : 'text-rose-400'}`} />
              <span className="font-semibold">AI Glossing</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                  interlinearMode
                    ? 'bg-rose-950/90 text-rose-100 border border-rose-800'
                    : 'bg-[#180803] text-stone-400 border border-[#3e1b10]'
                }`}
              >
                {interlinearMode ? 'ON' : 'OFF'}
              </span>

              {/* Live Glossing Progress Badge */}
              {glossProgress && glossProgress.isGlossing && (
                <span className="flex items-center gap-1 ml-0.5 text-[9px] text-pink-100 bg-black/40 px-1.5 py-0.2 rounded-full border border-pink-300/40 animate-pulse">
                  <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                  <span>{glossProgress.completed}/{glossProgress.total}</span>
                </span>
              )}
            </button>

            {/* Video Link Toggle (if video loaded) */}
            {videoId && (
              <button
                type="button"
                onClick={() => setIsUrlImporterOpen(!isUrlImporterOpen)}
                className="px-2 py-1 rounded-lg bg-[#2a1209] hover:bg-[#38180d] border border-[#4a2014] text-rose-200 text-[11px] font-medium transition-colors cursor-pointer"
              >
                {isUrlImporterOpen
                  ? (isSpanish ? 'Ocultar link' : 'Hide link')
                  : (isSpanish ? 'Cambiar vídeo' : 'Change video')}
              </button>
            )}

            {/* Reset Reader Button */}
            {(videoId || subtitles.length > 0) && (
              <button
                type="button"
                onClick={handleResetSession}
                title={isSpanish ? 'Reiniciar lector' : 'Reset reader'}
                className="p-1.5 text-rose-300/60 hover:text-white hover:bg-[#38180d] rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. YouTube Importer Input (shown when no video or when 'Cambiar vídeo' clicked) */}
        {(!videoId || isUrlImporterOpen) && (
          <YouTubeImporter
            onImportVideo={handleImportVideo}
            initialUrl={videoUrl}
            selectedLanguage={videoLanguage}
            onLanguageChange={setVideoLanguage}
          />
        )}

        {/* 3. YouTube Video Player (Fixed at top) */}
        {videoId && (
          <div className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-xl shadow-black/40 border border-[#3d190f]">
            <YouTubePlayer
              videoId={videoId}
              onTimeUpdate={setCurrentTime}
              seekToTime={seekToTime}
            />
          </div>
        )}

        {/* 4. SubtitleImporter (compact 1-line when loaded, full when empty/expanded) */}
        <SubtitleImporter
          onSubtitlesLoaded={handleSubtitlesLoaded}
          subtitlesCount={subtitles.length}
          currentFormat={subtitleFormat}
          onClearSubtitles={subtitles.length > 0 ? handleClearSubtitles : null}
        />
      </div>

      {/* 5. Transcript / Subtítulos (Maximum vertical space with independent scroll) */}
      {subtitles.length > 0 && (
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden pt-1">
          <Transcript
            subtitles={subtitles}
            currentTime={currentTime}
            onSeek={handleSeek}
            autoScroll={autoScroll}
            fontSize={fontSize}
            showTimestamps={showTimestamps}
            searchQuery={searchQuery}
            interlinearMode={interlinearMode}
            targetLang={targetLang}
          />
        </div>
      )}

      {/* 6. Remaining controls placed BELOW the transcript */}
      {subtitles.length > 0 && (
        <div className="flex-shrink-0 pt-1.5">
          <TranscriptControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onResetToStart={handleResetToStart}
            autoScroll={autoScroll}
            onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
            fontSize={fontSize}
            onChangeFontSize={setFontSize}
            showTimestamps={showTimestamps}
            onToggleTimestamps={() => setShowTimestamps(!showTimestamps)}
          />
        </div>
      )}
    </div>
  );
}

export default YouTubeReaderPage;

