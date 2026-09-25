import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { localAudioImportManager } from '../services/localAudioImportManager.js';

const LocalAudioImportContext = createContext(null);

export function LocalAudioImportProvider({ children }) {
  const [importState, setImportState] = useState(() => localAudioImportManager.getState());

  useEffect(() => {
    const unsubscribe = localAudioImportManager.subscribe((nextState) => {
      setImportState(nextState);
    });
    return unsubscribe;
  }, []);

  const startImport = useCallback(({ audioFile, targetLang, nativeLang }) => {
    return localAudioImportManager.startImport({ audioFile, targetLang, nativeLang });
  }, []);

  const cancelImport = useCallback(() => {
    localAudioImportManager.cancelImport();
  }, []);

  const clearTask = useCallback(() => {
    localAudioImportManager.clearTask();
  }, []);

  const setMinimized = useCallback((val) => {
    localAudioImportManager.setMinimized(val);
  }, []);

  const toggleMinimized = useCallback(() => {
    localAudioImportManager.toggleMinimized();
  }, []);

  const value = {
    ...importState,
    isImporting: importState.status === 'transcribing' || importState.status === 'loading-model',
    startImport,
    cancelImport,
    clearTask,
    setMinimized,
    toggleMinimized
  };

  return (
    <LocalAudioImportContext.Provider value={value}>
      {children}
    </LocalAudioImportContext.Provider>
  );
}

export function useLocalAudioImport() {
  const context = useContext(LocalAudioImportContext);
  if (!context) {
    throw new Error('useLocalAudioImport must be used within a LocalAudioImportProvider');
  }
  return context;
}
