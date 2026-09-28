import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Mic,
  PhoneCall,
  Sparkles,
  ArrowRight,
  Clock,
  Calendar,
  ChevronRight,
  Languages,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLanguageMeta, getLocalizedLanguageName, LANGUAGE_FLAGS } from '../../constants/languages.js';

const CALL_STORAGE_KEY = 'linguaflow_call_history';

// Default mock call history for demonstration without interfering with real chat storage
const DEFAULT_CALL_HISTORY = [
  {
    id: 'call-demo-1',
    type: 'call',
    lang: 'zh',
    date: 'Hoy, 18:12',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    duration: '04:25',
    summary: 'Práctica de tonos y saludos cotidianos en Pekín',
    transcript: [
      { sender: 'user', text: '你好！今天天气怎么样？' },
      { sender: 'bot', text: '今天北京天气很好，阳光明媚。你想去公园散步吗？' }
    ]
  },
  {
    id: 'call-demo-2',
    type: 'call',
    lang: 'de',
    date: 'Ayer, 20:15',
    timestamp: Date.now() - 1000 * 60 * 60 * 26,
    duration: '06:10',
    summary: 'Conversación sobre planes de viaje y trenes en Alemania',
    transcript: [
      { sender: 'user', text: 'Guten Tag! Ich möchte eine Fahrkarte nach Berlin kaufen.' },
      { sender: 'bot', text: 'Sehr gerne! Möchten Sie mit dem ICE fahren oder mit der Regionalbahn?' }
    ]
  }
];

export function loadUnifiedHistory(isSpanish, targetLang = '') {
  const historyItems = [];
  const selectedLanguage = String(targetLang || '').toLowerCase();

  // 1. Gather existing chat conversations
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('linguaflow_chat_')) {
          const langCode = key.replace('linguaflow_chat_', '');
          if (selectedLanguage && langCode.toLowerCase() !== selectedLanguage) continue;
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const lastMsg = parsed[parsed.length - 1];
                const langMeta = getLanguageMeta(langCode);
                const msgCount = parsed.length;

                historyItems.push({
                  id: `chat-${langCode}`,
                  type: 'chat',
                  lang: langCode,
                  langName: getLocalizedLanguageName(langCode, langMeta.name || langCode.toUpperCase(), isSpanish),
                  flag: langMeta.flag || LANGUAGE_FLAGS[langCode] || '🌐',
                  lastMessage: lastMsg?.text || (isSpanish ? 'Conversación activa' : 'Active conversation'),
                  date: isSpanish ? 'Conversación guardada' : 'Saved conversation',
                  timestamp: lastMsg?.id ? parseInt(lastMsg.id.replace(/\D/g, '')) || Date.now() : Date.now(),
                  msgCount
                });
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 2. Gather call sessions from separate call storage or defaults
    try {
      let storedCalls = [];
      const rawCalls = localStorage.getItem(CALL_STORAGE_KEY);
      if (rawCalls) {
        try {
          storedCalls = JSON.parse(rawCalls) || [];
        } catch (err) {
          storedCalls = [];
        }
      }

      storedCalls.forEach((call) => {
        if (selectedLanguage && String(call.lang || '').toLowerCase() !== selectedLanguage) return;
        const langMeta = getLanguageMeta(call.lang);
        historyItems.push({
          id: call.id,
          type: 'call',
          lang: call.lang,
          langName: getLocalizedLanguageName(call.lang, langMeta.name || call.lang.toUpperCase(), isSpanish),
          flag: langMeta.flag || LANGUAGE_FLAGS[call.lang] || '🌐',
          lastMessage: call.summary || (isSpanish ? `Llamada de voz (${call.duration})` : `Voice call (${call.duration})`),
          date: call.date || (isSpanish ? 'Llamada reciente' : 'Recent call'),
          duration: call.duration,
          timestamp: call.timestamp || 0,
          callData: call
        });
      });
    } catch (e) {}
  }

  // Sort by most recent
  historyItems.sort((a, b) => b.timestamp - a.timestamp);

  return historyItems;
}

export function ChatHubView({
  targetLang,
  setTargetLang,
  languages = [],
  onStartChat,
  onStartCall,
  onOpenChatSession,
  onOpenCallDetail,
  onDeleteChatSession,
  onDeleteCallSession
}) {
  const { t, isSpanish } = useSiteLanguage();
  const currentTargetMeta = getLanguageMeta(targetLang);
  const currentTargetName = getLocalizedLanguageName(targetLang, currentTargetMeta.name || targetLang, isSpanish);

  // Maintain local history state to reflect deletions immediately without reload
  const [historyItems, setHistoryItems] = useState(() => loadUnifiedHistory(isSpanish, targetLang));

  useEffect(() => {
    setHistoryItems(loadUnifiedHistory(isSpanish, targetLang));
  }, [isSpanish, targetLang]);

  const handleDeleteItem = useCallback((e, item) => {
    e.stopPropagation();

    const confirmMsg = t('confirm_delete_chat') || (isSpanish
      ? '¿Eliminar este chat del historial?'
      : 'Delete this chat from history?');

    if (window.confirm(confirmMsg)) {
      if (item.type === 'chat') {
        try {
          localStorage.removeItem(`linguaflow_chat_${item.lang}`);
        } catch (err) {
          console.warn('Failed to remove chat from localStorage:', err);
        }
        if (onDeleteChatSession) {
          onDeleteChatSession(item.lang);
        }
      } else if (item.type === 'call') {
        try {
          const raw = localStorage.getItem(CALL_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) || [];
            const filtered = parsed.filter((c) => c.id !== item.id);
            localStorage.setItem(CALL_STORAGE_KEY, JSON.stringify(filtered));
          }
        } catch (err) {
          console.warn('Failed to remove call from localStorage:', err);
        }
        if (onDeleteCallSession) {
          onDeleteCallSession(item.id);
        }
      }

      setHistoryItems((prev) => prev.filter((h) => h.id !== item.id));
    }
  }, [isSpanish, t, onDeleteChatSession, onDeleteCallSession]);

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)] space-y-6">
      {/* 1. Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSpanish ? 'Centro de Práctica Oral y Escrita' : 'Voice & Chat Practice Hub'}</span>
          </span>

          <div className="flex items-center space-x-2 text-xs font-bold text-[var(--text-secondary)]">
            <span className="text-base">{currentTargetMeta.flag}</span>
            <span>{currentTargetName}</span>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
          {t('chat_hub_title')}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          {t('chat_hub_subtitle')}
        </p>
      </div>

      {/* 2. MAIN 2 ACTIONS WITH EQUAL VISUAL PROMINENCE (Side-by-side on all screen sizes) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
        {/* ACTION 1: INICIAR CHAT */}
        <button
          type="button"
          onClick={onStartChat}
          className="group relative p-4 sm:p-6 rounded-3xl bg-white/70 dark:bg-white/[0.04] hover:bg-white/90 dark:hover:bg-white/[0.07] backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-rose-500/30 dark:hover:border-rose-500/30 text-left transition-all duration-300 shadow-sm hover:shadow-lg sm:hover:-translate-y-0.5 cursor-pointer active:scale-[0.99] overflow-hidden flex flex-col justify-between min-h-[150px] sm:min-h-[180px]"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-rose-500/20 transition-all duration-500" />

          {/* Top Row: Icon & Subtle Arrow */}
          <div className="relative flex items-center justify-between w-full">
            <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-xs group-hover:scale-105 transition-transform duration-300 shrink-0">
              <MessageSquare className="w-5 h-5 sm:w-8 sm:h-8" />
            </div>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center text-[var(--text-muted)] group-hover:text-rose-600 dark:group-hover:text-rose-400 group-hover:border-rose-500/30 group-hover:bg-rose-500/10 transition-all duration-300 shrink-0">
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>

          {/* Typography */}
          <div className="relative mt-3 sm:mt-5 space-y-1">
            <h2 className="text-sm sm:text-lg font-bold sm:font-extrabold text-[var(--text-primary)] group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors leading-snug">
              {t('start_chat_action')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {t('start_chat_desc')}
            </p>
          </div>
        </button>

        {/* ACTION 2: INICIAR LLAMADA */}
        <button
          type="button"
          onClick={onStartCall}
          className="group relative p-4 sm:p-6 rounded-3xl bg-white/70 dark:bg-white/[0.04] hover:bg-white/90 dark:hover:bg-white/[0.07] backdrop-blur-xl border border-black/5 dark:border-white/10 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 text-left transition-all duration-300 shadow-sm hover:shadow-lg sm:hover:-translate-y-0.5 cursor-pointer active:scale-[0.99] overflow-hidden flex flex-col justify-between min-h-[150px] sm:min-h-[180px]"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500" />

          {/* Top Row: Icon & Subtle Arrow */}
          <div className="relative flex items-center justify-between w-full">
            <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs group-hover:scale-105 transition-transform duration-300 shrink-0">
              <Mic className="w-5 h-5 sm:w-8 sm:h-8" />
            </div>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center text-[var(--text-muted)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 transition-all duration-300 shrink-0">
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>

          {/* Typography */}
          <div className="relative mt-3 sm:mt-5 space-y-1">
            <h2 className="text-sm sm:text-lg font-bold sm:font-extrabold text-[var(--text-primary)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
              {t('start_call_action')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {t('start_call_desc')}
            </p>
          </div>
        </button>
      </div>

      {/* 3. HISTORIAL SECTION */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-500" />
            <span>{t('chat_history_title')}</span>
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">
            {historyItems.length} {isSpanish ? 'registros' : 'items'}
          </span>
        </div>

        {historyItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-primary)] p-6">
            <p>{t('chat_history_empty')}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {historyItems.map((item) => {
              const isChat = item.type === 'chat';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isChat) {
                      onOpenChatSession(item.lang);
                    } else {
                      onOpenCallDetail(item.callData);
                    }
                  }}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] hover:border-rose-500/40 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99]"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    {/* Type & Lang Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                        isChat
                          ? 'bg-gradient-to-tr from-rose-500 to-pink-500'
                          : 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                      }`}
                    >
                      {isChat ? <MessageSquare className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </div>

                    {/* Metadata & Snippet */}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-rose-500 transition-colors flex items-center gap-1.5">
                          <span>{item.flag}</span>
                          <span>{item.langName}</span>
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold border ${
                            isChat
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                          }`}
                        >
                          {isChat ? t('history_type_chat') : t('history_type_call')}
                        </span>
                        {item.duration && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            {item.duration}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] truncate leading-snug">
                        {item.lastMessage}
                      </p>
                    </div>
                  </div>

                  {/* Right: Date, Delete Button & Chevron */}
                  <div className="flex items-center space-x-2 shrink-0 text-right">
                    <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline font-mono">
                      {item.date}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteItem(e, item)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer active:scale-90"
                      title={t('delete_chat') || (isSpanish ? 'Eliminar chat' : 'Delete chat')}
                      aria-label={t('delete_chat') || (isSpanish ? 'Eliminar chat' : 'Delete chat')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatHubView;
