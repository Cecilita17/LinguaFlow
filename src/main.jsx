import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SiteLanguageProvider } from './context/SiteLanguageContext.jsx';
import { AudioSettingsProvider } from './context/AudioSettingsContext.jsx';
import { SavedWordsProvider } from './context/SavedWordsContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <SiteLanguageProvider>
        <AudioSettingsProvider>
          <SavedWordsProvider>
            <App />
          </SavedWordsProvider>
        </AudioSettingsProvider>
      </SiteLanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
