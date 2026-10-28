import { router, useLocalSearchParams } from "expo-router";
import { RefinementScreen } from "@/features/reflections/screens";
import { reflectionCopy } from "@/features/reflections/copy";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { EditorialHeader, Notice, Screen } from "@/shared/ui";

export default function RefineRoute() {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const { bookId, runId } = useLocalSearchParams<{
    bookId: string;
    runId: string;
  }>();
  const book = Number(bookId);
  const run = Number(runId);
  const onBack = () => goBackOrReplace("/reflection");
  if (![book, run].every((id) => Number.isSafeInteger(id) && id > 0))
    return (
      <Screen>
        <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.refine} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <RefinementScreen
      bookId={book}
      onBack={onBack}
      runId={run}
      onDone={() => router.replace(`/books/${book}`)}
    />
  );
}
