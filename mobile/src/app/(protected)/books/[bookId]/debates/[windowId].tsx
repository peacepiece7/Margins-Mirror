import { router, useLocalSearchParams } from "expo-router";
import { useBookQuery } from "@/features/books/queries";
import { DebateRoomScreen } from "@/features/debates/screens";
import { debateCopy } from "@/features/debates/copy";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { Button, EditorialHeader, LoadingState, Notice, Screen } from "@/shared/ui";

export default function DebateRoomRoute() {
  const { locale } = useI18n();
  const c = debateCopy(locale);
  const { bookId, windowId } = useLocalSearchParams<{
    bookId: string;
    windowId: string;
  }>();
  const book = Number(bookId);
  const window = Number(windowId);
  const onBack = () =>
    goBackOrReplace(
      Number.isSafeInteger(book) && book > 0
        ? `/books/${book}/debates`
        : "/library?action=debate",
    );
  if (![book, window].every((id) => Number.isSafeInteger(id) && id > 0))
    return (
      <Screen>
        <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return <ResolvedDebateRoomRoute bookId={book} windowId={window} />;
}

export function ResolvedDebateRoomRoute({ bookId, windowId }: { bookId: number; windowId: number }) {
  const { locale } = useI18n();
  const c = debateCopy(locale);
  const book = useBookQuery(bookId);
  const onBack = () => goBackOrReplace(`/books/${bookId}/debates`);
  if (book.isLoading) return (
    <Screen scroll={false}>
      <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
      <LoadingState label={c.room} />
    </Screen>
  );
  if (book.isError) return (
    <Screen>
      <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
      <Notice title={c.loadError} tone="error">
        <Button onPress={() => void book.refetch()} variant="outline">{c.retry}</Button>
      </Notice>
    </Screen>
  );
  if (!book.data) return (
    <Screen>
      <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
      <Notice title={c.notFound} tone="error" />
    </Screen>
  );
  return (
    <DebateRoomScreen
      bookAuthor={book.data.author}
      bookId={bookId}
      bookTitle={book.data.title}
      onBack={onBack}
      onArchived={() => router.replace(`/books/${bookId}/debates`)}
      windowId={windowId}
    />
  );
}
