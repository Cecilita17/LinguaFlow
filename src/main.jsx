import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SiteLanguageProvider } from './context/SiteLanguageContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SiteLanguageProvider>
      <App />
    </SiteLanguageProvider>
  </React.StrictMode>,
);
