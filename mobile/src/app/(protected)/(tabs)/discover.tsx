import { router } from 'expo-router';

import { DiscoverScreen } from '@/features/books/discover-screen';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { useFlashAlert } from '@/shared/ui';

export default function DiscoverRoute() {
  const { t } = useI18n();
  const { showAlert } = useFlashAlert();
  return (
    <DiscoverScreen
      onOpenBook={(bookId) => router.push(`/books/${bookId}`)}
      onSaved={() => {
        showAlert({
          dismissLabel: t('dismissNotification'),
          message: t('bookAdded'),
          tone: 'success',
        });
        router.replace('/library');
      }}
    />
  );
}
