import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { privacyApi } from '../api';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { markAuthSessionConsentSatisfied, writeAuthSession } from '@/lib/auth-session';
import { useI18n } from '@/lib/i18n';

const version = '2026-07-27';

export function ConsentPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const googleRegistration = searchParams.get('registration') === 'google';
  const [privacy, setPrivacy] = useState(false);
  const [ai, setAi] = useState(false);
  const [age, setAge] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (googleRegistration) return;
    void privacyApi
      .status()
      .then((status) => {
        if (!status.consentRequired) navigate('/', { replace: true });
      })
      .catch(() => navigate('/', { replace: true }));
  }, [googleRegistration, navigate]);

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      const request = {
        privacyPolicyAccepted: privacy,
        aiTransferAccepted: ai,
        ageOver14Confirmed: age,
        privacyPolicyVersion: version,
        aiTransferVersion: version,
      };
      if (googleRegistration) {
        writeAuthSession(await privacyApi.completeGoogleRegistration(request));
      } else {
        await privacyApi.grant(request);
        markAuthSessionConsentSatisfied();
      }
      navigate('/', { replace: true });
    } catch (cause) {
      setError(apiErrorMessage(cause, t, 'consentSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      className="margins-page-gutter mx-auto grid min-h-screen max-w-xl content-center gap-6 py-10"
      data-consent-page
    >
      <div>
        <h1 className="font-display text-4xl font-semibold">{t('consentTitle')}</h1>
        <p className="mt-3 leading-7 text-stone-600">{t('consentDescription')}</p>
      </div>
      <fieldset className="grid gap-4 rounded border border-stone-300 p-4 sm:p-5">
        <ConsentLine checked={privacy} onChange={setPrivacy}>
          {t('consentPrivacyPrefix')}{' '}
          <a className="underline" href="/privacy">
            {t('privacyPolicyTitle')}
          </a>{' '}
          {t('consentPrivacySuffix')}
        </ConsentLine>
        <ConsentLine checked={ai} onChange={setAi}>
          {t('consentAiTransfer')}
        </ConsentLine>
        <ConsentLine checked={age} onChange={setAge}>
          {t('consentAge')}
        </ConsentLine>
      </fieldset>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button disabled={saving || !privacy || !ai || !age} onClick={() => void submit()}>
        {t('consentContinue')}
      </Button>
      <p className="text-sm text-stone-600">
        {t('consentDeclinePrefix')}{' '}
        <a className="underline" href="/account">
          {t('consentAccountLink')}
        </a>
        {t('consentDeclineSuffix')}
      </p>
    </main>
  );
}

function ConsentLine({
  checked,
  children,
  onChange,
}: {
  checked: boolean;
  children: React.ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 leading-6">
      <Checkbox
        checked={checked}
        className="mt-1"
        onCheckedChange={(nextChecked) => onChange(nextChecked === true)}
      />
      <span>{children}</span>
    </label>
  );
}
