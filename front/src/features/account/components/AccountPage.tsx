import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BlueprintWorkspace } from '@/components/layouts/blueprint-workspace';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SpinnerInline } from '@/components/ui/spinner';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { useAccountQuery } from '../queries';
import { PasswordChangeForm } from './PasswordChangeForm';
import { ProfileForm } from './ProfileForm';
import { ResignationForm } from './ResignationForm';

export function AccountPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const accountQuery = useAccountQuery();
  const [noticeKey, setNoticeKey] = useState<TranslationKey>();

  useEffect(() => {
    if (accountQuery.isError) navigate('/', { replace: true });
  }, [accountQuery.isError, navigate]);

  return (
    <BlueprintWorkspace
      className="blueprint-account-workspace"
      header={
        <header className="blueprint-workspace-header">
          <div className="margins-page-gutter mx-auto flex max-w-6xl flex-col gap-6 py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="blueprint-unit-label">UNIT / ACCOUNT</span>
              <h1 className="font-display text-4xl font-semibold tracking-normal">
                {t('accountTitle')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                {t('accountSubtitle')}
              </p>
            </div>
            <Button onClick={() => navigate('/')} type="button" variant="outline">
              ← {t('accountBack')}
            </Button>
          </div>
        </header>
      }
      testAttributes={testAttr('account-page')}
    >
      <section className="margins-page-gutter margins-section-stack mx-auto grid max-w-6xl py-6">
        {noticeKey && (
          <Alert variant="success">
            <AlertDescription>{t(noticeKey)}</AlertDescription>
          </Alert>
        )}
        {accountQuery.isPending && (
          <section
            aria-live="polite"
            className="rounded border border-stone-300 bg-stone-50/80 p-4"
          >
            <SpinnerInline>{t('accountLoading')}</SpinnerInline>
          </section>
        )}
        {accountQuery.data && (
          <>
            <AccountSection
              description={t('accountProfileDescription')}
              title={t('accountProfileTitle')}
            >
              <ProfileForm
                account={accountQuery.data}
                onSaved={() => setNoticeKey('accountProfileSaved')}
              />
            </AccountSection>
            {accountQuery.data.authProvider === 'local' && (
              <AccountSection
                description={t('accountPasswordDescription')}
                title={t('accountPasswordTitle')}
              >
                <PasswordChangeForm />
              </AccountSection>
            )}
            <section
              className="rounded border border-red-300 bg-red-50/55 p-4 sm:p-5"
              {...testAttr('account-resignation-panel')}
            >
              <span className="blueprint-unit-label text-red-700">CAUTION / MEMBERSHIP</span>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal">
                {t('accountDangerTitle')}
              </h2>
              <div className="mt-3 grid gap-3 text-sm leading-6 text-stone-700">
                <p>{t('accountDangerDescription')}</p>
                <p>{t('accountDangerRetention')}</p>
                <p>
                  {t('accountContactPrefix')}{' '}
                  <Link className="font-medium underline" to="/contact">
                    {t('contactLink')}
                  </Link>
                </p>
              </div>
              <ResignationForm />
            </section>
          </>
        )}
      </section>
    </BlueprintWorkspace>
  );
}

function AccountSection({
  children,
  description,
  title,
}: PropsWithChildren<{ description: string; title: string }>) {
  return (
    <section className="rounded border border-stone-300 bg-stone-50/80 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.05)] sm:p-5">
      <header className="mb-5 border-b border-stone-200 pb-4">
        <h2 className="font-display text-2xl font-semibold tracking-normal">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
      </header>
      {children}
    </section>
  );
}
