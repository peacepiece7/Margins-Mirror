import { router, useLocalSearchParams } from "expo-router";
import { InterviewScreen } from "@/features/reflections/screens";
import { reflectionCopy } from "@/features/reflections/copy";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { EditorialHeader, Notice, Screen } from "@/shared/ui";

export default function InterviewRoute() {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const { bookId, interviewId, sessionId } = useLocalSearchParams<{
    bookId: string;
    interviewId: string;
    sessionId: string;
  }>();
  const book = Number(bookId);
  const interview = Number(interviewId);
  const session = Number(sessionId);
  const onBack = () =>
    goBackOrReplace(
      Number.isSafeInteger(book) && book > 0 && Number.isSafeInteger(session) && session > 0
        ? `/books/${book}/reflection?sessionId=${session}`
        : "/reflection",
    );
  if (![book, interview, session].every((id) => Number.isSafeInteger(id) && id > 0))
    return (
      <Screen>
        <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.interview} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <InterviewScreen
      bookId={book}
      interviewId={interview}
      key={interview}
      onBack={onBack}
      sessionId={session}
      onDone={() =>
        router.replace(`/books/${book}/reflection?sessionId=${session}`)
      }
      onInterview={(nextInterviewId) =>
        router.replace(
          `/books/${book}/reflection/interview?interviewId=${nextInterviewId}&sessionId=${session}`,
        )
      }
      onGuide={(guideId) =>
        router.push(`/books/${book}/reflection/guide/${guideId}`)
      }
      onSourceRevision={(revisionId) =>
        router.push(
          `/books/${book}/reflection?sessionId=${session}&revisionId=${revisionId}`,
        )
      }
    />
  );
}
