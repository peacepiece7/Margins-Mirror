import { router, useLocalSearchParams } from "expo-router";
import { useBookQuery } from "@/features/books/queries";
import { ReflectionScreen } from "@/features/reflections/screens";
import { reflectionCopy } from "@/features/reflections/copy";
import { ApiRequestError } from "@/shared/api/error";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { Button, EditorialHeader, LoadingState, Notice, Screen } from "@/shared/ui";

export default function ReflectionRoute() {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const { bookId, revisionId, sessionId } = useLocalSearchParams<{
    bookId: string;
    revisionId?: string;
    sessionId: string;
  }>();
  const book = Number(bookId);
  const session = Number(sessionId);
  const revision = revisionId === undefined ? undefined : Number(revisionId);
  const onBack = () => goBackOrReplace("/reflection");
  if (
    ![book, session].every((id) => Number.isSafeInteger(id) && id > 0) ||
    (revision !== undefined && (!Number.isSafeInteger(revision) || revision <= 0))
  )
    return (
      <Screen>
        <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.reflection} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <ResolvedReflectionRoute
      bookId={book}
      revisionId={revision}
      sessionId={session}
    />
  );
}

export function ResolvedReflectionRoute({
  bookId,
  revisionId,
  sessionId,
}: {
  bookId: number;
  revisionId?: number;
  sessionId: number;
}) {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const book = useBookQuery(bookId);
  const onBack = () => goBackOrReplace("/reflection");
  if (book.isLoading) return (
    <Screen scroll={false}>
      <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.reflection} />
      <LoadingState label={c.reflection} />
    </Screen>
  );
  if (book.isError) {
    const notFound =
      book.error instanceof ApiRequestError && book.error.status === 404;
    return (
      <Screen>
        <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.reflection} />
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button onPress={() => void book.refetch()} variant="outline">
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  if (!book.data)
    return (
      <Screen>
        <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.reflection} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <ReflectionScreen
      bookAuthor={book.data.author}
      bookId={bookId}
      bookTitle={book.data.title}
      onBack={onBack}
      onCloseSourceRevision={() =>
        router.replace(`/books/${bookId}/reflection?sessionId=${sessionId}`)
      }
      sessionId={sessionId}
      sourceRevisionId={revisionId}
      onWorkflow={(target) => {
        if (target.kind === "interview") {
          router.push(
            `/books/${bookId}/reflection/interview?interviewId=${target.id}&sessionId=${sessionId}`,
          );
          return;
        }
        if (target.kind === "guide") {
          router.push(`/books/${bookId}/reflection/guide/${target.id}`);
          return;
        }
        router.push(
          `/books/${bookId}/reflection/${target.kind}/${target.id}`,
        );
      }}
    />
  );
}
