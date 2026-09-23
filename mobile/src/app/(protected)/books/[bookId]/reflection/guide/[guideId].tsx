import { router, useLocalSearchParams } from "expo-router";
import { GuideScreen } from "@/features/reflections/screens";
import { reflectionCopy } from "@/features/reflections/copy";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";
import { EditorialHeader, Notice, Screen } from "@/shared/ui";

export default function GuideRoute() {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const { bookId, guideId } = useLocalSearchParams<{
    bookId: string;
    guideId: string;
  }>();
  const book = Number(bookId);
  const guide = Number(guideId);
  const onBack = () => goBackOrReplace("/reflection");
  if (![book, guide].every((id) => Number.isSafeInteger(id) && id > 0))
    return (
      <Screen>
        <EditorialHeader backLabel={c.backToReflection} onBack={onBack} title={c.guide} />
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  return (
    <GuideScreen
      bookId={book}
      guideId={guide}
      key={guide}
      onBack={onBack}
      onGuideVersion={(selectedGuideId) =>
        router.push(`/books/${book}/reflection/guide/${selectedGuideId}`)
      }
      onDiscuss={(runId) =>
        router.push(`/books/${book}/reflection/discuss/${runId}`)
      }
    />
  );
}
