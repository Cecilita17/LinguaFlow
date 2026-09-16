import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { YouTubePlayer } from '../components/youtube/YouTubePlayer.jsx';
import { YouTubeImporter } from '../components/youtube/YouTubeImporter.jsx';
import { SubtitleImporter } from '../components/youtube/SubtitleImporter.jsx';
import { Transcript } from '../components/youtube/Transcript.jsx';
import { TranscriptControls } from '../components/youtube/TranscriptControls.jsx';
import { SavedTranscriptsModal } from '../components/youtube/SavedTranscriptsModal.jsx';
import { YouTubeLibraryView } from '../components/youtube/YouTubeLibraryView.jsx';
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
  getTranscriptFromLibrary,
  computeSubtitleHash,
  updateTranscriptPlaybackPosition,
  getLibraryKey
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
  Play,
  ArrowLeft,
  Plus,
  Menu,
  Home,
  Sparkles,
  Gauge,
  ArrowDown,
  Search,
  X,
  Upload,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { ErrorBoundary } from '../components/common/ErrorBoundary.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useAudioSettings } from '../context/AudioSettingsContext.jsx';

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

export function YouTubeReaderPage({
  targetLang = 'zh',
  setTargetLang = null,
  languages = [],
  nativeLang = 'es',
  apiKey = '',
  onWordClick = null,
  setActiveTab = null
}) {
  const { isSpanish } = useSiteLanguage();
  const {
    wordHighlightEnabled,
    setWordHighlightEnabled
  } = useAudioSettings();

  // Navigation mode: 'library' | 'importer' | 'reader'
  // Default to 'library' when entering YouTube Reader
  const [viewMode, setViewMode] = useState('library');

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
  const [currentRecordId, setCurrentRecordId] = useState('');
  const [pendingScrollSubtitleId, setPendingScrollSubtitleId] = useState(null);
  const latestPositionRef = useRef({ time: 0, subId: null });
  const saveThrottlerRef = useRef({ lastSavedTime: 0, timer: null });

  // Transcript view preferences
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg' | 'xl'
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [interlinearMode, setInterlinearMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUrlImporterOpen, setIsUrlImporterOpen] = useState(false);

  // Hamburger actions menu state & ref
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isSettingsSubmenuOpen, setIsSettingsSubmenuOpen] = useState(false);
  const actionsMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close hamburger menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setIsActionsMenuOpen(false);
      }
    }
    if (isActionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionsMenuOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isActionsMenuOpen) {
        setIsActionsMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActionsMenuOpen]);

  // Helpers to cycle font size and playback speed
  const fontSizes = ['sm', 'base', 'lg', 'xl'];
  const cycleFontSize = () => {
    const currentIndex = fontSizes.indexOf(fontSize);
    const nextIndex = (currentIndex + 1) % fontSizes.length;
    setFontSize(fontSizes[nextIndex]);
  };

  const cyclePlaybackRate = () => {
    const nextRateMap = { 1: 0.75, 0.75: 0.5, 0.5: 1 };
    const next = nextRateMap[playbackRate] || 1;
    setPlaybackRate(next);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    setCurrentRecordId('');
    setPendingScrollSubtitleId(null);
    latestPositionRef.current = { time: 0, subId: null };
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
        if (parsed.currentRecordId) setCurrentRecordId(parsed.currentRecordId);
        if (Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
          const normalized = normalizeSubtitlesSafely(parsed.subtitles, parsed.subtitleFormat || 'sub');
          launchProgressiveTokenization(normalized, targetLang);
        }
        if (parsed.subtitleFormat) setSubtitleFormat(parsed.subtitleFormat);
        if (parsed.subtitleSource) setSubtitleSource(parsed.subtitleSource);

        if (typeof parsed.lastPlaybackTime === 'number' && parsed.lastPlaybackTime > 0) {
          const savedTime = parsed.lastPlaybackTime;
          setCurrentTime(savedTime);
          setSeekToTime({ time: savedTime, autoPlay: false });
          latestPositionRef.current.time = savedTime;
        }
        if (parsed.lastSubtitleId) {
          setPendingScrollSubtitleId(parsed.lastSubtitleId);
          latestPositionRef.current.subId = parsed.lastSubtitleId;
        }

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

  // Dynamic target language switch: re-tokenize subtitles to reflect new target language
  const prevTargetLangRef = useRef(targetLang);
  useEffect(() => {
    if (prevTargetLangRef.current !== targetLang) {
      prevTargetLangRef.current = targetLang;
      if (Array.isArray(subtitles) && subtitles.length > 0) {
        const resetTokens = subtitles.map(s => ({ ...s, tokens: [] }));
        launchProgressiveTokenization(resetTokens, targetLang);
      }
    }
  }, [targetLang, subtitles, launchProgressiveTokenization]);

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
        currentRecordId,
        lastPlaybackTime: latestPositionRef.current?.time ?? currentTime,
        lastSubtitleId: latestPositionRef.current?.subId ?? pendingScrollSubtitleId,
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
  }, [videoId, videoTitle, videoUrl, videoLanguage, currentRecordId, currentTime, pendingScrollSubtitleId, subtitles, subtitleFormat, subtitleSource, autoScroll, fontSize, showTimestamps, interlinearMode]);

  // Throttled playback position persistence:
  // Saves current time and active subtitle ID every 1.5s to 2s without freezing or overloading IndexedDB.
  const flushPlaybackPosition = useCallback(() => {
    if (saveThrottlerRef.current.timer) {
      clearTimeout(saveThrottlerRef.current.timer);
      saveThrottlerRef.current.timer = null;
    }
    const { time, subId } = latestPositionRef.current;
    if (currentRecordId && typeof time === 'number') {
      updateTranscriptPlaybackPosition(currentRecordId, time, subId).catch(err => {
        console.warn('Failed to flush playback position:', err);
      });
      saveThrottlerRef.current.lastSavedTime = Date.now();
    }
  }, [currentRecordId]);

  const handleTimeUpdate = useCallback((newTime) => {
    setCurrentTime(newTime);
    latestPositionRef.current.time = newTime;

    // Identify active subtitle line ID for this timestamp
    if (Array.isArray(subtitles) && subtitles.length > 0) {
      const activeLine = subtitles.find(s => {
        if (!s || typeof s.startTime !== 'number') return false;
        const end = typeof s.endTime === 'number' && s.endTime > s.startTime ? s.endTime : s.startTime + 4.0;
        return newTime >= s.startTime && newTime <= end;
      });
      if (activeLine?.id) {
        latestPositionRef.current.subId = activeLine.id;
      }
    }

    if (!currentRecordId) return;

    const now = Date.now();
    if (now - saveThrottlerRef.current.lastSavedTime >= 2000) {
      // Throttle interval passed, save immediately
      saveThrottlerRef.current.lastSavedTime = now;
      updateTranscriptPlaybackPosition(
        currentRecordId,
        latestPositionRef.current.time,
        latestPositionRef.current.subId
      ).catch(() => {});
    } else if (!saveThrottlerRef.current.timer) {
      // Queue next throttled update
      saveThrottlerRef.current.timer = setTimeout(() => {
        saveThrottlerRef.current.timer = null;
        saveThrottlerRef.current.lastSavedTime = Date.now();
        if (currentRecordId) {
          updateTranscriptPlaybackPosition(
            currentRecordId,
            latestPositionRef.current.time,
            latestPositionRef.current.subId
          ).catch(() => {});
        }
      }, 2000);
    }
  }, [currentRecordId, subtitles]);

  // Flush position on pause (state 2) or end (state 0)
  const handlePlayerStateChange = useCallback((state) => {
    // 2 === PAUSED, 0 === ENDED
    if (state === 2 || state === 0) {
      flushPlaybackPosition();
    }
  }, [flushPlaybackPosition]);

  // Flush position on beforeunload / tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPlaybackPosition();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushPlaybackPosition();
    };
  }, [flushPlaybackPosition]);

  // Navigation helper: change view mode and update browser history
  const navigateToView = useCallback((newMode) => {
    if (newMode === 'library') {
      flushPlaybackPosition();
    }
    setViewMode(newMode);
    try {
      if (newMode === 'library') {
        if (window.location.hash) {
          window.history.pushState(null, '', window.location.pathname + window.location.search);
        }
      } else if (newMode === 'importer') {
        window.history.pushState({ viewMode: 'importer' }, '', '#import');
      } else if (newMode === 'reader') {
        window.history.pushState({ viewMode: 'reader' }, '', '#reader');
      }
    } catch (e) {}
  }, [flushPlaybackPosition]);

  // Listen to browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash === '#reader' && (videoId || (subtitles && subtitles.length > 0))) {
        setViewMode('reader');
      } else if (hash === '#import') {
        setViewMode('importer');
      } else {
        setViewMode('library');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [videoId, subtitles]);

  const handleImportVideo = (newVideoId, newUrl) => {
    flushPlaybackPosition();
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
    setCurrentRecordId('');
    latestPositionRef.current = { time: 0, subId: null };
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

  const handleSubtitlesLoaded = useCallback(async (newSubtitles, format, sourceName) => {
    flushPlaybackPosition();
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

    const subHash = computeSubtitleHash(normalized);
    const recId = getLibraryKey(videoId || 'novideo', subHash, targetLang);
    setCurrentRecordId(recId);

    // Check if transcript already exists in library ($0 Groq cost reuse)
    try {
      const existing = await getTranscriptFromLibrary(videoId || 'novideo', subHash, targetLang);
      if (existing && Array.isArray(existing.subtitles) && existing.subtitles.length > 0) {
        handleLoadFromLibrary(existing);
        navigateToView('library');
        return;
      }
    } catch (e) {
      console.warn('Error checking library for existing transcript:', e);
    }

    // Launch progressive non-blocking tokenization
    launchProgressiveTokenization(normalized, targetLang);

    // Persist initial record in library with position 0
    try {
      await saveTranscriptToLibrary({
        id: recId,
        videoId: videoId || 'novideo',
        videoTitle: videoTitle || `YouTube Video (${videoId || 'novideo'})`,
        videoUrl: videoUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
        targetLanguage: targetLang,
        nativeLanguage: nativeLang,
        sourceType: sourceName || 'srt',
        subtitleHash: subHash,
        subtitlesCount: normalized.length,
        completedLinesCount: 0,
        isComplete: false,
        format: format || 'srt',
        subtitles: normalized,
        lastPlaybackTime: 0,
        lastSubtitleId: null
      });
      await refreshLibraryCount();
    } catch (e) {
      console.warn('Failed to save imported transcript to library:', e);
    }

    // Requirement 4: After successful import, navigate back to YouTube Library where it appears
    navigateToView('library');
  }, [videoId, videoTitle, videoUrl, targetLang, nativeLang, launchProgressiveTokenization, refreshLibraryCount, flushPlaybackPosition, navigateToView]);

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
    flushPlaybackPosition();
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    if (progressiveTokenizeRef.current) {
      progressiveTokenizeRef.current.abort();
      progressiveTokenizeRef.current = null;
    }

    const subHash = record.subtitleHash || (Array.isArray(record.subtitles) ? computeSubtitleHash(record.subtitles) : '');
    const recId = record.id || getLibraryKey(record.videoId, subHash, targetLang);
    setCurrentRecordId(recId);

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

    // Restore saved playback position and subtitle marker
    const savedTime = typeof record.lastPlaybackTime === 'number' && !isNaN(record.lastPlaybackTime)
      ? Math.max(0, record.lastPlaybackTime)
      : 0;
    const savedSubId = record.lastSubtitleId || null;

    setCurrentTime(savedTime);
    setSeekToTime({ time: savedTime, autoPlay: false });
    latestPositionRef.current = { time: savedTime, subId: savedSubId };

    if (savedSubId) {
      setPendingScrollSubtitleId(savedSubId);
    } else {
      setPendingScrollSubtitleId(null);
    }

    refreshLibraryCount();
    navigateToView('reader');
  };

  // Handle deletion of transcript from library
  const handleTranscriptDeleted = (deletedId) => {
    refreshLibraryCount();
    if (currentRecordId === deletedId) {
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
      setCurrentRecordId('');
      setCurrentTime(0);
      setPendingScrollSubtitleId(null);
      latestPositionRef.current = { time: 0, subId: null };
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {}
    }
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
    flushPlaybackPosition();
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
      glossAbortControllerRef.current = null;
    }
    setSubtitles([]);
    setSubtitleFormat(null);
    setSubtitleSource('');
    setGlossProgress(null);
    setCurrentRecordId('');
    setPendingScrollSubtitleId(null);
    latestPositionRef.current = { time: 0, subId: null };
  };

  const handleResetSession = () => {
    flushPlaybackPosition();
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
    setCurrentRecordId('');
    setPendingScrollSubtitleId(null);
    latestPositionRef.current = { time: 0, subId: null };
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
      {viewMode === 'library' ? (
        /* =================== VIEW 1: DEDICATED YOUTUBE LIBRARY =================== */
        <YouTubeLibraryView
          onSelectVideo={handleLoadFromLibrary}
          onAddNew={() => navigateToView('importer')}
          onBackToHome={setActiveTab ? () => setActiveTab('home') : null}
          currentVideoId={videoId}
        />
      ) : viewMode === 'importer' ? (
        /* =================== VIEW 2: ADD / IMPORT VIDEO SCREEN =================== */
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto px-2 sm:px-4 py-3 sm:py-4 overflow-y-auto custom-scrollbar text-[var(--text-primary)]">
          {/* Top Bar with Back to Library */}
          <div className="flex-shrink-0 flex items-center justify-between pb-3 sm:pb-4 border-b border-[var(--border-primary)] mb-4">
            <button
              type="button"
              onClick={() => navigateToView('library')}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isSpanish ? 'Biblioteca' : 'Library'}</span>
            </button>

            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Plus className="w-4 h-4 text-rose-500" />
              <span>{isSpanish ? 'Importar Vídeo y Subtítulos' : 'Import Video & Subtitles'}</span>
            </h2>

            <div className="w-20" /> {/* Spacer for symmetry */}
          </div>

          <div className="space-y-4 max-w-2xl mx-auto w-full">
            <YouTubeImporter
              onImportVideo={handleImportVideo}
              initialUrl={videoUrl}
              selectedLanguage={videoLanguage}
              onLanguageChange={setVideoLanguage}
            />

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
        </div>
      ) : (
        /* =================== VIEW 3: READER & TRANSCRIPT SCREEN =================== */
        <div className="h-full flex-1 overflow-hidden w-full flex flex-col bg-[var(--app-bg)] text-[var(--text-primary)] min-h-0">
          {/* TOP HEADER: [ ← ]     [TÍTULO]     [Idioma ▼]     [☰] */}
          <header className="relative z-30 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--header-border)] shadow-md text-[var(--text-primary)] shrink-0 transition-colors overflow-visible">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 min-w-0 max-w-4xl mx-auto">
              {/* [ ← ] Back button to library */}
              <button
                type="button"
                onClick={() => navigateToView('library')}
                title={isSpanish ? 'Volver a la Biblioteca' : 'Back to Library'}
                aria-label={isSpanish ? 'Volver a la Biblioteca' : 'Back to Library'}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* [TÍTULO] Centered video title */}
              <div className="min-w-0 flex-1 text-center px-1 sm:px-2">
                <h2
                  title={videoTitle || (isSpanish ? 'Lector de YouTube' : 'YouTube Reader')}
                  className="text-xs sm:text-sm md:text-base font-bold text-[var(--text-primary)] truncate leading-snug"
                >
                  {videoTitle || (isSpanish ? 'Lector de YouTube' : 'YouTube Reader')}
                </h2>
              </div>

              {/* [Idioma ▼] Target Language Selector Dropdown */}
              <div className="shrink-0">
                <LanguageSelectDropdown
                  value={targetLang}
                  onChange={(newLang) => {
                    if (setTargetLang) {
                      setTargetLang(newLang);
                    }
                  }}
                  options={languages && languages.length > 0 ? languages : undefined}
                  variant="header"
                  align="right"
                />
              </div>

              {/* [☰] Hamburger actions menu button */}
              <div className="relative shrink-0" ref={actionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen(prev => !prev)}
                  title={isSpanish ? 'Menú de opciones' : 'Menu options'}
                  aria-label={isSpanish ? 'Menú de opciones' : 'Menu options'}
                  aria-expanded={isActionsMenuOpen}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                    isActionsMenuOpen
                      ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] border border-rose-500/50'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                {/* Dropdown Menu */}
                {isActionsMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 z-[100] w-64 bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl p-1 text-xs font-medium text-[var(--text-primary)] max-h-[80vh] overflow-y-auto">
                    {/* 1. Inicio */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        if (setActiveTab) setActiveTab('home');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                    >
                      <Home className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                      <span>{isSpanish ? 'Inicio' : 'Home'}</span>
                    </button>

                    {/* 2. Librería */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        navigateToView('library');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                    >
                      <BookOpen className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                      <span>{isSpanish ? 'Librería' : 'Library'}</span>
                    </button>

                    {/* ⚙️ Configuraciones */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSettingsSubmenuOpen(prev => !prev);
                      }}
                      aria-expanded={isSettingsSubmenuOpen}
                      className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                    >
                      <span className="flex items-center space-x-2.5">
                        <Settings className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                        <span>{isSpanish ? 'Configuraciones' : 'Settings'}</span>
                      </span>
                      {isSettingsSubmenuOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      )}
                    </button>

                    {isSettingsSubmenuOpen && (
                      <div className="ml-3 pl-2 border-l border-[var(--border-subtle)]/60 space-y-0.5 mt-0.5">
                        {/* Subrayado de palabras (Sincronización visual) */}
                        <button
                          type="button"
                          onClick={() => setWordHighlightEnabled(!wordHighlightEnabled)}
                          className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                          title={isSpanish ? 'Activar/desactivar subrayado visual de palabras durante la reproducción' : 'Enable/disable visual word highlight during playback'}
                        >
                          <span className="flex items-center space-x-2.5">
                            <Sparkles className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                            <span>{isSpanish ? 'Subrayado de palabras' : 'Word highlighting'}</span>
                          </span>
                          <span
                            className={`w-8 h-4 rounded-full flex items-center px-0.5 shrink-0 ${
                              wordHighlightEnabled
                                ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end'
                                : 'bg-[var(--surface-secondary)] justify-start'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                          </span>
                        </button>

                        {/* Playback speed */}
                        <button
                          type="button"
                          onClick={cyclePlaybackRate}
                          className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                        >
                          <span className="flex items-center space-x-2.5">
                            <Gauge className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                            <span>Playback speed</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-300 shrink-0">
                            {playbackRate}×
                          </span>
                        </button>

                        {/* Transliterations [ON/OFF] */}
                        <button
                          type="button"
                          onClick={() => setInterlinearMode(!interlinearMode)}
                          className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                        >
                          <span className="flex items-center space-x-2.5">
                            <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[12px] leading-none text-rose-500 dark:text-rose-400 shrink-0">A文</span>
                            <span>Transliterations</span>
                          </span>
                          <span
                            className={`w-8 h-4 rounded-full flex items-center px-0.5 shrink-0 ${
                              interlinearMode
                                ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end'
                                : 'bg-[var(--surface-secondary)] justify-start'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                          </span>
                        </button>

                        {/* Text size */}
                        <button
                          type="button"
                          onClick={cycleFontSize}
                          className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                        >
                          <span className="flex items-center space-x-2.5">
                            <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[12px] leading-none text-rose-500 dark:text-rose-400 shrink-0">A±</span>
                            <span>Text size</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-300 shrink-0">
                            {fontSize}
                          </span>
                        </button>

                        {/* Auto glossing [ON/OFF] */}
                        <button
                          type="button"
                          onClick={handleToggleAutoGlossing}
                          className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                        >
                          <span className="flex items-center space-x-2.5">
                            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isAutoGlossing ? 'text-emerald-500 fill-emerald-500' : 'text-rose-500 dark:text-rose-400'}`} />
                            <span>Auto glossing</span>
                          </span>
                          <span
                            className={`w-8 h-4 rounded-full flex items-center px-0.5 shrink-0 ${
                              isAutoGlossing
                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 justify-end'
                                : 'bg-[var(--surface-secondary)] justify-start'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                          </span>
                        </button>

                        {/* Auto-scroll [ON/OFF] */}
                        <button
                          type="button"
                          onClick={() => setAutoScroll(!autoScroll)}
                          className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                        >
                          <span className="flex items-center space-x-2.5">
                            <ArrowDown className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                            <span>Auto-scroll</span>
                          </span>
                          <span
                            className={`w-8 h-4 rounded-full flex items-center px-0.5 shrink-0 ${
                              autoScroll
                                ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end'
                                : 'bg-[var(--surface-secondary)] justify-start'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                          </span>
                        </button>
                      </div>
                    )}

                    <div className="my-1 border-t border-[var(--border-subtle)]/60" />

                    {/* 8. Ir al inicio del vídeo */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        handleResetToStart();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                    >
                      <RotateCcw className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                      <span>{isSpanish ? 'Ir al inicio del vídeo' : 'Rewind to start'}</span>
                    </button>

                    {/* 9. Cambiar archivo de subtítulos */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                    >
                      <Upload className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                      <span>{isSpanish ? 'Cambiar archivo subtítulos' : 'Change subtitle file'}</span>
                    </button>

                    {/* 10. Cambiar vídeo / URL */}
                    {videoId && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsUrlImporterOpen(!isUrlImporterOpen);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                      >
                        <Youtube className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                        <span>{isUrlImporterOpen ? (isSpanish ? 'Ocultar cambio vídeo' : 'Hide change video') : (isSpanish ? 'Cambiar vídeo / URL' : 'Change video / URL')}</span>
                      </button>
                    )}

                    {/* 11. Reiniciar lector */}
                    {(videoId || subtitles.length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          handleResetSession();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" />
                        <span>{isSpanish ? 'Reiniciar lector' : 'Reset reader'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* MAIN READER BODY */}
          <div className="flex-1 overflow-hidden flex flex-col w-full max-w-4xl mx-auto px-2 sm:px-4 py-2 min-h-0">
            {/* YouTube Importer Input (shown when 'Cambiar vídeo' clicked) */}
            {isUrlImporterOpen && (
              <div className="mb-2 shrink-0">
                <YouTubeImporter
                  onImportVideo={handleImportVideo}
                  initialUrl={videoUrl}
                  selectedLanguage={videoLanguage}
                  onLanguageChange={setVideoLanguage}
                />
              </div>
            )}

            {/* YouTube Video Player */}
            {videoId && (
              <div className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-xl shadow-black/40 border border-[#3d190f] mb-2 shrink-0">
                <YouTubePlayer
                  videoId={videoId}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayerStateChange={handlePlayerStateChange}
                  onPlayerReady={handlePlayerReady}
                  seekToTime={seekToTime}
                  playbackRate={playbackRate}
                />
              </div>
            )}

            {/* SubtitleImporter (compact status line in reader) */}
            {subtitles.length > 0 && (
              <div className="shrink-0 mb-1">
                <SubtitleImporter
                  onSubtitlesLoaded={handleSubtitlesLoaded}
                  subtitlesCount={subtitles.length}
                  currentFormat={subtitleFormat}
                  onClearSubtitles={handleClearSubtitles}
                  glossProgress={glossProgress}
                  onStopOrPauseGlossing={handleStopOrPauseGlossing}
                  onResumeGlossing={handleResumeGlossing}
                />
              </div>
            )}

            {/* Search Input & Quick Controls */}
            {subtitles.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 shrink-0 px-0.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isSpanish ? "Buscar en el transcript..." : "Search transcript..."}
                    className="w-full bg-[var(--input-bg)] text-[var(--text-primary)] text-xs pl-8 pr-7 py-1.5 rounded-xl border border-[var(--input-border)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-rose-500 shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleResetToStart}
                  title={isSpanish ? "Ir al inicio del vídeo y transcript" : "Rewind to video start"}
                  className="p-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors cursor-pointer shrink-0 shadow-xs active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                </button>

                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  title={autoScroll ? (isSpanish ? "Auto-scroll activo: clic para desactivar" : "Auto-scroll active: click to disable") : (isSpanish ? "Activar auto-scroll" : "Enable auto-scroll")}
                  className={`px-2 py-1.5 rounded-xl border text-[10px] font-semibold transition-all flex items-center gap-1 shrink-0 shadow-xs cursor-pointer active:scale-95 ${
                    autoScroll
                      ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <ArrowDown className={`w-3 h-3 ${autoScroll ? 'animate-bounce' : ''}`} />
                  <span className="hidden xs:inline">Auto-scroll</span>
                  <span className={`text-[8px] px-1 py-0.2 rounded font-bold ${autoScroll ? 'bg-rose-900 text-white' : 'bg-[var(--surface-tertiary)] text-[var(--text-muted)]'}`}>
                    {autoScroll ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}

            {/* Transcript (Maximum vertical space with independent scroll) */}
            {subtitles.length > 0 && (
              <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden pt-0.5">
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
                  nativeLang={nativeLang}
                  onWordClick={onWordClick}
                  pendingScrollSubtitleId={pendingScrollSubtitleId}
                  onScrollComplete={() => setPendingScrollSubtitleId(null)}
                />
              </div>
            )}
          </div>

          {/* BOTTOM CONTROL BAR — compact icon controls matching TextReaderPage */}
          {subtitles.length > 0 && (
            <div className="shrink-0 z-30 bg-[var(--header-bg)] backdrop-blur-md border-t border-[var(--header-border)] shadow-md">
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-around gap-1 sm:gap-2 max-w-4xl mx-auto">
                {/* 1. Transliterations — A文 */}
                <button
                  type="button"
                  onClick={() => setInterlinearMode(!interlinearMode)}
                  title={interlinearMode
                    ? (isSpanish ? 'Desactivar transliteración / glosado interlineal' : 'Disable transliteration / interlinear gloss')
                    : (isSpanish ? 'Activar transliteración / glosado interlineal' : 'Enable transliteration / interlinear gloss')}
                  aria-label="Transliterations"
                  aria-pressed={interlinearMode}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                    interlinearMode
                      ? 'bg-rose-600 text-white border border-rose-500 ring-1 ring-rose-400/30 shadow-rose-900/40'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span className="font-bold text-[11px] sm:text-xs leading-none select-none tracking-tighter">A文</span>
                </button>

                {/* 2. Auto glossing — Sparkles */}
                <button
                  type="button"
                  onClick={handleToggleAutoGlossing}
                  title={isAutoGlossing
                    ? (isSpanish ? 'Glosado automático activo (clic para pausar)' : 'Auto-glossing active (click to pause)')
                    : (isSpanish ? 'Activar glosado automático' : 'Enable auto-glossing')}
                  aria-label="Auto glossing"
                  aria-pressed={isAutoGlossing}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                    isAutoGlossing
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-emerald-950/40'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border-primary)]'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isAutoGlossing ? 'text-white fill-white' : 'text-rose-500 dark:text-rose-400'}`} />
                </button>

                {/* 3. Text size — A± */}
                <button
                  type="button"
                  onClick={cycleFontSize}
                  title={isSpanish ? `Tamaño de texto: ${fontSize.toUpperCase()} — clic para cambiar` : `Text size: ${fontSize.toUpperCase()} — click to change`}
                  aria-label="Tamaño de texto"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <span className="font-bold text-[11px] sm:text-xs leading-none select-none tracking-tight">A±</span>
                </button>

                {/* 4. Playback speed — Gauge */}
                <button
                  type="button"
                  onClick={cyclePlaybackRate}
                  title={isSpanish
                    ? `Velocidad del vídeo (${playbackRate}×) — clic para cambiar`
                    : `Video playback speed (${playbackRate}×) — click to change`}
                  aria-label="Playback speed"
                  className="min-w-9 h-9 sm:min-w-10 sm:h-10 px-1.5 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95 bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 dark:text-rose-400" />
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold leading-none">
                    {playbackRate}×
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Hidden File Input for Subtitle file changes */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt,.txt,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Saved Transcripts Modal (kept for backward compatibility or quick access) */}
      <SavedTranscriptsModal
        isOpen={isLibraryOpen}
        onClose={() => {
          setIsLibraryOpen(false);
          refreshLibraryCount();
        }}
        onLoadTranscript={handleLoadFromLibrary}
        onDeleteTranscript={handleTranscriptDeleted}
        currentVideoId={videoId}
      />
    </ErrorBoundary>
  );
}

export default YouTubeReaderPage;
