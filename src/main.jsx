import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SiteLanguageProvider } from './context/SiteLanguageContext.jsx';
import { AudioSettingsProvider } from './context/AudioSettingsContext.jsx';
import { SavedWordsProvider } from './context/SavedWordsContext.jsx';
import { ReaderSettingsProvider } from './context/ReaderSettingsContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LocalAudioImportProvider } from './context/LocalAudioImportContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <SiteLanguageProvider>
          <AudioSettingsProvider>
            <ReaderSettingsProvider>
              <SavedWordsProvider>
                <LocalAudioImportProvider>
                  <App />
                </LocalAudioImportProvider>
              </SavedWordsProvider>
            </ReaderSettingsProvider>
          </AudioSettingsProvider>
        </SiteLanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);
