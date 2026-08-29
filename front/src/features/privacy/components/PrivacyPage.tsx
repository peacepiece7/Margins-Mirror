import { Link } from 'react-router-dom';

import { useI18n } from '@/lib/i18n';

export function PrivacyPage() {
  const { t } = useI18n();
  return (
    <main
      className="margins-page-gutter mx-auto min-h-screen max-w-3xl py-10 text-stone-800"
      data-privacy-page
    >
      <header className="border-b border-stone-300 pb-6">
        <Link className="text-sm underline" to="/">
          {t('privacyBackHome')}
        </Link>
        <h1 className="mt-4 font-display text-4xl font-semibold">{t('privacyPolicyTitle')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('privacyEffectiveVersion')}</p>
      </header>
      <div className="grid gap-8 py-8 leading-7">
        <PolicySection title={t('privacySectionContactTitle')}>
          {t('privacySectionContactBody')}
        </PolicySection>
        <PolicySection title={t('privacySectionCollectionTitle')}>
          {t('privacySectionCollectionBody')}
        </PolicySection>
        <PolicySection title={t('privacySectionTransferTitle')}>
          {t('privacySectionTransferBody')}
        </PolicySection>
        <PolicySection title={t('privacySectionStorageTitle')}>
          {t('privacySectionStorageBody')}
        </PolicySection>
        <PolicySection title={t('privacySectionRetentionTitle')}>
          {t('privacySectionRetentionBody')}
        </PolicySection>
        <PolicySection title={t('privacySectionSecurityTitle')}>
          {t('privacySectionSecurityBody')}
        </PolicySection>
        <p>
          <Link className="underline" to="/privacy/history">
            {t('privacyViewHistory')}
          </Link>
        </p>
        <p>
          <Link className="underline" to="/contact">
            {t('contactLink')}
          </Link>
        </p>
      </div>
    </main>
  );
}

function PolicySection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
