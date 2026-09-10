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
      {/* Top Fixed Section (Miraa style: Video stays fixed on top) */}
      <div className="flex-shrink-0 space-y-2 pb-1">
        {/* Banner / Header */}
        {!videoId ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#32170f]/90 border border-[#52271a] shadow-lg shadow-black/30 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-md shadow-rose-950 mt-0.5">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                    YouTube Reader
                  </h2>
                  <span className="text-[10px] uppercase font-bold bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800">
                    Inmersión
                  </span>
                </div>
                <p className="text-xs text-rose-200/70 mt-0.5 leading-relaxed max-w-xl">
                  Pega cualquier vídeo de YouTube e importa sus subtítulos en <span className="font-semibold text-rose-300">SRT</span>, <span className="font-semibold text-rose-300">VTT</span> o <span className="font-semibold text-rose-300">TXT</span>. Lee la transcripción sincronizada con glosas interlineales por palabra.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Slim compact top toolbar when video is loaded */
          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <div className="flex items-center space-x-2 truncate">
              <Youtube className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-bold text-white tracking-wide truncate">
                YouTube Reader
              </span>
              <span className="text-[10px] bg-rose-950/80 text-rose-300 px-1.5 py-0.5 rounded-md border border-rose-800/80 shrink-0">
                {targetLang === 'zh' ? '🇨🇳 Chino' : targetLang.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsUrlImporterOpen(!isUrlImporterOpen)}
                className="px-2 py-1 rounded-lg bg-[#2b160f] hover:bg-[#3b1e15] border border-[#482519] text-rose-200 text-[11px] font-medium transition-colors cursor-pointer"
              >
                {isUrlImporterOpen
                  ? (isSpanish ? 'Ocultar link' : 'Hide link')
                  : (isSpanish ? 'Cambiar vídeo' : 'Change video')}
              </button>

              <button
                type="button"
                onClick={handleResetSession}
                title={isSpanish ? 'Reiniciar lector' : 'Reset reader'}
                className="p-1.5 text-rose-300/60 hover:text-white hover:bg-[#3b1e15] rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 1. YouTube Importer Input (shown when no video or when 'Cambiar vídeo' clicked) */}
        {(!videoId || isUrlImporterOpen) && (
          <YouTubeImporter
            onImportVideo={handleImportVideo}
            initialUrl={videoUrl}
            selectedLanguage={videoLanguage}
            onLanguageChange={setVideoLanguage}
          />
        )}

        {/* 2. YouTube Video Player (Fixed aspect-video at top) */}
        {videoId && (
          <div className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-xl shadow-black/40 border border-[#3d190f]">
            <YouTubePlayer
              videoId={videoId}
              onTimeUpdate={setCurrentTime}
              seekToTime={seekToTime}
            />
          </div>
        )}

        {/* 3. Subtitles Importer (compact bar when loaded, full when empty) */}
        <SubtitleImporter
          onSubtitlesLoaded={handleSubtitlesLoaded}
          subtitlesCount={subtitles.length}
          currentFormat={subtitleFormat}
          onClearSubtitles={subtitles.length > 0 ? handleClearSubtitles : null}
          glossProgress={glossProgress}
        />

        {/* 4. Controls Bar (compact) */}
        {subtitles.length > 0 && (
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
            interlinearMode={interlinearMode}
            onToggleInterlinearMode={() => setInterlinearMode(!interlinearMode)}
          />
        )}
      </div>

      {/* Reader Section with Independent Vertical Scroll (Miraa style) */}
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
    </div>
  );
}

export default YouTubeReaderPage;

