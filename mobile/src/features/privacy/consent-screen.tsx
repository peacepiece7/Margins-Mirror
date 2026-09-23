import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useApiClient } from "@/shared/api/api-client-provider";
import { supportsBundledConsentPolicy } from "@/shared/consent-policy";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { colors, radius, spacing } from "@/shared/theme/tokens";
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

export function ConsentScreen({
  logout,
  onOpenAccount,
  onOpenPrivacy,
  onOpenTerms,
  refreshSession,
}: {
  logout(): Promise<void>;
  onOpenAccount(): void;
  onOpenPrivacy(): void;
  onOpenTerms(): void;
  refreshSession(): Promise<void>;
}) {
  const api = createPrivacyApi(useApiClient());
  const queryClient = useQueryClient();
  const { locale } = useI18n();
  const c = privacyCopy(locale);
  const requirements = useQuery({
    queryKey: ["privacy", "requirements"],
    queryFn: api.requirements,
  });
  const status = useQuery({
    queryKey: ["privacy", "status"],
    queryFn: api.status,
  });
  const [privacy, setPrivacy] = useState(false);
  const [ai, setAi] = useState(false);
  const [age, setAge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [grantCompleted, setGrantCompleted] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const consentAlreadyCurrent =
    status.data?.consentRequired === false ||
    status.data?.missingConsentTypes.length === 0;
  const consentCompleted = grantCompleted || consentAlreadyCurrent;
  const submit = async () => {
    if (!requirements.data) return;
    setSaving(true);
    setError(false);
    setRefreshFailed(false);
    try {
      if (!consentCompleted) {
        const grantedStatus = await api.grant({
          privacyPolicyAccepted: privacy,
          aiTransferAccepted: ai,
          ageOver14Confirmed: age,
          privacyPolicyVersion: requirements.data.privacyPolicyVersion,
          aiTransferVersion: requirements.data.aiTransferVersion,
          preferredLocale: locale,
        });
        queryClient.setQueryData(["privacy", "status"], grantedStatus);
        setGrantCompleted(true);
      }
    } catch {
      setError(true);
      setSaving(false);
      return;
    }
    try {
      await refreshSession();
    } catch {
      setRefreshFailed(true);
    } finally {
      setSaving(false);
    }
  };
  if (requirements.isPending || status.isPending)
    return (
      <Screen>
        <LoadingState label={c.consentTitle} />
      </Screen>
    );
  if (requirements.isError || status.isError || !requirements.data)
    return (
      <Screen>
        <Notice title={c.loadError} tone="error">
          <Button
            onPress={() => {
              void requirements.refetch();
              void status.refetch();
            }}
          >
            {c.retry}
          </Button>
        </Notice>
      </Screen>
    );
  if (!supportsBundledConsentPolicy(requirements.data)) {
    return (
      <Screen testID="consent-policy-update-required">
        <Notice title={c.updateRequired} tone="error" />
        <View style={styles.actions}>
          <Button onPress={onOpenPrivacy} variant="ghost">
            {c.openPolicy}
          </Button>
          <Button onPress={onOpenTerms} variant="ghost">
            {c.openTerms}
          </Button>
          <Button onPress={onOpenAccount} variant="outline">
            {c.account}
          </Button>
          <Button onPress={() => void logout()} variant="ghost">
            {c.logout}
          </Button>
        </View>
      </Screen>
    );
  }
  return (
    <Screen testID="consent-screen">
      <View style={styles.heading}>
        <AppText accessibilityRole="header" variant="title">
          {c.consentTitle}
        </AppText>
        <AppText>{c.consentSubtitle}</AppText>
      </View>
      <Surface>
        <ConsentToggle
          checked={privacy || consentCompleted}
          disabled={consentCompleted}
          label={c.privacy}
          onPress={() => setPrivacy((value) => !value)}
        />
        <ConsentToggle
          checked={ai || consentCompleted}
          disabled={consentCompleted}
          label={c.ai}
          onPress={() => setAi((value) => !value)}
        />
        <ConsentToggle
          checked={age || consentCompleted}
          disabled={consentCompleted}
          label={`${c.age} (${requirements.data.minimumAge}+)`}
          onPress={() => setAge((value) => !value)}
        />
        <AppText variant="caption">
          {c.missing}:{" "}
          {status.data?.missingConsentTypes.join(", ") || c.accepted}
        </AppText>
      </Surface>
      {error ? <Notice title={c.saveError} tone="error" /> : null}
      {refreshFailed ? <Notice title={c.refreshError} tone="error" /> : null}
      <Button
        disabled={!consentCompleted && (!privacy || !ai || !age)}
        loading={saving}
        onPress={() => void submit()}
      >
        {refreshFailed ? c.retry : c.continue}
      </Button>
      <View style={styles.actions}>
        <Button onPress={onOpenPrivacy} variant="ghost">
          {c.openPolicy}
        </Button>
        <Button onPress={onOpenTerms} variant="ghost">
          {c.openTerms}
        </Button>
        <Button onPress={onOpenAccount} variant="outline">
          {c.account}
        </Button>
        <Button onPress={() => void logout()} variant="ghost">
          {c.logout}
        </Button>
      </View>
    </Screen>
  );
}

function ConsentToggle({
  checked,
  disabled,
  label,
  onPress,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.toggle}
    >
      <View style={[styles.box, checked && styles.checked]}>
        <AppText>{checked ? "✓" : ""}</AppText>
      </View>
      <AppText style={styles.toggleLabel}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.x2,
  },
  box: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radius.small,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  checked: { backgroundColor: colors.brass },
  heading: { gap: spacing.x2 },
  toggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.x3,
    minHeight: 44,
  },
  toggleLabel: { flex: 1 },
});
