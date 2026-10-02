import React from 'react';
import { ArrowLeft, BookOpen, ChevronDown, Globe, MessageCircle, FileText, Youtube, Image, Bookmark, Headphones, Mail, Gauge, Repeat2, Sparkles } from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

const TOPICS = [
  { id: 'start', icon: Globe },
  { id: 'chat', icon: MessageCircle },
  { id: 'text', icon: FileText },
  { id: 'epub', icon: BookOpen },
  { id: 'youtube', icon: Youtube },
  { id: 'image', icon: Image },
  { id: 'words', icon: Bookmark },
  { id: 'call', icon: Headphones }
];

export function TutorialSettingsView({ onBack }) {
  const { t } = useSiteLanguage();
  return (
    <div className="space-y-5 animate-fade-in text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-primary)]">
        <button type="button" onClick={onBack} className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] transition-colors flex items-center gap-2 text-xs sm:text-sm font-semibold cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {t('back_to_settings')}
        </button>
        <h1 className="flex items-center gap-2 text-base sm:text-lg font-bold">
          <BookOpen className="w-5 h-5 text-rose-500" aria-hidden="true" />
          {t('tutorial_title')}
        </h1>
      </div>

      <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/25">
        <h2 className="font-bold text-base sm:text-lg">{t('tutorial_welcome')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{t('tutorial_intro')}</p>
      </div>

      <div className="space-y-3">
        {TOPICS.map(({ id, icon: Icon }, index) => (
          <details key={id} open={index === 0 ? true : undefined} className="group rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm overflow-hidden">
            <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-3 p-4 sm:p-5 cursor-pointer hover:bg-[var(--surface-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300 flex items-center justify-center"><Icon className="w-5 h-5" aria-hidden="true" /></span>
              <span className="flex-1 min-w-0"><span className="block text-sm sm:text-base font-bold">{t(`tutorial_${id}_title`)}</span><span className="block mt-0.5 text-xs sm:text-sm text-[var(--text-muted)]">{t(`tutorial_${id}_description`)}</span></span>
              <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ol className="list-decimal pl-10 pr-5 sm:pl-12 pb-5 space-y-3 text-sm leading-relaxed text-[var(--text-secondary)] marker:font-bold marker:text-rose-500">
              {[1, 2, 3].map(step => <li key={step} className="pl-1">{t(`tutorial_${id}_step_${step}`)}</li>)}
            </ol>
          </details>
        ))}
      </div>

      <section className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
        <h2 className="font-bold text-sm sm:text-base mb-4">{t('tutorial_controls_title')}</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm text-[var(--text-secondary)]">
          {[[Gauge, 'speed'], [Repeat2, 'autoplay'], [Sparkles, 'gloss']].map(([Icon, id]) => (
            <div key={id} className="flex items-start gap-3"><Icon className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" aria-hidden="true" /><p>{t(`tutorial_control_${id}`)}</p></div>
          ))}
          <div className="flex items-start gap-3"><span className="shrink-0 text-rose-500 font-bold" aria-hidden="true">A文</span><p>{t('tutorial_control_interlinear')}</p></div>
        </div>
      </section>

      <section className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)]">
        <h2 className="font-bold text-sm sm:text-base">{t('support_title')}</h2>
        <p className="mt-2 mb-3 text-sm text-[var(--text-muted)]">{t('tutorial_support_hint')}</p>
        <a href="mailto:fceci.coder@gmail.com" className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
          <Mail className="w-5 h-5 shrink-0 text-rose-500" aria-hidden="true" />
          <span className="min-w-0"><span className="block text-sm font-semibold">{t('support_contact')}</span><span className="block text-xs text-[var(--text-muted)] break-all">fceci.coder@gmail.com</span></span>
        </a>
      </section>
    </div>
  );
}
