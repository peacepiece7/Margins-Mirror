import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';

import { BlueprintWorkspace } from '@/components/layouts/blueprint-workspace';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SpinnerInline } from '@/components/ui/spinner';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type { LoginResponse } from '@/types/api/auth';
import { testAttr } from '@/utils/testAttrs';

import { useAccountConsentStatusQuery, useAccountQuery } from '../queries';
import { PasswordChangeForm } from './PasswordChangeForm';
import { ProfileForm } from './ProfileForm';
import { ResignationForm } from './ResignationForm';

const AUTH_PROVIDER_LABELS: Record<string, TranslationKey> = {
  google: 'accountAuthProviderGoogle',
  local: 'accountAuthProviderLocal',
  'local+google': 'accountAuthProviderLocalGoogle',
  resigned: 'accountAuthProviderResigned',
};

const CONSENT_TYPE_LABELS: Record<string, TranslationKey> = {
  PRIVACY_POLICY: 'consentTypePrivacy',
  OPENAI_OVERSEAS_TRANSFER: 'consentTypeAiTransfer',
  AGE_OVER_14: 'consentTypeAge',
};

export function AccountPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const session = useOutletContext<LoginResponse | undefined>();
  const accountQuery = useAccountQuery();
  const consentQuery = useAccountConsentStatusQuery();
  const [noticeKey, setNoticeKey] = useState<TranslationKey>();
  const account = accountQuery.data;
  const localAccount = account?.authProvider.toLowerCase() === 'local';

  useEffect(() => {
    if (accountQuery.isError) navigate('/', { replace: true });
  }, [accountQuery.isError, navigate]);

  return (
    <BlueprintWorkspace
      className="blueprint-account-workspace"
      header={
        <header className="blueprint-workspace-header">
          <div className="margins-page-gutter mx-auto flex max-w-[90rem] flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="blueprint-unit-label">UNIT / ACCOUNT</span>
              <h1 className="font-display text-4xl font-semibold tracking-normal">
                {t('accountTitle')}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
                {t('accountSubtitle')}
              </p>
            </div>
            <Button onClick={() => navigate('/book/library')} type="button" variant="outline">
              ← {t('accountBack')}
            </Button>
          </div>
        </header>
      }
      testAttributes={testAttr('account-page')}
    >
      <section className="web-account-layout margins-page-gutter mx-auto grid max-w-[90rem]">
        <aside className="web-account-index">
          <span className="blueprint-unit-label">INDEX</span>
          <h2>{t('accountIndexTitle')}</h2>
          <nav aria-label={t('accountIndexTitle')}>
            <a href="#account-profile">{t('accountProfileTitle')}</a>
            <a href="#account-security">
              {localAccount ? t('accountPasswordTitle') : t('accountAuthProvider')}
            </a>
            <a href="#account-language">{t('language')}</a>
            <a href="#account-membership">{t('accountMembershipTitle')}</a>
            <a href="#account-privacy">{t('accountConsentSummaryTitle')}</a>
            <a className="is-danger" href="#account-danger">
              {t('accountDangerTitle')}
            </a>
          </nav>
        </aside>

        <div className="web-account-main">
          {noticeKey && (
            <Alert variant="success">
              <AlertDescription>{t(noticeKey)}</AlertDescription>
            </Alert>
          )}
          {accountQuery.isPending && (
            <section aria-live="polite" className="border border-stone-300 bg-stone-50/80 p-4">
              <SpinnerInline>{t('accountLoading')}</SpinnerInline>
            </section>
          )}
          {account && (
            <>
              <AccountSection
                description={t('accountProfileDescription')}
                id="account-profile"
                title={t('accountProfileTitle')}
              >
                <ProfileForm
                  account={account}
                  onSaved={() => setNoticeKey('accountProfileSaved')}
                />
              </AccountSection>
              <AccountSection
                description={
                  localAccount ? t('accountPasswordDescription') : t('accountSignInDescription')
                }
                id="account-security"
                title={localAccount ? t('accountPasswordTitle') : t('accountAuthProvider')}
              >
                {localAccount ? (
                  <PasswordChangeForm />
                ) : (
                  <p className="text-sm font-medium text-stone-700">
                    {t(
                      AUTH_PROVIDER_LABELS[account.authProvider.toLowerCase()] ??
                        'accountAuthProviderUnknown',
                    )}
                  </p>
                )}
              </AccountSection>
              <section
                className="web-account-danger border border-destructive/30 bg-destructive/5 p-4 sm:p-5"
                id="account-danger"
                {...testAttr('account-resignation-panel')}
              >
                <span className="blueprint-unit-label text-destructive">CAUTION / MEMBERSHIP</span>
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
        </div>

        <aside className="web-account-summary">
          <section id="account-membership">
            <span className="blueprint-unit-label">MEMBERSHIP</span>
            <h2>{t('accountMembershipTitle')}</h2>
            {session?.membershipTier && (
              <strong className="web-account-membership-badge">
                {session.membershipTier === 'PREMIUM'
                  ? t('accountMembershipPremium')
                  : t('accountMembershipFree')}
              </strong>
            )}
            <p>{t('accountMembershipDescription')}</p>
          </section>
          <section id="account-privacy">
            <span className="blueprint-unit-label">PRIVACY</span>
            <h2>{t('accountConsentSummaryTitle')}</h2>
            {consentQuery.isPending && <SpinnerInline>{t('accountLoading')}</SpinnerInline>}
            {consentQuery.isError && (
              <p className="text-sm text-destructive" role="alert">
                {t('consentStatusLoadFailed')}
              </p>
            )}
            {consentQuery.data && (
              <>
                <p>
                  {consentQuery.data.consentRequired
                    ? t('accountConsentActionNeeded')
                    : t('accountConsentCurrent')}
                </p>
                <dl className="web-account-consent-list">
                  {Object.entries(consentQuery.data.acceptedVersions).map(([type, version]) => (
                    <div key={type}>
                      <dt>{t(CONSENT_TYPE_LABELS[type] ?? 'accountConsentVersion')}</dt>
                      <dd>{version}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </section>
          <section>
            <span className="blueprint-unit-label">SUPPORT</span>
            <p>{t('accountSupportDescription')}</p>
            <Link className="web-account-support-link" to="/terms">
              {t('termsTitle')} →
            </Link>
            <Link className="web-account-support-link" to="/terms/history">
              {t('termsHistoryTitle')} →
            </Link>
            <Link className="web-account-support-link" to="/contact">
              {t('contactLink')} →
            </Link>
          </section>
        </aside>
      </section>
    </BlueprintWorkspace>
  );
}

function AccountSection({
  children,
  description,
  id,
  title,
}: PropsWithChildren<{ description: string; id: string; title: string }>) {
  return (
    <section className="web-account-section border border-stone-300 p-4 sm:p-5" id={id}>
      <header className="mb-5 border-b border-stone-200 pb-4">
        <h2 className="font-display text-2xl font-semibold tracking-normal">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
      </header>
      {children}
    </section>
  );
}
