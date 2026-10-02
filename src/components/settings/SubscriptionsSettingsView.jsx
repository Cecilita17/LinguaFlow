import React from 'react';
import { ArrowLeft, Check, Crown, Sparkles } from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

export function SubscriptionsSettingsView({ onBack, backToAccount = false }) {
  const { t } = useSiteLanguage();
  // Display copy only: these rows do not enforce subscription access or quotas.
  const plans = [
    {
      premium: false,
      name: t('subscriptions_free'),
      description: t('subscriptions_free_description'),
      benefits: [
        ['subscriptions_all_languages'],
        ['subscriptions_text_reader'],
        ['subscriptions_txt_import'],
        ['subscriptions_epub_reader'],
        ['subscriptions_tts'],
        ['subscriptions_saved_words', 'subscriptions_unlimited_words'],
        ['subscriptions_bookmarks', 'subscriptions_unlimited'],
        ['subscriptions_habit_tracker'],
        ['subscriptions_ai_chat', 'subscriptions_chat_limit'],
        ['subscriptions_live_call', 'subscriptions_call_limit'],
        ['subscriptions_youtube_reader', 'subscriptions_youtube_limit'],
        ['subscriptions_image_reader', 'subscriptions_image_limit'],
        ['subscriptions_ai_text', 'subscriptions_text_limit'],
        ['subscriptions_ai_translation', 'subscriptions_paragraph_limit'],
        ['subscriptions_ai_gloss', 'subscriptions_paragraph_limit']
      ]
    },
    {
      premium: true,
      name: t('subscriptions_premium'),
      description: t('subscriptions_premium_description'),
      benefits: [
        ['subscriptions_includes_free'],
        ['subscriptions_ai_chat', 'subscriptions_expanded'],
        ['subscriptions_live_call', 'subscriptions_expanded'],
        ['subscriptions_youtube_reader', 'subscriptions_expanded'],
        ['subscriptions_image_reader', 'subscriptions_expanded'],
        ['subscriptions_ai_translation', 'subscriptions_expanded'],
        ['subscriptions_ai_gloss', 'subscriptions_expanded'],
        ['subscriptions_ai_text', 'subscriptions_expanded'],
        ['subscriptions_epub_simplification'],
        ['subscriptions_audio_import'],
        ['subscriptions_large_documents']
      ]
    }
  ];

  return (
    <div className="space-y-6 pb-28 sm:pb-32 animate-fade-in">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-sm font-semibold hover:bg-[var(--surface-hover)] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        {t(backToAccount ? 'subscriptions_back_account' : 'back_to_settings')}
      </button>

      <header className="text-center py-4 sm:py-6">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-rose-500/15"><Crown className="w-7 h-7" /></div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"><Sparkles className="w-3.5 h-3.5" />{t('subscriptions_soon')}</span>
        <h1 className="text-2xl sm:text-3xl font-bold mt-3">{t('subscriptions_title')}</h1>
        <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-lg mx-auto mt-3 leading-relaxed">{t('subscriptions_intro')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {plans.map((plan) => (
          <article key={plan.name} className={`flex flex-col p-6 sm:p-7 rounded-3xl border ${plan.premium ? 'border-rose-400/70 ring-1 ring-rose-400/20 bg-gradient-to-br from-rose-500/10 via-[var(--surface-primary)] to-amber-500/10 shadow-lg shadow-rose-500/5' : 'border-[var(--border-primary)] bg-[var(--surface-primary)]'}`}>
            <div className="flex items-center gap-2"><h2 className="text-xl font-bold">{plan.name}</h2>{plan.premium && <Crown className="w-5 h-5 text-rose-500" />}</div>
            <p className="text-sm text-[var(--text-muted)] mt-2 min-h-12">{plan.description}</p>
            <div className="mt-5 mb-6">
              {plan.premium ? <><span className="text-4xl font-bold tracking-tight">13 <span className="text-lg font-semibold">USD</span></span><p className="text-sm text-[var(--text-muted)] mt-1">{t('subscriptions_month')}</p></> : <><span className="text-4xl font-bold tracking-tight">0 <span className="text-lg font-semibold">USD</span></span><p className="text-sm text-[var(--text-muted)] mt-1">{t('subscriptions_free_price')}</p></>}
            </div>
            <ul className="space-y-3 flex-1 mb-8">
              {plan.benefits.map(([featureKey, detailKey]) => (
                <li key={featureKey} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
                  <span className="min-w-0 flex-1">
                    <span className={featureKey === 'subscriptions_includes_free' ? 'font-semibold' : ''}>{t(featureKey)}</span>
                    {detailKey && <span className="block text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{t(detailKey)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" disabled className={`w-full rounded-2xl px-4 py-3 font-semibold text-sm cursor-not-allowed ${plan.premium ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white opacity-60' : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border-primary)]'}`}>{t(plan.premium ? 'subscriptions_cta' : 'subscriptions_free_cta')}</button>
          </article>
        ))}
      </div>
      <div className="text-xs text-[var(--text-muted)] text-center max-w-xl mx-auto space-y-2 leading-relaxed">
        <p>{t('subscriptions_new_content_notice')}</p>
        <p>{t('subscriptions_limits_renew')}</p>
        <p>{t('subscriptions_notice')}</p>
      </div>
    </div>
  );
}
