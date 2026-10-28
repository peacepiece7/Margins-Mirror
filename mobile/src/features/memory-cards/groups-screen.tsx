import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, StyleSheet, View } from "react-native";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { colors, radius, spacing } from "@/shared/theme/tokens";
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

import { memoryCopy } from "./copy";
import { useGroupMutations, useMemoryCardGroups } from "./queries";
import type { MemoryCardGroupInput } from "./types";

function displayDate(value: string | undefined, locale: "en" | "ko") {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US");
}

export function MemoryCardGroupsScreen({
  bookId,
  contextLabel,
  onBack,
  onOpenGroup,
  premium,
}: {
  bookId?: number;
  contextLabel?: string;
  onBack(): void;
  onOpenGroup(groupId: number): void;
  premium: boolean;
}) {
  const { locale } = useI18n();
  const c = memoryCopy(locale);
  const query = useMemoryCardGroups(premium, bookId);
  const mutations = useGroupMutations();
  const form = useForm<MemoryCardGroupInput>({
    defaultValues: { bookId, title: "", description: "", sourceLabel: "" },
  });
  const { reset } = form;
  useEffect(() => {
    reset({ bookId, title: "", description: "", sourceLabel: "" });
  }, [bookId, reset]);
  const submit = form.handleSubmit(async (input) => {
    try {
      await mutations.create.mutateAsync(input);
      reset({ bookId, title: "", description: "", sourceLabel: "" });
    } catch {
      form.setError("root.server", { message: c.error });
    }
  });
  if (!premium)
    return (
      <Screen testID="memory-card-premium-gate">
        <Notice title={c.premium}>
          <Button onPress={onBack}>{c.back}</Button>
        </Notice>
      </Screen>
    );
  return (
    <Screen layout="edge" testID="memory-card-groups-screen">
      <EditorialHeader backLabel={c.back} onBack={onBack} page title={c.title} />
      <Surface testID="memory-card-premium-context" variant="section">
        <View style={styles.premiumContext}>
          <AppText style={styles.premiumDescription}>{c.subtitle}</AppText>
          <AppText style={styles.premiumBadge} variant="eyebrow">{c.premiumLabel}</AppText>
        </View>
      </Surface>
      {contextLabel ? (
        <Surface testID="memory-card-selected-book" variant="section">
          <AppText variant="heading">{contextLabel}</AppText>
        </Surface>
      ) : null}
      {query.isPending ? <LoadingState label={c.title} /> : null}
      {query.isError ? (
        <Notice title={c.error} tone="error">
          <Button onPress={() => void query.refetch()}>{c.retry}</Button>
        </Notice>
      ) : null}
      {mutations.remove.isError ? (
        <Notice title={c.error} tone="error" />
      ) : null}
      {query.data?.groups.length === 0 ? <Notice title={c.empty} /> : null}
      {query.data?.groups.map((group) => (
        <Surface key={group.groupId} variant="section">
          <View style={styles.groupRow}>
            <View style={styles.groupCopy}>
              <AppText variant="heading">{group.title}</AppText>
              {group.description ? <AppText>{group.description}</AppText> : null}
              <AppText variant="caption">
                {c.cards}: {group.cardCount}
                {group.sourceLabel ? ` · ${group.sourceLabel}` : ""}
              </AppText>
            </View>
            <View accessibilityLabel={`${c.cards}: ${group.cardCount}`} style={styles.countBadge}>
              <AppText style={styles.countText} variant="heading">{group.cardCount}</AppText>
            </View>
          </View>
          {group.updatedAt ? (
            <AppText testID={`memory-card-group-updated-${group.groupId}`} variant="caption">
              {c.updated(displayDate(group.updatedAt, locale))}
            </AppText>
          ) : null}
          <View style={styles.row}>
            <Button
              onPress={() => onOpenGroup(group.groupId)}
              testID="memory-card-group-open"
            >
              {c.open}
            </Button>
            <Button
              onPress={() =>
                Alert.alert(c.remove, c.confirmDelete, [
                  { text: c.cancel, style: "cancel" },
                  {
                    text: c.remove,
                    style: "destructive",
                    onPress: () => mutations.remove.mutate(group.groupId),
                  },
                ])
              }
              variant="ghost"
            >
              {c.remove}
            </Button>
          </View>
        </Surface>
      ))}
      <Surface variant="section">
        <AppText accessibilityRole="header" variant="heading">
          {c.create}
        </AppText>
        {form.formState.errors.root?.server?.message ? (
          <Notice
            title={form.formState.errors.root.server.message}
            tone="error"
          />
        ) : null}
        <Controller
          control={form.control}
          name="title"
          rules={{ required: c.groupTitle }}
          render={({ field, fieldState }) => (
            <TextField
              error={fieldState.error?.message}
              label={c.groupTitle}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <TextField
              label={c.description}
              multiline
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <Controller
          control={form.control}
          name="sourceLabel"
          render={({ field }) => (
            <TextField
              label={c.source}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        <Button
          loading={mutations.create.isPending}
          onPress={() => void submit()}
        >
          {c.create}
        </Button>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  countBadge: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  countText: { color: colors.accentDeep, fontSize: 16, lineHeight: 20 },
  groupCopy: { flex: 1, gap: spacing.x1, minWidth: 0 },
  groupRow: { alignItems: "center", flexDirection: "row", gap: spacing.x3 },
  heading: { gap: spacing.x2 },
  premiumBadge: {
    borderColor: colors.accent,
    borderRadius: radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  premiumContext: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.x3,
    justifyContent: "space-between",
  },
  premiumDescription: { color: colors.muted, flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
});
