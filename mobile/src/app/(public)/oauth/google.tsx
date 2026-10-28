import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuthSession } from '@/features/auth/session-provider';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { Button, LoadingState, Notice, Screen } from '@/shared/ui';

export default function GoogleOAuthCallbackRoute() {
  const { code, error } = useLocalSearchParams<{ code?: string | string[]; error?: string | string[] }>();
  const { completeGoogleOAuthCode } = useAuthSession();
  const { locale } = useI18n();
  const [failed, setFailed] = useState(false);
  const invalidCallback = typeof error === 'string' || typeof code !== 'string';

  useEffect(() => {
    if (typeof error === 'string' || typeof code !== 'string') return;
    void completeGoogleOAuthCode(code)
      .then((pending) => {
        if (pending) router.replace('/signup');
      })
      .catch(() => setFailed(true));
  }, [code, completeGoogleOAuthCode, error]);

  if (!invalidCallback && !failed) {
    return <LoadingState label={locale === 'ko' ? 'Google 로그인을 완료하고 있어요…' : 'Finishing Google sign-in…'} />;
  }

  return (
    <Screen>
      <Notice title={locale === 'ko' ? 'Google 로그인을 완료하지 못했습니다.' : 'Google sign-in could not be completed.'} tone="error" />
      <Button onPress={() => router.replace('/login')}>
        {locale === 'ko' ? '로그인으로 돌아가기' : 'Back to sign in'}
      </Button>
    </Screen>
  );
}
