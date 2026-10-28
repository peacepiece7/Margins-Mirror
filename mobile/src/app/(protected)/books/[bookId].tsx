import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { BookDetailScreen } from '@/features/books/book-detail-screen';
import { bookDebateRoute } from '@/features/books/book-detail-navigation';
import { useBookReadingSession } from '@/features/reading-sessions/queries';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { Button, LoadingState, Notice, Screen } from '@/shared/ui';

type BookIntent = 'debate' | 'reflection';

function bookIntent(value: string | undefined): BookIntent | undefined {
  return value === 'debate' || value === 'reflection' ? value : undefined;
}

export default function BookDetailRoute() {
  const { bookId, intent } = useLocalSearchParams<{ bookId: string; intent?: string }>();
  const { t } = useI18n();
  const parsedBookId = Number(bookId);
  if (!Number.isSafeInteger(parsedBookId) || parsedBookId <= 0) {
    return (
      <Screen>
        <Notice title={t('bookNotFound')} tone="error" />
      </Screen>
    );
  }
  return <ResolvedBookDetailRoute bookId={parsedBookId} intent={bookIntent(intent)} />;
}

export function ResolvedBookDetailRoute({ bookId, intent }: { bookId: number; intent?: BookIntent }) {
  const { t } = useI18n();
  const session = useBookReadingSession(bookId);
  const sessionId = session.data?.sessionId;

  if (intent === 'debate') return <Redirect href={`/books/${bookId}/debates`} />;
  if (intent === 'reflection' && session.isLoading) {
    return <LoadingState label={t('reflectionNav')} />;
  }
  if (intent === 'reflection' && session.isError) {
    return (
      <Screen>
        <Notice title={t('genericError')} tone="error">
          <Button onPress={() => void session.refetch()} variant="outline">
            {t('retry')}
          </Button>
        </Notice>
      </Screen>
    );
  }
  if (intent === 'reflection' && sessionId) {
    return <Redirect href={`/books/${bookId}/reflection?sessionId=${sessionId}`} />;
  }
  if (intent === 'reflection' && !sessionId) {
    return (
      <Screen>
        <Notice title={t('workflowUnavailable')}>
          <Button onPress={() => router.replace(`/books/${bookId}`)} variant="outline">
            {t('bookDetails')}
          </Button>
        </Notice>
      </Screen>
    );
  }

  return (
    <BookDetailScreen
      bookId={bookId}
      debateAvailable
      onDeleted={() => router.replace('/library')}
      onOpenDebates={(recommendation) => {
        router.push(bookDebateRoute(bookId, recommendation));
      }}
      onOpenPrivacy={() => router.push('/privacy')}
      onOpenQuestions={() => {
        if (sessionId) router.push(`/books/${bookId}/reflection?sessionId=${sessionId}&source=book-detail`);
      }}
      onOpenReading={() => router.push(`/books/${bookId}/session`)}
      onOpenReflection={() => {
        if (sessionId) router.push(`/books/${bookId}/reflection?sessionId=${sessionId}`);
      }}
      workflowAvailable={Boolean(sessionId)}
      workflowError={session.isError}
      workflowPending={session.isLoading}
      onRetryWorkflow={() => void session.refetch()}
    />
  );
}
