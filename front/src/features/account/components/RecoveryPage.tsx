import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { RecoveryForm } from './RecoveryForm';

export function RecoveryPage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <main
      className="blueprint-login-page margins-page-gutter grid min-h-screen place-items-center py-8 text-stone-950"
      {...testAttr('account-recovery-page')}
    >
      <section className="blueprint-auth-card relative grid w-full max-w-xl gap-6 rounded border border-stone-300 bg-stone-50/95 p-6 shadow-[0_24px_80px_rgba(23,23,23,0.10)] sm:p-8">
        <div className="absolute right-4 top-4">
          <Button
            aria-label={`${t('language')}: ${locale === 'ko' ? 'EN' : 'KO'}`}
            onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
            size="sm"
            type="button"
            variant="outline"
          >
            {locale.toUpperCase()}
          </Button>
        </div>
        <header className="pr-16">
          <span className="blueprint-unit-label">UNIT / ACCOUNT RECOVERY</span>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-normal">
            {t('recoveryTitle')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">{t('recoveryDescription')}</p>
        </header>
        <RecoveryForm />
        <Button asChild className="justify-start px-0" variant="link">
          <Link to="/">← {t('recoveryReturnLogin')}</Link>
        </Button>
      </section>
    </main>
  );
}
