import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Maximize2
} from 'lucide-react';
import { TextParagraphItem } from '../components/text/TextParagraphItem.jsx';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { getLanguageMeta } from '../constants/languages.js';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import {
  splitTextIntoParagraphs,
  createTextDocument,
  saveActiveDocumentDraft,
  loadActiveDocumentDraft,
  clearActiveDocumentDraft
} from '../services/textDocumentService.js';
import {
  enrichParagraphsWithGlosses,
  isGlossComplete
} from '../services/textGlossService.js';

export function TextReaderPage({
  targetLang = 'zh',
  setTargetLang = null,
  nativeLang = 'es',
  languages = [],
  apiKey = '',
  onWordClick = null
}) {
  const { t } = useSiteLanguage();

  // Load existing draft if available
  const [document, setDocument] = useState(() => loadActiveDocumentDraft());
  const [isEditing, setIsEditing] = useState(() => !loadActiveDocumentDraft());
  const [inputText, setInputText] = useState(() => loadActiveDocumentDraft()?.rawText || '');
  const [inputTitle, setInputTitle] = useState(() => loadActiveDocumentDraft()?.title || '');
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg' | 'xl'
  const [interlinearMode, setInterlinearMode] = useState(true);

  // Audio TTS states
  const [playingParagraphId, setPlayingParagraphId] = useState(null);
  const [audioErrorId, setAudioErrorId] = useState(null);

  // Glossing progress & controller
  const [glossingProgress, setGlossingProgress] = useState({
    total: 0,
    completed: 0,
    isGlossing: false,
    isPaused: false,
    isComplete: false,
    failed: 0
  });
  const abortControllerRef = useRef(null);

  // Cleanup speech synthesis & glossing on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Save active document state whenever document changes
  useEffect(() => {
    if (document) {
      saveActiveDocumentDraft(document);
    }
  }, [document]);

  // Synchronize targetLang change: if document language differs, re-evaluate offline tokens
  useEffect(() => {
    if (document && document.targetLang !== targetLang) {
      const retokenizedParagraphs = splitTextIntoParagraphs(document.rawText, targetLang);
      const updatedDoc = {
        ...document,
        targetLang,
        paragraphs: retokenizedParagraphs
      };
      setDocument(updatedDoc);
      saveActiveDocumentDraft(updatedDoc);
      // Trigger glossing for the new language
      triggerGlossing(retokenizedParagraphs, targetLang);
    }
  }, [targetLang]);

  // Handle single-paragraph TTS playback
  const handlePlayParagraph = useCallback((paragraph) => {
    if (!paragraph || !paragraph.text) return;
    if (!window.speechSynthesis) {
      setAudioErrorId(paragraph.id);
      return;
    }

    // Cancel any current utterance
    window.speechSynthesis.cancel();
    setAudioErrorId(null);
    setPlayingParagraphId(paragraph.id);

    const langMeta = getLanguageMeta(targetLang);
    const speechCode = langMeta?.speechCode || 'zh-CN';
    const cleanText = paragraph.text.replace(/<[^>]*>/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechCode;
    utterance.rate = 0.95;

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
  }, [targetLang]);

  const handleStopAudio = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingParagraphId(null);
  }, []);

  // Handle manual per-segment glosses save (0ms latency, zero AI calls)
  const handleSaveManualGlosses = useCallback((paragraphId, updatedTokens) => {
    setDocument(prev => {
      if (!prev || !Array.isArray(prev.paragraphs)) return prev;
      const nextParagraphs = prev.paragraphs.map(p => {
        if (p.id !== paragraphId) return p;
        return {
          ...p,
          tokens: updatedTokens
        };
      });
      const nextDoc = {
        ...prev,
        paragraphs: nextParagraphs
      };
      saveActiveDocumentDraft(nextDoc);
      return nextDoc;
    });
  }, []);

  // Trigger background AI glossing
  const triggerGlossing = useCallback((paragraphsToGloss, activeTargetLang = targetLang) => {
    if (!Array.isArray(paragraphsToGloss) || paragraphsToGloss.length === 0) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const enriched = enrichParagraphsWithGlosses({
      paragraphs: paragraphsToGloss,
      targetLang: activeTargetLang,
      nativeLang,
      apiKey,
      abortSignal: controller.signal,
      onUpdate: (updatedParagraphs) => {
        setDocument(prev => {
          if (!prev) return prev;
          const nextDoc = {
            ...prev,
            paragraphs: updatedParagraphs
          };
          saveActiveDocumentDraft(nextDoc);
          return nextDoc;
        });
      },
      onProgress: (prog) => {
        setGlossingProgress(prog);
      }
    });

    // Update document with immediately prepared offline tokens
    setDocument(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        paragraphs: enriched
      };
    });
  }, [targetLang, nativeLang, apiKey]);

  // Stop/Pause glossing
  const handleStopGlossing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGlossingProgress(prev => ({
      ...prev,
      isGlossing: false,
      isPaused: true
    }));
  };

  // Resume glossing
  const handleResumeGlossing = () => {
    if (document && Array.isArray(document.paragraphs)) {
      triggerGlossing(document.paragraphs, targetLang);
    }
  };

  // Submit / Start reading parsed text
  const handleStartReading = () => {
    const raw = inputText.trim();
    if (!raw) return;

    const paragraphs = splitTextIntoParagraphs(raw, targetLang);
    const newDoc = createTextDocument({
      title: inputTitle.trim(),
      rawText: raw,
      targetLang,
      nativeLang,
      paragraphs
    });

    setDocument(newDoc);
    setIsEditing(false);
    saveActiveDocumentDraft(newDoc);

    // Automatically begin glossing
    triggerGlossing(paragraphs, targetLang);
  };

  // File Upload handler (.txt)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
  };

  // Font size cycle
  const cycleFontSize = () => {
    const order = ['sm', 'base', 'lg', 'xl'];
    const nextIdx = (order.indexOf(fontSize) + 1) % order.length;
    setFontSize(order[nextIdx]);
  };

  const currentLangMeta = getLanguageMeta(targetLang);

  return (
    <div className="flex-1 overflow-hidden w-full flex flex-col bg-gradient-to-b from-[#190904] via-[#210c06] to-[#150602] text-stone-100">
      {/* TOP HEADER CONTROLS BAR */}
      <div className="px-4 py-3 bg-[#231109]/95 backdrop-blur-md border-b border-[#3d1a10] shadow-md shadow-black/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Section Title & Editable Doc Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/50 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-800/60">
                📖 {t('text_reader_title') || 'Importador de Textos'}
              </span>
              {document && !isEditing && (
                <span className="text-xs text-stone-400 font-medium hidden sm:inline">
                  • {document.paragraphs?.length || 0} párrafos
                </span>
              )}
            </div>

            {/* Editable or Static Document Title */}
            {document && !isEditing ? (
              <h2
                title="Título del documento"
                className="text-base sm:text-lg font-bold text-white truncate leading-tight max-w-[240px] sm:max-w-md mt-0.5"
              >
                {document.title}
              </h2>
            ) : (
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight mt-0.5">
                {t('home_text_title') || 'Lector Independiente'}
              </h2>
            )}
          </div>
        </div>

        {/* Right: Language Dropdown, AI Glossing button, Font Size, Edit / New Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Target Language Dropdown */}
          <div className="bg-[#1a0c07] rounded-xl border border-[#482015] p-0.5">
            <LanguageSelectDropdown
              value={targetLang}
              onChange={(newLang) => setTargetLang && setTargetLang(newLang)}
              options={languages}
              variant="header"
              align="right"
            />
          </div>

          {/* AI Glossing Control (Pause / Resume / Loading) when reader is active */}
          {document && !isEditing && (
            <>
              {glossingProgress.isGlossing ? (
                <button
                  type="button"
                  onClick={handleStopGlossing}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 text-amber-200 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  title="Pausar generación de gloses"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Pausar</span>
                  <span className="text-[11px] opacity-80 font-mono">
                    ({glossingProgress.completed}/{glossingProgress.total})
                  </span>
                </button>
              ) : glossingProgress.isPaused ? (
                <button
                  type="button"
                  onClick={handleResumeGlossing}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/80 text-rose-200 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  title="Reanudar generación de gloses"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Reanudar</span>
                  <span className="text-[11px] opacity-80 font-mono">
                    ({glossingProgress.completed}/{glossingProgress.total})
                  </span>
                </button>
              ) : glossingProgress.isComplete ? (
                <span className="px-2.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-600/60 text-emerald-200 text-xs font-semibold hidden md:inline-flex items-center space-x-1.5 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Glosado completo</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => triggerGlossing(document.paragraphs, targetLang)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#2e150d] hover:bg-[#3d1c12] border border-[#54271a] text-rose-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  title="Generar o actualizar glosado con IA"
                >
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">AI Glossing</span>
                </button>
              )}

              {/* Interlinear Mode Toggle */}
              <button
                type="button"
                onClick={() => setInterlinearMode(!interlinearMode)}
                title={interlinearMode ? "Cambiar a texto continuo" : "Ver con glosado interlineal"}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                  interlinearMode
                    ? 'bg-rose-600 border-rose-400 text-white shadow-rose-900/40'
                    : 'bg-[#2a130b] border-[#482015] text-rose-200/80 hover:text-white'
                }`}
              >
                <Type className="w-4 h-4" />
              </button>

              {/* Font Size Button */}
              <button
                type="button"
                onClick={cycleFontSize}
                title={`Tamaño de fuente: ${fontSize.toUpperCase()}`}
                className="px-2.5 py-1.5 rounded-xl bg-[#2a130b] border border-[#482015] hover:border-rose-500/60 text-stone-200 hover:text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                A{fontSize === 'xl' ? '++' : fontSize === 'lg' ? '+' : fontSize === 'sm' ? '-' : ''}
              </button>

              {/* Edit text button */}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Editar o cambiar el texto"
                className="p-2 rounded-xl bg-[#2a130b] border border-[#482015] hover:border-rose-500/60 text-stone-200 hover:text-white transition-all shadow-xs cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              {/* New / Clear button */}
              <button
                type="button"
                onClick={handleClearDocument}
                title="Nuevo texto / Limpiar documento"
                className="p-2 rounded-xl bg-[#2a130b] border border-[#482015] hover:border-rose-500/60 text-stone-200 hover:text-rose-300 transition-all shadow-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto flex flex-col">
        {isEditing ? (
          /* ============================================================ */
          /* 1. INPUT / IMPORT VIEW (Escribir, Pegar, Importar archivo)     */
          /* ============================================================ */
          <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full animate-fade-in my-auto">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#220f09]/95 border border-[#461f14] shadow-2xl shadow-black/40">
              {/* Header Title inside card */}
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#3d190f]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/60">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">
                      {t('text_importer_heading') || 'Importar o escribir texto'}
                    </h3>
                    <p className="text-xs text-rose-200/70 mt-0.5">
                      {t('text_importer_subheading') || 'Pega cualquier lectura. Se dividirá automáticamente en párrafos con audio y glosado.'}
                    </p>
                  </div>
                </div>

                {document && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-xl bg-[#2d140d] border border-[#4c2217] text-stone-300 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Volver a lectura
                  </button>
                )}
              </div>

              {/* Title Input */}
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-200 mb-1.5">
                  Título del texto (opcional)
                </label>
                <input
                  type="text"
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  placeholder="Ej: Mi primer día de clases / 我的学校..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#190b06] border border-[#441e13] focus:border-rose-500 focus:outline-hidden text-stone-100 placeholder-stone-500 text-sm transition-all"
                />
              </div>

              {/* Textarea for raw text */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-rose-200">
                    Contenido del texto
                  </label>
                  <span className="text-[11px] text-stone-400">
                    {inputText.trim() ? `${splitTextIntoParagraphs(inputText, targetLang).length} párrafos detectados` : 'Escribe o pega aquí'}
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Pega o escribe tu texto aquí en cualquier idioma (chino, árabe, polaco, ruso, etc.). Cada salto de línea o espacio en blanco formará un párrafo independiente."
                  className="w-full p-4 rounded-2xl bg-[#180b06] border border-[#441e13] focus:border-rose-500 focus:outline-hidden text-stone-100 placeholder-stone-500 text-sm leading-relaxed transition-all resize-y"
                />
              </div>

              {/* Action Buttons Strip (Paste clipboard, Upload .txt file, Start Reading) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center space-x-2">
                  {/* Paste from Clipboard */}
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-3.5 py-2 rounded-xl bg-[#2d140d] hover:bg-[#3d1a10] border border-[#4c2217] text-stone-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Clipboard className="w-4 h-4 text-rose-400" />
                    <span>Pegar texto</span>
                  </button>

                  {/* File Upload Button (.txt) */}
                  <label className="px-3.5 py-2 rounded-xl bg-[#2d140d] hover:bg-[#3d1a10] border border-[#4c2217] text-stone-200 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Cargar archivo .txt</span>
                    <input
                      type="file"
                      accept=".txt,text/plain"
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
                      : 'bg-[#2b160e] text-stone-500 border border-[#3f1e14] cursor-not-allowed opacity-60'
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
            {document?.paragraphs?.map((paragraph) => (
              <TextParagraphItem
                key={paragraph.id}
                paragraph={paragraph}
                targetLang={targetLang}
                fontSize={fontSize}
                interlinearMode={interlinearMode}
                isPlaying={playingParagraphId === paragraph.id}
                isAudioError={audioErrorId === paragraph.id}
                onPlay={handlePlayParagraph}
                onStop={handleStopAudio}
                onWordClick={onWordClick}
                onSaveManualGlosses={handleSaveManualGlosses}
              />
            ))}

            {/* End of Document Footer Note */}
            <div className="pt-8 pb-4 text-center text-xs text-rose-200/50 flex items-center justify-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/40"></span>
              <span>Fin del texto • Haz clic en ▶️ en cualquier párrafo para escuchar su pronunciación</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/40"></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TextReaderPage;
