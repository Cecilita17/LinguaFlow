import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SiteLanguageProvider } from './context/SiteLanguageContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <SiteLanguageProvider>
        <App />
      </SiteLanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
