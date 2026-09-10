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
  Type,
  Maximize2,
  BookOpen,
  Languages,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TextParagraphItem } from '../components/text/TextParagraphItem.jsx';
import { SavedDocumentsModal } from '../components/text/SavedDocumentsModal.jsx';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { getLanguageMeta } from '../constants/languages.js';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import {
  splitTextIntoParagraphs,
  createTextDocument,
  saveDocument,
  saveActiveDocumentDraft,
  loadActiveDocumentDraft,
  clearActiveDocumentDraft
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
import { useAudioSettings } from '../context/AudioSettingsContext.jsx';

export function TextReaderPage({
  targetLang = 'zh',
  setTargetLang = null,
  nativeLang = 'es',
  languages = [],
  apiKey = '',
  onWordClick = null
}) {
  const { t } = useSiteLanguage();
  const { speechRate } = useAudioSettings();

  // Load existing draft if available
  const [document, setDocument] = useState(() => loadActiveDocumentDraft());

  // EPUB Chapter-by-chapter state
  const isEpub = Boolean(
    document &&
    (document.format === 'epub' || document.sourceType === 'epub' || (Array.isArray(document.chapters) && document.chapters.length > 0))
  );
  const chapters = useMemo(() => {
    return (isEpub && Array.isArray(document?.chapters)) ? document.chapters : [];
  }, [isEpub, document?.chapters]);

  // Helper to resolve chapter index from a document's saved positions
  const resolveChapterIndexForDoc = useCallback((doc) => {
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
  }, []);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(() => {
    return resolveChapterIndexForDoc(loadActiveDocumentDraft());
  });

  // Synchronize chapter index when switching documents or after EPUB import
  useEffect(() => {
    if (document && isEpub && chapters.length > 0) {
      const idx = resolveChapterIndexForDoc(document);
      setCurrentChapterIndex(idx);
    }
  }, [document?.id, isEpub, resolveChapterIndexForDoc]);

  const currentChapter = isEpub && chapters[currentChapterIndex] ? chapters[currentChapterIndex] : null;

  // Render ONLY the current chapter's paragraphs for EPUB, or all paragraphs for TXT
  const visibleParagraphs = useMemo(() => {
    if (!document || !Array.isArray(document.paragraphs)) return [];
    if (!isEpub || chapters.length === 0 || !currentChapter) {
      return document.paragraphs;
    }
    return document.paragraphs.filter(p => p.chapterId === currentChapter.id);
  }, [document, isEpub, chapters, currentChapter]);
  const [isEditing, setIsEditing] = useState(() => !loadActiveDocumentDraft());
  const [inputText, setInputText] = useState(() => loadActiveDocumentDraft()?.rawText || '');
  const [inputTitle, setInputTitle] = useState(() => loadActiveDocumentDraft()?.title || '');
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg' | 'xl'
  const [interlinearMode, setInterlinearMode] = useState(true);

  // Saved documents library modal
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedDocsCount, setSavedDocsCount] = useState(0);

  // EPUB Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // Audio TTS states
  const [playingParagraphId, setPlayingParagraphId] = useState(null);
  const [audioErrorId, setAudioErrorId] = useState(null);

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
                setDocument(prev => {
                  if (!prev || prev.lastReadingPosition?.paragraphId === pid) return prev;
                  const posData = {
                    paragraphId: pid,
                    chapterIndex: currentChapterIndex,
                    chapterId: currentChapter?.id,
                    updatedAt: Date.now()
                  };
                  const updated = {
                    ...prev,
                    lastReadingPosition: posData
                  };
                  saveActiveDocumentDraft(updated);
                  if (updated.id) {
                    saveTextDocument(updated).catch(() => {});
                  }
                  return updated;
                });
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
  }, [isEditing]);

  // Navigate to another chapter (unmounts previous chapter, mounts new chapter, scrolls to top)
  const handleNavigateChapter = useCallback((newIndex) => {
    if (newIndex < 0 || newIndex >= chapters.length) return;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingParagraphId(null);
    setCurrentChapterIndex(newIndex);

    if (scrollContainerRef.current) {
      isProgrammaticScrollRef.current = true;
      scrollContainerRef.current.scrollTop = 0;
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 150);
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
  }, [chapters]);

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
  const [glossingParagraphIds, setGlossingParagraphIds] = useState(new Set());
  const loadingParagraphIds = glossingParagraphIds; // Alias for backward compatibility
  const setLoadingParagraphIds = setGlossingParagraphIds;
  const abortControllerRef = useRef(null);

  // Cleanup speech synthesis, glossing & timers on unmount
  useEffect(() => {
    return () => {
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
  }, []);

  // Refresh library count from IndexedDB
  const refreshLibraryCount = useCallback(async () => {
    try {
      const count = await getTextDocumentsCount();
      setSavedDocsCount(count);
    } catch (e) {
      console.warn('Failed to count saved documents in IndexedDB:', e);
    }
  }, []);

  // On mount: run migration from legacy localStorage to IndexedDB, refresh count, and schedule draft scroll restoration
  useEffect(() => {
    migrateFromLocalStorage().then(() => {
      refreshLibraryCount();
    }).catch(() => {});

    // Restore scroll to last audio position or last reading position on initial mount / app reload
    const draft = loadActiveDocumentDraft();
    const targetPosId = draft?.lastAudioPosition?.paragraphId || draft?.lastReadingPosition?.paragraphId;
    if (draft && targetPosId) {
      const exists = Array.isArray(draft.paragraphs) && draft.paragraphs.some(p => p.id === targetPosId);
      if (exists) {
        setPendingScrollParagraphId(targetPosId);
      }
    }
  }, [refreshLibraryCount]);

  // Save active document state whenever document changes (syncs draft + IndexedDB)
  useEffect(() => {
    if (document) {
      saveActiveDocumentDraft(document);
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
    return document.paragraphs.filter(p => isGlossComplete(p, activeDocLang)).length;
  }, [document, activeDocLang]);

  // Initial sync: if draft document exists with its own targetLang, synchronize targetLang once on mount
  useEffect(() => {
    if (document?.targetLang && setTargetLang && document.targetLang !== targetLang) {
      setTargetLang(document.targetLang);
    }
  }, []);

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
    if (!window.speechSynthesis) {
      setAudioErrorId(paragraph.id);
      return; // No position saved — TTS not available
    }

    // Cancel any current utterance
    window.speechSynthesis.cancel();
    setAudioErrorId(null);
    setPlayingParagraphId(paragraph.id);

    // Save last audio position immediately (persists even if page closes or switches document)
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
      saveActiveDocumentDraft(updated);
      // Persist immediately to IndexedDB
      if (updated.id) {
        saveTextDocument(updated).then(() => {
          refreshLibraryCount();
        }).catch(err => console.warn('Failed to save lastAudioPosition to library:', err));
      }
      return updated;
    });

    const docLang = paragraph.tts?.speechCode ? null : activeDocLang;
    const speechCode = paragraph.tts?.speechCode || getLanguageMeta(docLang)?.speechCode || 'zh-CN';
    const cleanText = paragraph.text.replace(/<[^>]*>/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechCode;
    utterance.rate = speechRate || 1.0;

    // Select suitable voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(speechCode.slice(0, 2).toLowerCase()));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      setPlayingParagraphId(null);
    };

    utterance.onerror = (e) => {
      console.warn('TTS playback error for paragraph:', paragraph.id, e);
      setPlayingParagraphId(null);
      setAudioErrorId(paragraph.id);
    };

    window.speechSynthesis.speak(utterance);
  }, [activeDocLang, refreshLibraryCount]);

  const handleStopAudio = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingParagraphId(null);
  }, []);

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
        if (prog.isComplete) {
          setIsAutoGlossing(false);
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
      setIsAutoGlossing(true);
      triggerGlossing(paragraphsToGloss, activeDocLang);
    }
  }, [isAutoGlossing, document, activeDocLang, triggerGlossing]);

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
    if (isGlossComplete(paragraph, activeDocLang)) return; // $0 Groq cost: already glossed!

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

  // Submit / Start reading parsed text (OFFLINE ONLY: Zero AI calls!)
  const handleStartReading = async () => {
    const raw = inputText.trim();
    if (!raw) return;

    const isExistingDoc = Boolean(document && document.id);
    const rawTextChanged = isExistingDoc && document.rawText.trim() !== raw;
    const effectiveParagraphs = (!rawTextChanged && isExistingDoc && Array.isArray(document.paragraphs) && document.paragraphs.length > 0)
      ? document.paragraphs
      : splitTextIntoParagraphs(raw, targetLang);

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
    refreshLibraryCount();

    // Auto-glossing MUST BE OFF BY DEFAULT:
    // Display text immediately, persist offline segmentation, ZERO AI calls!
    const alreadyComplete = effectiveParagraphs.every(p => isGlossComplete(p, targetLang));
    const completedCount = effectiveParagraphs.filter(p => isGlossComplete(p, targetLang)).length;

    setGlossingProgress({
      total: effectiveParagraphs.length,
      completed: completedCount,
      isGlossing: false,
      isPaused: false,
      isComplete: alreadyComplete,
      failed: 0
    });
    setIsAutoGlossing(false);
  };

  // Open / select document from saved library modal
  const handleSelectSavedDocument = useCallback((doc) => {
    if (!doc) return;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPlayingParagraphId(null);
    setAudioErrorId(null);
    setDocument(doc);
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
    const allComplete = paras.length > 0 && paras.every(p => isGlossComplete(p, docLang));
    const completedCount = paras.filter(p => isGlossComplete(p, docLang)).length;

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
  }, [setTargetLang]);

  // Delete document handler from library modal
  const handleDeleteDocumentFromLibrary = useCallback(async (deletedId) => {
    if (document && document.id === deletedId) {
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
      setIsEditing(true);
      setGlossingProgress({
        total: 0,
        completed: 0,
        isGlossing: false,
        isPaused: false,
        isComplete: false,
        failed: 0
      });
    }
    await refreshLibraryCount();
  }, [document, refreshLibraryCount]);

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
        const alreadyComplete = saved.paragraphs.every(p => isGlossComplete(p, docLang));
        const completedCount = saved.paragraphs.filter(p => isGlossComplete(p, docLang)).length;

        setGlossingProgress({
          total: saved.paragraphs.length,
          completed: completedCount,
          isGlossing: false,
          isPaused: false,
          isComplete: alreadyComplete,
          failed: 0
        });
        setIsAutoGlossing(false);
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
    const order = ['sm', 'base', 'lg', 'xl'];
    const nextIdx = (order.indexOf(fontSize) + 1) % order.length;
    setFontSize(order[nextIdx]);
  };

  const currentLangMeta = getLanguageMeta(targetLang);

  return (
    <div className="h-full flex-1 overflow-hidden w-full flex flex-col bg-[var(--app-bg)] text-[var(--text-primary)] min-h-0">
      {/* TOP HEADER CONTROLS BAR: FULL AUTO-HIDE ON SCROLL DOWN */}
      <header
        className={`reader-full-header relative z-30 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--header-border)] shadow-md text-[var(--text-primary)] shrink-0 transition-colors ${
          isHeaderHidden && !isEditing ? 'is-hidden' : ''
        }`}
        inert={isHeaderHidden && !isEditing ? '' : undefined}
        aria-hidden={isHeaderHidden && !isEditing}
      >
        {/* PARTE 1 — BARRA PRINCIPAL: Document title, reader badge, essential context */}
        <div className="reader-main-bar px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3">
          {/* Left: Section Title & Editable Doc Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/50 shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                  📖 {t('text_reader_title') || 'Importador de Textos'}
                </span>
                {document && !isEditing && (
                  <span className="text-xs text-[var(--text-muted)] font-medium hidden sm:inline">
                    • {document.paragraphs?.length || 0} párrafos
                  </span>
                )}
              </div>

              {/* Editable or Static Document Title */}
              {document && !isEditing ? (
                <h2
                  title="Título del documento"
                  className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate leading-tight max-w-[240px] sm:max-w-md mt-0.5"
                >
                  {document.title}
                </h2>
              ) : (
                <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight mt-0.5">
                  {t('home_text_title') || 'Lector Independiente'}
                </h2>
              )}
            </div>
          </div>

          {/* Right: Language indicator pill on main bar when reading */}
          {document && !isEditing && (
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] flex items-center gap-1.5 shadow-xs select-none">
                <span className="text-sm">{currentLangMeta?.flag || '🌐'}</span>
                <span className="hidden xs:inline font-medium">{currentLangMeta?.name || activeDocLang.toUpperCase()}</span>
              </span>
            </div>
          )}
        </div>

        {/* PARTE 2 — CONTROLES DEL LECTOR (All controls inside same header wrapper) */}
        <div className="reader-controls overflow-hidden">
          <div className="px-4 pb-2.5 sm:pb-3 pt-1 flex items-center flex-wrap gap-2 border-t border-[var(--border-subtle)]/40">
            {/* Saved Documents Library Button */}
            <button
              type="button"
              onClick={() => setShowSavedModal(true)}
              title={t('saved_documents') || 'Biblioteca de textos guardados'}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span className="hidden sm:inline">Biblioteca</span>
              {savedDocsCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 font-mono font-bold">
                  {savedDocsCount}
                </span>
              )}
            </button>

            {/* Target Language Dropdown */}
            <div className="bg-[var(--surface-tertiary)] rounded-xl border border-[var(--border-primary)] p-0.5">
              <LanguageSelectDropdown
                value={activeDocLang}
                onChange={handleLanguageChange}
                options={languages}
                variant="header"
                align="right"
              />
            </div>

            {/* Reader controls (Auto-glossing, Interlinear, Font size, Edit, Clear) */}
            {document && !isEditing && (
              <>
                {/* GLOBAL AUTO-GLOSSING TOGGLE (Represented by Languages icon, ON/OFF, Green when ON, Progress badge) */}
                <button
                  type="button"
                  onClick={handleToggleAutoGlossing}
                  title={
                    isAutoGlossing
                      ? 'Glosado automático activo: clic para detener'
                      : 'Activar glosado automático global'
                  }
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs ${
                    isAutoGlossing
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-950/40'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-primary)]'
                  }`}
                >
                  <Languages className={`w-3.5 h-3.5 ${isAutoGlossing ? 'text-white' : 'text-rose-500 dark:text-rose-400'}`} />
                  <span className="font-semibold">Auto-Glosado</span>
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
                  {document.paragraphs?.length > 0 && (
                    <span className={`flex items-center gap-1 ml-0.5 text-[9px] px-1.5 py-0.2 rounded-full border ${
                      isAutoGlossing
                        ? 'text-emerald-100 bg-black/40 border-emerald-300/40 animate-pulse'
                        : 'text-[var(--text-muted)] bg-[var(--surface-tertiary)] border-[var(--border-primary)]'
                    }`}>
                      {isAutoGlossing && <span className="w-1 h-1 rounded-full bg-white animate-ping" />}
                      <span>{completedParagraphsCount}/{document.paragraphs.length}</span>
                    </span>
                  )}
                </button>

                {/* Interlinear Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setInterlinearMode(!interlinearMode)}
                  title={interlinearMode ? "Cambiar a texto continuo" : "Ver con glosado interlineal"}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                    interlinearMode
                      ? 'bg-rose-600 border-rose-400 text-white shadow-rose-900/40'
                      : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Type className="w-4 h-4" />
                </button>

                {/* Font Size Button */}
                <button
                  type="button"
                  onClick={cycleFontSize}
                  title={`Tamaño de fuente: ${fontSize.toUpperCase()}`}
                  className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-all shadow-xs cursor-pointer hover:bg-[var(--surface-hover)]"
                >
                  A{fontSize === 'xl' ? '++' : fontSize === 'lg' ? '+' : fontSize === 'sm' ? '-' : ''}
                </button>

                {/* Edit text button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setIsHeaderHidden(false);
                    previousScrollTopRef.current = 0;
                  }}
                  title="Editar o cambiar el texto"
                  className="p-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-xs cursor-pointer hover:bg-[var(--surface-hover)]"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* New / Clear button */}
                <button
                  type="button"
                  onClick={handleClearDocument}
                  title="Nuevo texto / Limpiar documento"
                  className="p-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/60 text-[var(--text-secondary)] hover:text-rose-500 transition-all shadow-xs cursor-pointer hover:bg-[var(--surface-hover)]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto flex flex-col min-h-0"
      >
        {isEditing ? (
          /* ============================================================ */
          /* 1. INPUT / IMPORT VIEW (Escribir, Pegar, Importar archivo)     */
          /* ============================================================ */
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
                      onClick={() => setShowSavedModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                      <span>Biblioteca ({savedDocsCount})</span>
                    </button>
                  )}

                  {document && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setIsHeaderHidden(false);
                        previousScrollTopRef.current = 0;
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold cursor-pointer hover:bg-[var(--surface-hover)]"
                    >
                      Volver a lectura
                    </button>
                  )}
                </div>
              </div>


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
                  className="w-full px-4 py-2.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-rose-500 focus:outline-hidden text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm transition-all"
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

              {/* Action Buttons Strip (Paste clipboard, Upload .txt file, Start Reading) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center space-x-2">
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
                </div>

                {/* Submit / Start Reading CTA */}
                <button
                  type="button"
                  disabled={!inputText.trim()}
                  onClick={handleStartReading}
                  className={`py-3 px-6 rounded-2xl font-bold text-sm shadow-lg flex items-center space-x-2 transition-all cursor-pointer ${
                    inputText.trim()
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
        ) : (
          /* ============================================================ */
          /* 2. READER VIEW (Párrafos con audio alineado y glosado)       */
          /* ============================================================ */
          <div className="space-y-4 sm:space-y-5 animate-fade-in pb-16">
            {/* EPUB Top Chapter Navigation Bar */}
            {isEpub && chapters.length > 1 && (
              <div className="sticky top-0 z-10 py-2 px-3 sm:px-4 mb-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm backdrop-blur-md flex items-center justify-between gap-2 sm:gap-3 transition-colors">
                <button
                  type="button"
                  disabled={currentChapterIndex === 0}
                  onClick={() => handleNavigateChapter(currentChapterIndex - 1)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 sm:space-x-1.5 transition-all ${
                    currentChapterIndex === 0
                      ? 'opacity-40 cursor-not-allowed bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] cursor-pointer active:scale-95'
                  }`}
                  title="Capítulo anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
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
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 sm:space-x-1.5 transition-all ${
                    currentChapterIndex === chapters.length - 1
                      ? 'opacity-40 cursor-not-allowed bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-primary)] cursor-pointer active:scale-95'
                  }`}
                  title="Capítulo siguiente"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

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
                    fontSize={fontSize}
                    interlinearMode={interlinearMode}
                    isPlaying={playingParagraphId === paragraph.id}
                    isAudioError={audioErrorId === paragraph.id}
                    isGlossing={glossingParagraphIds.has(paragraph.id)}
                    hasGloss={isGlossComplete(paragraph, activeDocLang)}
                    isLastAudioPosition={lastAudioParagraphId === paragraph.id}
                    onPlay={handlePlayParagraph}
                    onStop={handleStopAudio}
                    onWordClick={onWordClick}
                    onGloss={handleGlossParagraph}
                    onGlossParagraph={handleGlossParagraph}
                  />
                </React.Fragment>
              );
            })}

            {/* EPUB Bottom Chapter Navigation Footer Card */}
            {isEpub && chapters.length > 1 && (
              <div className="mt-8 pt-5 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={currentChapterIndex === 0}
                  onClick={() => handleNavigateChapter(currentChapterIndex - 1)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Capítulo anterior</span>
                </button>
                <span className="text-xs text-[var(--text-muted)] font-medium text-center">
                  Capítulo {currentChapterIndex + 1} de {chapters.length}
                  {currentChapter?.title && !/^cap[ií]tulo\s+\d+$/i.test(currentChapter.title.trim()) && !/^chapter\s+\d+$/i.test(currentChapter.title.trim()) && (
                    <span className="text-[var(--text-primary)] font-bold ml-1">• {currentChapter.title}</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={currentChapterIndex === chapters.length - 1}
                  onClick={() => handleNavigateChapter(currentChapterIndex + 1)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-md shadow-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Siguiente capítulo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        )}
      </main>

      {/* FOOTER: Fixed to the bottom of the visible area, never scrolls with the text */}
      {!isEditing && document && (
        <footer className="relative z-20 shrink-0 px-4 py-2.5 bg-[var(--header-bg)] border-t border-[var(--header-border)] text-center text-xs text-[var(--text-muted)] flex items-center justify-center space-x-2 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 shrink-0"></span>
          <span className="truncate">
            {isEpub && chapters.length > 1
              ? `Capítulo ${currentChapterIndex + 1} de ${chapters.length} • Haz clic en ▶️ en cualquier párrafo para escuchar su pronunciación`
              : 'Fin del texto • Haz clic en ▶️ en cualquier párrafo para escuchar su pronunciación'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 shrink-0"></span>
        </footer>
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
      />
    </div>
  );
}

export default TextReaderPage;
