import { Redirect, router, useLocalSearchParams } from "expo-router";

import { useAuthSession } from "@/features/auth/session-provider";
import { useBookQuery } from "@/features/books/queries";
import { memoryCopy } from "@/features/memory-cards/copy";
import { MemoryCardGroupsScreen } from "@/features/memory-cards/groups-screen";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { Button, EditorialHeader, LoadingState, Notice, Screen } from "@/shared/ui";

export default function MemoryCardGroupsRoute() {
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();
  const { session } = useAuthSession();
  const { locale, t } = useI18n();
  const c = memoryCopy(locale);
  if (session?.membershipTier !== "PREMIUM") {
    return (
      <MemoryCardGroupsScreen
        onBack={() => goBackOrReplace("/library")}
        onOpenGroup={() => undefined}
        premium={false}
      />
    );
  }

  if (bookId === undefined) return <Redirect href="/library?action=study" />;
  const parsedBookId = Number(bookId);
  if (!Number.isSafeInteger(parsedBookId) || parsedBookId <= 0) {
    return (
      <Screen>
        <EditorialHeader backLabel={c.back} onBack={() => goBackOrReplace("/library?action=study")} title={t("studyNav")} />
        <Notice title={t("bookNotFound")} tone="error" />
      </Screen>
    );
  }
  return <ResolvedMemoryCardGroupsRoute bookId={parsedBookId} />;
}

export function ResolvedMemoryCardGroupsRoute({ bookId }: { bookId: number }) {
  const { locale, t } = useI18n();
  const c = memoryCopy(locale);
  const book = useBookQuery(bookId);
  const onBack = () => goBackOrReplace("/library?action=study");
  if (book.isLoading) {
    return <Screen scroll={false}><EditorialHeader backLabel={c.back} onBack={onBack} title={t("studyNav")} /><LoadingState label={t("studyNav")} /></Screen>;
  }
  if (book.isError) {
    return <Screen><EditorialHeader backLabel={c.back} onBack={onBack} title={t("studyNav")} /><Notice title={c.error} tone="error"><Button onPress={() => void book.refetch()} variant="outline">{c.retry}</Button></Notice></Screen>;
  }
  if (!book.data) {
    return <Screen><EditorialHeader backLabel={c.back} onBack={onBack} title={t("studyNav")} /><Notice title={t("bookNotFound")} tone="error" /></Screen>;
  }

  return (
    <MemoryCardGroupsScreen
      bookId={bookId}
      contextLabel={`${t("selectedBook")}: ${book.data.title}`}
      onBack={onBack}
      onOpenGroup={(groupId) => router.push(`/memory-cards/${groupId}`)}
      premium
    />
  );
}
