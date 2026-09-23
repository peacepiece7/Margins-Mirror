import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { useApiClient } from "@/shared/api/api-client-provider";
import {
  bundledConsentPolicy,
  supportsBundledConsentPolicy,
} from "@/shared/consent-policy";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { spacing } from "@/shared/theme/tokens";
import {
  AppText,
  Button,
  LoadingState,
  Notice,
  Screen,
  Surface,
} from "@/shared/ui";

import { createPrivacyApi } from "./api";
import { privacyCopy } from "./copy";

export function PrivacyScreen({ onOpenHistory }: { onOpenHistory(): void }) {
  const api = createPrivacyApi(useApiClient());
  const { locale } = useI18n();
  const c = privacyCopy(locale);
  const query = useQuery({
    queryKey: ["privacy", "requirements"],
    queryFn: api.requirements,
  });
  const currentPolicySupported = query.data
    ? supportsBundledConsentPolicy(query.data)
    : true;
  return (
    <Screen testID="privacy-screen">
      <View style={styles.heading}>
        <AppText accessibilityRole="header" variant="title">
          {c.title}
        </AppText>
        <AppText>{c.subtitle}</AppText>
      </View>
      {query.isPending ? <LoadingState label={c.title} /> : null}
      {query.isError ? (
        <Notice title={c.loadError} tone="error">
          <Button onPress={() => void query.refetch()}>{c.retry}</Button>
        </Notice>
      ) : null}
      {!currentPolicySupported ? (
        <Notice title={c.bundledPolicyNotice} tone="error" />
      ) : null}
      <Surface>
        <AppText variant="heading">{c.policy}</AppText>
        <AppText>{c.effectiveVersion}</AppText>
        {query.data && currentPolicySupported ? (
          <>
          <AppText>
            {c.version}: {query.data.privacyPolicyVersion}
          </AppText>
          <AppText>
            {c.effective}: {query.data.effectiveDate}
          </AppText>
          <AppText>
            {c.minimumAge}: {query.data.minimumAge}
          </AppText>
          </>
        ) : (
          <>
            <AppText>
              {c.version}: {bundledConsentPolicy.privacyPolicyVersion}
            </AppText>
            <AppText>
              {c.effective}: {bundledConsentPolicy.effectiveDate}
            </AppText>
            <AppText>
              {c.minimumAge}: {bundledConsentPolicy.minimumAge}
            </AppText>
          </>
        )}
      </Surface>
      {c.sections.map((section) => (
        <Surface key={section.title}>
          <AppText accessibilityRole="header" variant="heading">
            {section.title}
          </AppText>
          <AppText>{section.body}</AppText>
        </Surface>
      ))}
      <Button onPress={onOpenHistory} variant="outline">
        {c.history}
      </Button>
    </Screen>
  );
}

export function PrivacyHistoryScreen({
  onOpenCurrent,
}: {
  onOpenCurrent(): void;
}) {
  const { locale } = useI18n();
  const c = privacyCopy(locale);
  return (
    <Screen testID="privacy-history-screen">
      <View style={styles.heading}>
        <AppText accessibilityRole="header" variant="title">
          {c.historyTitle}
        </AppText>
        <AppText>{c.historyCurrent}</AppText>
      </View>
      <Surface>
        <AppText accessibilityRole="header" variant="heading">
          {c.historyInitial}
        </AppText>
        <AppText>{c.historySummary}</AppText>
        <Button onPress={onOpenCurrent} variant="outline">
          {c.historyVersionLink}
        </Button>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({ heading: { gap: spacing.x2 } });
