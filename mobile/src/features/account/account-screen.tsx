import React from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { Alert, StyleSheet, View } from "react-native";

import { ApiRequestError } from "@/shared/api/error";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { colors, spacing } from "@/shared/theme/tokens";
import {
  AppText,
  Button,
  EditorialHeader,
  LoadingState,
  Notice,
  Screen,
  Surface,
  TextField,
} from "@/shared/ui";

import { accountCopy } from "./copy";
import { useAccountMutations, useAccountQuery } from "./queries";
import type { ResignationReason } from "./types";

function providerLabel(
  provider: string,
  labels: {
    providerGoogle: string;
    providerLocal: string;
    providerLocalGoogle: string;
    providerResigned: string;
    providerUnknown: string;
  },
) {
  switch (provider.toLowerCase()) {
    case "google":
      return labels.providerGoogle;
    case "local":
      return labels.providerLocal;
    case "local+google":
      return labels.providerLocalGoogle;
    case "resigned":
      return labels.providerResigned;
    default:
      return labels.providerUnknown;
  }
}

export function AccountScreen({
  logout,
  membershipTier,
  onContactSupport,
  onOpenPrivacy,
  onOpenPrivacyHistory,
  onOpenTerms,
  onOpenTermsHistory,
  refreshSession,
}: {
  logout(): Promise<void>;
  membershipTier?: "FREE" | "PREMIUM";
  onContactSupport(): Promise<void>;
  onOpenPrivacy(): void;
  onOpenPrivacyHistory(): void;
  onOpenTerms(): void;
  onOpenTermsHistory(): void;
  refreshSession(): Promise<void>;
}) {
  const { locale, setLocale } = useI18n();
  const c = accountCopy(locale);
  const account = useAccountQuery();
  const accountData = account.data;
  const mutations = useAccountMutations();
  const profile = useForm<{
    displayName: string;
    preferredLocale: "ko" | "en";
  }>({
    defaultValues: {
      displayName: accountData?.displayName ?? "",
      preferredLocale: accountData?.preferredLocale ?? locale,
    },
  });
  const profileIsDirty = profile.formState.isDirty;
  const resetProfile = profile.reset;
  React.useEffect(() => {
    if (!accountData || profileIsDirty) return;
    resetProfile({
      displayName: accountData.displayName,
      preferredLocale: accountData.preferredLocale,
    });
  }, [accountData, profileIsDirty, resetProfile]);
  const password = useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const resignation = useForm<{
    code: string;
    reason: ResignationReason;
  }>({
    defaultValues: { code: "", reason: "NOT_USING" },
  });
  const selectedLocale = useWatch({
    control: profile.control,
    name: "preferredLocale",
  });
  const selectedReason = useWatch({
    control: resignation.control,
    name: "reason",
  });
  const [notice, setNotice] = React.useState("");

  const submitProfile = profile.handleSubmit(async ({
    displayName,
    preferredLocale,
  }) => {
    let result;
    try {
      result = await mutations.profile.mutateAsync({
        displayName: displayName.trim(),
        preferredLocale,
      });
    } catch {
      setNotice(c.error);
      return;
    }
    profile.reset({
      displayName: result.account.displayName,
      preferredLocale: result.account.preferredLocale,
    });
    const savedCopy = accountCopy(result.account.preferredLocale);
    try {
      await setLocale(result.account.preferredLocale);
      await refreshSession();
      setNotice(savedCopy.saved);
    } catch {
      setNotice(savedCopy.savedSessionRefreshFailed);
    }
  });
  const submitPassword = password.handleSubmit(async (values) => {
    if (values.newPassword.length < 10)
      return password.setError("newPassword", { message: c.minPassword });
    if (values.newPassword !== values.confirmPassword)
      return password.setError("confirmPassword", { message: c.mismatch });
    try {
      await mutations.password.mutateAsync(values);
      password.reset();
      await logout();
    } catch {
      password.setError("root.server", { message: c.error });
    }
  });
  const submitResignation = resignation.handleSubmit(async ({ code, reason }) => {
    if (!mutations.challenge.data) return;
    await new Promise<void>((resolve) => {
      Alert.alert(
        c.danger,
        c.dangerDescription,
        [
          { onPress: () => resolve(), style: "cancel", text: c.cancel },
          {
            onPress: () => {
              void (async () => {
                try {
                  const verified = mutations.verifyResignation.data
                    ?? await mutations.verifyResignation.mutateAsync({
                      challengeId: mutations.challenge.data!.challengeId,
                      code,
                    });
                  await mutations.resign.mutateAsync({
                    actionToken: verified.actionToken,
                    reason,
                  });
                  await logout();
                } catch (error) {
                  if (
                    error instanceof ApiRequestError &&
                    error.code === "ACCOUNT_CHALLENGE_INVALID"
                  ) {
                    mutations.verifyResignation.reset();
                  }
                  resignation.setError("root.server", {
                    message:
                      error instanceof ApiRequestError &&
                      error.code === "ACCOUNT_CHALLENGE_INVALID"
                        ? c.challengeInvalid
                        : c.error,
                  });
                } finally {
                  resolve();
                }
              })();
            },
            style: "destructive",
            text: c.resign,
          },
        ],
        { cancelable: true, onDismiss: () => resolve() },
      );
    });
  });
  const requestResignationChallenge = async () => {
    resignation.clearErrors("root");
    try {
      await mutations.challenge.mutateAsync();
      mutations.verifyResignation.reset();
      resignation.setValue("code", "", { shouldDirty: false });
    } catch (error) {
      resignation.setError("root.server", {
        message:
          error instanceof ApiRequestError &&
          (error.code === "ACCOUNT_CHALLENGE_RATE_LIMITED" || error.status === 429)
            ? c.challengeRateLimited
            : c.error,
      });
    }
  };

  if (account.isPending)
    return (
      <Screen>
        <LoadingState label={c.title} />
      </Screen>
    );
  if (account.isError || !account.data)
    return (
      <Screen>
        <Notice title={c.error}>
          <Button onPress={() => void account.refetch()}>{c.retry}</Button>
        </Notice>
      </Screen>
    );

  return (
    <Screen layout="edge" testID="account-screen">
      <EditorialHeader description={c.subtitle} page title={c.title} />
      {notice ? (
        <Notice
          title={notice}
          tone={notice === c.error ? "error" : "success"}
        />
      ) : null}
      <Surface variant="section">
        <View style={styles.profileHero}>
          <View accessibilityElementsHidden style={styles.avatar}>
            <AppText style={styles.avatarText} variant="title">
              {(account.data.displayName || account.data.username || "M").slice(0, 1).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.profileIdentity}>
            <AppText accessibilityRole="header" variant="heading">
              {account.data.displayName || account.data.username}
            </AppText>
            <AppText variant="caption">{account.data.email}</AppText>
            <View style={styles.profileMeta}>
              <AppText variant="caption">@{account.data.username}</AppText>
              {membershipTier ? (
                <AppText
                  style={membershipTier === "PREMIUM" ? styles.premiumBadge : styles.freeBadge}
                  testID="account-membership-tier"
                  variant="eyebrow"
                >
                  {membershipTier === "PREMIUM" ? c.premiumMembership : c.freeMembership}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>
        <AppText accessibilityRole="header" variant="heading">
          {c.profile}
        </AppText>
        <AppText variant="caption">
          {c.signInMethod}:{" "}
          {providerLabel(account.data.authProvider, c)}
        </AppText>
        <Controller
          control={profile.control}
          name="displayName"
          rules={{ required: c.required }}
          render={({ field, fieldState }) => (
            <TextField
              error={fieldState.error?.message}
              label={c.displayName}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <Button
          loading={profile.formState.isSubmitting}
          onPress={() => void submitProfile()}
          testID="account-profile-save"
        >
          {c.saveLocale}
        </Button>
      </Surface>
      <Surface variant="section">
        <AppText accessibilityRole="header" variant="heading">
          {c.utilities}
        </AppText>
        <View style={styles.utilityRow}>
          <Button
            accessibilityState={{ selected: selectedLocale === "ko" }}
            onPress={() => {
              profile.setValue("preferredLocale", "ko", { shouldDirty: true });
              void setLocale("ko");
            }}
            style={styles.utilityButton}
            variant={selectedLocale === "ko" ? "primary" : "secondary"}
          >
            한국어
          </Button>
          <Button
            accessibilityState={{ selected: selectedLocale === "en" }}
            onPress={() => {
              profile.setValue("preferredLocale", "en", { shouldDirty: true });
              void setLocale("en");
            }}
            style={styles.utilityButton}
            variant={selectedLocale === "en" ? "primary" : "secondary"}
          >
            English
          </Button>
        </View>
        <View style={styles.logoutRow}>
          <Button
            onPress={() => void logout().catch(() => setNotice(c.error))}
            testID="account-logout"
            variant="secondary"
          >
            {c.logout}
          </Button>
        </View>
      </Surface>
      <Surface variant="section">
        <AppText accessibilityRole="header" variant="heading">
          {c.privacyAndSupport}
        </AppText>
        <View style={styles.accountLinks}>
          <Button onPress={onOpenPrivacy} variant="outline">
            {c.privacyPolicy}
          </Button>
          <Button onPress={onOpenPrivacyHistory} variant="outline">
            {c.privacyHistory}
          </Button>
          <Button onPress={onOpenTerms} variant="outline">
            {c.serviceTerms}
          </Button>
          <Button onPress={onOpenTermsHistory} variant="outline">
            {c.serviceTermsHistory}
          </Button>
          <Button
            onPress={() =>
              void onContactSupport().catch(() => setNotice(c.error))
            }
            variant="outline"
          >
            {c.contactSupport}
          </Button>
        </View>
      </Surface>
      {account.data.authProvider === "local" ? (
        <Surface variant="section">
          <AppText accessibilityRole="header" variant="heading">
            {c.password}
          </AppText>
          {password.formState.errors.root?.server?.message ? (
            <Notice
              title={password.formState.errors.root.server.message}
              tone="error"
            />
          ) : null}
          <PasswordField
            control={password.control}
            label={c.currentPassword}
            name="currentPassword"
            required={c.required}
          />
          <PasswordField
            control={password.control}
            label={c.newPassword}
            name="newPassword"
            required={c.required}
          />
          <PasswordField
            control={password.control}
            label={c.confirmPassword}
            name="confirmPassword"
            required={c.required}
          />
          <Button
            loading={password.formState.isSubmitting}
            onPress={() => void submitPassword()}
          >
            {c.password}
          </Button>
        </Surface>
      ) : null}
      <Surface style={styles.danger} variant="section">
        <AppText accessibilityRole="header" variant="heading">
          {c.danger}
        </AppText>
        <AppText>{c.dangerDescription}</AppText>
        <AppText variant="label">{c.reason}</AppText>
        <View style={styles.reasonList}>
          {(
            [
              "NOT_USING",
              "MISSING_FEATURES",
              "TOO_MANY_ERRORS",
              "PRIVACY_CONCERNS",
              "OTHER",
            ] as ResignationReason[]
          ).map((value) => (
            <Button
              accessibilityState={{ selected: selectedReason === value }}
              disabled={resignation.formState.isSubmitting}
              key={value}
              onPress={() =>
                resignation.setValue("reason", value, { shouldDirty: true })
              }
              variant={selectedReason === value ? "destructive" : "outline"}
            >
              {c[value]}
            </Button>
          ))}
        </View>
        <View style={styles.disclosures}>
          <AppText>{c.recoveryWindow}</AppText>
          <AppText>{c.activityRetention}</AppText>
          <AppText>{c.backupRetention}</AppText>
          <AppText>{c.emailRestriction}</AppText>
          <AppText>{c.support}</AppText>
        </View>
        {!mutations.challenge.data ? (
          <>
            {resignation.formState.errors.root?.server?.message ? (
              <Notice
                title={resignation.formState.errors.root.server.message}
                tone="error"
              />
            ) : null}
            <Button
              loading={mutations.challenge.isPending}
              onPress={() => void requestResignationChallenge()}
              testID="account-resignation-challenge"
              variant="destructive"
            >
              {c.sendCode}
            </Button>
          </>
        ) : (
          <>
            <Notice title={c.resignationCodeSent} />
            {__DEV__ && mutations.challenge.data.devVerificationCode ? (
              <Notice
                title={`${c.devCode}: ${mutations.challenge.data.devVerificationCode}`}
              />
            ) : null}
            <Controller
              control={resignation.control}
              name="code"
              rules={{
                pattern: { value: /^\d{6}$/, message: c.code },
                required: c.required,
              }}
              render={({ field, fieldState }) => (
                <TextField
                  error={fieldState.error?.message}
                  keyboardType="number-pad"
                  label={c.code}
                  maxLength={6}
                  onChangeText={(value) => {
                    mutations.verifyResignation.reset();
                    field.onChange(value);
                  }}
                  value={field.value}
                />
              )}
            />
            {resignation.formState.errors.root?.server?.message ? (
              <Notice
                title={resignation.formState.errors.root.server.message}
                tone="error"
              />
            ) : null}
            <Button
              loading={resignation.formState.isSubmitting}
              onPress={() => void submitResignation()}
              testID="account-resign-submit"
              variant="destructive"
            >
              {c.resign}
            </Button>
            <Button
              disabled={resignation.formState.isSubmitting}
              loading={mutations.challenge.isPending}
              onPress={() => void requestResignationChallenge()}
              variant="outline"
            >
              {c.resendCode}
            </Button>
          </>
        )}
      </Surface>
    </Screen>
  );
}

type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
function PasswordField({
  control,
  label,
  name,
  required,
}: {
  control: Control<PasswordValues>;
  label: string;
  name: FieldPath<PasswordValues>;
  required: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={{ required }}
      render={({ field, fieldState }) => (
        <TextField
          error={fieldState.error?.message}
          label={label}
          onBlur={field.onBlur}
          onChangeText={field.onChange}
          secureTextEntry
          value={field.value}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  accountLinks: { gap: spacing.x2 },
  avatar: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  avatarText: { color: colors.accentDeep },
  danger: { borderColor: colors.danger },
  disclosures: { gap: spacing.x2 },
  heading: { gap: spacing.x2 },
  profileHero: { alignItems: "center", flexDirection: "row", gap: spacing.x3 },
  profileIdentity: { flex: 1, gap: spacing.x1, minWidth: 0 },
  profileMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  premiumBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  freeBadge: {
    alignSelf: "flex-start",
    borderColor: colors.line,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.muted,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  reasonList: { gap: spacing.x2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  logoutRow: { alignItems: "flex-start", marginTop: spacing.x1 },
  utilityRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  utilityButton: { flex: 1 },
});
