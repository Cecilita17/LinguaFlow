import React, { useState, useEffect, useRef, useMemo } from 'react';
import HanziWriter from 'hanzi-writer';
import {
  X,
  Play,
  Lightbulb,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Award,
  PenTool,
  BookOpen
} from 'lucide-react';
import { extractHanziItems } from '../services/chineseWritingService.js';

export function ChineseWritingPractice({
  isOpen,
  onClose,
  initialMode = 'words', // 'words' | 'sentence'
  correctedText = '',
  diffTokens = [],
  showTransliteration = true
}) {
  const [mode, setMode] = useState(initialMode); // 'words' | 'sentence'
  const [filterType, setFilterType] = useState('corrections'); // 'corrections' | 'all'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isCharCompleted, setIsCharCompleted] = useState(false);
  const [completedCharIndices, setCompletedCharIndices] = useState(new Set());
  const [charMistakes, setCharMistakes] = useState(0);
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [isMistakeFlash, setIsMistakeFlash] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const containerRef = useRef(null);
  const writerRef = useRef(null);

  // Extract items from corrected sentence
  const { allItems, changedItems } = useMemo(() => {
    return extractHanziItems(correctedText, diffTokens);
  }, [correctedText, diffTokens]);

  // Determine active list based on mode and filter
  const activeItems = useMemo(() => {
    if (mode === 'sentence') {
      return allItems;
    }
    // 'words' mode
    if (filterType === 'corrections' && changedItems.length > 0) {
      return changedItems;
    }
    return allItems;
  }, [mode, filterType, allItems, changedItems]);

  // If there are no changed items, default to 'all'
  useEffect(() => {
    if (mode === 'words' && changedItems.length === 0 && filterType !== 'all') {
      setFilterType('all');
    }
  }, [mode, changedItems.length, filterType]);

  // Current active character item
  const currentItem = activeItems[currentIndex] || activeItems[0] || null;
  const currentChar = currentItem?.char || '';

  // Reset index if out of bounds
  useEffect(() => {
    if (currentIndex >= activeItems.length && activeItems.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeItems.length, currentIndex]);

  // Reset state when switching mode or filter
  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setCurrentIndex(0);
    setIsCharCompleted(false);
    setCompletedCharIndices(new Set());
    setTotalMistakes(0);
    setCharMistakes(0);
    setShowSummary(false);
  };

  const handleSwitchFilter = (newFilter) => {
    setFilterType(newFilter);
    setCurrentIndex(0);
    setIsCharCompleted(false);
    setCompletedCharIndices(new Set());
    setTotalMistakes(0);
    setCharMistakes(0);
    setShowSummary(false);
  };

  // Setup Hanzi Writer instance when current character changes
  useEffect(() => {
    if (!isOpen || !containerRef.current || !currentChar) return;

    // Reset status for new character
    setIsCharCompleted(false);
    setCharMistakes(0);
    setIsAnimating(false);

    // Clear previous SVG content in container
    containerRef.current.innerHTML = '';

    const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 640;
    const canvasSize = isSmallScreen ? 230 : 270;

    try {
      const writer = HanziWriter.create(containerRef.current, currentChar, {
        width: canvasSize,
        height: canvasSize,
        padding: 20,
        showOutline: true,
        showCharacter: false, // In quiz mode, character is hidden so user draws it
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 180,
        strokeColor: '#e11d48', // rose-600
        radicalColor: '#f43f5e', // rose-500
        outlineColor: '#e2e8f0', // slate-200
        drawingColor: '#2563eb', // blue-600
        drawingWidth: 16,
        showHintAfterMisses: 3,
        highlightOnComplete: true,
        highlightColor: '#10b981' // emerald-500
      });

      writerRef.current = writer;

      // Start quiz
      writer.quiz({
        onMistake: () => {
          setCharMistakes(prev => prev + 1);
          setTotalMistakes(prev => prev + 1);
          setIsMistakeFlash(true);
          setTimeout(() => setIsMistakeFlash(false), 350);
        },
        onCorrectStroke: () => {
          // User drew a correct stroke
        },
        onComplete: () => {
          setIsCharCompleted(true);
          setCompletedCharIndices(prev => new Set([...prev, currentIndex]));

          // Check if this was the last character
          if (currentIndex + 1 >= activeItems.length) {
            setTimeout(() => {
              setShowSummary(true);
            }, 800);
          }
        }
      });
    } catch (err) {
      console.warn('HanziWriter initialization error:', err);
    }

    return () => {
      if (writerRef.current) {
        try {
          writerRef.current.cancelQuiz();
        } catch (e) {}
      }
    };
  }, [isOpen, currentChar, currentIndex, activeItems.length]);

  // Control Actions
  const handleAnimate = () => {
    if (!writerRef.current || isAnimating) return;
    setIsAnimating(true);
    writerRef.current.animateCharacter({
      onComplete: () => {
        setIsAnimating(false);
        // Restart quiz mode after animation
        if (!isCharCompleted && writerRef.current) {
          writerRef.current.quiz({
            onMistake: () => {
              setCharMistakes(prev => prev + 1);
              setTotalMistakes(prev => prev + 1);
              setIsMistakeFlash(true);
              setTimeout(() => setIsMistakeFlash(false), 350);
            },
            onComplete: () => {
              setIsCharCompleted(true);
              setCompletedCharIndices(prev => new Set([...prev, currentIndex]));
              if (currentIndex + 1 >= activeItems.length) {
                setTimeout(() => setShowSummary(true), 800);
              }
            }
          });
        }
      }
    });
  };

  const handleHint = () => {
    if (!writerRef.current) return;
    // Flashes the outline or reveals the stroke
    try {
      writerRef.current.showOutline();
      setTimeout(() => {
        if (!isCharCompleted && writerRef.current) {
          // keep faint outline
        }
      }, 1000);
    } catch (e) {}
  };

  const handleResetCurrent = () => {
    if (!writerRef.current) return;
    setIsCharCompleted(false);
    setCharMistakes(0);
    try {
      writerRef.current.quiz({
        onMistake: () => {
          setCharMistakes(prev => prev + 1);
          setTotalMistakes(prev => prev + 1);
          setIsMistakeFlash(true);
          setTimeout(() => setIsMistakeFlash(false), 350);
        },
        onComplete: () => {
          setIsCharCompleted(true);
          setCompletedCharIndices(prev => new Set([...prev, currentIndex]));
          if (currentIndex + 1 >= activeItems.length) {
            setTimeout(() => setShowSummary(true), 800);
          }
        }
      });
    } catch (e) {}
  };

  const handleNext = () => {
    if (currentIndex + 1 < activeItems.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowSummary(false);
    }
  };

  const handleRestartAll = () => {
    setCurrentIndex(0);
    setCompletedCharIndices(new Set());
    setTotalMistakes(0);
    setCharMistakes(0);
    setIsCharCompleted(false);
    setShowSummary(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-xs">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span>Práctica de Escritura</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                  汉字
                </span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {mode === 'sentence' ? 'Oración corregida completa' : 'Caracteres corregidos / nuevos'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
            title="Cerrar práctica"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-950/40">
          <div className="flex p-1 bg-stone-200/70 dark:bg-stone-800/80 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSwitchMode('words')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                mode === 'words'
                  ? 'bg-white dark:bg-stone-700 text-rose-600 dark:text-rose-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>✍️ Escritura</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('sentence')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                mode === 'sentence'
                  ? 'bg-white dark:bg-stone-700 text-rose-600 dark:text-rose-300 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>📝 Oración</span>
            </button>
          </div>

          {/* Sub-filter in 'words' mode */}
          {mode === 'words' && changedItems.length > 0 && (
            <div className="flex items-center space-x-1 text-[11px]">
              <button
                type="button"
                onClick={() => handleSwitchFilter('corrections')}
                className={`px-2 py-1 rounded-md transition-all font-semibold ${
                  filterType === 'corrections'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Solo corrección ({changedItems.length})
              </button>
              <button
                type="button"
                onClick={() => handleSwitchFilter('all')}
                className={`px-2 py-1 rounded-md transition-all font-semibold ${
                  filterType === 'all'
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Todos ({allItems.length})
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col items-center justify-between">
          {showSummary ? (
            /* Completion Screen */
            <div className="w-full flex flex-col items-center justify-center py-8 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-md">
                <Award className="w-9 h-9" />
              </div>
              <h4 className="text-2xl font-black text-stone-900 dark:text-stone-100 mb-1">
                ¡Práctica Completada!
              </h4>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
                Has escrito todos los caracteres en orden de trazos correcto.
              </p>

              <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
                <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/60 text-center">
                  <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {completedCharIndices.size} / {activeItems.length}
                  </span>
                  <p className="text-xs text-stone-500 font-medium mt-0.5">Caracteres</p>
                </div>
                <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/60 text-center">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {totalMistakes}
                  </span>
                  <p className="text-xs text-stone-500 font-medium mt-0.5">Errores de trazo</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleRestartAll}
                  className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-700 dark:text-stone-200 font-semibold text-sm transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Repetir</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-sm shadow-md transition-all"
                >
                  Continuar Chat
                </button>
              </div>
            </div>
          ) : (
            /* Active Character Practice */
            <>
              {/* Sentence View Header (when in 'sentence' mode) */}
              {mode === 'sentence' && (
                <div className="w-full mb-4 p-3 rounded-2xl bg-stone-100/90 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/60">
                  <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1 flex items-center justify-between">
                    <span>Oración corregida:</span>
                    <span>{currentIndex + 1} de {activeItems.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center text-lg leading-loose font-chinese">
                    {activeItems.map((item, idx) => {
                      const isActive = idx === currentIndex;
                      const isDone = completedCharIndices.has(idx);

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentIndex(idx)}
                          className={`relative px-1.5 py-0.5 rounded-lg transition-all flex flex-col items-center cursor-pointer ${
                            isActive
                              ? 'bg-rose-600 text-white font-bold shadow-md scale-110 ring-2 ring-rose-400'
                              : isDone
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                          }`}
                        >
                          {showTransliteration && item.pinyin && (
                            <span className="text-[10px] leading-none opacity-80 select-none">
                              {item.pinyin}
                            </span>
                          )}
                          <span>{item.char}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Character Header Info */}
              <div className="flex flex-col items-center mb-2">
                {/* Pinyin with tone marks */}
                {currentItem?.pinyin ? (
                  <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400 tracking-wider">
                    {currentItem.pinyin}
                  </span>
                ) : (
                  <span className="text-xs text-stone-400 font-medium">Escribe con el dedo o mouse</span>
                )}

                {/* Status badges */}
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    Carácter {currentIndex + 1} de {activeItems.length}
                  </span>
                  {currentItem?.isNewOrChanged && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/30">
                      Elemento corregido
                    </span>
                  )}
                  {isCharCompleted && (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>¡Correcto!</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Calligraphy Grid & Drawing Canvas */}
              <div
                className={`relative rounded-2xl p-1 transition-all duration-300 shadow-md ${
                  isMistakeFlash
                    ? 'ring-4 ring-rose-500 bg-rose-50 dark:bg-rose-950/40'
                    : isCharCompleted
                    ? 'ring-4 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-2 border-stone-300 dark:border-stone-700 bg-[#fffdf9] dark:bg-stone-900'
                }`}
              >
                {/* Traditional Chinese Rice Grid (米字格 - Mi Zi Ge) SVG background */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none stroke-rose-300/40 dark:stroke-rose-800/30"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <line x1="0" y1="0" x2="100" y2="100" strokeDasharray="3,3" strokeWidth="0.75" />
                  <line x1="0" y1="100" x2="100" y2="0" strokeDasharray="3,3" strokeWidth="0.75" />
                  <line x1="50" y1="0" x2="50" y2="100" strokeDasharray="3,3" strokeWidth="0.75" />
                  <line x1="0" y1="50" x2="100" y2="50" strokeDasharray="3,3" strokeWidth="0.75" />
                  <rect x="0" y="0" width="100" height="100" fill="none" strokeWidth="1.2" />
                </svg>

                {/* HanziWriter target element */}
                <div
                  ref={containerRef}
                  className="touch-none select-none cursor-crosshair flex items-center justify-center relative z-10"
                  style={{ touchAction: 'none' }}
                />
              </div>

              {/* Live Mistakes / Hint prompt */}
              <div className="h-6 mt-2 flex items-center justify-center">
                {charMistakes > 0 && !isCharCompleted && (
                  <span className="text-xs font-semibold text-rose-500 dark:text-rose-400">
                    Errores en este carácter: {charMistakes}
                  </span>
                )}
                {isCharCompleted && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    ¡Trazos completados! Pulsa Siguiente para avanzar.
                  </span>
                )}
              </div>

              {/* Hanzi Writer Tool Buttons */}
              <div className="flex items-center space-x-2 mt-2">
                <button
                  type="button"
                  onClick={handleAnimate}
                  disabled={isAnimating}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  title="Ver animación del orden de trazos"
                >
                  <Play className={`w-3.5 h-3.5 text-rose-500 ${isAnimating ? 'animate-pulse' : ''}`} />
                  <span>{isAnimating ? 'Animando...' : 'Ver trazos'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleHint}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  title="Mostrar pista del siguiente trazo"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pista</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetCurrent}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                  title="Borrar y reiniciar este carácter"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                  <span>Reiniciar</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer Navigation */}
        {!showSummary && (
          <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-900/80">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-200/50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            {/* Quick Character Thumbnails strip in 'words' mode */}
            <div className="flex items-center space-x-1 max-w-[50%] overflow-x-auto py-1 px-1">
              {activeItems.map((it, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-6 h-6 rounded-md text-xs font-bold transition-all flex items-center justify-center ${
                    idx === currentIndex
                      ? 'bg-rose-600 text-white shadow-xs'
                      : completedCharIndices.has(idx)
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-stone-200/60 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                  title={`Carácter: ${it.char}`}
                >
                  {it.char}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 shadow-xs ${
                isCharCompleted
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              <span>{currentIndex + 1 >= activeItems.length ? 'Finalizar' : 'Siguiente'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChineseWritingPractice;
