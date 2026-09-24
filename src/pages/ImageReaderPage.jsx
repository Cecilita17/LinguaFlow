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
  X
} from 'lucide-react';
import { ImageUploader } from '../components/image/ImageUploader.jsx';
import { TextParagraphItem } from '../components/text/TextParagraphItem.jsx';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { describeImageApi } from '../services/imageDescriptionService.js';
import {
  tokenizeAndGlossLineOffline,
  glossSingleParagraph,
  enrichParagraphsWithGlosses
} from '../services/textGlossService.js';
import { translateParagraphTextApi } from '../services/textDocumentService.js';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useAudioSettings, mapSpeechRateToUtteranceRate } from '../context/AudioSettingsContext.jsx';
import { getLanguageMeta, isRtlLanguage, getTextDirection } from '../constants/languages.js';
import { createAudioWordSynchronizer } from '../utils/audioWordSync.js';

const CEFR_LEVELS = [
  { value: 'A1', es: 'Principiante (A1)', en: 'Beginner (A1)' },
  { value: 'A2', es: 'Elemental (A2)', en: 'Elementary (A2)' },
  { value: 'B1', es: 'Intermedio (B1)', en: 'Intermediate (B1)' },
  { value: 'B2', es: 'Intermedio Alto (B2)', en: 'Upper Intermediate (B2)' },
  { value: 'C1', es: 'Avanzado (C1)', en: 'Advanced (C1)' }
];

export function ImageReaderPage({
  targetLang = 'zh',
  setTargetLang,
  nativeLang = 'es',
  languages = [],
  apiKey = '',
  onWordClick,
  setActiveTab
}) {
  const { isSpanish } = useSiteLanguage();
  const { speechRate } = useAudioSettings();

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

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      handleStopAudio();
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

  // Handle single paragraph AI gloss
  const handleGlossParagraph = useCallback(async (paragraph) => {
    if (!paragraph || glossingParagraphIds.has(paragraph.id)) return;

    setGlossingParagraphIds(prev => new Set(prev).add(paragraph.id));
    try {
      const updated = await glossSingleParagraph({
        paragraph,
        targetLang,
        nativeLang,
        apiKey
      });

      setParagraphs(prev => prev.map(p => (p.id === paragraph.id ? updated : p)));
    } catch (err) {
      console.warn('Failed to gloss paragraph with AI:', err);
    } finally {
      setGlossingParagraphIds(prev => {
        const next = new Set(prev);
        next.delete(paragraph.id);
        return next;
      });
    }
  }, [glossingParagraphIds, targetLang, nativeLang, apiKey]);

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

      setParagraphTranslations(prev => ({
        ...prev,
        [paraId]: {
          text: result?.translation || result?.text || '',
          isTranslating: false,
          isVisible: true,
          error: null
        }
      }));
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
  }, [paragraphTranslations, targetLang, nativeLang, apiKey, isSpanish]);

  // Batch gloss all paragraphs with AI
  const handleGlossAll = useCallback(() => {
    if (isBatchGlossing || paragraphs.length === 0) return;
    setIsBatchGlossing(true);

    enrichParagraphsWithGlosses({
      paragraphs,
      targetLang,
      nativeLang,
      apiKey,
      onUpdate: (updatedParas) => {
        setParagraphs([...updatedParas]);
      },
      onProgress: (progress) => {
        if (progress.completed >= progress.total) {
          setIsBatchGlossing(false);
        }
      }
    });
  }, [isBatchGlossing, paragraphs, targetLang, nativeLang, apiKey]);

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

      setResultTitle(response.title || '');
      setUsedModel(response.model || '');

      // Split generated description into paragraphs
      const rawText = (response.description || '').trim();
      const rawBlocks = rawText.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

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

  const handleReset = () => {
    handleStopAudio();
    setSelectedImage(null);
    setResultTitle('');
    setParagraphs([]);
    setGenerationError(null);
    setParagraphTranslations({});
  };

  const isRtl = isRtlLanguage(targetLang);

  return (
    <div className="flex-1 overflow-y-auto w-full bg-[var(--app-bg)] text-[var(--text-primary)] flex flex-col justify-between">
      {/* Top sticky navigation bar */}
      <header className="sticky top-0 z-20 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--border-primary)] px-3 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-xs">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab ? setActiveTab('home') : null}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer shrink-0"
            title={isSpanish ? 'Volver al Inicio' : 'Back to Home'}
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

                {/* Reset / New photo button */}
                <button
                  type="button"
                  onClick={handleReset}
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
                    hasGloss={Array.isArray(para.tokens) && para.tokens.some(t => Boolean(t && (t.gloss || t.translation)))}
                    translation={paragraphTranslations[para.id]?.text}
                    isTranslating={Boolean(paragraphTranslations[para.id]?.isTranslating)}
                    isTranslationVisible={Boolean(paragraphTranslations[para.id]?.isVisible)}
                    translationError={paragraphTranslations[para.id]?.error}
                    onPlay={handlePlayParagraph}
                    onStop={handleStopAudio}
                    onWordClick={onWordClick}
                    onGlossParagraph={handleGlossParagraph}
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
