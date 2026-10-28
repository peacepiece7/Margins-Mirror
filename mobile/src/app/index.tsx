import { Redirect, router } from 'expo-router';

import { SessionRestoreScreen } from '@/features/auth/session-restore-screen';
import { useAuthSession } from '@/features/auth/session-provider';
import { WelcomeScreen } from '@/features/auth/welcome-screen';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { BrandedLaunchScreen } from '@/shared/ui';
import { useBrandedLaunch } from '@/shared/ui/use-branded-launch';

export default function IndexRoute() {
  const { status } = useAuthSession();
  const { t } = useI18n();
  const showBrandedLaunch = useBrandedLaunch(status === 'restoring');

  if (showBrandedLaunch) {
    return (
      <BrandedLaunchScreen
        appName={t('appName')}
        statusLabel={t('loadingSession')}
        tagline={t('welcomeTitle')}
      />
    );
  }
  if (status === 'restore-error') return <SessionRestoreScreen />;
  if (status === 'anonymous') {
    return (
      <WelcomeScreen
        onLogin={() => router.push('/login')}
        onOpenPrivacy={() => router.push('/privacy')}
        onOpenTerms={() => router.push('/terms')}
        onSignUp={() => router.push('/signup')}
      />
    );
  }
  if (status === 'consent-required') return <Redirect href="/consent" />;
  return <Redirect href="/library" />;
}
