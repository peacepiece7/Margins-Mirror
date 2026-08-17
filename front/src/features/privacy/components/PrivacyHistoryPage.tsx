import { Link } from 'react-router-dom';

import { useI18n } from '@/lib/i18n';

export function PrivacyHistoryPage() {
  const { t } = useI18n();
  return (
    <main
      className="margins-page-gutter mx-auto min-h-screen max-w-3xl py-10"
      data-privacy-history-page
    >
      <Link className="text-sm underline" to="/privacy">
        {t('privacyHistoryCurrent')}
      </Link>
      <h1 className="mt-4 font-display text-4xl font-semibold">{t('privacyHistoryTitle')}</h1>
      <article className="mt-8 rounded border border-stone-300 p-4 sm:p-5">
        <h2 className="text-xl font-semibold">2026-07-27</h2>
        <p className="mt-2 text-sm text-stone-600">{t('privacyHistoryInitial')}</p>
        <p className="mt-4 leading-7">{t('privacyHistoryFirstPublished')}</p>
        <Link className="mt-3 inline-block underline" to="/privacy?version=2026-07-27">
          {t('privacyHistoryVersionLink')}
        </Link>
      </article>
    </main>
  );
}
