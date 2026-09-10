import React, { useState, useEffect, useCallback, useRef } from 'react';
import { YouTubePlayer } from '../components/youtube/YouTubePlayer.jsx';
import { YouTubeImporter } from '../components/youtube/YouTubeImporter.jsx';
import { SubtitleImporter } from '../components/youtube/SubtitleImporter.jsx';
import { Transcript } from '../components/youtube/Transcript.jsx';
import { TranscriptControls } from '../components/youtube/TranscriptControls.jsx';
import { SavedTranscriptsModal } from '../components/youtube/SavedTranscriptsModal.jsx';
import { enrichSubtitlesWithGlosses } from '../services/subtitleGlossService.js';
import { parseSubtitlesAuto } from '../services/subtitleService.js';
import {
  getSavedTranscriptsCount,
  findTranscriptsByVideoId
} from '../services/transcriptLibraryStorage.js';
import {
  Youtube,
  Sparkles,
  FileText,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  Pause,
  Play
} from 'lucide-react';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';

const SESSION_STORAGE_KEY = 'linguaflow_youtube_reader_session';

export function YouTubeReaderPage({ targetLang = 'zh', nativeLang = 'es', apiKey = '' }) {
  const { isSpanish } = useSiteLanguage();
  // Session state with localStorage persistence
  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLanguage, setVideoLanguage] = useState('auto');
  const [subtitles, setSubtitles] = useState([]);
  const [subtitleFormat, setSubtitleFormat] = useState(null);
  const [subtitleSource, setSubtitleSource] = useState('');
  const [glossProgress, setGlossProgress] = useState(null);

  // Library modal state
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryCount, setLibraryCount] = useState(0);

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

  // Abort controller ref to stop / pause glossing
  const glossAbortControllerRef = useRef(null);

  // Refresh saved transcripts count
  const refreshLibraryCount = useCallback(async () => {
    try {
      const count = await getSavedTranscriptsCount();
      setLibraryCount(count);
    } catch (e) {
      console.warn('Failed to get library count:', e);
    }
  }, []);

  // Cleanup in-flight glossing on unmount
  useEffect(() => {
    return () => {
      if (glossAbortControllerRef.current) {
        glossAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Start or resume glossing with abortable controller
  const startGlossing = useCallback((subtitlesToGloss, sourceName = subtitleSource) => {
    if (!Array.isArray(subtitlesToGloss) || subtitlesToGloss.length === 0) return;

    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    glossAbortControllerRef.current = controller;

    const enriched = enrichSubtitlesWithGlosses({
      subtitles: subtitlesToGloss,
      targetLang,
      nativeLang,
      apiKey,
      videoId,
      videoTitle,
      videoUrl,
      sourceType: sourceName || 'srt',
      abortSignal: controller.signal,
      onUpdate: (updated) => {
        setSubtitles(updated);
        refreshLibraryCount();
      },
      onProgress: (p) => setGlossProgress(p)
    });

    setSubtitles(enriched);
    refreshLibraryCount();
  }, [targetLang, nativeLang, apiKey, videoId, videoTitle, videoUrl, subtitleSource, refreshLibraryCount]);

  // Stop / Pause glossing
  const handleStopOrPauseGlossing = useCallback(() => {
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    setGlossProgress(prev => prev ? ({ ...prev, isGlossing: false, isPaused: true }) : null);
  }, []);

  // Resume glossing
  const handleResumeGlossing = useCallback(() => {
    if (!subtitles || subtitles.length === 0) return;
    startGlossing(subtitles, subtitleSource);
  }, [subtitles, subtitleSource, startGlossing]);

  // 1. Restore previous session on initial mount
  useEffect(() => {
    refreshLibraryCount();
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.videoId) setVideoId(parsed.videoId);
        if (parsed.videoTitle) setVideoTitle(parsed.videoTitle);
        if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
        if (parsed.videoLanguage) setVideoLanguage(parsed.videoLanguage);
        if (Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
          const enriched = enrichSubtitlesWithGlosses({
            subtitles: parsed.subtitles,
            targetLang,
            nativeLang,
            apiKey,
            videoId: parsed.videoId,
            videoTitle: parsed.videoTitle || '',
            videoUrl: parsed.videoUrl || '',
            sourceType: parsed.subtitleSource || 'srt',
            onUpdate: (updated) => {
              setSubtitles(updated);
              refreshLibraryCount();
            },
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
  }, [targetLang, nativeLang, refreshLibraryCount]);

  // 2. Persist session when critical state changes
  useEffect(() => {
    try {
      const sessionData = {
        videoId,
        videoTitle,
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
  }, [videoId, videoTitle, videoUrl, videoLanguage, subtitles, subtitleFormat, subtitleSource, autoScroll, fontSize, showTimestamps, interlinearMode]);

  // Handlers
  const handleImportVideo = (newVideoId, newUrl) => {
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    setVideoId(newVideoId);
    setVideoUrl(newUrl);
    setCurrentTime(0);
    setIsUrlImporterOpen(false);

    // Auto-check if a saved transcript exists in the library for this video
    findTranscriptsByVideoId(newVideoId, targetLang)
      .then((saved) => {
        if (saved && saved.length > 0) {
          const latest = saved[0];
          console.log(`[GlossCache] Auto-recovering saved transcript for video ${newVideoId}: "${latest.videoTitle}" (${latest.subtitlesCount} lines)`);
          handleLoadFromLibrary(latest);
        }
      })
      .catch((err) => console.warn('Error checking saved transcripts for video:', err));
  };

  const handleSubtitlesLoaded = (newSubtitles, format, sourceName) => {
    setSubtitleFormat(format);
    setSubtitleSource(sourceName);
    startGlossing(newSubtitles, sourceName);
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') return;
        const { format, subtitles: newSubs } = parseSubtitlesAuto(content, file.name);
        if (newSubs && newSubs.length > 0) {
          handleSubtitlesLoaded(newSubs, format, file.name);
        }
      } catch (err) {
        console.warn('Error reading subtitle file:', err);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleLoadFromLibrary = (record) => {
    if (!record) return;
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    if (record.videoId) setVideoId(record.videoId);
    if (record.videoUrl) setVideoUrl(record.videoUrl);
    if (record.videoTitle) setVideoTitle(record.videoTitle);
    if (record.sourceType) setSubtitleSource(record.sourceType);
    if (record.format) setSubtitleFormat(record.format);
    if (Array.isArray(record.subtitles)) {
      setSubtitles(record.subtitles);
      setGlossProgress({
        total: record.subtitles.length,
        completed: record.completedLinesCount || record.subtitles.length,
        isGlossing: false,
        isComplete: Boolean(record.isComplete),
        failed: 0
      });
    }
    setCurrentTime(0);
    refreshLibraryCount();
  };

  const handlePlayerReady = (player) => {
    try {
      if (player && typeof player.getVideoData === 'function') {
        const data = player.getVideoData();
        if (data && data.title && (!videoTitle || videoTitle.startsWith('YouTube Video'))) {
          setVideoTitle(data.title);
        }
      }
    } catch (e) {
      console.warn('Error reading video title from player:', e);
    }
  };

  const handleClearSubtitles = () => {
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    setSubtitles([]);
    setSubtitleFormat(null);
    setSubtitleSource('');
    setGlossProgress(null);
  };

  const handleResetSession = () => {
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    setVideoId('');
    setVideoTitle('');
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
      {/* 1. Header: YouTube Reader + AI Glossing Control + Stop/Pause + Saved Transcripts Library */}
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

          {/* Right: Library Button + AI Glossing Toggle + Pause/Resume + Video Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* SAVED TRANSCRIPTS LIBRARY BUTTON */}
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              title={isSpanish ? 'Abrir biblioteca de transcripciones guardadas' : 'Open saved transcripts library'}
              className="px-2 py-1 rounded-lg bg-[#2a1209] hover:bg-[#38180d] border border-[#4a2014] text-rose-200 hover:text-white text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">{isSpanish ? 'Biblioteca' : 'Library'}</span>
              {libraryCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 bg-rose-950 text-rose-300 rounded-full font-bold border border-rose-800">
                  {libraryCount}
                </span>
              )}
            </button>

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

            {/* STOP / PAUSE BUTTON (shown while actively glossing) */}
            {glossProgress && glossProgress.isGlossing && (
              <button
                type="button"
                onClick={handleStopOrPauseGlossing}
                title={isSpanish ? 'Pausar / Detener glosado IA' : 'Pause / Stop AI glossing'}
                className="px-2 py-1 rounded-lg bg-amber-950/90 hover:bg-amber-900 border border-amber-500 text-amber-200 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs animate-pulse"
              >
                <Pause className="w-3 h-3 fill-amber-300 text-amber-300" />
                <span>{isSpanish ? 'Pausar' : 'Pause'}</span>
              </button>
            )}

            {/* RESUME BUTTON (shown when paused or stopped with incomplete lines) */}
            {glossProgress && (glossProgress.isPaused || (!glossProgress.isGlossing && !glossProgress.isComplete && glossProgress.completed < glossProgress.total)) && (
              <button
                type="button"
                onClick={handleResumeGlossing}
                title={isSpanish ? 'Reanudar glosado IA' : 'Resume AI glossing'}
                className="px-2 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500 text-emerald-200 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
              >
                <Play className="w-3 h-3 fill-emerald-300 text-emerald-300" />
                <span>{isSpanish ? 'Reanudar' : 'Resume'}</span>
                {glossProgress.total > 0 && (
                  <span className="text-[9px] opacity-80 font-mono">({glossProgress.completed}/{glossProgress.total})</span>
                )}
              </button>
            )}

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
              onPlayerReady={handlePlayerReady}
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
          glossProgress={glossProgress}
          onStopOrPauseGlossing={handleStopOrPauseGlossing}
          onResumeGlossing={handleResumeGlossing}
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

      {/* 6. Controls placed BELOW the transcript */}
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
            onFileUpload={handleFileUpload}
          />
        </div>
      )}

      {/* 7. Saved Transcripts Modal (IndexedDB persistent library) */}
      <SavedTranscriptsModal
        isOpen={isLibraryOpen}
        onClose={() => {
          setIsLibraryOpen(false);
          refreshLibraryCount();
        }}
        onLoadTranscript={handleLoadFromLibrary}
        currentVideoId={videoId}
      />
    </div>
  );
}

export default YouTubeReaderPage;
