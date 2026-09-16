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
import { getLanguageMeta, LANGUAGE_FLAGS } from '../../constants/languages.js';

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

export function loadUnifiedHistory(isSpanish) {
  const historyItems = [];

  // 1. Gather existing chat conversations
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('linguaflow_chat_')) {
          const langCode = key.replace('linguaflow_chat_', '');
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
                  langName: langMeta.name || langCode.toUpperCase(),
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
        const langMeta = getLanguageMeta(call.lang);
        historyItems.push({
          id: call.id,
          type: 'call',
          lang: call.lang,
          langName: langMeta.name || call.lang.toUpperCase(),
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

  // Maintain local history state to reflect deletions immediately without reload
  const [historyItems, setHistoryItems] = useState(() => loadUnifiedHistory(isSpanish));

  useEffect(() => {
    setHistoryItems(loadUnifiedHistory(isSpanish));
  }, [isSpanish]);

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
            <span>{currentTargetMeta.name}</span>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
          {t('chat_hub_title')}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          {t('chat_hub_subtitle')}
        </p>
      </div>

      {/* 2. MAIN 2 ACTIONS WITH EQUAL VISUAL PROMINENCE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {/* ACTION 1: INICIAR CHAT */}
        <button
          type="button"
          onClick={onStartChat}
          className="group relative p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border-2 border-rose-500/40 hover:border-rose-500 text-left transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-rose-500/50 flex flex-col justify-between cursor-pointer active:scale-98"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/40 shrink-0 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] group-hover:text-rose-500 transition-colors">
                  {t('start_chat_action')}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                  TEXT
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">
                {t('start_chat_desc')}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-primary)]/60 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
            <span>{isSpanish ? 'Abrir conversación' : 'Open conversation'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* ACTION 2: INICIAR LLAMADA */}
        <button
          type="button"
          onClick={onStartCall}
          className="group relative p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border-2 border-emerald-500/40 hover:border-emerald-500 text-left transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-emerald-500/50 flex flex-col justify-between cursor-pointer active:scale-98"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 shrink-0 group-hover:scale-105 transition-transform">
              <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] group-hover:text-emerald-500 transition-colors">
                  {t('start_call_action')}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  VOICE
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">
                {t('start_call_desc')}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-primary)]/60 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>{isSpanish ? 'Iniciar llamada de voz' : 'Start voice call'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
