import { router, useLocalSearchParams } from 'expo-router';

import { LibraryScreen } from '@/features/books/library-screen';
import { useI18n } from '@/shared/i18n/i18n-provider';

type BookSelectionAction = 'debate' | 'study';

function bookSelectionAction(value: string | undefined): BookSelectionAction | undefined {
  return value === 'debate' || value === 'study' ? value : undefined;
}

export default function LibraryRoute() {
  const { t } = useI18n();
  const { action, added } = useLocalSearchParams<{
    action?: string;
    added?: string;
  }>();
  const selectionAction = bookSelectionAction(action);
  const selectionPrompt = selectionAction === 'debate'
    ? t('selectBookForDebate')
    : selectionAction === 'study'
      ? t('selectBookForStudy')
      : undefined;
  return (
    <LibraryScreen
      key={`${added === '1' ? 'saved' : 'default'}-${selectionAction ?? 'open'}`}
      onDismissSaved={() => router.setParams({ added: undefined })}
      onOpenBook={(book) => {
        if (selectionAction === 'study') {
          router.push(`/memory-cards?bookId=${book.bookId}`);
          return;
        }
        if (selectionAction) {
          router.push(`/books/${book.bookId}?intent=${selectionAction}`);
          return;
        }
        router.push(`/books/${book.bookId}`);
      }}
      onOpenReviews={() => router.push('/reviews')}
      saved={added === '1'}
      selectionPrompt={selectionPrompt}
    />
  );
}
