import React, { useState, useEffect, useCallback, useRef } from 'react';
import { YouTubePlayer } from '../components/youtube/YouTubePlayer.jsx';
import { YouTubeImporter } from '../components/youtube/YouTubeImporter.jsx';
import { SubtitleImporter } from '../components/youtube/SubtitleImporter.jsx';
import { Transcript } from '../components/youtube/Transcript.jsx';
import { TranscriptControls } from '../components/youtube/TranscriptControls.jsx';
import { SavedTranscriptsModal } from '../components/youtube/SavedTranscriptsModal.jsx';
import {
  enrichSubtitlesWithGlosses,
  glossSingleSubtitleLine,
  isGlossComplete,
  tokenizeAndGlossLineOffline
} from '../services/subtitleGlossService.js';
import { parseSubtitlesAuto } from '../services/subtitleService.js';
import {
  getSavedTranscriptsCount,
  findTranscriptsByVideoId,
  saveTranscriptToLibrary,
  computeSubtitleHash
} from '../services/transcriptLibraryStorage.js';
import {
  Youtube,
  Languages,
  Loader2,
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

  const [isAutoGlossing, setIsAutoGlossing] = useState(false);
  const [glossingLineIds, setGlossingLineIds] = useState(new Set());
  const loadingLineIds = glossingLineIds; // Alias for backward compatibility
  const setLoadingLineIds = setGlossingLineIds;

  // Count how many subtitle lines are completely glossed
  const completedLinesCount = useMemo(() => {
    if (!Array.isArray(subtitles)) return 0;
    return subtitles.filter(s => isGlossComplete(s, targetLang)).length;
  }, [subtitles, targetLang]);

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

  // Start or resume auto-glossing with abortable controller
  const startGlossing = useCallback((subtitlesToGloss, sourceName = subtitleSource) => {
    if (!Array.isArray(subtitlesToGloss) || subtitlesToGloss.length === 0) return;

    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    glossAbortControllerRef.current = controller;
    setIsAutoGlossing(true);

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
      onProgress: (p) => {
        setGlossProgress(p);
        if (p.isComplete) {
          setIsAutoGlossing(false);
        }
      }
    });

    setSubtitles(enriched);
    refreshLibraryCount();
  }, [targetLang, nativeLang, apiKey, videoId, videoTitle, videoUrl, subtitleSource, refreshLibraryCount]);

  // Toggle Global Auto-Glossing (ON / OFF)
  const handleToggleAutoGlossing = useCallback(() => {
    if (isAutoGlossing) {
      if (glossAbortControllerRef.current) {
        glossAbortControllerRef.current.abort();
        glossAbortControllerRef.current = null;
      }
      setIsAutoGlossing(false);
      setGlossProgress(prev => prev ? ({ ...prev, isGlossing: false, isPaused: true }) : null);
    } else {
      if (!subtitles || subtitles.length === 0) return;
      setIsAutoGlossing(true);
      startGlossing(subtitles, subtitleSource);
    }
  }, [isAutoGlossing, subtitles, subtitleSource, startGlossing]);

  // Stop / Pause glossing
  const handleStopOrPauseGlossing = useCallback(() => {
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    setIsAutoGlossing(false);
    setGlossProgress(prev => prev ? ({ ...prev, isGlossing: false, isPaused: true }) : null);
  }, []);

  // Resume glossing
  const handleResumeGlossing = useCallback(() => {
    if (!subtitles || subtitles.length === 0) return;
    setIsAutoGlossing(true);
    startGlossing(subtitles, subtitleSource);
  }, [subtitles, subtitleSource, startGlossing]);

  // Individual line glossing (runs only for that paragraph, works even when auto-glossing is OFF)
  const handleGlossSingleLine = useCallback(async (line) => {
    if (!line || !line.id) return;
    if (isGlossComplete(line, targetLang)) return; // $0 Groq cost, already glossed!

    setLoadingLineIds(prev => new Set(prev).add(line.id));

    try {
      const updatedLine = await glossSingleSubtitleLine({
        sub: line,
        targetLang,
        nativeLang,
        apiKey
      });

      setSubtitles(prevSubtitles => {
        const updatedList = prevSubtitles.map(s => s.id === line.id ? updatedLine : s);

        const completedCount = updatedList.filter(s => isGlossComplete(s, targetLang)).length;
        saveTranscriptToLibrary({
          videoId,
          videoTitle,
          videoUrl,
          targetLanguage: targetLang,
          nativeLanguage: nativeLang,
          sourceType: subtitleSource || 'srt',
          subtitleHash: computeSubtitleHash(updatedList),
          subtitlesCount: updatedList.length,
          completedLinesCount: completedCount,
          isComplete: completedCount === updatedList.length,
          subtitles: updatedList
        }).then(() => {
          refreshLibraryCount();
        }).catch(err => console.warn('Failed to save single glossed line to library:', err));

        return updatedList;
      });
    } catch (err) {
      console.error('Failed to gloss single line:', err);
    } finally {
      setLoadingLineIds(prev => {
        const next = new Set(prev);
        next.delete(line.id);
        return next;
      });
    }
  }, [targetLang, nativeLang, apiKey, videoId, videoTitle, videoUrl, subtitleSource, refreshLibraryCount]);

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
          // Offline session restoration: load saved glosses directly with ZERO AI calls!
          const prepared = parsed.subtitles.map(sub => {
            if (Array.isArray(sub.tokens) && sub.tokens.length > 0) return sub;
            return {
              ...sub,
              tokens: tokenizeAndGlossLineOffline(sub.text || '', targetLang)
            };
          });
          setSubtitles(prepared);
          const completed = prepared.filter(s => isGlossComplete(s, targetLang)).length;
          setGlossProgress({
            total: prepared.length,
            completed,
            isGlossing: false,
            isPaused: false,
            isComplete: prepared.length > 0 && completed === prepared.length,
            failed: 0
          });
          setIsAutoGlossing(false);
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
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    setSubtitleFormat(format);
    setSubtitleSource(sourceName);
    setIsAutoGlossing(false);

    // Prepare lines offline with local tokenization (ZERO AI calls on subtitle import)
    const prepared = (newSubtitles || []).map(sub => {
      if (Array.isArray(sub.tokens) && sub.tokens.length > 0) return sub;
      return {
        ...sub,
        tokens: tokenizeAndGlossLineOffline(sub.text || '', targetLang)
      };
    });

    setSubtitles(prepared);
    const completed = prepared.filter(s => isGlossComplete(s, targetLang)).length;
    setGlossProgress({
      total: prepared.length,
      completed,
      isGlossing: false,
      isPaused: false,
      isComplete: prepared.length > 0 && completed === prepared.length,
      failed: 0
    });
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

            {/* GLOBAL AUTO-GLOSSING TOGGLE (Represented by Languages icon, ON/OFF, Green when ON, Progress badge) */}
            <button
              type="button"
              onClick={handleToggleAutoGlossing}
              title={
                isAutoGlossing
                  ? (isSpanish ? 'Glosado automático activo: clic para detener' : 'Auto-glossing active: click to stop')
                  : (isSpanish ? 'Activar glosado automático global' : 'Enable global auto-glossing')
              }
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs ${
                isAutoGlossing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-950/40'
                  : 'bg-[#2a1209] hover:bg-[#38180d] text-stone-300 border-[#4a2014]'
              }`}
            >
              <Languages className={`w-3.5 h-3.5 ${isAutoGlossing ? 'text-white' : 'text-rose-400'}`} />
              <span className="font-semibold">{isSpanish ? 'Glosado Auto' : 'Auto Gloss'}</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                  isAutoGlossing
                    ? 'bg-emerald-950 text-emerald-100 border border-emerald-400/40'
                    : 'bg-[#180803] text-stone-400 border border-[#3e1b10]'
                }`}
              >
                {isAutoGlossing ? 'ON' : 'OFF'}
              </span>

              {/* Live Auto-Glossing Progress Badge */}
              {subtitles.length > 0 && (
                <span className={`flex items-center gap-1 ml-0.5 text-[9px] px-1.5 py-0.2 rounded-full border ${
                  isAutoGlossing
                    ? 'text-emerald-100 bg-black/40 border-emerald-300/40 animate-pulse'
                    : 'text-stone-400 bg-black/30 border-stone-700/50'
                }`}>
                  {isAutoGlossing && <span className="w-1 h-1 rounded-full bg-white animate-ping" />}
                  <span>{completedLinesCount}/{subtitles.length}</span>
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
            onGloss={handleGlossSingleLine}
            onGlossLine={handleGlossSingleLine}
            glossingLineIds={glossingLineIds}
            loadingLineIds={loadingLineIds}
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
