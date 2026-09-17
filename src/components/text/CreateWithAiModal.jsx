import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  BookOpen,
  Sliders,
  Layers,
  FileText
} from 'lucide-react';
import { LANGUAGE_METADATA } from '../../constants/languages.js';
import { generateAiTextDocument } from '../../services/textDocumentService.js';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

export function CreateWithAiModal({
  isOpen,
  onClose,
  targetLang = 'es',
  apiKey = '',
  onTextGenerated
}) {
  const { isSpanish } = useSiteLanguage();
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('B1');
  const [length, setLength] = useState('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const langMeta = LANGUAGE_METADATA[targetLang] || {
    name: targetLang.toUpperCase(),
    nativeName: targetLang.toUpperCase(),
    flag: '🌐'
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError(isSpanish ? 'Por favor escribe un tema o idea para el texto.' : 'Please enter a topic or prompt for the text.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateAiTextDocument({
        topic: trimmedTopic,
        targetLang,
        level,
        length,
        apiKey
      });

      if (result && result.text) {
        if (onTextGenerated) {
          onTextGenerated({
            title: result.title || trimmedTopic,
            text: result.text
          });
        }
        onClose();
      }
    } catch (err) {
      console.error('[CreateWithAiModal] Generation error:', err);
      setError(err.message || (isSpanish ? 'No se pudo generar el texto con IA.' : 'Failed to generate text with AI.'));
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = isSpanish
    ? [
        'Un día en una cafetería',
        'Mi primer viaje al extranjero',
        'Una conversación sobre planes del fin de semana',
        'El misterio del reloj antiguo',
        'Tecnología e inteligencia artificial en la vida diaria'
      ]
    : [
        'A day at a cozy coffee shop',
        'My first trip abroad',
        'A casual chat about weekend plans',
        'The mystery of the antique watch',
        'Technology and AI in daily life'
      ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative text-[var(--text-primary)] transition-all">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer disabled:opacity-50"
          title={isSpanish ? 'Cerrar' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-rose-500 to-amber-400 flex items-center justify-center shadow-md shadow-rose-950/40 text-white shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span>{isSpanish ? 'Crear texto con IA' : 'Create text with AI'}</span>
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-0.5">
              <span>{isSpanish ? 'Idioma de aprendizaje:' : 'Target language:'}</span>
              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <span>{langMeta.flag}</span>
                <span>{langMeta.name || langMeta.nativeName}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Topic / Prompt Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              {isSpanish ? 'Tema o descripción del texto' : 'Topic or prompt'}
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isLoading}
              placeholder={
                isSpanish
                  ? `Describe de qué quieres que trate el texto (ej: "Una historia corta sobre dos amigos que se reencuentran en la estación")...`
                  : `Describe what the text should be about (e.g. "A short story about two friends reuniting at the train station")...`
              }
              className="w-full p-3.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--input-border)] focus:border-rose-500 focus:outline-hidden text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm leading-relaxed transition-all resize-none shadow-xs"
            />
          </div>

          {/* Quick suggestions pills */}
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1.5">
              {isSpanish ? 'Ideas sugeridas:' : 'Quick ideas:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.slice(0, 3).map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setTopic(prompt)}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer truncate max-w-full text-left"
                >
                  💡 {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Options: Level & Length */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Level Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                {isSpanish ? 'Nivel' : 'Level'}
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-xs font-semibold focus:border-rose-500 focus:outline-hidden transition-all cursor-pointer"
              >
                <option value="A1-A2">{isSpanish ? 'Principiante (A1-A2)' : 'Beginner (A1-A2)'}</option>
                <option value="B1">{isSpanish ? 'Intermedio (B1)' : 'Intermediate (B1)'}</option>
                <option value="B2">{isSpanish ? 'Intermedio Alto (B2)' : 'Upper Intermediate (B2)'}</option>
                <option value="C1">{isSpanish ? 'Avanzado (C1)' : 'Advanced (C1)'}</option>
              </select>
            </div>

            {/* Length Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                {isSpanish ? 'Longitud' : 'Length'}
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-xs font-semibold focus:border-rose-500 focus:outline-hidden transition-all cursor-pointer"
              >
                <option value="short">{isSpanish ? 'Corto (~150 palabras)' : 'Short (~150 words)'}</option>
                <option value="medium">{isSpanish ? 'Medio (~300 palabras)' : 'Medium (~300 words)'}</option>
                <option value="long">{isSpanish ? 'Largo (~500 palabras)' : 'Long (~500 words)'}</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {isSpanish ? 'Cancelar' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center space-x-2 transition-all cursor-pointer ${
                isLoading || !topic.trim()
                  ? 'bg-rose-500/50 text-white/70 cursor-not-allowed opacity-70'
                  : 'bg-gradient-to-r from-purple-600 via-rose-500 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-rose-950/40 active:scale-95'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isSpanish ? 'Generando texto...' : 'Generating text...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isSpanish ? 'Generar texto' : 'Generate text'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default CreateWithAiModal;
