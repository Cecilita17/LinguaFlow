import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Camera,
  Loader2,
  AlertCircle,
  RotateCcw,
  Type,
  Languages,
  CheckCircle2,
  Volume2,
  VolumeX,
  BookOpen,
  X
} from 'lucide-react';
import { ImageUploader } from '../components/image/ImageUploader.jsx';
import { ImageLibraryView } from '../components/image/ImageLibraryView.jsx';
import { TextParagraphItem } from '../components/text/TextParagraphItem.jsx';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { describeImageApi } from '../services/imageDescriptionService.js';
import {
  saveImageDocument,
  getImageDocumentById
} from '../services/imageReaderLibraryStorage.js';
import {
  tokenizeAndGlossLineOffline,
  glossSingleParagraph,
  enrichParagraphsWithGlosses,
  isGlossComplete
} from '../services/textGlossService.js';
import { translateParagraphTextApi } from '../services/textDocumentService.js';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAudioSettings, mapSpeechRateToUtteranceRate } from '../context/AudioSettingsContext.jsx';
import { recordHabitActivityForToday } from '../services/habitTrackerService.js';
import { getLanguageMeta, isRtlLanguage, getTextDirection } from '../constants/languages.js';
import { createAudioWordSynchronizer } from '../utils/audioWordSync.js';

const CEFR_LEVELS = [
  { value: 'A1', es: 'Principiante (A1)', en: 'Beginner (A1)' },
  { value: 'A2', es: 'Elemental (A2)', en: 'Elementary (A2)' },
  { value: 'B1', es: 'Intermedio (B1)', en: 'Intermediate (B1)' },
  { value: 'B2', es: 'Intermedio Alto (B2)', en: 'Upper Intermediate (B2)' },
  { value: 'C1', es: 'Avanzado (C1)', en: 'Advanced (C1)' }
];

/**
 * Segments an image description into natural pedagogical paragraphs.
 * For Chinese / CJK: splits at natural terminal punctuation (。！？；) and clause boundaries if long,
 * grouping sentences into balanced paragraphs of ~40-80 characters.
 * For alphabetic / other languages: splits at sentence punctuation and groups into ~120-220 characters.
 * Guarantees zero text loss and preserves complete character integrity.
 */
export function segmentImageDescriptionIntoParagraphs(rawText, targetLang = 'zh') {
  if (!rawText || typeof rawText !== 'string') return [];
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const isCjk = typeof targetLang === 'string' && (targetLang.startsWith('zh') || targetLang.startsWith('ja'));
  const rawBlocks = normalized.split(/\n+/).map(b => b.trim()).filter(Boolean);
  const resultParagraphs = [];

  for (const block of rawBlocks) {
    const terminalRegex = /([.。!！?؟;；]['"”’»\)\]｝』」]*)/g;
    const sentences = [];
    let lastIndex = 0;
    let match;

    while ((match = terminalRegex.exec(block)) !== null) {
      const punctEnd = match.index + match[0].length;
      const punct = match[1];

      if (punct.startsWith('.')) {
        const prevChar = match.index > 0 ? block[match.index - 1] : '';
        const nextChar = punctEnd < block.length ? block[punctEnd] : '';
        if (/\d/.test(prevChar) && /\d/.test(nextChar)) continue;
        const precedingWord = block.slice(Math.max(0, match.index - 4), match.index).toLowerCase();
        if (/^(dr|mr|ms|vs|eg|ie)$/i.test(precedingWord)) continue;
      }

      const sentence = block.slice(lastIndex, punctEnd).trim();
      if (sentence) {
        sentences.push(sentence);
        lastIndex = punctEnd;
      }
    }

    const remainder = block.slice(lastIndex).trim();
    if (remainder) {
      sentences.push(remainder);
    }

    if (sentences.length === 0) {
      sentences.push(block);
    }

    const units = [];
    for (const sent of sentences) {
      if (isCjk && sent.length > 85) {
        const clauseRegex = /([，、：—–…][\s]*)/g;
        let cLastIdx = 0;
        let cMatch;
        let clauseAcc = '';
        while ((cMatch = clauseRegex.exec(sent)) !== null) {
          const cEnd = cMatch.index + cMatch[0].length;
          const clause = sent.slice(cLastIdx, cEnd);
          if ((clauseAcc + clause).length > 70 && clauseAcc.length >= 30) {
            units.push(clauseAcc.trim());
            clauseAcc = clause;
          } else {
            clauseAcc += clause;
          }
          cLastIdx = cEnd;
        }
        const cRemainder = sent.slice(cLastIdx);
        if (cRemainder) clauseAcc += cRemainder;
        if (clauseAcc.trim()) units.push(clauseAcc.trim());
      } else if (!isCjk && sent.length > 200) {
        const parts = sent.split(/(?<=[,;])\s+/);
        let pAcc = '';
        for (const p of parts) {
          if (pAcc && (pAcc.length + p.length > 180)) {
            units.push(pAcc.trim());
            pAcc = p;
          } else {
            pAcc = pAcc ? (pAcc + ' ' + p) : p;
          }
        }
        if (pAcc.trim()) units.push(pAcc.trim());
      } else {
        units.push(sent);
      }
    }

    if (isCjk) {
      let acc = '';
      for (const unit of units) {
        if (!acc) {
          acc = unit;
        } else if (acc.length + unit.length <= 75) {
          acc += unit;
        } else if (acc.length < 35 && acc.length + unit.length <= 85) {
          acc += unit;
        } else {
          resultParagraphs.push(acc);
          acc = unit;
        }
      }
      if (acc) {
        if (resultParagraphs.length > 0 && acc.length < 25 && resultParagraphs[resultParagraphs.length - 1].length + acc.length <= 90) {
          resultParagraphs[resultParagraphs.length - 1] += acc;
        } else {
          resultParagraphs.push(acc);
        }
      }
    } else {
      let acc = '';
      for (const unit of units) {
        if (!acc) {
          acc = unit;
        } else if (acc.length + 1 + unit.length <= 180) {
          acc += ' ' + unit;
        } else if (acc.length < 90 && acc.length + 1 + unit.length <= 220) {
          acc += ' ' + unit;
        } else {
          resultParagraphs.push(acc);
          acc = unit;
        }
      }
      if (acc) {
        if (resultParagraphs.length > 0 && acc.length < 50 && resultParagraphs[resultParagraphs.length - 1].length + 1 + acc.length <= 240) {
          resultParagraphs[resultParagraphs.length - 1] += ' ' + acc;
        } else {
          resultParagraphs.push(acc);
        }
      }
    }
  }

  return resultParagraphs;
}

export function ImageReaderPage({
  targetLang = 'zh',
  setTargetLang,
  nativeLang = 'es',
  languages = [],
  apiKey = '',
  onWordClick,
  setActiveTab
}) {
  const { user } = useAuth();
  const { isSpanish } = useSiteLanguage();
  const { speechRate } = useAudioSettings();

  // View mode state: 'library' (default) | 'uploader' | 'reader'
  const [viewMode, setViewMode] = useState('library');
  const [currentDocId, setCurrentDocId] = useState(null);
  const currentDocIdRef = useRef(currentDocId);
  useEffect(() => {
    currentDocIdRef.current = currentDocId;
  }, [currentDocId]);

  // Selected image state
  const [selectedImage, setSelectedImage] = useState(null);

  // CEFR level selection
  const [level, setLevel] = useState(() => {
    try {
      return localStorage.getItem('linguaflow_image_reader_level') || 'B1';
    } catch (e) {
      return 'B1';
    }
  });

  const handleLevelChange = (newLevel) => {
    setLevel(newLevel);
    try {
      localStorage.setItem('linguaflow_image_reader_level', newLevel);
    } catch (e) {}
  };

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);

  // Result state
  const [resultTitle, setResultTitle] = useState('');
  const [paragraphs, setParagraphs] = useState([]);
  const [usedModel, setUsedModel] = useState('');

  // Linguistic UI preferences
  const [interlinearMode, setInterlinearMode] = useState(true);
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg' | 'xl' | '2xl'

  // Paragraph translations state: { [paraId]: { text, isTranslating, isVisible, error } }
  const [paragraphTranslations, setParagraphTranslations] = useState({});

  // Audio TTS playback state
  const [playingParagraphId, setPlayingParagraphId] = useState(null);
  const playingParagraphIdRef = useRef(null);
  const [activeAudioCharIndex, setActiveAudioCharIndex] = useState(-1);
  const [audioErrorId, setAudioErrorId] = useState(null);
  const audioPlaybackIdRef = useRef(0);
  const audioSynchronizerRef = useRef(null);

  // Glossing state
  const [glossingParagraphIds, setGlossingParagraphIds] = useState(new Set());
  const [isBatchGlossing, setIsBatchGlossing] = useState(false);
  const glossAbortControllerRef = useRef(null);

  // Clean audio playback helper
  const clearAudioVisualTimer = useCallback(() => {
    if (audioSynchronizerRef.current) {
      audioSynchronizerRef.current.stop();
      audioSynchronizerRef.current = null;
    }
  }, []);

  const handleStopAudio = useCallback(() => {
    audioPlaybackIdRef.current++;
    clearAudioVisualTimer();
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setPlayingParagraphId(null);
    playingParagraphIdRef.current = null;
    setActiveAudioCharIndex(-1);
  }, [clearAudioVisualTimer]);

  // Clean up audio and async tasks on unmount
  useEffect(() => {
    return () => {
      handleStopAudio();
      if (glossAbortControllerRef.current) {
        glossAbortControllerRef.current.abort();
      }
    };
  }, [handleStopAudio]);

  // Handle single paragraph TTS play
  const handlePlayParagraph = useCallback((paragraph) => {
    if (!paragraph || !paragraph.text) return;
    const playbackId = ++audioPlaybackIdRef.current;
    clearAudioVisualTimer();

    if (!window.speechSynthesis) {
      setAudioErrorId(paragraph.id);
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    setAudioErrorId(null);
    setPlayingParagraphId(paragraph.id);
    playingParagraphIdRef.current = paragraph.id;
    setActiveAudioCharIndex(0);

    const docLangMeta = getLanguageMeta(targetLang);
    const speechCode = docLangMeta?.speechCode || 'es-ES';
    const cleanText = paragraph.text.replace(/<[^>]*>/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechCode;
    utterance.rate = mapSpeechRateToUtteranceRate(speechRate || 1.0);

    // Pick appropriate voice
    try {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(v => v.lang.toLowerCase().startsWith(speechCode.slice(0, 2).toLowerCase()));
      if (match) utterance.voice = match;
    } catch (e) {}

    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
    const synchronizer = createAudioWordSynchronizer({
      text: cleanText,
      tokens: paragraph.tokens || [],
      targetLang,
      speechRate: speechRate || 1.0,
      paragraphId: paragraph.id,
      playbackId,
      isAndroid,
      onActiveCharChange: (charIndex) => {
        if (playbackId !== audioPlaybackIdRef.current) return;
        setActiveAudioCharIndex(charIndex);
      }
    });
    audioSynchronizerRef.current = synchronizer;

    utterance.onstart = (e) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handleStart(e);
    };
    utterance.onboundary = (e) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handleBoundary(e);
    };
    utterance.onend = (e) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.handleEnd(e);
      setPlayingParagraphId(null);
      playingParagraphIdRef.current = null;
      setActiveAudioCharIndex(-1);
    };
    utterance.onerror = (e) => {
      if (playbackId !== audioPlaybackIdRef.current) return;
      synchronizer.stop();
      setPlayingParagraphId(null);
      playingParagraphIdRef.current = null;
      setActiveAudioCharIndex(-1);
      console.warn('SpeechSynthesis error in Image Reader:', e);
      setAudioErrorId(paragraph.id);
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis speak failed:', err);
      setAudioErrorId(paragraph.id);
    }
  }, [targetLang, speechRate, clearAudioVisualTimer]);

  // Auto-persist updates (new glosses or translations) to the active document in IndexedDB
  const persistDocumentChanges = useCallback(async (updatedFields = {}) => {
    const docId = currentDocIdRef.current;
    if (!docId) return;
    try {
      const existing = await getImageDocumentById(docId);
      if (existing) {
        const merged = {
          ...existing,
          ...updatedFields,
          updatedAt: new Date().toISOString()
        };
        await saveImageDocument(merged);
      }
    } catch (e) {
      console.warn('[ImageReaderPage] Failed to auto-persist document updates:', e);
    }
  }, []);

  // Handle single paragraph AI gloss
  const handleGlossParagraph = useCallback(async (paragraph) => {
    if (!paragraph || !paragraph.id || glossingParagraphIds.has(paragraph.id)) return;
    if (isGlossComplete(paragraph, targetLang, nativeLang)) return;

    setGlossingParagraphIds(prev => new Set(prev).add(paragraph.id));
    try {
      const updated = await glossSingleParagraph({
        paragraph,
        targetLang,
        nativeLang,
        apiKey
      });

      setParagraphs(prev => {
        const next = prev.map(p => (p.id === paragraph.id ? { ...p, ...updated, id: p.id } : p));
        persistDocumentChanges({ paragraphs: next });
        return next;
      });
    } catch (err) {
      console.warn('Failed to gloss paragraph with AI:', err);
    } finally {
      setGlossingParagraphIds(prev => {
        const next = new Set(prev);
        next.delete(paragraph.id);
        return next;
      });
    }
  }, [glossingParagraphIds, targetLang, nativeLang, apiKey, persistDocumentChanges]);

  // Handle on-demand paragraph translation
  const handleTranslateParagraph = useCallback(async (paragraph) => {
    if (!paragraph) return;
    const paraId = paragraph.id;

    setParagraphTranslations(prev => {
      const existing = prev[paraId];
      if (existing?.text && !existing?.error) {
        return {
          ...prev,
          [paraId]: {
            ...existing,
            isVisible: !existing.isVisible
          }
        };
      }
      return {
        ...prev,
        [paraId]: {
          text: null,
          isTranslating: true,
          isVisible: true,
          error: null
        }
      };
    });

    if (paragraphTranslations[paraId]?.text && !paragraphTranslations[paraId]?.error) {
      return;
    }

    try {
      const result = await translateParagraphTextApi({
        text: paragraph.text,
        targetLang,
        nativeLang,
        apiKey
      });

      setParagraphTranslations(prev => {
        const next = {
          ...prev,
          [paraId]: {
            text: result?.translation || result?.text || '',
            isTranslating: false,
            isVisible: true,
            error: null
          }
        };
        persistDocumentChanges({ paragraphTranslations: next });
        return next;
      });
    } catch (err) {
      console.warn('Failed to translate paragraph:', err);
      setParagraphTranslations(prev => ({
        ...prev,
        [paraId]: {
          text: null,
          isTranslating: false,
          isVisible: true,
          error: isSpanish ? 'No se pudo traducir el párrafo.' : 'Could not translate paragraph.'
        }
      }));
    }
  }, [paragraphTranslations, targetLang, nativeLang, apiKey, isSpanish, persistDocumentChanges]);

  // Batch gloss all paragraphs with AI
  const handleGlossAll = useCallback(() => {
    if (isBatchGlossing || paragraphs.length === 0) return;
    const allComplete = paragraphs.every(p => isGlossComplete(p, targetLang, nativeLang));
    if (allComplete) return;

    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    glossAbortControllerRef.current = controller;

    setIsBatchGlossing(true);

    try {
      enrichParagraphsWithGlosses({
        paragraphs,
        targetLang,
        nativeLang,
        apiKey,
        abortSignal: controller.signal,
        onUpdate: (updatedParas) => {
          setParagraphs([...updatedParas]);
          persistDocumentChanges({ paragraphs: updatedParas });
        },
        onProgress: (progress) => {
          if (!progress || progress.isGlossing === false || progress.isComplete === true) {
            setIsBatchGlossing(false);
          }
        }
      });
    } catch (err) {
      console.warn('Batch glossing error:', err);
      setIsBatchGlossing(false);
    }
  }, [isBatchGlossing, paragraphs, targetLang, nativeLang, apiKey, persistDocumentChanges]);

  // Main generation trigger
  const handleGenerateDescription = async () => {
    if (!selectedImage || !selectedImage.base64 || isGenerating) return;

    setIsGenerating(true);
    setGenerationError(null);
    handleStopAudio();

    try {
      const response = await describeImageApi({
        imageBase64: selectedImage.base64,
        mimeType: selectedImage.mimeType,
        targetLang,
        nativeLang,
        level,
        apiKey
      });

      const finalTitle = response.title || (isSpanish ? 'Descripción de la imagen' : 'Image Description');
      setResultTitle(finalTitle);
      setUsedModel(response.model || '');

      // Split generated description into balanced natural paragraphs
      const rawText = (response.description || '').trim();
      const rawBlocks = segmentImageDescriptionIntoParagraphs(rawText, targetLang);

      // Process each block immediately through the offline linguistic tokenizer (0ms Pinyin / tokens)
      const initializedParas = rawBlocks.map((blockText, idx) => {
        const offlineTokens = tokenizeAndGlossLineOffline(blockText, targetLang, nativeLang);
        return {
          id: `img-para-${idx + 1}`,
          text: blockText,
          tokens: offlineTokens
        };
      });

      setParagraphs(initializedParas);
      setParagraphTranslations({});

      // Auto-save to Library immediately
      const newDoc = {
        id: `img_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: finalTitle,
        description: rawText,
        targetLang,
        nativeLang,
        level,
        model: response.model || 'qwen/qwen3.8-27b',
        imageBase64: selectedImage.dataUrl || selectedImage.base64,
        mimeType: selectedImage.mimeType || 'image/jpeg',
        paragraphs: initializedParas,
        paragraphTranslations: {}
      };

      try {
        await saveImageDocument(newDoc);
        setCurrentDocId(newDoc.id);
      } catch (saveErr) {
        console.warn('[ImageReaderPage] Error auto-saving generated image document:', saveErr);
      }

      recordHabitActivityForToday({
        user,
        langCode: targetLang,
        activityKey: 'reading'
      });

      setViewMode('reader');
    } catch (err) {
      console.warn('Image description error:', err);
      setGenerationError(
        err.message ||
        (isSpanish
          ? 'Error al analizar la imagen con la IA. Verifica tu conexión o intenta con otra foto.'
          : 'Error analyzing image with AI. Please check connection or try another photo.')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Reopen a saved document from Library
  const handleOpenSavedDocument = useCallback((doc) => {
    if (!doc) return;
    recordHabitActivityForToday({
      user,
      langCode: doc.targetLang || targetLang,
      activityKey: 'reading'
    });
    handleStopAudio();
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
    }
    setIsBatchGlossing(false);
    setCurrentDocId(doc.id);
    setSelectedImage({
      dataUrl: doc.imageBase64,
      base64: doc.imageBase64,
      mimeType: doc.mimeType || 'image/jpeg'
    });
    setResultTitle(doc.title || '');
    setParagraphs(Array.isArray(doc.paragraphs) ? doc.paragraphs : []);
    setParagraphTranslations(doc.paragraphTranslations || {});
    setUsedModel(doc.model || '');
    if (doc.level) setLevel(doc.level);
    if (doc.targetLang && doc.targetLang !== targetLang && setTargetLang) {
      setTargetLang(doc.targetLang);
    }
    setViewMode('reader');
  }, [handleStopAudio, targetLang, setTargetLang, user]);

  const handleReset = () => {
    handleStopAudio();
    if (glossAbortControllerRef.current) {
      glossAbortControllerRef.current.abort();
    }
    setIsBatchGlossing(false);
    setSelectedImage(null);
    setCurrentDocId(null);
    setResultTitle('');
    setParagraphs([]);
    setGenerationError(null);
    setParagraphTranslations({});
  };

  const isRtl = isRtlLanguage(targetLang);

  if (viewMode === 'library') {
    return (
      <ImageLibraryView
        targetLang={targetLang}
        setTargetLang={setTargetLang}
        languages={languages}
        onSelectDocument={handleOpenSavedDocument}
        onAddNew={() => {
          handleReset();
          setViewMode('uploader');
        }}
        onBackToHome={() => (setActiveTab ? setActiveTab('home') : null)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto w-full bg-[var(--app-bg)] text-[var(--text-primary)] flex flex-col justify-between">
      {/* Top sticky navigation bar */}
      <header className="sticky top-0 z-20 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--border-primary)] px-3 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-xs">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              handleStopAudio();
              setViewMode('library');
            }}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer shrink-0"
            title={isSpanish ? 'Volver a la biblioteca' : 'Back to Library'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Camera className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate">
              Image Reader
            </h1>
          </div>
        </div>

        {/* Right: Language selector & CEFR Level dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          {/* CEFR Level Selector */}
          <select
            value={level}
            onChange={(e) => handleLevelChange(e.target.value)}
            disabled={isGenerating}
            className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] text-xs font-bold focus:border-rose-500 focus:outline-hidden transition-all cursor-pointer"
            title={isSpanish ? 'Nivel de aprendizaje' : 'Proficiency level'}
          >
            {CEFR_LEVELS.map(lvl => (
              <option key={lvl.value} value={lvl.value}>
                {isSpanish ? lvl.es : lvl.en}
              </option>
            ))}
          </select>

          {/* Target Language Dropdown */}
          <LanguageSelectDropdown
            value={targetLang}
            onChange={(newLang) => {
              if (setTargetLang) setTargetLang(newLang);
            }}
            options={languages}
            variant="header"
            align="right"
          />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 flex flex-col">
        {/* State A: Before analysis (or Image Upload step) */}
        {paragraphs.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center max-w-xl mx-auto w-full py-4 animate-fade-in">
            {/* Image Uploader */}
            <ImageUploader
              image={selectedImage}
              onImageSelected={setSelectedImage}
              onImageCleared={() => setSelectedImage(null)}
              disabled={isGenerating}
            />

            {/* Error Message */}
            {generationError && (
              <div className="mt-4 w-full p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-700 dark:text-rose-200 animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1">
                  <strong className="block font-bold mb-0.5">
                    {isSpanish ? 'Error de análisis' : 'Analysis error'}
                  </strong>
                  <span>{generationError}</span>
                </div>
              </div>
            )}

            {/* Action Button: Generate Description */}
            {selectedImage && (
              <div className="mt-6 w-full flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGenerating}
                  className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-98 ${
                    isGenerating
                      ? 'bg-rose-500/50 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:via-pink-500 hover:to-amber-500 text-white shadow-rose-950/30 hover:shadow-xl'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{isSpanish ? 'Describiendo imagen con IA...' : 'Describing image with AI...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>{isSpanish ? 'Describir en mi idioma objetivo' : 'Describe in target language'}</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-[var(--text-muted)] text-center mt-2.5">
                  {isSpanish
                    ? `Generará una descripción adaptada a nivel ${level} en ${getLanguageMeta(targetLang)?.name || targetLang}.`
                    : `Will generate a description adapted to level ${level} in ${getLanguageMeta(targetLang)?.name || targetLang}.`}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* State B: Results Display (Image + Description + Linguistics) */
          <div className="w-full flex flex-col gap-5 animate-fade-in pb-10">
            {/* Top Toolbar: Image Thumbnail, Title, and Action Controls */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {selectedImage?.dataUrl && (
                  <img
                    src={selectedImage.dataUrl}
                    alt="Thumbnail"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-[var(--border-primary)] shadow-xs shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                      Nivel {level}
                    </span>
                    {usedModel && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {usedModel.replace('-preview', '')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-xl font-bold text-[var(--text-primary)] truncate">
                    {resultTitle || (isSpanish ? 'Descripción de la imagen' : 'Image Description')}
                  </h2>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--border-primary)]">
                {/* Interlinear Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setInterlinearMode(!interlinearMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    interlinearMode
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:bg-[var(--surface-tertiary)]'
                  }`}
                  title={interlinearMode ? 'Ocultar glosas' : 'Mostrar glosas'}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>{isSpanish ? 'Glosas' : 'Glosses'}</span>
                  <span className="text-[10px] opacity-75">{interlinearMode ? 'ON' : 'OFF'}</span>
                </button>

                {/* AI Batch Gloss Button */}
                <button
                  type="button"
                  onClick={handleGlossAll}
                  disabled={isBatchGlossing}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-[var(--border-primary)] ${
                    isBatchGlossing
                      ? 'bg-rose-500/20 text-rose-400 cursor-not-allowed'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] text-[var(--text-primary)] cursor-pointer'
                  }`}
                  title={isSpanish ? 'Enriquecer todas las palabras con IA' : 'Gloss all with AI'}
                >
                  {isBatchGlossing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{isSpanish ? 'Glosar todo' : 'Gloss all'}</span>
                </button>

                {/* Library button */}
                <button
                  type="button"
                  onClick={() => {
                    handleStopAudio();
                    setViewMode('library');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] transition-all flex items-center gap-1.5 cursor-pointer"
                  title={isSpanish ? 'Volver a la biblioteca' : 'Return to library'}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{isSpanish ? 'Biblioteca' : 'Library'}</span>
                </button>

                {/* Reset / New photo button */}
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    setViewMode('uploader');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] transition-all flex items-center gap-1.5 cursor-pointer"
                  title={isSpanish ? 'Analizar otra imagen' : 'Analyze another image'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isSpanish ? 'Nueva foto' : 'New photo'}</span>
                </button>
              </div>
            </div>

            {/* Paragraphs List (rendered using existing TextParagraphItem component) */}
            <div className="flex flex-col gap-4">
              {paragraphs.map((para) => (
                <div
                  key={para.id}
                  className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm hover:border-rose-500/40 transition-colors"
                >
                  <TextParagraphItem
                    paragraph={para}
                    targetLang={targetLang}
                    nativeLang={nativeLang}
                    fontSize={fontSize}
                    interlinearMode={interlinearMode}
                    isPlaying={playingParagraphId === para.id}
                    activeAudioCharIndex={playingParagraphId === para.id ? activeAudioCharIndex : -1}
                    isAudioError={audioErrorId === para.id}
                    isGlossing={glossingParagraphIds.has(para.id)}
                    hasGloss={isGlossComplete(para, targetLang, nativeLang)}
                    translation={paragraphTranslations[para.id]?.text}
                    isTranslating={Boolean(paragraphTranslations[para.id]?.isTranslating)}
                    isTranslationVisible={Boolean(paragraphTranslations[para.id]?.isVisible)}
                    translationError={paragraphTranslations[para.id]?.error}
                    onPlay={handlePlayParagraph}
                    onStop={handleStopAudio}
                    onWordClick={onWordClick}
                    onGloss={handleGlossParagraph}
                    onGlossParagraph={handleGlossParagraph}
                    onTranslate={handleTranslateParagraph}
                    onTranslateParagraph={handleTranslateParagraph}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ImageReaderPage;
