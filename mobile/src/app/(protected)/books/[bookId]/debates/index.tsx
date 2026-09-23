import { router, useLocalSearchParams } from "expo-router";
import { useBookQuery } from "@/features/books/queries";
import { useCreateDebateWindow } from "@/features/debates/queries";
import { DebateRoomsScreen, type CreateDebateRoomIntent } from "@/features/debates/screens";
import { debateCopy } from "@/features/debates/copy";
import { parseDebateRecommendationParams } from "@/features/debates/route-params";
import {
  useBookReadingSession,
  useEnsureReadingSessionForBook,
} from "@/features/reading-sessions/queries";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { Button, EditorialHeader, LoadingState, Notice, Screen } from "@/shared/ui";

export default function DebatesRoute() {
  const { locale } = useI18n();
  const c = debateCopy(locale);
  const params = useLocalSearchParams<{
    bookId: string;
    personaKeys?: string | string[];
    questionId?: string;
    topic?: string | string[];
  }>();
  const { bookId, questionId } = params;
  const recommendation = parseDebateRecommendationParams(params);
  const book = Number(bookId);
  const question = questionId === undefined ? undefined : Number(questionId);
  const onBack = () =>
    goBackOrReplace(
      Number.isSafeInteger(book) && book > 0 ? `/books/${book}` : "/library",
    );
  if (
    !Number.isSafeInteger(book) ||
    book <= 0 ||
    (question !== undefined &&
      (!Number.isSafeInteger(question) || question <= 0))
  )
    return (
      <Screen>
        <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <ResolvedDebatesRoute
      bookId={book}
      questionId={question}
      {...recommendation}
    />
  );
}

export function ResolvedDebatesRoute({ bookId, questionId, recommendedPersonaKeys, recommendedTopic }: {
  bookId: number;
  questionId?: number;
  recommendedPersonaKeys: string[];
  recommendedTopic?: string;
}) {
  const { locale } = useI18n();
  const c = debateCopy(locale);
  const book = useBookQuery(bookId);
  const session = useBookReadingSession(bookId);
  const ensureSession = useEnsureReadingSessionForBook();
  const createRoom = useCreateDebateWindow();
  const ensuredSessionId = ensureSession.variables === bookId
    ? ensureSession.data?.sessionId
    : undefined;
  const sessionId = session.data?.sessionId ?? ensuredSessionId;
  const onBack = () => goBackOrReplace(`/books/${bookId}`);

  async function handleCreateRoom(intent: CreateDebateRoomIntent) {
    try {
      const activeSessionId = sessionId
        ?? (await ensureSession.mutateAsync(bookId)).sessionId;
      const room = await createRoom.mutateAsync({
        personaIds: intent.personaIds,
        sessionId: activeSessionId,
        title: `Debate: ${intent.topic}`,
      });
      router.push(`/books/${bookId}/debates/${room.windowId}`);
    } catch {
      // Mutation state renders the recoverable error without discarding the picker draft.
    }
  }

  if (book.isLoading) return (
    <Screen scroll={false}>
      <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
      <LoadingState label={c.room} />
    </Screen>
  );
  if (book.isError) {
    return (
      <Screen>
        <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
        <Notice title={c.loadError} tone="error">
          <Button onPress={() => void book.refetch()} variant="outline">{c.retry}</Button>
        </Notice>
      </Screen>
    );
  }
  if (!book.data) {
    return (
      <Screen>
        <EditorialHeader backLabel={c.back} onBack={onBack} title={c.room} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  }
  return (
    <DebateRoomsScreen
      bookAuthor={book.data.author}
      bookId={bookId}
      bookTitle={book.data.title}
      createRoomError={ensureSession.isError || createRoom.isError}
      createRoomPending={ensureSession.isPending || createRoom.isPending}
      onBack={onBack}
      onCreateRoom={(intent) => void handleCreateRoom(intent)}
      onReloadSession={() => void session.refetch()}
      questionId={questionId}
      recommendedPersonaKeys={recommendedPersonaKeys}
      recommendedTopic={recommendedTopic}
      sessionError={session.isError}
      sessionId={sessionId}
      sessionLoading={session.isLoading}
      onRoom={(windowId) =>
        router.push(`/books/${bookId}/debates/${windowId}`)
      }
    />
  );
}
