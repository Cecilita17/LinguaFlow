import React, { createContext, useContext, useState } from 'react';

export const SPEECH_RATE_OPTIONS = [
  0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00,
  1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50
];
export const DEFAULT_SPEECH_RATE = 1.00;

export const STORAGE_KEY_RATE = 'linguaflow_global_speech_rate';
export const STORAGE_KEY_AUTOPLAY = 'linguaflow_auto_play_ai';
export const STORAGE_KEY_AUTOPLAY_READER = 'linguaflow_auto_play_text_reader';

const AudioSettingsContext = createContext({
  speechRate: DEFAULT_SPEECH_RATE,
  setSpeechRate: () => {},
  autoPlayAi: false,
  setAutoPlayAi: () => {},
  autoPlayTextReader: false,
  setAutoPlayTextReader: () => {},
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

  return (
    <AudioSettingsContext.Provider
      value={{
        speechRate,
        setSpeechRate,
        autoPlayAi,
        setAutoPlayAi,
        autoPlayTextReader,
        setAutoPlayTextReader,
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
