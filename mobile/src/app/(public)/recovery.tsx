import { router } from 'expo-router';

import { useRecoveryMutations } from '@/features/account/queries';
import { RecoveryScreen } from '@/features/auth/recovery-screen';

export default function RecoveryRoute() {
  const mutations = useRecoveryMutations();
  return (
    <RecoveryScreen
      mutations={mutations}
      onBack={() => router.replace('/login')}
    />
  );
}
