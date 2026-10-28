import { Link } from 'react-router-dom';

import { useI18n } from '@/lib/i18n';

export function TermsPage() {
  const { t } = useI18n();

  return (
    <main
      className="margins-page-gutter mx-auto min-h-screen max-w-3xl py-10 text-stone-800"
      data-service-terms-page
    >
      <header className="border-b border-stone-300 pb-6">
        <Link className="text-sm underline" to="/">
          {t('termsBackHome')}
        </Link>
        <h1 className="mt-4 font-display text-4xl font-semibold">{t('termsTitle')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('termsPublicationStatus')}</p>
      </header>
      <div className="grid gap-8 py-8 leading-7">
        <section className="rounded border border-stone-300 p-4 sm:p-5">
          <h2 className="mb-2 text-xl font-semibold">{t('termsPendingTitle')}</h2>
          <p>{t('termsPendingBody')}</p>
          <p className="mt-3 text-sm text-stone-600">{t('termsNoAcceptance')}</p>
        </section>
        <nav aria-label={t('termsRelatedDocuments')} className="grid gap-3">
          <Link className="underline" to="/terms/history">
            {t('termsViewHistory')}
          </Link>
          <Link className="underline" to="/privacy">
            {t('privacyPolicyTitle')}
          </Link>
          <Link className="underline" to="/contact">
            {t('contactLink')}
          </Link>
        </nav>
      </div>
    </main>
  );
}
