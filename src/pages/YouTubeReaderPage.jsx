import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { ErrorBoundary } from '../components/common/ErrorBoundary.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';

const SESSION_STORAGE_KEY = 'linguaflow_youtube_reader_session';

/**
 * Normalizes an array of raw subtitle objects with safe defaults,
 * filtering out any completely empty or invalid entries.
 */
function normalizeSubtitlesSafely(rawSubs, format = 'sub') {
  if (!Array.isArray(rawSubs)) return [];
  const normalized = [];
  for (let i = 0; i < rawSubs.length; i++) {
    const item = rawSubs[i];
    if (!item || typeof item !== 'object') continue;
    const rawText = typeof item.text === 'string' ? item.text : (item.text != null ? String(item.text) : '');
    const text = rawText.trim();
    if (!text) continue;

    const startTime = typeof item.startTime === 'number' && !isNaN(item.startTime) && isFinite(item.startTime)
      ? Math.max(0, item.startTime)
      : i * 3.5;
    const endTime = typeof item.endTime === 'number' && !isNaN(item.endTime) && isFinite(item.endTime)
      ? Math.max(startTime, item.endTime)
      : startTime + 3.0;

    normalized.push({
      id: item.id ? String(item.id) : `${format}_${i + 1}`,
      startTime,
      endTime,
      text,
      tokens: Array.isArray(item.tokens) && item.tokens.length > 0 ? item.tokens : [],
      glosses: Array.isArray(item.glosses) ? item.glosses : []
    });
  }
  return normalized;
}

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
  const [playbackRate, setPlaybackRate] = useState(1);

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
  const progressiveTokenizeRef = useRef(null);

  // Refresh saved transcripts count
  const refreshLibraryCount = useCallback(async () => {
    try {
      const count = await getSavedTranscriptsCount();
      setLibraryCount(count);
    } catch (e) {
      console.warn('Failed to get library count:', e);
    }
  }, []);

  // Cleanup in-flight glossing and progressive tokenization on unmount
  useEffect(() => {
    return () => {
      if (glossAbortControllerRef.current) {
        glossAbortControllerRef.current.abort();
      }
      if (progressiveTokenizeRef.current) {
        progressiveTokenizeRef.current.abort();
      }
    };
  }, []);

  // Progressive tokenization processor: tokenizes initial 50 lines for instant display,
  // then enriches remaining lines in asynchronous non-blocking batches without freezing UI
  const launchProgressiveTokenization = useCallback((normalizedList, lang) => {
    if (progressiveTokenizeRef.current) {
      progressiveTokenizeRef.current.abort();
      progressiveTokenizeRef.current = null;
    }

    const INITIAL_SYNC_LIMIT = 50;
    const CHUNK_SIZE = 100;

    // Fast initial display: only tokenize the first 50 lines synchronously
    const initialItems = normalizedList.map((sub, idx) => {
      if (sub.tokens && sub.tokens.length > 0) return sub;
      if (idx < INITIAL_SYNC_LIMIT) {
        return {
          ...sub,
          tokens: tokenizeAndGlossLineOffline(sub.text, lang)
        };
      }
      return sub;
    });

    setSubtitles(initialItems);

    const completed = initialItems.filter(s => isGlossComplete(s, lang)).length;
    setGlossProgress({
      total: initialItems.length,
      completed,
      isGlossing: false,
      isPaused: false,
      isComplete: initialItems.length > 0 && completed === initialItems.length,
      failed: 0
    });

    const needsTokenizing = initialItems.some((s, idx) => idx >= INITIAL_SYNC_LIMIT && (!s.tokens || s.tokens.length === 0));
    if (!needsTokenizing) return;

    const abortCtrl = { aborted: false };
    progressiveTokenizeRef.current = {
      abort: () => { abortCtrl.aborted = true; }
    };

    let currentIndex = INITIAL_SYNC_LIMIT;

    const processNextChunk = () => {
      if (abortCtrl.aborted) return;

      const endIndex = Math.min(currentIndex + CHUNK_SIZE, initialItems.length);
      const chunkResults = [];

      for (let i = currentIndex; i < endIndex; i++) {
        const sub = initialItems[i];
        if (sub && (!sub.tokens || sub.tokens.length === 0)) {
          chunkResults.push({
            index: i,
            tokens: tokenizeAndGlossLineOffline(sub.text, lang)
          });
        }
      }

      if (abortCtrl.aborted) return;

      if (chunkResults.length > 0) {
        setSubtitles(prev => {
          if (!prev || prev.length === 0) return prev;
          const updated = [...prev];
          for (const { index, tokens } of chunkResults) {
            if (updated[index]) {
              updated[index] = { ...updated[index], tokens };
            }
          }
          return updated;
        });
      }

      currentIndex = endIndex;
      if (currentIndex < initialItems.length && !abortCtrl.aborted) {
        setTimeout(processNextChunk, 16);
      }
    };

    setTimeout(processNextChunk, 32);
  }, []);

  // Safe reset reader action (e.g. on ErrorBoundary recovery or complete clear)
  const handleResetReader = useCallback(() => {
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    if (progressiveTokenizeRef.current) {
      progressiveTokenizeRef.current.abort();
      progressiveTokenizeRef.current = null;
    }
    setSubtitles([]);
    setSubtitleFormat(null);
    setSubtitleSource('');
    setIsAutoGlossing(false);
    setGlossProgress(null);
    setCurrentTime(0);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}
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
          const normalized = normalizeSubtitlesSafely(parsed.subtitles, parsed.subtitleFormat || 'sub');
          launchProgressiveTokenization(normalized, targetLang);
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
  }, [targetLang, nativeLang, refreshLibraryCount, launchProgressiveTokenization]);

  // 2. Persist session when critical state changes (quota-safe)
  useEffect(() => {
    try {
      // If subtitle count is very large, save a lightweight version to prevent exceeding localStorage quota
      const safeSubtitles = (subtitles || []).map(s => {
        if (subtitles.length > 1000 && (!s.tokens || !s.tokens.some(t => t && t.gloss))) {
          return {
            id: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            text: s.text,
            tokens: [],
            glosses: s.glosses || []
          };
        }
        return s;
      });

      const sessionData = {
        videoId,
        videoTitle,
        videoUrl,
        videoLanguage,
        subtitles: safeSubtitles,
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
    if (progressiveTokenizeRef.current) {
      progressiveTokenizeRef.current.abort();
      progressiveTokenizeRef.current = null;
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

  const handleSubtitlesLoaded = useCallback((newSubtitles, format, sourceName) => {
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    if (progressiveTokenizeRef.current) {
      progressiveTokenizeRef.current.abort();
      progressiveTokenizeRef.current = null;
    }

    setSubtitleFormat(format);
    setSubtitleSource(sourceName);
    setIsAutoGlossing(false);

    // Normalize safely (filters invalid/empty items and ensures all properties exist)
    const normalized = normalizeSubtitlesSafely(newSubtitles, format || 'sub');
    if (normalized.length === 0) {
      setSubtitles([]);
      setGlossProgress(null);
      return;
    }

    // Launch progressive non-blocking tokenization
    launchProgressiveTokenization(normalized, targetLang);
  }, [targetLang, launchProgressiveTokenization]);

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
    <ErrorBoundary
      title={isSpanish ? 'Error en YouTube Transcript Reader' : 'Error in YouTube Transcript Reader'}
      resetLabel={isSpanish ? 'Reiniciar lector' : 'Reset Reader'}
      onReset={handleResetReader}
    >
      <div className="flex flex-col h-full w-full max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-3 overflow-hidden text-[var(--text-primary)]">
      {/* 1. Header: YouTube Reader + AI Glossing Control + Stop/Pause + Saved Transcripts Library */}
      <div className="flex-shrink-0 space-y-2 pb-1">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-primary)] shadow-xs text-xs">
          {/* Left: Brand & Target Language */}
          <div className="flex items-center space-x-2 truncate">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Youtube className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-bold text-[var(--text-primary)] tracking-wide text-xs sm:text-sm truncate">
              YouTube Reader
            </h2>
            <span className="text-[10px] bg-[var(--surface-tertiary)] text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded border border-[var(--border-primary)] font-mono shrink-0">
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
              className="px-2 py-1 rounded-lg bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-primary)] text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span className="hidden sm:inline">{isSpanish ? 'Biblioteca' : 'Library'}</span>
              {libraryCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/15 text-rose-600 dark:text-rose-300 rounded-full font-bold border border-rose-500/30">
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
                  : 'bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-primary)]'
              }`}
            >
              <Languages className={`w-3.5 h-3.5 ${isAutoGlossing ? 'text-white' : 'text-rose-500 dark:text-rose-400'}`} />
              <span className="font-semibold">{isSpanish ? 'Glosado Auto' : 'Auto Gloss'}</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                  isAutoGlossing
                    ? 'bg-emerald-950 text-emerald-100 border border-emerald-400/40'
                    : 'bg-[var(--surface-tertiary)] text-[var(--text-muted)] border border-[var(--border-primary)]'
                }`}
              >
                {isAutoGlossing ? 'ON' : 'OFF'}
              </span>

              {/* Live Auto-Glossing Progress Badge */}
              {subtitles.length > 0 && (
                <span className={`flex items-center gap-1 ml-0.5 text-[9px] px-1.5 py-0.2 rounded-full border ${
                  isAutoGlossing
                    ? 'text-emerald-100 bg-black/40 border-emerald-300/40 animate-pulse'
                    : 'text-[var(--text-muted)] bg-[var(--surface-tertiary)] border-[var(--border-primary)]'
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
                className="px-2 py-1 rounded-lg bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] font-medium transition-colors cursor-pointer"
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
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
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
              playbackRate={playbackRate}
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
            playbackRate={playbackRate}
            onChangePlaybackRate={setPlaybackRate}
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
        onDeleteTranscript={refreshLibraryCount}
        currentVideoId={videoId}
      />
      </div>
    </ErrorBoundary>
  );
}

export default YouTubeReaderPage;
