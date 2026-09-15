import React from 'react';
import {
  ArrowLeft,
  Mic,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLanguageMeta } from '../../constants/languages.js';

export function CallDetailView({
  callData,
  onBack
}) {
  const { t, isSpanish } = useSiteLanguage();
  const langMeta = getLanguageMeta(callData?.lang || 'es');

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)] space-y-6 animate-fade-in">
      {/* 1. Header with Back button */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_hub')}</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
            <Mic className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-wide">
            {t('call_detail_title')}
          </h2>
        </div>

        <div className="w-20" />
      </div>

      {/* 2. Metadata Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{langMeta.flag}</span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {langMeta.name}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {callData?.summary || (isSpanish ? 'Llamada de voz completada' : 'Completed voice call')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{callData?.duration || '00:00'}</span>
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{callData?.date || (isSpanish ? 'Hoy' : 'Today')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Transcription Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
        <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-rose-500" />
          <span>{t('call_detail_transcript_title')}</span>
        </h4>

        {callData?.transcript && callData.transcript.length > 0 ? (
          <div className="space-y-3">
            {callData.transcript.map((line, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  line.sender === 'user'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-[var(--text-primary)] ml-6'
                    : 'bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] mr-6'
                }`}
              >
                <span className="font-bold text-[10px] text-rose-600 dark:text-rose-400 block mb-0.5">
                  {line.sender === 'user' ? (isSpanish ? 'Tú:' : 'You:') : 'LinguaFlow AI:'}
                </span>
                <p>{line.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-primary)] p-4">
            <p>{isSpanish ? 'No se registró transcripción para esta llamada.' : 'No transcript recorded for this call.'}</p>
          </div>
        )}
      </div>

      {/* 4. Learned Vocabulary & Corrections Section (Placeholder Foundation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-3">
          <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-rose-500" />
            <span>{t('call_detail_vocab_title')}</span>
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            {isSpanish
              ? 'Las palabras practicadas en las llamadas se sincronizarán aquí automáticamente.'
              : 'Vocabulary practiced during voice calls will be automatically recorded here.'}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-3">
          <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-500" />
            <span>{t('call_detail_corrections_title')}</span>
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            {isSpanish
              ? 'Retroalimentación y sugerencias fonéticas registradas de la llamada.'
              : 'Feedback and phonetic suggestions recorded from the call.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default CallDetailView;
