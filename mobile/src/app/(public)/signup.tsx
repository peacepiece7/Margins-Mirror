import { router } from 'expo-router';

import { RegistrationScreen } from '@/features/auth/registration-screen';

export default function SignupRoute() {
  return (
    <RegistrationScreen
      onBack={() => router.replace('/login')}
      onOpenPrivacy={() => router.push('/privacy')}
      onOpenTerms={() => router.push('/terms')}
    />
  );
}
