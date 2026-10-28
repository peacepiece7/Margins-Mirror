import { StyleSheet, View } from "react-native";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { spacing } from "@/shared/theme/tokens";
import { AppText, Button, Screen, Surface } from "@/shared/ui";

import { serviceTermsCopy } from "./copy";

export function TermsScreen({
  onContact,
  onOpenHistory,
  onOpenPrivacy,
}: {
  onContact(): void;
  onOpenHistory(): void;
  onOpenPrivacy(): void;
}) {
  const { locale } = useI18n();
  const c = serviceTermsCopy(locale);

  return (
    <Screen testID="service-terms-screen">
      <View style={styles.heading}>
        <AppText accessibilityRole="header" variant="title">
          {c.title}
        </AppText>
        <AppText variant="caption">{c.status}</AppText>
      </View>
      <Surface>
        <AppText accessibilityRole="header" variant="heading">
          {c.pendingTitle}
        </AppText>
        <AppText>{c.pendingBody}</AppText>
        <AppText variant="caption">{c.noAcceptance}</AppText>
      </Surface>
      <View style={styles.actions}>
        <Button onPress={onOpenHistory} variant="outline">
          {c.history}
        </Button>
        <Button onPress={onOpenPrivacy} variant="outline">
          {c.privacy}
        </Button>
        <Button onPress={onContact} variant="ghost">
          {c.contact}
        </Button>
      </View>
    </Screen>
  );
}

export function TermsHistoryScreen({
  onContact,
  onOpenCurrent,
  onOpenPrivacy,
}: {
  onContact(): void;
  onOpenCurrent(): void;
  onOpenPrivacy(): void;
}) {
  const { locale } = useI18n();
  const c = serviceTermsCopy(locale);

  return (
    <Screen testID="service-terms-history-screen">
      <View style={styles.heading}>
        <AppText accessibilityRole="header" variant="title">
          {c.historyTitle}
        </AppText>
        <Button onPress={onOpenCurrent} variant="ghost">
          {c.backToCurrent}
        </Button>
      </View>
      <Surface>
        <AppText accessibilityRole="header" variant="heading">
          {c.historyEmptyTitle}
        </AppText>
        <AppText>{c.historyEmptyBody}</AppText>
      </Surface>
      <View style={styles.actions}>
        <Button onPress={onOpenPrivacy} variant="outline">
          {c.privacy}
        </Button>
        <Button onPress={onContact} variant="ghost">
          {c.contact}
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.x2 },
  heading: { gap: spacing.x2 },
});
