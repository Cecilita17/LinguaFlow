import React from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Calendar,
  Clock,
  BookOpen
} from 'lucide-react';
import { ChatMessage } from '../ChatMessage.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLanguageMeta, getLocalizedLanguageName } from '../../constants/languages.js';

export function ChatSessionDetailView({
  sessionData,
  nativeLang = 'es',
  onBack,
  onWordClick,
  onOpenGrammarBreakdown,
  onPlayAudio,
  showTransliteration = true
}) {
  const { t, isSpanish } = useSiteLanguage();

  if (!sessionData) return null;

  const targetLang = sessionData.targetLang || 'zh';
  const langMeta = getLanguageMeta(targetLang);
  const localizedLangName = getLocalizedLanguageName(targetLang, langMeta.name || targetLang, isSpanish);

  const messages = Array.isArray(sessionData.messages) ? sessionData.messages : [];

  const formatTimestamp = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return '';
    }
  };

  const formattedStartedAt = formatTimestamp(sessionData.startedAt);
  const formattedEndedAt = formatTimestamp(sessionData.endedAt);

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)] space-y-5 animate-fade-in">
      {/* 1. Header with Back button */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_hub') || (isSpanish ? 'Volver al Hub' : 'Back to Hub')}</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-wide">
            {isSpanish ? 'Conversación archivada' : 'Archived Chat'}
          </h2>
        </div>

        <div className="w-16" />
      </div>

      {/* 2. Metadata Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{langMeta.flag}</span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {localizedLangName}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {isSpanish ? 'Conversación de texto completada' : 'Completed text conversation'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {messages.length} {isSpanish ? 'mensajes' : 'messages'}
            </span>
            {sessionData.metadata?.level && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                {sessionData.metadata.level}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[var(--border-primary)] text-xs text-[var(--text-secondary)]">
          {formattedEndedAt && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>{isSpanish ? `Finalizada: ${formattedEndedAt}` : `Ended: ${formattedEndedAt}`}</span>
            </div>
          )}
          {formattedStartedAt && formattedStartedAt !== formattedEndedAt && (
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <Clock className="w-3.5 h-3.5" />
              <span>{isSpanish ? `Iniciada: ${formattedStartedAt}` : `Started: ${formattedStartedAt}`}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Messages List (Read-only) */}
      <div className="space-y-4">
        {messages.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-primary)]">
            <p>{isSpanish ? 'Esta conversación no contiene mensajes.' : 'This conversation has no messages.'}</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage
              key={msg.id || index}
              message={msg}
              targetLang={targetLang}
              nativeLang={nativeLang}
              showTransliteration={showTransliteration}
              onWordClick={onWordClick}
              onPlayAudio={onPlayAudio}
              onOpenGrammarBreakdown={onOpenGrammarBreakdown}
              onDeleteMessage={null}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ChatSessionDetailView;
