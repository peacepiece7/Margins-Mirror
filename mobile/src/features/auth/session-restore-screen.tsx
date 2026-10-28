import { useState } from 'react';

import { useI18n } from '@/shared/i18n/i18n-provider';
import { Button, Notice, Screen } from '@/shared/ui';

import { useAuthSession } from './session-provider';

export function SessionRestoreScreen() {
  const { t } = useI18n();
  const { logout, retryRestore } = useAuthSession();
  const [clearing, setClearing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      await retryRestore();
    } finally {
      setRetrying(false);
    }
  }

  async function continueToLogin() {
    setClearing(true);
    try {
      await logout();
    } finally {
      setClearing(false);
    }
  }

  return (
    <Screen>
      <Notice title={t('sessionRestoreFailed')} tone="error">
        {t('networkError')}
      </Notice>
      <Button
        disabled={clearing}
        loading={retrying}
        onPress={() => void retry()}
        variant="primary"
      >
        {t('restoreSession')}
      </Button>
      <Button
        disabled={retrying}
        loading={clearing}
        onPress={() => void continueToLogin()}
        variant="outline"
      >
        {t('continueToLogin')}
      </Button>
    </Screen>
  );
}
