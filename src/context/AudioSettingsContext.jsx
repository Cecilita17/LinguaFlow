import React, { createContext, useContext, useState } from 'react';

export const SPEECH_RATE_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
export const DEFAULT_SPEECH_RATE = 1.0;

export const STORAGE_KEY_RATE = 'linguaflow_global_speech_rate';
export const STORAGE_KEY_AUTOPLAY = 'linguaflow_auto_play_ai';

const AudioSettingsContext = createContext({
  speechRate: DEFAULT_SPEECH_RATE,
  setSpeechRate: () => {},
  autoPlayAi: false,
  setAutoPlayAi: () => {},
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

  return (
    <AudioSettingsContext.Provider
      value={{
        speechRate,
        setSpeechRate,
        autoPlayAi,
        setAutoPlayAi,
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
