import { router, useLocalSearchParams } from "expo-router";
import { localizedPersonaDisplay } from "@/features/debates/display";
import { usePersonaCatalog } from "@/features/debates/queries";
import { DiscussionScreen } from "@/features/reflections/screens";
import { reflectionCopy } from "@/features/reflections/copy";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { EditorialHeader, Notice, Screen } from "@/shared/ui";

export default function DiscussRoute() {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const personas = usePersonaCatalog();
  const { bookId, runId } = useLocalSearchParams<{
    bookId: string;
    runId: string;
  }>();
  const book = Number(bookId);
  const run = Number(runId);
  const personaNames = Object.fromEntries(
    (personas.data?.personas ?? []).map((persona) => [
      persona.personaId,
      localizedPersonaDisplay(persona, locale).displayName,
    ]),
  );
  const onBack = () => goBackOrReplace("/reflection");
  if (![book, run].every((id) => Number.isSafeInteger(id) && id > 0))
    return (
      <Screen>
        <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.discuss} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <DiscussionScreen
      bookId={book}
      onBack={onBack}
      personaNames={personaNames}
      runId={run}
      onRefine={(id) =>
        router.replace(`/books/${book}/reflection/refine/${id}`)
      }
    />
  );
}
