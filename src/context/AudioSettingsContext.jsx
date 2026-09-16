import React, { createContext, useContext, useState } from 'react';

export const SPEECH_RATE_OPTIONS = [
  0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00,
  1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50
];
export const DEFAULT_SPEECH_RATE = 1.00;

/**
 * Maps the user-selected display speechRate to the internal SpeechSynthesisUtterance.rate.
 * 
 * Background & Rationale:
 * Web Speech API browsers (Chrome/Chromium, Edge, Safari) and underlying OS TTS engines
 * compress low rates heavily: raw rates between 0.60 and 0.95 often sound imperceptibly
 * different or too slow/unnatural, while sub-1.0 speeds lack a smooth, distinct graduation.
 * 
 * This mapping ensures:
 * - 1.00x is preserved exactly as 1.00 (natural normal speed).
 * - Rates < 1.00 scale smoothly and distinctly across [0.35, 0.94] so that 0.60x is clearly
 *   the slowest option, 0.65x is distinctly faster, up through 0.95x, in a monotonic, pleasant curve.
 * - Rates > 1.00 scale linearly from 1.00 to 1.50x.
 */
export function mapSpeechRateToUtteranceRate(displayRate) {
  const rate = typeof displayRate === 'number' && !isNaN(displayRate) ? displayRate : DEFAULT_SPEECH_RATE;
  
  if (Math.abs(rate - 1.0) < 0.001) {
    return 1.0;
  }
  
  if (rate < 1.0) {
    // Piecewise smooth expansion for slow speeds:
    // When displayRate = 0.60 -> utterance.rate = 0.35 (clearly distinct slow, natural cadence)
    // When displayRate = 1.00 -> utterance.rate = 1.00
    // Linear slope: 0.35 + ((rate - 0.60) / 0.40) * (1.00 - 0.35) = 0.35 + (rate - 0.60) * 1.625
    const mapped = 0.35 + ((rate - 0.60) / 0.40) * 0.65;
    return Math.round(Math.max(0.2, Math.min(1.0, mapped)) * 1000) / 1000;
  }
  
  // For rates > 1.0, preserve standard 1:1 speedup
  return Math.round(rate * 1000) / 1000;
}

export const STORAGE_KEY_RATE = 'linguaflow_global_speech_rate';
export const STORAGE_KEY_AUTOPLAY = 'linguaflow_auto_play_ai';
export const STORAGE_KEY_AUTOPLAY_READER = 'linguaflow_auto_play_text_reader';
export const STORAGE_KEY_WORD_HIGHLIGHT = 'linguaflow_word_highlight_v1';

const AudioSettingsContext = createContext({
  speechRate: DEFAULT_SPEECH_RATE,
  setSpeechRate: () => {},
  autoPlayAi: false,
  setAutoPlayAi: () => {},
  autoPlayTextReader: false,
  setAutoPlayTextReader: () => {},
  wordHighlightEnabled: true,
  setWordHighlightEnabled: () => {},
  speechRateOptions: SPEECH_RATE_OPTIONS
});

export function AudioSettingsProvider({ children }) {
  const [speechRate, setSpeechRateState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RATE);
      if (saved) {
        const val = parseFloat(saved);
        if (SPEECH_RATE_OPTIONS.includes(val)) return val;
      }
      const legacyConfig = localStorage.getItem('linguaflow_config');
      if (legacyConfig) {
        const parsed = JSON.parse(legacyConfig);
        if (parsed.speechRate) {
          const legacyRate = parseFloat(parsed.speechRate);
          if (SPEECH_RATE_OPTIONS.includes(legacyRate)) return legacyRate;
        }
      }
    } catch (e) {}
    return DEFAULT_SPEECH_RATE;
  });

  const [autoPlayAi, setAutoPlayAiState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AUTOPLAY) === 'true';
    } catch (e) {
      return false;
    }
  });

  const [autoPlayTextReader, setAutoPlayTextReaderState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AUTOPLAY_READER) === 'true';
    } catch (e) {
      return false;
    }
  });

  const [wordHighlightEnabled, setWordHighlightEnabledState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORD_HIGHLIGHT);
      if (saved !== null) {
        return saved === 'true';
      }
      const legacyConfig = localStorage.getItem('linguaflow_config');
      if (legacyConfig) {
        const parsed = JSON.parse(legacyConfig);
        if (typeof parsed.wordHighlightEnabled === 'boolean') {
          return parsed.wordHighlightEnabled;
        }
      }
    } catch (e) {}
    return true;
  });

  const setSpeechRate = (newRate) => {
    const rateNum = parseFloat(newRate);
    if (!isNaN(rateNum) && SPEECH_RATE_OPTIONS.includes(rateNum)) {
      setSpeechRateState(rateNum);
      try {
        localStorage.setItem(STORAGE_KEY_RATE, String(rateNum));
        const legacyConfig = localStorage.getItem('linguaflow_config');
        if (legacyConfig) {
          const parsed = JSON.parse(legacyConfig);
          parsed.speechRate = rateNum;
          localStorage.setItem('linguaflow_config', JSON.stringify(parsed));
        }
      } catch (e) {}
    }
  };

  const setAutoPlayAi = (newVal) => {
    setAutoPlayAiState((prev) => {
      const boolVal = typeof newVal === 'function' ? newVal(prev) : Boolean(newVal);
      try {
        localStorage.setItem(STORAGE_KEY_AUTOPLAY, boolVal ? 'true' : 'false');
      } catch (e) {}
      return boolVal;
    });
  };

  const setAutoPlayTextReader = (newVal) => {
    setAutoPlayTextReaderState((prev) => {
      const boolVal = typeof newVal === 'function' ? newVal(prev) : Boolean(newVal);
      try {
        localStorage.setItem(STORAGE_KEY_AUTOPLAY_READER, boolVal ? 'true' : 'false');
      } catch (e) {}
      return boolVal;
    });
  };

  const setWordHighlightEnabled = (newVal) => {
    setWordHighlightEnabledState((prev) => {
      const boolVal = typeof newVal === 'function' ? newVal(prev) : Boolean(newVal);
      try {
        localStorage.setItem(STORAGE_KEY_WORD_HIGHLIGHT, boolVal ? 'true' : 'false');
        const legacyConfig = localStorage.getItem('linguaflow_config');
        if (legacyConfig) {
          const parsed = JSON.parse(legacyConfig);
          parsed.wordHighlightEnabled = boolVal;
          localStorage.setItem('linguaflow_config', JSON.stringify(parsed));
        }
      } catch (e) {}
      return boolVal;
    });
  };

  return (
    <AudioSettingsContext.Provider
      value={{
        speechRate,
        setSpeechRate,
        autoPlayAi,
        setAutoPlayAi,
        autoPlayTextReader,
        setAutoPlayTextReader,
        wordHighlightEnabled,
        setWordHighlightEnabled,
        speechRateOptions: SPEECH_RATE_OPTIONS
      }}
    >
      {children}
    </AudioSettingsContext.Provider>
  );
}

export function useAudioSettings() {
  return useContext(AudioSettingsContext);
}
