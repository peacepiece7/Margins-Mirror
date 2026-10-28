import { router } from 'expo-router';

import { LoginScreen } from '@/features/auth/login-screen';

export default function LoginRoute() {
  return (
    <LoginScreen
      onGoogleRegistration={() => router.push('/signup')}
      onOpenPrivacy={() => router.push('/privacy')}
      onOpenTerms={() => router.push('/terms')}
      onRecovery={() => router.push('/recovery')}
      onSignUp={() => router.push('/signup')}
    />
  );
}
