import { Link } from 'react-router-dom';

import { useI18n } from '@/lib/i18n';

export function TermsHistoryPage() {
  const { t } = useI18n();

  return (
    <main
      className="margins-page-gutter mx-auto min-h-screen max-w-3xl py-10 text-stone-800"
      data-service-terms-history-page
    >
      <Link className="text-sm underline" to="/terms">
        {t('termsHistoryCurrent')}
      </Link>
      <h1 className="mt-4 font-display text-4xl font-semibold">{t('termsHistoryTitle')}</h1>
      <section className="mt-8 rounded border border-stone-300 p-4 sm:p-5">
        <h2 className="text-xl font-semibold">{t('termsHistoryEmptyTitle')}</h2>
        <p className="mt-3 leading-7">{t('termsHistoryEmptyBody')}</p>
      </section>
      <nav aria-label={t('termsRelatedDocuments')} className="mt-8 grid gap-3">
        <Link className="underline" to="/privacy">
          {t('privacyPolicyTitle')}
        </Link>
        <Link className="underline" to="/contact">
          {t('contactLink')}
        </Link>
      </nav>
    </main>
  );
}
