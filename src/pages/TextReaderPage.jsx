import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText,
  Sparkles,
  Play,
  Square,
  Pause,
  Upload,
  Clipboard,
  Trash2,
  Edit3,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Type,
  Maximize2,
  BookOpen,
  Languages,
  Menu,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Home,
  Settings,
  Gauge,
  Plus,
  Headphones,
  AlertCircle,
  X
} from 'lucide-react';
import { TextParagraphItem } from '../components/text/TextParagraphItem.jsx';
import { SavedDocumentsModal } from '../components/text/SavedDocumentsModal.jsx';
import { CreateWithAiModal } from '../components/text/CreateWithAiModal.jsx';
import { TextLibraryView } from '../components/text/TextLibraryView.jsx';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { getLanguageMeta } from '../constants/languages.js';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { recordHabitActivityForToday } from '../services/habitTrackerService.js';
import {
  splitTextIntoParagraphs,
  createTextDocument,
  saveDocument,
  saveActiveDocumentDraft,
  loadActiveDocumentDraft,
  clearActiveDocumentDraft,
  translateParagraphTextApi,
  transcribeAudioFileApi
} from '../services/textDocumentService.js';
import {
  saveTextDocument,
  getTextDocumentById,
  getAllTextDocuments,
  deleteTextDocument,
  getTextDocumentsCount,
  migrateFromLocalStorage
} from '../services/textLibraryStorage.js';
import {
  enrichParagraphsWithGlosses,
  glossSingleParagraph,
  isGlossComplete
} from '../services/textGlossService.js';
import { parseEpubFile } from '../services/epubService.js';
import { requestAutoBackup } from '../services/autoBackupService.js';
import { useAudioSettings, SPEECH_RATE_OPTIONS, mapSpeechRateToUtteranceRate } from '../context/AudioSettingsContext.jsx';
import { estimateSpeechDurationMs, createAudioWordSynchronizer } from '../utils/audioWordSync.js';

/**
 * Resolves the initial chapter index for a document based on its saved reading/audio bookmarks.
 * Fallback order:
 * 1. lastAudioPosition.paragraphId
 * 2. lastReadingPosition.paragraphId
 * 3. lastReadingPosition.chapterIndex
 * 4. 0 (default first chapter)
 */
function resolveChapterIndexForDoc(doc) {
  if (!doc || !Array.isArray(doc.chapters) || doc.chapters.length === 0) return 0;
  const targetId = doc.lastAudioPosition?.paragraphId || doc.lastReadingPosition?.paragraphId;
  if (targetId) {
    const chIdx = doc.chapters.findIndex(ch => Array.isArray(ch.paragraphIds) && ch.paragraphIds.includes(targetId));
    if (chIdx !== -1) return chIdx;
  }
  if (typeof doc.lastReadingPosition?.chapterIndex === 'number' && doc.lastReadingPosition.chapterIndex >= 0 && doc.lastReadingPosition.chapterIndex < doc.chapters.length) {
    return doc.lastReadingPosition.chapterIndex;
  }
  return 0;
}

const PARAGRAPHS_PER_PAGE = 15;

/**
 * Resolves the initial 0-based paragraph page for an EPUB chapter based on
 * lastAudioPosition or lastReadingPosition paragraphId.
 */
function resolvePageIndexForDoc(doc, chapterIdx = 0) {
  if (!doc || !Array.isArray(doc.paragraphs) || doc.paragraphs.length === 0) return 0;
  const isEp = Boolean(
    doc.format === 'epub' || doc.sourceType === 'epub' || (Array.isArray(doc.chapters) && doc.chapters.length > 0)
  );
  if (!isEp || !Array.isArray(doc.chapters) || doc.chapters.length === 0) return 0;
  const ch = doc.chapters[chapterIdx] || doc.chapters[0];
  if (!ch) return 0;
  const chapterParas = doc.paragraphs.filter(p => p.chapterId === ch.id);
  const targetId = doc.lastAudioPosition?.paragraphId || doc.lastReadingPosition?.paragraphId;
  if (targetId) {
    const pIdx = chapterParas.findIndex(p => p.id === targetId);
    if (pIdx !== -1) {
      return Math.floor(pIdx / PARAGRAPHS_PER_PAGE);
    }
  }
  return 0;
}

export function TextReaderPage({
  targetLang = 'zh',
  setTargetLang = null,
  nativeLang = 'es',
  languages = [],
  apiKey = '',
  onWordClick = null,
  setActiveTab = null
}) {
  const { user } = useAuth();
  const { t, isSpanish } = useSiteLanguage();
  const {
    speechRate,
    setSpeechRate,
    autoPlayTextReader,
    setAutoPlayTextReader,
    wordHighlightEnabled,
    setWordHighlightEnabled,
    speechRateOptions
  } = useAudioSettings();
  const speechRateRef = useRef(speechRate);
  speechRateRef.current = speechRate;
  const autoPlayTextReaderRef = useRef(autoPlayTextReader);
  autoPlayTextReaderRef.current = autoPlayTextReader;
  const userStoppedRef = useRef(false);
  const visibleParagraphsRef = useRef([]);
  const chapterParagraphsRef = useRef([]);
  const currentParagraphPageRef = useRef(0);
  const handlePlayParagraphRef = useRef(null);

  // Audio TTS states & visual synchronizer ref
  const [playingParagraphId, setPlayingParagraphId] = useState(null);
  const [activeAudioCharIndex, setActiveAudioCharIndex] = useState(-1);
  const [audioErrorId, setAudioErrorId] = useState(null);
  const audioPlaybackIdRef = useRef(0);
  const audioSynchronizerRef = useRef(null);

  const clearAudioVisualTimer = useCallback(() => {
    if (audioSynchronizerRef.current) {
      audioSynchronizerRef.current.stop();
      audioSynchronizerRef.current = null;
    }
  }, []);

  // Saved documents library count & refresh helper
  const [savedDocsCount, setSavedDocsCount] = useState(0);
  const refreshLibraryCount = useCallback(async () => {
    try {
      const count = await getTextDocumentsCount();
      setSavedDocsCount(count);
    } catch (e) {
      console.warn('Failed to count saved documents in IndexedDB:', e);
    }
  }, []);

  // Contextual actions menu state for top bar
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef(null);
  // UI-only toggle to expand/collapse the "Configuraciones" submenu inside the hamburger menu.
  const [isSettingsSubmenuOpen, setIsSettingsSubmenuOpen] = useState(false);

  // Glossing progress & controller
  const [glossingProgress, setGlossingProgress] = useState({
    total: 0,
    completed: 0,
    isGlossing: false,
    isPaused: false,
    isComplete: false,
    failed: 0
  });
  const [isAutoGlossing, setIsAutoGlossing] = useState(false);
  const [glossNotice, setGlossNotice] = useState(null); // { message: string, type: 'success' | 'warning' }
  const [glossingParagraphIds, setGlossingParagraphIds] = useState(new Set());
  const loadingParagraphIds = glossingParagraphIds; // Alias for backward compatibility
  const setLoadingParagraphIds = setGlossingParagraphIds;
  const abortControllerRef = useRef(null);

  // Auto-dismiss gloss notice toast after 5 seconds
  useEffect(() => {
    if (!glossNotice) return;
    const timer = setTimeout(() => {
      setGlossNotice(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [glossNotice]);

  // On-demand paragraph translation state: { [paragraphId]: { text, isTranslating, isVisible, error } }
  const [paragraphTranslations, setParagraphTranslations] = useState({});

  // Load existing draft if available
  const [document, setDocument] = useState(() => loadActiveDocumentDraft());
  const documentRef = useRef(document);
  documentRef.current = document;

  // EPUB Chapter-by-chapter state
  const isEpub = Boolean(
    document &&
    (document.format === 'epub' || document.sourceType === 'epub' || (Array.isArray(document.chapters) && document.chapters.length > 0))
  );
  const chapters = useMemo(() => {
    return (isEpub && Array.isArray(document?.chapters)) ? document.chapters : [];
  }, [isEpub, document?.chapters]);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(() => {
    return resolveChapterIndexForDoc(loadActiveDocumentDraft());
  });

  const [currentParagraphPage, setCurrentParagraphPage] = useState(() => {
    const draft = loadActiveDocumentDraft();
    const chIdx = resolveChapterIndexForDoc(draft);
    return resolvePageIndexForDoc(draft, chIdx);
  });
  currentParagraphPageRef.current = currentParagraphPage;

  // Synchronize chapter and page index when switching documents or after EPUB import
  useEffect(() => {
    if (document && isEpub && chapters.length > 0) {
      const idx = resolveChapterIndexForDoc(document);
      setCurrentChapterIndex(idx);
      const pageIdx = resolvePageIndexForDoc(document, idx);
      setCurrentParagraphPage(pageIdx);
    } else {
      setCurrentParagraphPage(0);
    }
  }, [document?.id, isEpub, chapters.length]);

  const currentChapter = isEpub && chapters[currentChapterIndex] ? chapters[currentChapterIndex] : null;

  // All paragraphs belonging to the active chapter (or entire document for TXT)
  const chapterParagraphs = useMemo(() => {
    if (!document || !Array.isArray(document.paragraphs)) return [];
    if (!isEpub || chapters.length === 0 || !currentChapter) {
      return document.paragraphs;
    }
    return document.paragraphs.filter(p => p.chapterId === currentChapter.id);
  }, [document?.id, document?.paragraphs, isEpub, chapters, currentChapter]);
  chapterParagraphsRef.current = chapterParagraphs;

  // Total pages: fixed 15 paragraphs per page for EPUB, 1 page for TXT (continuous scroll)
  const totalPages = useMemo(() => {
    if (!isEpub || chapters.length === 0) return 1;
    return Math.max(1, Math.ceil(chapterParagraphs.length / PARAGRAPHS_PER_PAGE));
  }, [isEpub, chapters.length, chapterParagraphs.length]);

  // Ensure currentParagraphPage does not exceed totalPages
  useEffect(() => {
    if (currentParagraphPage >= totalPages) {
      setCurrentParagraphPage(Math.max(0, totalPages - 1));
    }
  }, [currentParagraphPage, totalPages]);

  // Render ONLY the current 15 paragraphs for EPUB, or all paragraphs for TXT
  const visibleParagraphs = useMemo(() => {
    if (!isEpub || chapters.length === 0) {
      return chapterParagraphs;
    }
    const safePage = Math.min(Math.max(0, currentParagraphPage), totalPages - 1);
    const start = safePage * PARAGRAPHS_PER_PAGE;
    return chapterParagraphs.slice(start, start + PARAGRAPHS_PER_PAGE);
  }, [isEpub, chapters.length, chapterParagraphs, currentParagraphPage, totalPages]);
  visibleParagraphsRef.current = visibleParagraphs;

  // Navigation mode: 'library' | 'importer' | 'reader'
  // Default to 'library' when entering Text Reader
  const [viewMode, setViewMode] = useState('library');

  // Navigation helper: change view mode and update browser history
  const navigateToView = useCallback((newMode) => {
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
  }, []);

  // Listen to browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash === '#reader' && document) {
        setViewMode('reader');
      } else if (hash === '#import') {
        setViewMode('importer');
      } else {
        setViewMode('library');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [document]);

  // Auto-backup trigger strictly upon content exit/closure with stable document.id
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    if (viewModeRef.current === 'reader' && viewMode !== 'reader') {
      const docId = documentRef.current?.id;
      if (docId) {
        requestAutoBackup({
          type: 'text-document',
          id: docId,
          reason: 'text-reader-exit'
        });
      }
    }
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (viewModeRef.current === 'reader') {
        const docId = documentRef.current?.id;
        if (docId) {
          requestAutoBackup({
            type: 'text-document',
            id: docId,
            reason: 'text-reader-unmount'
          });
        }
      }
    };
  }, []);

  const isEditing = viewMode === 'importer';
  const setIsEditing = (val) => navigateToView(val ? 'importer' : 'reader');

  const [inputText, setInputText] = useState(() => loadActiveDocumentDraft()?.rawText || '');
  const [inputTitle, setInputTitle] = useState(() => loadActiveDocumentDraft()?.title || '');

  const handleAddNewDocument = useCallback(() => {
    audioPlaybackIdRef.current++;
    clearAudioVisualTimer();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAutoGlossing(false);
    setPlayingParagraphId(null);
    setActiveAudioCharIndex(-1);
    setLastAudioParagraphId(null);
    setPendingScrollParagraphId(null);
    setDocument(null);
    setInputText('');
    setInputTitle('');
    navigateToView('importer');
  }, [clearAudioVisualTimer, navigateToView]);
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg' | 'xl' | '2xl'
  const [interlinearMode, setInterlinearMode] = useState(true);

  // Saved documents library modal
  const [showSavedModal, setShowSavedModal] = useState(false);

  // Create with AI modal state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleAiTextGenerated = useCallback(async ({ title, text }) => {
    const raw = (text || '').trim();
    if (!raw) return;

    try {
      audioPlaybackIdRef.current++;
      clearAudioVisualTimer();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsAutoGlossing(false);
      setPlayingParagraphId(null);
      setActiveAudioCharIndex(-1);
      setLastAudioParagraphId(null);
      setPendingScrollParagraphId(null);
      previousScrollTopRef.current = 0;
      setIsHeaderHidden(false);

      const effectiveTitle = (title || '').trim() || (isSpanish ? 'Historia con IA' : 'AI Generated Story');

      const docToSave = createTextDocument({
        title: effectiveTitle,
        rawText: raw,
        targetLang,
        nativeLang,
        sourceType: 'ai',
        format: 'txt',
        createdAt: new Date().toISOString()
      });

      const saved = await saveDocument(docToSave);
      setDocument(saved);
      setInputText(saved.rawText || '');
      setInputTitle(saved.title || '');
      await refreshLibraryCount();
      navigateToView('reader');

      // Auto-glossing is OFF by default:
      const alreadyComplete = Array.isArray(saved.paragraphs) && saved.paragraphs.every(p => isGlossComplete(p, targetLang, nativeLang));
      const completedCount = Array.isArray(saved.paragraphs) ? saved.paragraphs.filter(p => isGlossComplete(p, targetLang, nativeLang)).length : 0;

      setGlossingProgress({
        total: Array.isArray(saved.paragraphs) ? saved.paragraphs.length : 0,
        completed: completedCount,
        isGlossing: false,
        isPaused: false,
        isComplete: alreadyComplete,
        failed: 0
      });
    } catch (err) {
      console.error('Failed to create and save AI document:', err);
      setInputText(text);
      if (title) {
        setInputTitle(title);
      }
      navigateToView('importer');
    }
  }, [targetLang, nativeLang, isSpanish, clearAudioVisualTimer, refreshLibraryCount, navigateToView]);

  // EPUB Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');


  // Last audio position bookmark — persisted in document.lastAudioPosition
  const [lastAudioParagraphId, setLastAudioParagraphId] = useState(
    () => loadActiveDocumentDraft()?.lastAudioPosition?.paragraphId || null
  );
  // Scheduling a scroll: set to a paragraphId, cleared after scroll fires
  const [pendingScrollParagraphId, setPendingScrollParagraphId] = useState(null);

  // Auto-hide entire reader header on scroll down
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const scrollContainerRef = useRef(null);
  const previousScrollTopRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const saveReadingPositionTimeoutRef = useRef(null);

  // Scroll listener on main content container for auto-hiding full header
  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    // Initialize previous scroll position
    previousScrollTopRef.current = element.scrollTop;

    const handleScroll = () => {
      const currentScrollTop = element.scrollTop;
      const previousScrollTop = previousScrollTopRef.current;
      const delta = currentScrollTop - previousScrollTop;

      // 1. Ignore programmatic scrolls (such as restoring last audio position)
      if (isProgrammaticScrollRef.current) {
        previousScrollTopRef.current = currentScrollTop;
        setIsHeaderHidden(false);
        return;
      }

      // 2. If at or near top (<= 10px), always show entire header
      if (currentScrollTop <= 10) {
        previousScrollTopRef.current = Math.max(0, currentScrollTop);
        setIsHeaderHidden(false);
        return;
      }

      // 3. Ignore micro-scrolls (tolerance threshold 8px) to prevent flicker
      if (Math.abs(delta) < 8) {
        return;
      }

      // 4. Detect scroll direction
      if (delta > 0) {
        // Scrolling DOWN -> hide entire header
        setIsHeaderHidden(true);
      } else {
        // Scrolling UP -> show entire header immediately
        setIsHeaderHidden(false);
      }

      // Close contextual actions menu if open on scroll
      setIsActionsMenuOpen(false);

      previousScrollTopRef.current = currentScrollTop;

      // 5. Debounce saving last reading position (topmost visible paragraph)
      if (!isProgrammaticScrollRef.current && element) {
        clearTimeout(saveReadingPositionTimeoutRef.current);
        saveReadingPositionTimeoutRef.current = setTimeout(() => {
          if (!element) return;
          const containerRect = element.getBoundingClientRect();
          const paraEls = element.querySelectorAll('[data-paragraph-id]');
          for (const pEl of paraEls) {
            const pRect = pEl.getBoundingClientRect();
            if (pRect.bottom >= containerRect.top + 60 && pRect.top <= containerRect.bottom) {
              const pid = pEl.getAttribute('data-paragraph-id');
              if (pid) {
                const prev = documentRef.current;
                if (prev && prev.lastReadingPosition?.paragraphId !== pid) {
                  const posData = {
                    paragraphId: pid,
                    chapterIndex: currentChapterIndex,
                    chapterId: currentChapter?.id,
                    updatedAt: Date.now()
                  };
                  prev.lastReadingPosition = posData;
                  saveActiveDocumentDraft(prev);
                  if (prev.id) {
                    saveTextDocument(prev).catch(() => {});
                  }
                }
              }
              break;
            }
          }
        }, 800);
      }
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [isEditing, viewMode]);

  // Navigate to another chapter (unmounts previous chapter, mounts new chapter, scrolls to top)
  const handleNavigateChapter = useCallback((newIndex) => {
    if (newIndex < 0 || newIndex >= chapters.length) return;
    audioPlaybackIdRef.current++;
    clearAudioVisualTimer();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingParagraphId(null);
    setActiveAudioCharIndex(-1);
    setCurrentChapterIndex(newIndex);
    setCurrentParagraphPage(0);

    if (scrollContainerRef.current) {
      isProgrammaticScrollRef.current = true;
      scrollContainerRef.current.scrollTop = 0;
      previousScrollTopRef.current = 0;
      setIsHeaderHidden(false);
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        if (scrollContainerRef.current) {
          previousScrollTopRef.current = scrollContainerRef.current.scrollTop;
        }
      }, 200);
    }

    const targetChapter = chapters[newIndex];
    const firstParaId = targetChapter?.paragraphIds?.[0];
    if (firstParaId) {
      setDocument(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          lastReadingPosition: {
            paragraphId: firstParaId,
            chapterIndex: newIndex,
            chapterId: targetChapter.id,
            updatedAt: Date.now()
          }
        };
        saveActiveDocumentDraft(updated);
        if (updated.id) {
          saveTextDocument(updated).catch(() => {});
        }
        return updated;
      });
    }
  }, [chapters, clearAudioVisualTimer]);

  // Navigate to another page within the current chapter (resets scroll to top cleanly)
  const handleNavigatePage = useCallback((newPage) => {
    if (newPage < 0 || newPage >= totalPages || newPage === currentParagraphPage) return;
    audioPlaybackIdRef.current++;
    clearAudioVisualTimer();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingParagraphId(null);
    setActiveAudioCharIndex(-1);

    if (saveReadingPositionTimeoutRef.current) {
      clearTimeout(saveReadingPositionTimeoutRef.current);
    }

    isProgrammaticScrollRef.current = true;
    setCurrentParagraphPage(newPage);

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      previousScrollTopRef.current = 0;
    }
    setIsHeaderHidden(false);

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      if (scrollContainerRef.current) {
        previousScrollTopRef.current = scrollContainerRef.current.scrollTop;
      }
    }, 200);

    const firstParaOfPage = chapterParagraphs[newPage * PARAGRAPHS_PER_PAGE];
    if (firstParaOfPage) {
      setDocument(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          lastReadingPosition: {
            paragraphId: firstParaOfPage.id,
            chapterIndex: currentChapterIndex,
            chapterId: currentChapter?.id,
            updatedAt: Date.now()
          }
        };
        saveActiveDocumentDraft(updated);
        if (updated.id) {
          saveTextDocument(updated).catch(() => {});
        }
        return updated;
      });
    }
  }, [totalPages, currentParagraphPage, chapterParagraphs, currentChapterIndex, currentChapter, clearAudioVisualTimer]);


  // Cleanup speech synthesis, glossing & timers on unmount
  useEffect(() => {
    return () => {
      audioPlaybackIdRef.current++;
      clearAudioVisualTimer();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (saveReadingPositionTimeoutRef.current) {
        clearTimeout(saveReadingPositionTimeoutRef.current);
      }
    };
  }, [clearAudioVisualTimer]);


  // On mount: run migration from legacy localStorage to IndexedDB, refresh count, and schedule draft scroll restoration
  useEffect(() => {
    migrateFromLocalStorage().then(async () => {
      await refreshLibraryCount();

      // Hydrate full active document from IndexedDB if active draft is minimal or missing full paragraphs
      const draft = loadActiveDocumentDraft();
      if (draft && draft.id) {
        try {
          const fullDoc = await getTextDocumentById(draft.id);
          if (fullDoc && Array.isArray(fullDoc.paragraphs) && fullDoc.paragraphs.length > 0) {
            const merged = {
              ...fullDoc,
              lastAudioPosition: draft.lastAudioPosition || fullDoc.lastAudioPosition,
              lastReadingPosition: draft.lastReadingPosition || fullDoc.lastReadingPosition
            };
            setDocument(merged);
            const targetPosId = merged.lastAudioPosition?.paragraphId || merged.lastReadingPosition?.paragraphId;
            if (targetPosId) {
              setPendingScrollParagraphId(targetPosId);
            }
          }
        } catch (err) {
          console.warn('Failed to hydrate active document from IndexedDB:', err);
        }
      } else if (draft && Array.isArray(draft.paragraphs) && draft.paragraphs.length > 0) {
        const targetPosId = draft.lastAudioPosition?.paragraphId || draft.lastReadingPosition?.paragraphId;
        if (targetPosId) {
          setPendingScrollParagraphId(targetPosId);
        }
      }
    }).catch(() => {});
  }, [refreshLibraryCount]);

  // Save active document state whenever document changes (syncs draft + IndexedDB)
  useEffect(() => {
    if (document) {
      saveActiveDocumentDraft(document);
      // If the document is an unhydrated minimal draft from localStorage, avoid redundant IndexedDB writes
      if (document.isMinimalDraft) {
        return;
      }
      if (document.id) {
        saveTextDocument(document).then(() => {
          refreshLibraryCount();
        }).catch(() => {});
      }
    }
  }, [document, refreshLibraryCount]);

  // Scroll restoration: smoothly scrolls the real overflow container to the last audio paragraph
  useEffect(() => {
    if (!pendingScrollParagraphId) return;
    let cancelled = false;
    let attempts = 0;
    let timeoutId = null;

    const performScroll = () => {
      if (cancelled) return;
      const targetId = pendingScrollParagraphId;
      const container = scrollContainerRef.current;
      const el = container?.querySelector(`[data-paragraph-id="${targetId}"]`)
        || window.document.querySelector(`[data-paragraph-id="${targetId}"]`);

      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const relativeTop = elRect.top - containerRect.top + container.scrollTop;
        const targetScrollTop = Math.max(0, relativeTop - (container.clientHeight / 2) + (elRect.height / 2));

        isProgrammaticScrollRef.current = true;
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });

        previousScrollTopRef.current = targetScrollTop;
        setPendingScrollParagraphId(null);

        // Keep header visible and release programmatic lock after smooth scroll completes
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          if (container) {
            previousScrollTopRef.current = container.scrollTop;
          }
        }, 500);
      } else if (attempts < 6) {
        attempts++;
        timeoutId = setTimeout(performScroll, 80);
      } else {
        setPendingScrollParagraphId(null);
      }
    };

    timeoutId = setTimeout(performScroll, 100);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pendingScrollParagraphId]);

  // Active document language (falls back to selected targetLang if editing/new)
  const activeDocLang = (document && !isEditing && document.targetLang) ? document.targetLang : targetLang;

  // Count how many paragraphs are completely glossed
  const completedParagraphsCount = useMemo(() => {
    if (!document || !Array.isArray(document.paragraphs)) return 0;
    return document.paragraphs.filter(p => isGlossComplete(p, activeDocLang, nativeLang)).length;
  }, [document, activeDocLang, nativeLang]);


  // Change target language safely without silently deleting user manual glosses or prior language states
  const handleLanguageChange = useCallback(async (newLang) => {
    if (!newLang) return;

    if (document && !isEditing) {
      if (newLang === document.targetLang) return;

      const currentDocLang = document.targetLang || 'zh';
      const currentStates = (document.languageStates && typeof document.languageStates === 'object')
        ? { ...document.languageStates }
        : {};

      // Snapshot current language paragraphs into languageStates
      currentStates[currentDocLang] = {
        targetLang: currentDocLang,
        paragraphs: document.paragraphs,
        updatedAt: new Date().toISOString()
      };

      // 1. If this document ALREADY has a saved state for newLang, restore it directly!
      // This immediately recovers previous AI glosses, manual glosses, and pinyin ($0 Groq cost, 0ms latency)
      if (currentStates[newLang] && Array.isArray(currentStates[newLang].paragraphs) && currentStates[newLang].paragraphs.length > 0) {
        const restoredDoc = {
          ...document,
          targetLang: newLang,
          paragraphs: currentStates[newLang].paragraphs,
          languageStates: currentStates
        };
        const saved = await saveDocument(restoredDoc);
        setDocument(saved);
        refreshLibraryCount();
        if (setTargetLang) setTargetLang(newLang);
        return;
      }

      // 2. Otherwise, retokenize for newLang while preserving manual glosses
      const hasManual = document.paragraphs?.some(p =>
        Array.isArray(p.tokens) && p.tokens.some(t => t.glossSource === 'manual' && t.gloss)
      );

      if (hasManual) {
        const newMeta = getLanguageMeta(newLang);
        const confirmed = window.confirm(
          `El documento actual contiene glosas manuales.\n\nAl cambiar el idioma a "${newMeta.name}", el texto se retokenizará para ese idioma pero se conservarán automáticamente todas las glosas manuales de las palabras coincidentes.\n\n¿Deseas cambiar el idioma del documento?`
        );
        if (!confirmed) {
          return;
        }
      }

      // Collect all manual glosses from current document
      const globalManualMap = new Map();
      document.paragraphs.forEach(p => {
        if (Array.isArray(p.tokens)) {
          p.tokens.forEach(tok => {
            if (tok.glossSource === 'manual' && tok.gloss) {
              const w = (tok.word || tok.text || '').trim();
              if (w) {
                globalManualMap.set(w, tok.gloss);
                globalManualMap.set(w.toLowerCase(), tok.gloss);
              }
            }
          });
        }
      });

      // Split and tokenize for the new language
      const freshParagraphs = splitTextIntoParagraphs(document.rawText, newLang);

      // Restore matching manual glosses onto fresh paragraphs
      const preservedParagraphs = freshParagraphs.map(p => {
        if (!Array.isArray(p.tokens)) return p;
        let modified = false;
        const newTokens = p.tokens.map(tok => {
          const w = (tok.word || tok.text || '').trim();
          if (w && (globalManualMap.has(w) || globalManualMap.has(w.toLowerCase()))) {
            const preservedGloss = globalManualMap.get(w) || globalManualMap.get(w.toLowerCase());
            modified = true;
            return {
              ...tok,
              gloss: preservedGloss,
              glossSource: 'manual'
            };
          }
          return tok;
        });
        return modified ? { ...p, tokens: newTokens } : p;
      });

      currentStates[newLang] = {
        targetLang: newLang,
        paragraphs: preservedParagraphs,
        updatedAt: new Date().toISOString()
      };

      const updatedDoc = {
        ...document,
        targetLang: newLang,
        paragraphs: preservedParagraphs,
        languageStates: currentStates
      };
      const saved = await saveDocument(updatedDoc);
      setDocument(saved);
      refreshLibraryCount();
      if (setTargetLang) setTargetLang(newLang);
    } else {
      if (setTargetLang) setTargetLang(newLang);
    }
  }, [document, isEditing, setTargetLang, refreshLibraryCount]);

  // Handle single-paragraph TTS playback
  const handlePlayParagraph = useCallback((paragraph) => {
    if (!paragraph || !paragraph.text) return;
    const playbackId = ++audioPlaybackIdRef.current;
    if (!window.speechSynthesis) {
      setAudioErrorId(paragraph.id);
      return; // No position saved — TTS not available
    }

    userStoppedRef.current = false;
    clearAudioVisualTimer();

    // Cancel any current utterance
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    setAudioErrorId(null);
    setPlayingParagraphId(paragraph.id);
    setActiveAudioCharIndex(0);

    // Save last audio position safely (persists even if page closes or switches document)
    try {
      setLastAudioParagraphId(paragraph.id);
      setDocument(prev => {
        if (!prev) return prev;
        const posData = {
          paragraphId: paragraph.id,
          paragraphIndex: (prev.paragraphs || []).findIndex(p => p.id === paragraph.id),
          updatedAt: Date.now()
        };
        const updated = {
          ...prev,
          lastAudioPosition: posData
        };
        // Persist immediately to active draft in localStorage
        try {
          saveActiveDocumentDraft(updated);
        } catch (draftErr) {}
        // Persist immediately to IndexedDB
        if (updated.id) {
          saveTextDocument(updated).then(() => {
            refreshLibraryCount();
          }).catch(err => console.warn('Failed to save lastAudioPosition to library:', err));
        }
        return updated;
      });
    } catch (posErr) {
      console.warn('Non-fatal error updating last audio position:', posErr);
    }

    const docLang = paragraph.tts?.speechCode ? null : activeDocLang;
    const speechCode = paragraph.tts?.speechCode || getLanguageMeta(docLang)?.speechCode || 'zh-CN';
    const cleanText = paragraph.text.replace(/<[^>]*>/g, '').trim();
    const textLength = cleanText.length;
    const currentRate = speechRateRef.current || speechRate || 1.0;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechCode;
    utterance.rate = mapSpeechRateToUtteranceRate(currentRate);

    // Select suitable voice if available
    try {
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(speechCode.slice(0, 2).toLowerCase()));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
    } catch (voiceErr) {}

    // Create encapsulated Audio Word Synchronizer for boundary-anchored local token progression
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
    let prevActiveCharIndex = -1;
    const synchronizer = createAudioWordSynchronizer({
      text: cleanText,
      tokens: paragraph.tokens || [],
      targetLang: activeDocLang,
      speechRate: currentRate,
      paragraphId: paragraph.id,
      playbackId,
      isAndroid,
      onActiveCharChange: (charIndex) => {
        if (playbackId !== audioPlaybackIdRef.current) return;
        if (isAndroid && charIndex >= 0) {
          const matchedTok = synchronizer.wordTokens.find(wt => wt.startChar === charIndex);
          console.log(`[TextReaderSync:activeChar] [playback #${playbackId}] charIndex=${charIndex} word="${matchedTok?.word || ''}"`);
          if (prevActiveCharIndex >= 0 && charIndex > prevActiveCharIndex) {
            const prevTok = synchronizer.wordTokens.find(wt => wt.startChar === prevActiveCharIndex);
            const prevPos = synchronizer.wordTokens.findIndex(wt => wt.startChar === prevActiveCharIndex);
            const currPos = synchronizer.wordTokens.findIndex(wt => wt.startChar === charIndex);
            if (prevPos >= 0 && currPos >= 0 && currPos - prevPos > 1) {
              console.warn(`[TextReaderSync:CHAR_GAP] [playback #${playbackId}] previousChar=${prevActiveCharIndex} (word="${prevTok?.word || ''}") currentChar=${charIndex} (word="${matchedTok?.word || ''}") gapTokens=${currPos - prevPos}`);
            }
          }
          prevActiveCharIndex = charIndex;
        }
        setActiveAudioCharIndex(charIndex);
      },
      debug: process.env.NODE_ENV !== 'production'
    });
    audioSynchronizerRef.current = synchronizer;

    utterance.onstart = (event) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handleStart(event);
    };

    utterance.onboundary = (event) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handleBoundary(event);
    };

    utterance.onpause = (event) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handlePause(event);
    };

    utterance.onresume = (event) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handleResume(event);
    };

    utterance.onend = (event) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handleEnd(event);
      setPlayingParagraphId(null);
      setActiveAudioCharIndex(-1);
      // If Auto-play is ON and user did NOT manually pause/stop, advance to next paragraph
      if (autoPlayTextReaderRef.current && !userStoppedRef.current) {
        const allParas = chapterParagraphsRef.current || [];
        const currentIndex = allParas.findIndex(p => p.id === paragraph.id);
        if (currentIndex >= 0 && currentIndex < allParas.length - 1) {
          const nextPara = allParas[currentIndex + 1];
          if (nextPara && handlePlayParagraphRef.current) {
            const nextParaIndex = currentIndex + 1;
            const nextPage = Math.floor(nextParaIndex / PARAGRAPHS_PER_PAGE);
            if (isEpub && nextPage !== currentParagraphPageRef.current) {
              isProgrammaticScrollRef.current = true;
              setCurrentParagraphPage(nextPage);
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
                previousScrollTopRef.current = 0;
              }
              setIsHeaderHidden(false);
              setTimeout(() => {
                isProgrammaticScrollRef.current = false;
                if (scrollContainerRef.current) {
                  previousScrollTopRef.current = scrollContainerRef.current.scrollTop;
                }
              }, 250);
            }
            handlePlayParagraphRef.current(nextPara);
            setTimeout(() => {
              try {
                const el = window.document.querySelector(`[data-paragraph-id="${nextPara.id}"]`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              } catch (scrollErr) {}
            }, 80);
          }
        }
      }
    };

    utterance.onerror = (e) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.stop();
      setPlayingParagraphId(null);
      setActiveAudioCharIndex(-1);
      if (!userStoppedRef.current) {
        console.warn('TTS playback error for paragraph:', paragraph.id, e);
        setAudioErrorId(paragraph.id);
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (speakErr) {
      console.warn('SpeechSynthesis speak call error:', speakErr);
    }
  }, [activeDocLang, clearAudioVisualTimer, refreshLibraryCount, speechRate]);

  handlePlayParagraphRef.current = handlePlayParagraph;

  const handleStopAudio = useCallback(() => {
    userStoppedRef.current = true;
    audioPlaybackIdRef.current++;
    clearAudioVisualTimer();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingParagraphId(null);
    setActiveAudioCharIndex(-1);
  }, [clearAudioVisualTimer]);

  // Trigger background AI glossing
  const triggerGlossing = useCallback((paragraphsToGloss, activeTargetLang = targetLang) => {
    if (!Array.isArray(paragraphsToGloss) || paragraphsToGloss.length === 0) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsAutoGlossing(true);

    const enriched = enrichParagraphsWithGlosses({
      paragraphs: paragraphsToGloss,
      targetLang: activeTargetLang,
      nativeLang,
      apiKey,
      abortSignal: controller.signal,
      onUpdate: (updatedParagraphs) => {
        setDocument(prev => {
          if (!prev || !Array.isArray(prev.paragraphs)) return prev;
          const updatedMap = new Map(updatedParagraphs.map(p => [p.id, p]));
          const nextParagraphs = prev.paragraphs.map(p => updatedMap.get(p.id) || p);
          const nextDoc = {
            ...prev,
            paragraphs: nextParagraphs
          };
          saveDocument(nextDoc).catch(err => console.warn('Error saving glossing update:', err));
          return nextDoc;
        });
      },
      onProgress: (prog) => {
        setGlossingProgress(prog);
        if (!prog.isGlossing) {
          setIsAutoGlossing(false);
          if (!prog.isPaused) {
            const completedCount = prog.completed;
            const totalCount = prog.total;
            const failedCount = (typeof prog.failed === 'number' && prog.failed >= 0) ? prog.failed : (totalCount - completedCount);
            if (completedCount === totalCount) {
              setGlossNotice({
                message: `Glosado terminado: ${totalCount}/${totalCount}`,
                type: 'success'
              });
            } else {
              setGlossNotice({
                message: `Glosado terminado: ${completedCount}/${totalCount}. ${failedCount} pendientes.`,
                type: 'warning'
              });
            }
          }
        }
      }
    });

    // Update document with immediately prepared offline tokens
    setDocument(prev => {
      if (!prev || !Array.isArray(prev.paragraphs)) return prev;
      const enrichedMap = new Map(enriched.map(p => [p.id, p]));
      const nextParagraphs = prev.paragraphs.map(p => enrichedMap.get(p.id) || p);
      return {
        ...prev,
        paragraphs: nextParagraphs
      };
    });
  }, [targetLang, nativeLang, apiKey]);

  // Toggle Global Auto-Glossing (ON / OFF)
  const handleToggleAutoGlossing = useCallback(() => {
    if (isAutoGlossing) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsAutoGlossing(false);
      setGlossingProgress(prev => ({
        ...prev,
        isGlossing: false,
        isPaused: true
      }));
    } else {
      const paragraphsToGloss = (isEpub && visibleParagraphs.length > 0)
        ? visibleParagraphs
        : (document?.paragraphs || []);
      if (!paragraphsToGloss || paragraphsToGloss.length === 0) return;

      const activeTarget = activeDocLang || targetLang;
      const missing = paragraphsToGloss.filter(p => !isGlossComplete(p, activeTarget, nativeLang));

      if (missing.length === 0) {
        setGlossNotice({
          message: `Glosado terminado: ${paragraphsToGloss.length}/${paragraphsToGloss.length}`,
          type: 'success'
        });
        return;
      }

      setIsAutoGlossing(true);
      triggerGlossing(paragraphsToGloss, activeDocLang);
    }
  }, [isAutoGlossing, document, isEpub, visibleParagraphs, activeDocLang, targetLang, nativeLang, triggerGlossing]);

  // Stop/Pause glossing
  const handleStopGlossing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAutoGlossing(false);
    setGlossingProgress(prev => ({
      ...prev,
      isGlossing: false,
      isPaused: true
    }));
  };

  // Resume glossing
  const handleResumeGlossing = () => {
    if (document && Array.isArray(document.paragraphs)) {
      setIsAutoGlossing(true);
      triggerGlossing(document.paragraphs, targetLang);
    }
  };

  // Individual paragraph glossing (runs ONLY for that paragraph, works even when auto-glossing is OFF)
  const handleGlossParagraph = useCallback(async (paragraph) => {
    if (!paragraph || !paragraph.id) return;
    if (isGlossComplete(paragraph, activeDocLang, nativeLang)) return; // $0 Groq cost: already glossed!

    // Mark solely this paragraph as glossing
    setGlossingParagraphIds(prev => new Set(prev).add(paragraph.id));

    try {
      // Send ONLY this single paragraph to the glossing service
      const updatedParagraph = await glossSingleParagraph({
        paragraph,
        targetLang: activeDocLang,
        nativeLang,
        apiKey
      });

      // Replace ONLY this paragraph inside document.paragraphs and persist immediately
      setDocument(prev => {
        if (!prev || !Array.isArray(prev.paragraphs)) return prev;
        const updatedParagraphs = prev.paragraphs.map(p =>
          p.id === paragraph.id ? updatedParagraph : p
        );
        const updatedDoc = {
          ...prev,
          paragraphs: updatedParagraphs
        };
        saveDocument(updatedDoc).then(() => {
          refreshLibraryCount();
        }).catch(err => console.warn('Failed to save single glossed paragraph to library:', err));

        return updatedDoc;
      });
    } catch (err) {
      console.error('Failed to gloss single paragraph:', err);
    } finally {
      setGlossingParagraphIds(prev => {
        const next = new Set(prev);
        next.delete(paragraph.id);
        return next;
      });
    }
  }, [activeDocLang, nativeLang, apiKey, refreshLibraryCount]);

  // Alias for backwards compatibility
  const handleGlossSingleParagraph = handleGlossParagraph;

  // Individual paragraph full translation (Groq openai/gpt-oss-120b, cached in-memory per paragraph)
  const handleTranslateParagraph = useCallback(async (paragraph) => {
    if (!paragraph || !paragraph.id) return;
    const paraId = paragraph.id;

    // Check current state for this paragraph
    setParagraphTranslations(prev => {
      const currentState = prev[paraId];

      // If currently translating, ignore double trigger
      if (currentState?.isTranslating) return prev;

      // If already translated without error, toggle visibility
      if (currentState?.text && !currentState?.error) {
        return {
          ...prev,
          [paraId]: {
            ...currentState,
            isVisible: !currentState.isVisible
          }
        };
      }

      // Otherwise set loading state and initiate fetch
      return {
        ...prev,
        [paraId]: {
          text: currentState?.text || null,
          isTranslating: true,
          isVisible: true,
          error: null
        }
      };
    });

    // If already translated without error or already translating, don't re-fetch
    if (paragraphTranslations[paraId]?.isTranslating) return;
    if (paragraphTranslations[paraId]?.text && !paragraphTranslations[paraId]?.error) return;

    try {
      const result = await translateParagraphTextApi({
        text: paragraph.text,
        targetLang: activeDocLang,
        nativeLang,
        apiKey
      });

      setParagraphTranslations(prev => ({
        ...prev,
        [paraId]: {
          text: result.translation,
          isTranslating: false,
          isVisible: true,
          error: null
        }
      }));
    } catch (err) {
      console.error('Failed to translate paragraph:', err);
      setParagraphTranslations(prev => ({
        ...prev,
        [paraId]: {
          text: null,
          isTranslating: false,
          isVisible: true,
          error: err.message || 'Error al traducir el párrafo.'
        }
      }));
    }
  }, [paragraphTranslations, activeDocLang, nativeLang, apiKey]);

  // Submit / Start reading parsed text (OFFLINE ONLY: Zero AI calls!)
  const handleStartReading = async () => {
    const raw = inputText.trim();
    if (!raw) return;

    const isExistingDoc = Boolean(document && document.id);
    const rawTextChanged = isExistingDoc && document.rawText.trim() !== raw;
    const effectiveParagraphs = (!rawTextChanged && isExistingDoc && Array.isArray(document.paragraphs) && document.paragraphs.length > 0)
      ? document.paragraphs
      : splitTextIntoParagraphs(raw, targetLang, nativeLang);

    // Validate if lastAudioPosition still points to an existing paragraph after edit
    let preservedLastAudioPosition = null;
    if (isExistingDoc && document?.lastAudioPosition?.paragraphId) {
      const targetId = document.lastAudioPosition.paragraphId;
      const targetIdx = effectiveParagraphs.findIndex(p => p.id === targetId);
      if (targetIdx !== -1) {
        preservedLastAudioPosition = {
          ...document.lastAudioPosition,
          paragraphIndex: targetIdx
        };
      }
    }

    const docToSave = createTextDocument({
      id: isExistingDoc ? document.id : null,
      title: inputTitle.trim(),
      rawText: raw,
      targetLang,
      nativeLang,
      paragraphs: effectiveParagraphs,
      languageStates: isExistingDoc ? document.languageStates : null,
      lastAudioPosition: preservedLastAudioPosition,
      createdAt: isExistingDoc ? document.createdAt : null
    });

    const saved = await saveDocument(docToSave);
    setDocument(saved);
    setLastAudioParagraphId(preservedLastAudioPosition ? preservedLastAudioPosition.paragraphId : null);
    setIsEditing(false);
    setIsHeaderHidden(false);
    previousScrollTopRef.current = 0;
    await refreshLibraryCount();

    // Auto-glossing MUST BE OFF BY DEFAULT:
    // Display text immediately, persist offline segmentation, ZERO AI calls!
    const alreadyComplete = effectiveParagraphs.every(p => isGlossComplete(p, targetLang, nativeLang));
    const completedCount = effectiveParagraphs.filter(p => isGlossComplete(p, targetLang, nativeLang)).length;

    setGlossingProgress({
      total: effectiveParagraphs.length,
      completed: completedCount,
      isGlossing: false,
      isPaused: false,
      isComplete: alreadyComplete,
      failed: 0
    });
    setIsAutoGlossing(false);
    navigateToView('reader');
  };

  // Open / select document from saved library modal
  const handleSelectSavedDocument = useCallback((doc) => {
    if (!doc) return;
    recordHabitActivityForToday({
      user,
      langCode: doc.targetLang || targetLang,
      activityKey: 'reading'
    });
    audioPlaybackIdRef.current++;
    clearAudioVisualTimer();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPlayingParagraphId(null);
    setActiveAudioCharIndex(-1);
    setAudioErrorId(null);
    setDocument(doc);
    const targetChapterIdx = resolveChapterIndexForDoc(doc);
    setCurrentChapterIndex(targetChapterIdx);
    const targetPageIdx = resolvePageIndexForDoc(doc, targetChapterIdx);
    setCurrentParagraphPage(targetPageIdx);
    setInputText(doc.rawText || '');
    setInputTitle(doc.title || '');
    setIsEditing(false);
    setIsHeaderHidden(false);
    previousScrollTopRef.current = 0;
    saveActiveDocumentDraft(doc);

    // Sync last audio position or reading position bookmark from the loaded document (validate existence)
    const savedAudioPos = doc.lastAudioPosition;
    const isValidAudioPos = Boolean(
      savedAudioPos?.paragraphId &&
      Array.isArray(doc.paragraphs) &&
      doc.paragraphs.some(p => p.id === savedAudioPos.paragraphId)
    );
    const validAudioPosId = isValidAudioPos ? savedAudioPos.paragraphId : null;
    setLastAudioParagraphId(validAudioPosId);

    const savedReadingPos = doc.lastReadingPosition;
    const isValidReadingPos = Boolean(
      savedReadingPos?.paragraphId &&
      Array.isArray(doc.paragraphs) &&
      doc.paragraphs.some(p => p.id === savedReadingPos.paragraphId)
    );
    const validReadingPosId = isValidReadingPos ? savedReadingPos.paragraphId : null;

    // Prioritize audio position bookmark; fallback to last reading position
    const targetScrollId = validAudioPosId || validReadingPosId;
    if (targetScrollId) {
      setPendingScrollParagraphId(targetScrollId);
    } else {
      setPendingScrollParagraphId(null);
    }

    if (setTargetLang && doc.targetLang) {
      setTargetLang(doc.targetLang);
    }

    const docLang = doc.targetLang || 'zh';
    const paras = Array.isArray(doc.paragraphs) ? doc.paragraphs : [];
    const allComplete = paras.length > 0 && paras.every(p => isGlossComplete(p, docLang, nativeLang));
    const completedCount = paras.filter(p => isGlossComplete(p, docLang, nativeLang)).length;

    setGlossingProgress({
      total: paras.length,
      completed: completedCount,
      isGlossing: false,
      isPaused: false,
      isComplete: allComplete,
      failed: 0
    });
    setIsAutoGlossing(false);
    setLoadingParagraphIds(new Set());
    navigateToView('reader');
  }, [setTargetLang, navigateToView, nativeLang, targetLang, user]);

  // Delete document handler from library modal / view
  const handleDeleteDocumentFromLibrary = useCallback(async (deletedId) => {
    if (document && document.id === deletedId) {
      audioPlaybackIdRef.current++;
      clearAudioVisualTimer();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsAutoGlossing(false);
      setLoadingParagraphIds(new Set());
      setLastAudioParagraphId(null);
      setPendingScrollParagraphId(null);
      clearActiveDocumentDraft();
      setDocument(null);
      setInputText('');
      setInputTitle('');
      setPlayingParagraphId(null);
      setActiveAudioCharIndex(-1);
      setGlossingProgress({
        total: 0,
        completed: 0,
        isGlossing: false,
        isPaused: false,
        isComplete: false,
        failed: 0
      });
      navigateToView('library');
    }
    await refreshLibraryCount();
  }, [clearAudioVisualTimer, document, refreshLibraryCount, navigateToView]);

  // Start new document from modal
  const handleNewDocumentFromModal = useCallback(() => {
    handleClearDocument();
  }, []);

  // File Upload handler (.txt and .epub)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input value so selecting same file again re-triggers
    e.target.value = '';

    const isEpub = file.name.toLowerCase().endsWith('.epub') || file.type.includes('epub');

    if (isEpub) {
      setIsImporting(true);
      setImportStatus('Leyendo archivo EPUB...');
      try {
        const parsed = await parseEpubFile(file, {
          targetLang,
          nativeLang,
          onProgress: (prog) => {
            setImportStatus(`Extrayendo capítulos... (${prog.current} de ${prog.total})`);
          }
        });

        // Set detected language if available and not explicitly customized
        const docLang = parsed.targetLang || targetLang;
        if (parsed.detectedLanguage && setTargetLang && parsed.detectedLanguage !== targetLang) {
          setTargetLang(parsed.detectedLanguage);
        }

        const docToSave = createTextDocument({
          title: parsed.title,
          author: parsed.author,
          sourceType: 'epub',
          format: 'epub',
          rawText: parsed.rawText,
          targetLang: docLang,
          nativeLang,
          paragraphs: parsed.paragraphs,
          chapters: parsed.chapters,
          createdAt: new Date().toISOString()
        });

        const saved = await saveDocument(docToSave);
        setDocument(saved);
        setInputText(saved.rawText || '');
        setInputTitle(saved.title || '');
        setIsEditing(false);
        setIsHeaderHidden(false);
        setLastAudioParagraphId(null);
        setPendingScrollParagraphId(null);
        previousScrollTopRef.current = 0;
        await refreshLibraryCount();

        // Auto-glossing is OFF by default:
        const alreadyComplete = saved.paragraphs.every(p => isGlossComplete(p, docLang, nativeLang));
        const completedCount = saved.paragraphs.filter(p => isGlossComplete(p, docLang, nativeLang)).length;

        setGlossingProgress({
          total: saved.paragraphs.length,
          completed: completedCount,
          isGlossing: false,
          isPaused: false,
          isComplete: alreadyComplete,
          failed: 0
        });
        setIsAutoGlossing(false);
        navigateToView('reader');
      } catch (err) {
        console.error('Error al importar archivo EPUB:', err);
        alert(`Error al importar el archivo EPUB: ${err.message || err}`);
      } finally {
        setIsImporting(false);
        setImportStatus('');
      }
      return;
    }

    // Default: .txt handling
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setInputText(content);
        if (!inputTitle.trim()) {
          const defaultName = file.name.replace(/\.[^/.]+$/, '');
          setInputTitle(defaultName);
        }
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Audio File Upload & Transcription handler (.mp3, .wav, .m4a, .webm, .ogg)
  const handleAudioFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input value so selecting same file again re-triggers
    e.target.value = '';

    setIsImporting(true);
    setImportStatus(isSpanish ? 'Leyendo archivo de audio...' : 'Reading audio file...');
    try {
      const result = await transcribeAudioFileApi({
        audioFile: file,
        targetLang,
        nativeLang,
        apiKey,
        onProgress: (msg) => setImportStatus(msg)
      });

      const transcriptText = result.transcript;
      if (!transcriptText) {
        throw new Error(isSpanish ? 'No se detectó contenido de voz en el audio.' : 'No speech content detected in audio.');
      }

      const defaultTitle = file.name ? file.name.replace(/\.[^/.]+$/, '') : (isSpanish ? 'Audio transcrito' : 'Transcribed audio');

      const docToSave = createTextDocument({
        title: defaultTitle,
        sourceType: 'audio',
        format: 'audio',
        rawText: transcriptText,
        targetLang,
        nativeLang,
        audioSegments: Array.isArray(result.segments) ? result.segments : [],
        audioDuration: typeof result.duration === 'number' ? result.duration : 0,
        createdAt: new Date().toISOString()
      });

      const saved = await saveDocument(docToSave);
      setDocument(saved);
      setInputText(saved.rawText || '');
      setInputTitle(saved.title || '');
      setIsEditing(false);
      setIsHeaderHidden(false);
      setLastAudioParagraphId(null);
      setPendingScrollParagraphId(null);
      previousScrollTopRef.current = 0;
      await refreshLibraryCount();

      // Auto-glossing is OFF by default:
      const alreadyComplete = Array.isArray(saved.paragraphs) && saved.paragraphs.every(p => isGlossComplete(p, targetLang, nativeLang));
      const completedCount = Array.isArray(saved.paragraphs) ? saved.paragraphs.filter(p => isGlossComplete(p, targetLang, nativeLang)).length : 0;

      setGlossingProgress({
        total: Array.isArray(saved.paragraphs) ? saved.paragraphs.length : 0,
        completed: completedCount,
        isGlossing: false,
        isPaused: false,
        isComplete: alreadyComplete,
        failed: 0
      });
      setIsAutoGlossing(false);
      navigateToView('reader');
    } catch (err) {
      console.error('Error al importar audio:', err);
      alert(isSpanish ? `Error al importar el audio: ${err.message || err}` : `Error importing audio: ${err.message || err}`);
    } finally {
      setIsImporting(false);
      setImportStatus('');
    }
  };

  // Paste from clipboard handler
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputText(text);
        }
      }
    } catch (err) {
      console.warn('Clipboard paste notice:', err);
    }
  };

  // Clear / New Document handler
  const handleClearDocument = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAutoGlossing(false);
    setLoadingParagraphIds(new Set());
    setPlayingParagraphId(null);
    setAudioErrorId(null);
    setLastAudioParagraphId(null);
    setPendingScrollParagraphId(null);
    clearActiveDocumentDraft();
    setDocument(null);
    setInputText('');
    setInputTitle('');
    setIsEditing(true);
    setIsHeaderHidden(false);
    previousScrollTopRef.current = 0;
    setGlossingProgress({
      total: 0,
      completed: 0,
      isGlossing: false,
      isPaused: false,
      isComplete: false,
      failed: 0
    });
  };

  // Font size cycle
  const cycleFontSize = () => {
    const order = ['sm', 'base', 'lg', 'xl', '2xl'];
    const nextIdx = (order.indexOf(fontSize) + 1) % order.length;
    setFontSize(order[nextIdx]);
  };


  // Toggle menu visibility
  const toggleActionsMenu = useCallback((e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    setIsActionsMenuOpen(prev => !prev);
  }, []);

  // Close the menu when clicking outside of the trigger
  useEffect(() => {
    if (!isActionsMenuOpen) return;
    const handleClickOutside = (e) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setIsActionsMenuOpen(false);
      }
    };
    // Delay event listener registration so opening tap/click does not immediately close the menu
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isActionsMenuOpen]);

  // Audio toggle helper for top bar "A" button
  const isPlayingAnyAudio = Boolean(playingParagraphId);

  const handleToggleAudio = useCallback(() => {
    if (isPlayingAnyAudio) {
      handleStopAudio();
      return;
    }
    const paras = visibleParagraphs.length > 0 ? visibleParagraphs : (document?.paragraphs || []);
    if (paras.length === 0) return;

    let targetPara = null;
    if (lastAudioParagraphId) {
      targetPara = paras.find(p => p.id === lastAudioParagraphId);
    }
    if (!targetPara) {
      targetPara = paras[0];
    }
    if (targetPara) {
      handlePlayParagraph(targetPara);
    }
  }, [isPlayingAnyAudio, handleStopAudio, visibleParagraphs, document?.paragraphs, lastAudioParagraphId, handlePlayParagraph]);

  // Edit title action from three-dots menu
  const handleEditTitle = useCallback(() => {
    setIsActionsMenuOpen(false);
    const currentTitle = document?.title || '';
    const newTitle = window.prompt(t('edit_title') || 'Editar título del documento:', currentTitle);
    if (newTitle !== null && newTitle.trim()) {
      const trimmed = newTitle.trim();
      setDocument(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          title: trimmed,
          updatedAt: new Date().toISOString()
        };
        saveActiveDocumentDraft(updated);
        if (updated.id) {
          saveTextDocument(updated).then(() => refreshLibraryCount()).catch(() => {});
        }
        return updated;
      });
      setInputTitle(trimmed);
    }
  }, [document?.title, t, refreshLibraryCount]);

  // Delete document action from three-dots menu
  const handleDeleteText = useCallback(() => {
    setIsActionsMenuOpen(false);
    const confirmed = window.confirm(t('confirm_delete_text') || '¿Seguro que deseas eliminar este texto?');
    if (confirmed) {
      if (document?.id) {
        deleteTextDocument(document.id).then(() => refreshLibraryCount()).catch(() => {});
      }
      handleClearDocument();
      navigateToView('library');
    }
  }, [document?.id, handleClearDocument, refreshLibraryCount, t, navigateToView]);

  // Open library action from three-dots menu
  const handleOpenLibrary = useCallback(() => {
    setIsActionsMenuOpen(false);
    navigateToView('library');
  }, [navigateToView]);

  // Go back to Home — reuses the existing setActiveTab from App.jsx
  const handleGoHome = useCallback(() => {
    setIsActionsMenuOpen(false);
    if (typeof setActiveTab === 'function') {
      setActiveTab('home');
    }
  }, [setActiveTab]);


  const currentLangMeta = getLanguageMeta(targetLang);
  // Reuses the existing scroll-direction detection but now applies to the chapter bar only.
  // Header stays visible; only the chapter bar hides on scroll down and reappears on scroll up.
  const isChapterBarHidden = isHeaderHidden && !isEditing && !isActionsMenuOpen;

  return (
    <div className="h-full flex-1 overflow-hidden w-full flex flex-col bg-[var(--app-bg)] text-[var(--text-primary)] min-h-0">
      {viewMode === 'library' || (!document && viewMode === 'reader') ? (
        /* =================== VIEW 1: DEDICATED TEXT LIBRARY =================== */
        <TextLibraryView
          targetLang={targetLang}
          onSelectDocument={handleSelectSavedDocument}
          onAddNew={handleAddNewDocument}
          onBackToHome={handleGoHome}
          onDeleteDocument={handleDeleteDocumentFromLibrary}
          currentDocumentId={document?.id || ''}
        />
      ) : viewMode === 'importer' ? (
        /* =================== VIEW 2: ADD / IMPORT TEXT SCREEN =================== */
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-5 overflow-y-auto custom-scrollbar text-[var(--text-primary)]">
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
              <span>{t('text_importer_heading') || (isSpanish ? 'Importar o escribir texto' : 'Import or write text')}</span>
            </h2>

            <div className="w-20" />
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full animate-fade-in my-auto">
            <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl text-[var(--text-primary)]">
              {/* Header Title inside card */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/60">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight">
                      {t('text_importer_heading') || 'Importar o escribir texto'}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {t('text_importer_subheading') || 'Pega cualquier lectura. Se dividirá automáticamente en párrafos con audio y glosado.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {savedDocsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => navigateToView('library')}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                      <span>{isSpanish ? `Biblioteca (${savedDocsCount})` : `Library (${savedDocsCount})`}</span>
                    </button>
                  )}

                  {document && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderHidden(false);
                        previousScrollTopRef.current = 0;
                        navigateToView('reader');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold cursor-pointer hover:bg-[var(--surface-hover)]"
                    >
                      {isSpanish ? 'Volver a lectura' : 'Back to reading'}
                    </button>
                  )}
                </div>
              </div>

              {/* Import status indicator banner */}
              {isImporting && (
                <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-700 dark:text-amber-300 animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin shrink-0 text-amber-500" />
                  <span className="text-xs sm:text-sm font-semibold">
                    {importStatus || (isSpanish ? 'Procesando archivo...' : 'Processing file...')}
                  </span>
                </div>
              )}

              {/* Title Input */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Título del texto (opcional)
                </label>
                <input
                  type="text"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  placeholder="Ej: Mi primer día de clases / 我的学校..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-rose-500 focus:outline-hidden text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm transition-all shadow-xs"
                />
              </div>

              {/* Language Selector (Idioma del texto) */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  {t('text_language') || 'Idioma del texto'}
                </label>
                <LanguageSelectDropdown
                  value={targetLang}
                  onChange={(newLang) => {
                    if (setTargetLang) {
                      setTargetLang(newLang);
                    }
                  }}
                  options={languages}
                  variant="card"
                  align="left"
                  className="w-full"
                />
              </div>

              {/* Textarea for raw text */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Contenido del texto
                  </label>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {inputText.trim() ? `${splitTextIntoParagraphs(inputText, targetLang).length} párrafos detectados` : 'Escribe o pega aquí'}
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Pega o escribe tu texto aquí en cualquier idioma (chino, árabe, polaco, ruso, etc.). Cada salto de línea o espacio en blanco formará un párrafo independiente."
                  className="w-full p-4 rounded-2xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-rose-500 focus:outline-hidden text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm leading-relaxed transition-all resize-y"
                />
              </div>

              {/* Action Buttons Strip (Paste clipboard, Upload .txt/.epub file, Upload audio, Create with AI, Start Reading) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Paste from Clipboard */}
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Clipboard className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                    <span>Pegar texto</span>
                  </button>

                  {/* File Upload Button (.txt, .epub) */}
                  <label className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer">
                    <Upload className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span>Cargar archivo (.txt, .epub)</span>
                    <input
                      type="file"
                      accept=".txt,.epub,text/plain,application/epub+zip"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Audio File Upload Button (.mp3, .wav, .m4a, .webm, .ogg) */}
                  <label className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer">
                    <Headphones className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    <span>Importar audio</span>
                    <input
                      type="file"
                      accept=".mp3,.wav,.m4a,.webm,.ogg,audio/*"
                      onChange={handleAudioFileUpload}
                      disabled={isImporting}
                      className="hidden"
                    />
                  </label>

                  {/* Create with AI Button */}
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 via-rose-500/10 to-pink-500/10 hover:from-purple-500/20 hover:via-rose-500/20 hover:to-pink-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    <span>Crear con IA</span>
                  </button>
                </div>

                {/* Submit / Start Reading CTA */}
                <button
                  type="button"
                  disabled={!inputText.trim() || isImporting}
                  onClick={handleStartReading}
                  className={`py-3 px-6 rounded-2xl font-bold text-sm shadow-lg flex items-center space-x-2 transition-all cursor-pointer ${
                    inputText.trim() && !isImporting
                      ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/70 hover:shadow-rose-900/90 active:scale-95'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border-primary)] cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Comenzar a leer</span>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =================== VIEW 3: READER VIEW =================== */
        <>
      {/* TOP HEADER: [← back] [TÍTULO] [☰] — stays visible on scroll */}
      <header
        className="reader-full-header relative z-30 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--header-border)] shadow-md text-[var(--text-primary)] shrink-0 transition-colors overflow-visible"
      >
        {document && !isEditing ? (
          <div className="reader-main-bar px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Back button — goes back to library */}
            <button
              type="button"
              onClick={() => navigateToView('library')}
              title={isSpanish ? 'Volver a la Biblioteca' : 'Back to Library'}
              aria-label={isSpanish ? 'Volver a la Biblioteca' : 'Back to Library'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Título — centered, truncates cleanly */}
            <div className="min-w-0 flex-1 text-center px-2">
              <h2
                title={document.title}
                className="text-xs sm:text-sm md:text-base font-bold text-[var(--text-primary)] truncate leading-snug"
              >
                {document.title}
              </h2>
            </div>

            {/* ☰ Hamburger menu — reuses existing isActionsMenuOpen / toggleActionsMenu / actionsMenuRef */}
            <div className="relative shrink-0" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={toggleActionsMenu}
                title="Menú"
                aria-label="Menú"
                aria-expanded={isActionsMenuOpen}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                  isActionsMenuOpen
                    ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] border border-rose-500/50'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* Dropdown: Inicio / Librería / Editar Título / ⚙️ Configuraciones (submenu) / Eliminar */}
              {isActionsMenuOpen && (
                <div className="absolute right-0 top-full mt-2 z-[100] w-64 bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl p-1 text-xs font-medium text-[var(--text-primary)] max-h-[80vh] overflow-y-auto">
                  {/* Inicio — reuses existing setActiveTab */}
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                  >
                    <Home className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                    <span>{t('nav_home') || 'Inicio'}</span>
                  </button>

                  {/* Librería — reuses handleOpenLibrary */}
                  <button
                    type="button"
                    onClick={handleOpenLibrary}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                  >
                    <BookOpen className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                    <span>Librería</span>
                  </button>

                  {/* Editar Título — reuses handleEditTitle */}
                  <button
                    type="button"
                    onClick={handleEditTitle}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--text-primary)]"
                  >
                    <Edit3 className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                    <span>Editar título</span>
                  </button>

                  {/* ⚙️ Configuraciones — UI-only submenu, reuses the same state/handlers as the bottom bar */}
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
                      <span>Configuraciones</span>
                    </span>
                    {isSettingsSubmenuOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    )}
                  </button>

                  {isSettingsSubmenuOpen && (
                    <div className="ml-3 pl-2 border-l border-[var(--border-subtle)]/60 space-y-0.5 mt-0.5">
                      {/* Auto play textreader — same source of truth as bottom bar */}
                      <button
                        type="button"
                        onClick={() => setAutoPlayTextReader(!autoPlayTextReader)}
                        className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center space-x-2.5">
                          <Play className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                          <span>Auto play</span>
                        </span>
                        <span
                          className={`w-8 h-4 rounded-full flex items-center px-0.5 shrink-0 ${
                            autoPlayTextReader
                              ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end'
                              : 'bg-[var(--surface-secondary)] justify-start'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                        </span>
                      </button>

                      {/* Subrayado de palabras (Sincronización visual) */}
                      <button
                        type="button"
                        onClick={() => setWordHighlightEnabled(!wordHighlightEnabled)}
                        className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                        title={isSpanish ? 'Activar/desactivar subrayado visual de palabras durante el audio' : 'Enable/disable visual word highlight during audio'}
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
                      <div className="w-full px-3 py-1.5 rounded-xl flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors">
                        <span className="flex items-center space-x-2.5 text-xs text-[var(--text-primary)]">
                          <Gauge className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                          <span>Playback speed</span>
                        </span>
                        <select
                          value={speechRate}
                          onChange={(e) => setSpeechRate(parseFloat(e.target.value) || 1.0)}
                          aria-label="Playback speed"
                          className="bg-[var(--surface-secondary)] text-rose-600 dark:text-rose-300 font-mono font-bold text-[11px] px-2 py-1 rounded-lg border border-[var(--border-primary)] focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
                        >
                          {(Array.isArray(speechRateOptions) && speechRateOptions.length > 0 ? speechRateOptions : [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5]).map((rate) => (
                            <option key={rate} value={rate} className="bg-[var(--surface-primary)] text-[var(--text-primary)]">
                              {rate.toFixed(2)}×
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Transliterations — same setInterlinearMode as bottom bar */}
                      <button
                        type="button"
                        onClick={() => setInterlinearMode(!interlinearMode)}
                        className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center space-x-2.5">
                          <span className="w-3.5 h-3.5 flex items-center justify-center font-serif font-bold text-[13px] leading-none text-rose-500 dark:text-rose-400 shrink-0">T</span>
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

                      {/* Text size — same cycleFontSize as bottom bar */}
                      <button
                        type="button"
                        onClick={cycleFontSize}
                        className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center space-x-2.5">
                          <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[13px] leading-none text-rose-500 dark:text-rose-400 shrink-0">A</span>
                          <span>Text size</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold uppercase text-rose-600 dark:text-rose-300 shrink-0">
                          {fontSize}
                        </span>
                      </button>

                      {/* Auto glossing — same handleToggleAutoGlossing as bottom bar */}
                      <button
                        type="button"
                        onClick={handleToggleAutoGlossing}
                        className="w-full px-3 py-2 rounded-xl text-left flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
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
                    </div>
                  )}

                  <div className="my-1 border-t border-[var(--border-subtle)]/60" />

                  {/* Eliminar — reuses handleDeleteText (kept to preserve existing functionality) */}
                  <button
                    type="button"
                    onClick={handleDeleteText}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Eliminar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </header>

          {/* MAIN CONTENT AREA */}
          <main
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto flex flex-col min-h-0"
          >
          <div className="flex-1 flex flex-col animate-fade-in">
            {/* EPUB Top Chapter Navigation Bar: Sticky flush top inside reader view.
                Hides on scroll DOWN and reappears on scroll UP — reuses the existing
                isHeaderHidden scroll-direction detection (now derived as isChapterBarHidden). */}
            {isEpub && chapters.length > 1 && (
              <div
                className={`sticky top-0 z-20 py-2.5 px-3 sm:px-4 mb-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm backdrop-blur-md flex items-center justify-between gap-2 sm:gap-3 transition-all duration-200 ease-out ${
                  isChapterBarHidden
                    ? '-translate-y-4 opacity-0 pointer-events-none'
                    : 'translate-y-0 opacity-100'
                }`}
                aria-hidden={isChapterBarHidden}
              >
                <button
                  type="button"
                  disabled={currentChapterIndex === 0}
                  onClick={() => handleNavigateChapter(currentChapterIndex - 1)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    currentChapterIndex === 0
                      ? 'opacity-40 cursor-not-allowed bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] cursor-pointer active:scale-95'
                  }`}
                  title="Capítulo anterior"
                >
                  <ChevronLeft className="w-4 h-4 shrink-0" />
                  <span>Capítulo anterior</span>
                </button>

                <div className="flex-1 min-w-0 max-w-sm sm:max-w-md mx-auto text-center">
                  <div className="relative inline-block w-full">
                    <select
                      value={currentChapterIndex}
                      onChange={(e) => handleNavigateChapter(Number(e.target.value))}
                      className="w-full text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-secondary)] border border-[var(--border-primary)] rounded-xl py-1.5 px-3 pr-8 truncate appearance-none cursor-pointer text-center hover:border-rose-500/50 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      {chapters.map((ch, idx) => {
                        const hasCustomTitle = ch.title && !/^cap[ií]tulo\s+\d+$/i.test(ch.title.trim()) && !/^chapter\s+\d+$/i.test(ch.title.trim());
                        const label = hasCustomTitle
                          ? `Capítulo ${idx + 1} de ${chapters.length}: ${ch.title}`
                          : `Capítulo ${idx + 1} de ${chapters.length}`;
                        return (
                          <option key={ch.id || idx} value={idx}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={currentChapterIndex === chapters.length - 1}
                  onClick={() => handleNavigateChapter(currentChapterIndex + 1)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                    currentChapterIndex === chapters.length - 1
                      ? 'opacity-40 cursor-not-allowed bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] cursor-pointer active:scale-95'
                  }`}
                  title="Siguiente capítulo"
                >
                  <span>Siguiente capítulo</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            )}

            {/* EPUB Page Navigation Bar (Top): Shown when chapter has multiple 15-paragraph pages */}
            {isEpub && totalPages > 1 && (
              <div className="flex items-center justify-between py-2 px-3 mb-3 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] shadow-sm">
                <button
                  type="button"
                  disabled={currentParagraphPage === 0}
                  onClick={() => handleNavigatePage(currentParagraphPage - 1)}
                  className="px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1 transition-all bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Página anterior</span>
                  <span className="sm:hidden">Anterior</span>
                </button>
                <div className="flex items-center space-x-1.5 font-semibold text-[var(--text-primary)]">
                  <span>Página</span>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-rose-500 font-bold">
                    {currentParagraphPage + 1}
                  </span>
                  <span className="text-[var(--text-muted)]">de</span>
                  <span>{totalPages}</span>
                </div>
                <button
                  type="button"
                  disabled={currentParagraphPage === totalPages - 1}
                  onClick={() => handleNavigatePage(currentParagraphPage + 1)}
                  className="px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1 transition-all bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                  title="Siguiente página"
                >
                  <span className="hidden sm:inline">Siguiente página</span>
                  <span className="sm:hidden">Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-4 sm:space-y-5">
              {visibleParagraphs.map((paragraph, pIdx) => {
                const isChapterHeading = paragraph.isChapterStart && paragraph.chapterTitle;
                return (
                  <React.Fragment key={paragraph.id}>
                    {isChapterHeading && (
                      <div className="pt-6 pb-2 border-b border-[var(--border-subtle)] mb-4 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-wide">
                            {paragraph.chapterTitle}
                          </h3>
                        </div>
                        {document.author && pIdx === 0 && (
                          <span className="text-xs text-[var(--text-muted)] italic">
                            de {document.author}
                          </span>
                        )}
                      </div>
                    )}
                    <TextParagraphItem
                      paragraph={paragraph}
                      targetLang={activeDocLang}
                      nativeLang={nativeLang}
                      fontSize={fontSize}
                      interlinearMode={interlinearMode}
                      isPlaying={playingParagraphId === paragraph.id}
                      activeAudioCharIndex={playingParagraphId === paragraph.id ? activeAudioCharIndex : -1}
                      isAudioError={audioErrorId === paragraph.id}
                      isGlossing={glossingParagraphIds.has(paragraph.id)}
                      hasGloss={isGlossComplete(paragraph, activeDocLang, nativeLang)}
                      isLastAudioPosition={lastAudioParagraphId === paragraph.id}
                      translation={paragraphTranslations[paragraph.id]?.text || null}
                      isTranslating={Boolean(paragraphTranslations[paragraph.id]?.isTranslating)}
                      isTranslationVisible={Boolean(paragraphTranslations[paragraph.id]?.isVisible)}
                      translationError={paragraphTranslations[paragraph.id]?.error || null}
                      onPlay={handlePlayParagraph}
                      onStop={handleStopAudio}
                      onWordClick={onWordClick}
                      onGloss={handleGlossParagraph}
                      onGlossParagraph={handleGlossParagraph}
                      onTranslate={handleTranslateParagraph}
                      onTranslateParagraph={handleTranslateParagraph}
                    />
                  </React.Fragment>
                );
              })}
            </div>

            {/* EPUB Page Navigation Bar (Bottom): Shown when chapter has multiple 15-paragraph pages */}
            {isEpub && totalPages > 1 && (
              <div className="flex items-center justify-between py-2.5 px-3 mt-4 mb-2 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] shadow-sm">
                <button
                  type="button"
                  disabled={currentParagraphPage === 0}
                  onClick={() => handleNavigatePage(currentParagraphPage - 1)}
                  className="px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1.5 transition-all bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Página anterior</span>
                  <span className="sm:hidden">Anterior</span>
                </button>
                <div className="flex items-center space-x-1.5 font-semibold text-[var(--text-primary)]">
                  <span>Página</span>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-rose-500 font-bold">
                    {currentParagraphPage + 1}
                  </span>
                  <span className="text-[var(--text-muted)]">de</span>
                  <span>{totalPages}</span>
                </div>
                <button
                  type="button"
                  disabled={currentParagraphPage === totalPages - 1}
                  onClick={() => handleNavigatePage(currentParagraphPage + 1)}
                  className="px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1.5 transition-all bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                  title="Siguiente página"
                >
                  <span className="hidden sm:inline">Siguiente página</span>
                  <span className="sm:hidden">Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* FOOTER: Placed at the end of the text inside scroll container, never fixed/sticky */}
            <footer className="mt-10 py-6 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] flex items-center justify-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 shrink-0"></span>
              <span className="truncate">
                {isEpub && chapters.length > 1
                  ? `Capítulo ${currentChapterIndex + 1} de ${chapters.length} • Haz clic en ▶️ en cualquier párrafo para escuchar su pronunciación`
                  : 'Fin del texto • Haz clic en ▶️ en cualquier párrafo para escuchar su pronunciación'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 shrink-0"></span>
            </footer>

          </div>
          </main>

      {/* BOTTOM CONTROL BAR — compact icon controls; each button binds to the exact
          same state/handler used by the Configuraciones submenu. Single source of truth. */}
      {document && !isEditing && (
        <div className="shrink-0 z-30 bg-[var(--header-bg)] backdrop-blur-md border-t border-[var(--header-border)] shadow-md">
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-around gap-1 sm:gap-2 max-w-4xl mx-auto">
            {/* Auto play — same autoPlayTextReader / setAutoPlayTextReader */}
            <button
              type="button"
              onClick={() => setAutoPlayTextReader(!autoPlayTextReader)}
              title={autoPlayTextReader ? 'Auto play activo (clic para desactivar)' : 'Activar Auto play'}
              aria-label="Auto play"
              aria-pressed={autoPlayTextReader}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                autoPlayTextReader
                  ? 'bg-rose-600 text-white border border-rose-500 ring-1 ring-rose-400/30 shadow-rose-900/40'
                  : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <Play className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {/* Playback speed — Select dropdown directly selecting from SPEECH_RATE_OPTIONS */}
            <div
              className="relative inline-flex items-center"
              title={`Velocidad de reproducción (${Number(speechRate).toFixed(2)}×)`}
            >
              <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-secondary)] absolute left-2 pointer-events-none z-10" />
              <select
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value) || 1.0)}
                aria-label="Velocidad de reproducción"
                className="h-9 sm:h-10 pl-7 pr-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-mono font-bold transition-all shadow-xs cursor-pointer bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-1 focus:ring-rose-500 appearance-none"
              >
                {(Array.isArray(speechRateOptions) && speechRateOptions.length > 0 ? speechRateOptions : SPEECH_RATE_OPTIONS).map((rate) => (
                  <option key={rate} value={rate} className="bg-[var(--surface-primary)] text-[var(--text-primary)]">
                    {rate.toFixed(2)}×
                  </option>
                ))}
              </select>
            </div>

            {/* Translation / Glosses — same interlinearMode / setInterlinearMode */}
            <button
              type="button"
              onClick={() => setInterlinearMode(!interlinearMode)}
              title={interlinearMode ? 'Desactivar traducción / glosado interlineal' : 'Activar traducción / glosado interlineal'}
              aria-label="Traducción y glosado interlineal"
              aria-pressed={interlinearMode}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                interlinearMode
                  ? 'bg-rose-600 text-white border border-rose-500 ring-1 ring-rose-400/30 shadow-rose-900/40'
                  : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <span className="font-bold text-[11px] sm:text-xs leading-none select-none tracking-tighter">A文</span>
            </button>

            {/* Text size — same cycleFontSize */}
            <button
              type="button"
              onClick={cycleFontSize}
              title={`Tamaño de texto: ${fontSize} — clic para cambiar`}
              aria-label="Tamaño de texto"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              <span className="font-bold text-[11px] sm:text-xs leading-none select-none tracking-tight">A±</span>
            </button>

            {/* Auto glossing — same isAutoGlossing / handleToggleAutoGlossing */}
            <button
              type="button"
              onClick={handleToggleAutoGlossing}
              title={isAutoGlossing ? 'Glosado automático activo (clic para pausar)' : 'Activar glosado automático'}
              aria-label="Auto glossing"
              aria-pressed={isAutoGlossing}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 ${
                isAutoGlossing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-emerald-950/40'
                  : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border-primary)]'
              }`}
            >
              <Sparkles className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isAutoGlossing ? 'text-white fill-white' : ''}`} />
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* Loading Overlay during EPUB import */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl text-[var(--text-primary)] max-w-sm w-full flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/60">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[var(--text-primary)]">
                Importando libro EPUB
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {importStatus || 'Procesando capítulos y texto...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Saved Documents Library Modal */}
      <SavedDocumentsModal
        isOpen={showSavedModal}
        onClose={() => setShowSavedModal(false)}
        onSelectDocument={handleSelectSavedDocument}
        onNewDocument={handleNewDocumentFromModal}
        onDeleteDocument={handleDeleteDocumentFromLibrary}
        currentDocumentId={document?.id || ''}
        targetLang={targetLang}
      />

      {/* Create with AI Modal */}
      <CreateWithAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        targetLang={targetLang}
        apiKey={apiKey}
        onTextGenerated={handleAiTextGenerated}
      />

      {/* Gloss Notice Toast */}
      {glossNotice && (
        <div className="fixed bottom-20 right-4 z-50 max-w-sm w-full sm:w-auto px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md transition-all animate-fade-in flex items-center justify-between gap-3 bg-slate-900/95 text-white border-slate-700 dark:bg-slate-800/95 dark:border-slate-600">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {glossNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <span>{glossNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlossNotice(null)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default TextReaderPage;

