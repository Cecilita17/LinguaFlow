import React, { useState, useEffect } from 'react';
import { X, Key, Gauge, Volume2, Save, Info, Check } from 'lucide-react';

export function SettingsModal({ isOpen, onClose, config, onSaveConfig }) {
  if (!isOpen) return null;

  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [level, setLevel] = useState(config.level || 'A2/B1');
  const [speechRate, setSpeechRate] = useState(config.speechRate || 0.95);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(config.apiKey || '');
      setLevel(config.level || 'A2/B1');
      setSpeechRate(config.speechRate || 0.95);
    }
  }, [isOpen, config]);

  const handleSave = () => {
    onSaveConfig({ apiKey: apiKey.trim(), level, speechRate: parseFloat(speechRate) });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#fffdfc] text-stone-900 w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 p-6 transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="text-lg font-bold text-stone-900 flex items-center space-x-2">
            <span>Ajustes de LinguaFlow</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 my-4 text-sm">
          {/* Gemini API Key */}
          <div>
            <label className="block font-semibold text-stone-800 mb-1 flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-rose-600" />
              <span>Google Gemini API Key (Opcional)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 outline-none focus:ring-2 focus:ring-rose-500 font-mono text-xs"
            />
            <div className="flex items-start space-x-1.5 mt-1.5 text-xs text-stone-600 bg-rose-50/80 p-2.5 rounded-xl border border-rose-100">
              <Info className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>
                  <strong>¿Quieres respuestas 100% generadas por IA en vivo?</strong> Obtén tu API Key gratis sin costo ni tarjeta en{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-600 hover:text-rose-700 underline font-bold"
                  >
                    Google AI Studio
                  </a>.
                </p>
                <p className="text-[11px] text-stone-500">
                  Tip: También puedes configurar <code className="bg-white px-1 py-0.5 rounded border text-rose-700 font-mono">GEMINI_API_KEY</code> en las Variables de Entorno de tu panel de <strong>Render</strong> para que todos tus celulares y dispositivos tengan IA automática sin tener que pegar la clave.
                </p>
              </div>
            </div>
          </div>

          {/* Proficiency Level */}
          <div>
            <label className="block font-semibold text-stone-800 mb-1 flex items-center space-x-1.5">
              <Gauge className="w-4 h-4 text-rose-600" />
              <span>Nivel de Dificultad</span>
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-stone-900 outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            >
              <option value="A1">A1 - Principiante (frases muy simples y cortas)</option>
              <option value="A2/B1">A2 / B1 - Intermedio cotidiano (Recomendado)</option>
              <option value="B2/C1">B2 / C1 - Avanzado y fluido</option>
            </select>
          </div>

          {/* Speech Rate */}
          <div>
            <label className="block font-semibold text-stone-800 mb-1 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Volume2 className="w-4 h-4 text-rose-600" />
                <span>Velocidad de Voz del Bot</span>
              </span>
              <span className="text-rose-700 font-bold">{speechRate}x</span>
            </label>
            <input
              type="range"
              min="0.6"
              max="1.3"
              step="0.05"
              value={speechRate}
              onChange={(e) => setSpeechRate(e.target.value)}
              className="w-full accent-rose-600"
            />
            <div className="flex justify-between text-[11px] text-stone-400 mt-0.5">
              <span>Lento (0.6x)</span>
              <span>Normal (0.95x)</span>
              <span>Rápido (1.3x)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-100 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-medium text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={savedSuccess}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-white font-semibold text-xs shadow-sm transition-all ${
              savedSuccess
                ? 'bg-emerald-600'
                : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Ajustes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
