import { router, useLocalSearchParams } from "expo-router";

import { ReadingSessionScreen } from "@/features/reading-sessions/reading-session-screen";
import { readingCopy } from "@/features/reading-sessions/copy";
import { useBookQuery } from "@/features/books/queries";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { Button, EditorialHeader, Notice, Screen } from "@/shared/ui";

export default function ReadingSessionRoute() {
  const { bookId, sessionId } = useLocalSearchParams<{ bookId: string; sessionId?: string }>();
  const { locale } = useI18n();
  const c = readingCopy(locale);
  const id = Number(bookId);
  const selectedSessionId = sessionId ? Number(sessionId) : undefined;
  if (!Number.isSafeInteger(id) || id <= 0)
    return (
      <Screen>
        <EditorialHeader backLabel={c.back} onBack={() => goBackOrReplace("/library")} title={c.reading} />
        <Notice title={c.empty} tone="error" />
      </Screen>
    );
  if (selectedSessionId !== undefined && (!Number.isSafeInteger(selectedSessionId) || selectedSessionId <= 0)) {
    return <Screen>
      <EditorialHeader backLabel={c.back} onBack={() => goBackOrReplace(`/books/${id}`)} title={c.reading} />
      <Notice title={c.empty} tone="error" />
    </Screen>;
  }
  return <ResolvedReadingSessionRoute bookId={id} sessionId={selectedSessionId} />;
}

export function ResolvedReadingSessionRoute({ bookId, sessionId }: { bookId: number; sessionId?: number }) {
  const book = useBookQuery(bookId);
  const { locale } = useI18n();
  const c = readingCopy(locale);
  const onBack = () => goBackOrReplace(`/books/${bookId}`);
  if (book.isLoading) return <Screen>
    <EditorialHeader backLabel={c.back} onBack={onBack} title={c.reading} />
    <Notice title={c.reading} />
  </Screen>;
  if (book.isError) return <Screen>
    <EditorialHeader backLabel={c.back} onBack={onBack} title={c.reading} />
    <Notice title={c.error} tone="error">
      <Button onPress={() => void book.refetch()} variant="outline">{c.retry}</Button>
    </Notice>
  </Screen>;
  if (!book.data) return <Screen>
    <EditorialHeader backLabel={c.back} onBack={onBack} title={c.reading} />
    <Notice title={c.empty} tone="error" />
  </Screen>;
  return (
    <ReadingSessionScreen
      bookId={bookId}
      bookTitle={book.data.title}
      initialSessionId={sessionId}
      onBack={onBack}
      onArchived={() => router.replace("/library")}
      onDebate={(targetSessionId, resolvedBookId) =>
        router.push(`/books/${resolvedBookId}/debates?sessionId=${targetSessionId}`)
      }
      onReflection={(targetSessionId, resolvedBookId) =>
        router.push(`/books/${resolvedBookId}/reflection?sessionId=${targetSessionId}`)
      }
      onSearchResult={(targetSessionId, resolvedBookId) =>
        router.push(`/books/${resolvedBookId}/session?sessionId=${targetSessionId}`)
      }
    />
  );
}
