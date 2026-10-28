import { useState } from "react";
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

import { reflectionCopy } from "./copy";
import { guideStages, reflectionLabels } from "./labels";
import { shareGuideMarkdown } from "./guide-export";
import {
  createGuideEditDraft,
  guideEditError,
  moveGuideEditItem,
  toEditGuideInput,
  type GuideEditDraft,
} from "./guide-edit";
import {
  useCreateRun,
  useEditGuide,
  useGuide,
  useGuideMarkdown,
  useGuideProjection,
  useGuideVersions,
  useReflectionTimeline,
  useRegenerateGuide,
} from "./queries";
import { ownsReflectionRoute } from "./route-ownership";
import type {
  FacilitatorGuideProjection,
  GuideProjection,
  GuideProjectionResponse,
} from "./types";

export function GuideScreen({
  bookId,
  guideId,
  onBack,
  onDiscuss,
  onGuideVersion,
}: {
  bookId: number;
  guideId: number;
  onBack?(): void;
  onDiscuss(id: number): void;
  onGuideVersion(id: number): void;
}) {
  const { locale } = useI18n();
  const c = reflectionCopy(locale);
  const labels = reflectionLabels(locale);
  const guide = useGuide(guideId);
  const timeline = useReflectionTimeline(guide.data?.sessionId ?? 0);
  const [projectionType, setProjectionType] =
    useState<GuideProjection>("FACILITATOR");
  const [draft, setDraft] = useState<GuideEditDraft | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);
  const versions = useGuideVersions(guide.data?.interviewId);
  const projection = useGuideProjection(guideId, projectionType, !draft);
  const edit = useEditGuide(guideId);
  const regenerate = useRegenerateGuide(guideId);
  const exportMarkdown = useGuideMarkdown(guideId);
  const createRun = useCreateRun(guideId);
  const pageHeader = (page = false) => (
    <EditorialHeader
      backLabel={c.backToReflection}
      onBack={onBack}
      page={page}
      title={c.guide}
    />
  );

  if (guide.isLoading || (guide.data && timeline.isLoading))
    return (
      <Screen scroll={false}>
        {pageHeader()}
        <LoadingState label={c.guide} />
      </Screen>
    );
  if (guide.isError) {
    const notFound =
      guide.error instanceof ApiRequestError && guide.error.status === 404;
    return (
      <Screen>
        {pageHeader()}
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button onPress={() => void guide.refetch()} variant="outline">
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  if (!guide.data)
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );
  if (timeline.isError) {
    const notFound =
      timeline.error instanceof ApiRequestError && timeline.error.status === 404;
    return (
      <Screen>
        {pageHeader()}
        <Notice title={notFound ? c.notFound : c.error} tone="error">
          {!notFound ? (
            <Button onPress={() => void timeline.refetch()} variant="outline">
              {c.retry}
            </Button>
          ) : null}
        </Notice>
      </Screen>
    );
  }
  if (!ownsReflectionRoute(timeline.data, bookId, guide.data.sessionId))
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.notFound} tone="error" />
      </Screen>
    );

  const isConflictError = (error: unknown) =>
    error instanceof ApiRequestError && error.status === 409;
  const conflict = [edit.error, regenerate.error].some(isConflictError);
  const mutationFailed =
    [edit.error, regenerate.error].some(
      (error) => Boolean(error) && !isConflictError(error),
    ) || Boolean(createRun.error);
  const mutationPending =
    edit.isPending || regenerate.isPending || createRun.isPending;
  const chooseProjection = (next: GuideProjection) => {
    if (!draft) setProjectionType(next);
  };
  const saveDraft = () => {
    if (!draft) return;
    const error = guideEditError(draft, guide.data.targetMinutes);
    if (error) {
      setValidation(
        error === "blank"
          ? c.editBlank
          : error === "issues"
            ? c.editIssues
            : c.editMinutes,
      );
      return;
    }
    setValidation(null);
    edit.mutate(toEditGuideInput(draft, guide.data.guideVersion), {
      onSuccess: (next) => {
        setDraft(null);
        onGuideVersion(next.guideId);
      },
    });
  };
  const confirmRegenerate = () =>
    Alert.alert(c.regenerate, c.confirmRegenerate, [
      { style: "cancel", text: c.cancel },
      {
        onPress: () =>
          regenerate.mutate(
            {
              brief: {
                audienceMode: guide.data.audienceMode,
                disclosureMode: guide.data.disclosureMode,
                facilitationLevel: guide.data.facilitationLevel,
                purpose: guide.data.purpose,
                targetMinutes: guide.data.targetMinutes as 20 | 40 | 60,
              },
              expectedVersion: guide.data.guideVersion,
            },
            { onSuccess: (next) => onGuideVersion(next.guideId) },
          ),
        text: c.regenerate,
      },
    ]);

  return (
    <Screen layout="edge" testID="reflection-guide-screen">
      <EditorialHeader
        backLabel={c.backToReflection}
        description={`v${guide.data.guideVersion} · ${guide.data.current ? c.current : c.archived} · ${labels.audience[guide.data.audienceMode]} · ${labels.targetMinutes[guide.data.targetMinutes as 20 | 40 | 60]}`}
        onBack={onBack}
        page
        title={c.guide}
      />

      {conflict ? <Notice title={c.conflict} tone="error" /> : null}
      {mutationFailed ? <Notice title={c.error} tone="error" /> : null}
      {validation ? <Notice title={validation} tone="error" /> : null}
      {exportError ? <Notice title={c.exportError} tone="error" /> : null}

      {versions.isError ? (
        <Notice title={c.error} tone="error">
          <Button onPress={() => void versions.refetch()} variant="outline">
            {c.retry}
          </Button>
        </Notice>
      ) : null}

      {versions.data?.versions.length ? (
        <Surface variant="section">
          <AppText variant="heading">{c.versions}</AppText>
          <View style={styles.rowWrap}>
            {versions.data.versions.map((version) => (
              <Button
                accessibilityState={{ selected: version.guideId === guideId }}
                disabled={Boolean(draft) || mutationPending}
                key={version.guideId}
                onPress={() => onGuideVersion(version.guideId)}
                variant={version.guideId === guideId ? "primary" : "outline"}
              >
                v{version.guideVersion} · {version.current ? c.current : c.archived}
              </Button>
            ))}
          </View>
        </Surface>
      ) : null}

      <View style={[styles.row, styles.projectionPicker]}>
        <Button
          accessibilityState={{ selected: projectionType === "FACILITATOR" }}
          disabled={Boolean(draft) || mutationPending}
          onPress={() => chooseProjection("FACILITATOR")}
          variant={projectionType === "FACILITATOR" ? "primary" : "outline"}
        >
          {c.facilitator}
        </Button>
        <Button
          accessibilityState={{ selected: projectionType === "PARTICIPANT" }}
          disabled={Boolean(draft) || mutationPending}
          onPress={() => chooseProjection("PARTICIPANT")}
          variant={projectionType === "PARTICIPANT" ? "primary" : "outline"}
        >
          {c.participant}
        </Button>
      </View>

      {draft ? (
        <GuideEditor
          c={c}
          draft={draft}
          onChange={setDraft}
          targetMinutes={guide.data.targetMinutes}
        />
      ) : projection.isLoading ? (
        <LoadingState label={c.guide} />
      ) : projection.data ? (
        <GuideProjectionView c={c} projection={projection.data} />
      ) : (
        <>
          <Notice title={c.projectionError} tone="error" />
          <Button onPress={() => void projection.refetch()} variant="outline">
            {c.retry}
          </Button>
        </>
      )}

      <View style={styles.pageActions}>
        <Button
          disabled={!projection.data || Boolean(draft) || mutationPending}
          loading={exportMarkdown.isPending}
          onPress={() => {
            setExportError(false);
            exportMarkdown.mutate(projectionType, {
              onError: () => setExportError(true),
              onSuccess: (value) => {
                void shareGuideMarkdown(value).catch(() => setExportError(true));
              },
            });
          }}
          variant="outline"
        >
          {c.exportMarkdown}
        </Button>
      </View>

      {guide.data.current && projectionType === "FACILITATOR" ? (
        draft ? (
          <View style={[styles.row, styles.pageActions]}>
            <Button loading={edit.isPending} onPress={saveDraft}>
              {c.saveGuide}
            </Button>
            <Button
              disabled={edit.isPending}
              onPress={() => setDraft(null)}
              variant="outline"
            >
              {c.cancelEdit}
            </Button>
          </View>
        ) : (
          <View style={[styles.actions, styles.pageActions]}>
            <Button
              disabled={mutationPending}
              onPress={() => setDraft(createGuideEditDraft(guide.data))}
            >
              {c.editGuide}
            </Button>
            <Button
              loading={regenerate.isPending}
              disabled={mutationPending}
              onPress={confirmRegenerate}
              variant="outline"
            >
              {c.regenerate}
            </Button>
            <Button
              loading={createRun.isPending}
              disabled={mutationPending}
              onPress={() =>
                guide.data.runId
                  ? onDiscuss(guide.data.runId)
                  : createRun.mutate(undefined, {
                      onSuccess: (run) => onDiscuss(run.runId),
                    })
              }
            >
              {guide.data.runId ? c.openDiscussion : c.startDiscussionWithGuide}
            </Button>
          </View>
        )
      ) : guide.data.runId ? (
        <View style={styles.pageActions}>
          <Button onPress={() => onDiscuss(guide.data.runId!)}>{c.openDiscussion}</Button>
        </View>
      ) : null}
    </Screen>
  );
}

function GuideProjectionView({
  c,
  projection,
}: {
  c: ReturnType<typeof reflectionCopy>;
  projection: GuideProjectionResponse;
}) {
  const { locale } = useI18n();
  const labels = reflectionLabels(locale);
  return (
    <>
      <Surface variant="section">
        <AppText variant="caption">
          {projection.bookTitle}
          {projection.bookAuthor ? ` · ${projection.bookAuthor}` : ""}
        </AppText>
        <AppText variant="heading">{projection.goal}</AppText>
        {projection.issues.map((issue, index) => (
          <AppText key={`${projection.guideId}-issue-${index + 1}`}>• {issue}</AppText>
        ))}
      </Surface>
      <Surface variant="section">
        <AppText variant="heading">{c.guideStages}</AppText>
        <View style={styles.stageRow}>
          {guideStages.map((stage, index) => (
            <AppText key={stage} variant="caption">
              {index + 1}. {labels.stage[stage]}
            </AppText>
          ))}
        </View>
      </Surface>
      {projection.items.map((item) => (
        <Surface key={`${item.stage}-${item.order}`} variant="section">
          <AppText variant="caption">
            {labels.stage[item.stage as keyof typeof labels.stage] ?? item.stage}
            {"expectedMinutes" in item
              ? ` · ${item.expectedMinutes}${locale === "ko" ? "분" : " min"}`
              : ""}
            {" · "}
            {labels.priority[item.priority]}
          </AppText>
          <AppText variant="heading">{item.question}</AppText>
          {projection.projection === "FACILITATOR" ? (
            <FacilitatorDetails
              c={c}
              item={item as FacilitatorGuideProjection["items"][number]}
            />
          ) : null}
        </Surface>
      ))}
    </>
  );
}

function FacilitatorDetails({
  c,
  item,
}: {
  c: ReturnType<typeof reflectionCopy>;
  item: FacilitatorGuideProjection["items"][number];
}) {
  const { locale } = useI18n();
  const labels = reflectionLabels(locale);
  return (
    <View style={styles.details}>
      <AppText>{c.intent}: {item.intent}</AppText>
      <AppText>{c.minutes}: {item.expectedMinutes}</AppText>
      <AppText>{c.source}: {item.sourceLabel}</AppText>
      {item.sourceVersion ? <AppText variant="caption">{item.sourceVersion}</AppText> : null}
      {item.sourceExcerpt ? <AppText numberOfLines={3}>“{item.sourceExcerpt}”</AppText> : null}
      <AppText>{c.sensitivity}: {labels.sensitivity[item.sensitivity]}</AppText>
      {item.skippable ? <AppText>{c.skippable}</AppText> : null}
      {item.followUps.length ? (
        <AppText>{c.followUps}: {item.followUps.join(" · ")}</AppText>
      ) : null}
    </View>
  );
}

function GuideEditor({
  c,
  draft,
  onChange,
  targetMinutes,
}: {
  c: ReturnType<typeof reflectionCopy>;
  draft: GuideEditDraft;
  onChange(value: GuideEditDraft): void;
  targetMinutes: number;
}) {
  const { locale } = useI18n();
  const labels = reflectionLabels(locale);
  return (
    <>
      <TextField
        label={c.goal}
        multiline
        onChangeText={(goal) => onChange({ ...draft, goal })}
        value={draft.goal}
      />
      {draft.issues.map((issue, index) => (
        <View key={`issue-${index + 1}`} style={styles.details}>
          <TextField
            label={`${c.issues} ${index + 1}`}
            multiline
            onChangeText={(value) =>
              onChange({
                ...draft,
                issues: draft.issues.map((current, currentIndex) =>
                  currentIndex === index ? value : current,
                ),
              })
            }
            value={issue}
          />
          <Button
            disabled={draft.issues.length <= 2}
            onPress={() =>
              onChange({
                ...draft,
                issues: draft.issues.filter((_, currentIndex) => currentIndex !== index),
              })
            }
            variant="ghost"
          >
            {c.removeIssue}
          </Button>
        </View>
      ))}
      <Button
        disabled={draft.issues.length >= 4}
        onPress={() => onChange({ ...draft, issues: [...draft.issues, ""] })}
        variant="outline"
      >
        {c.addIssue}
      </Button>
      {draft.items.map((item, index) => (
        <Surface key={item.itemId} variant="section">
          <AppText variant="caption">
            {labels.stage[item.stage as keyof typeof labels.stage] ?? item.stage} ·{" "}
            {labels.priority[item.priority]}
          </AppText>
          <View style={styles.row}>
            <Button
              disabled={index === 0}
              onPress={() => onChange(moveGuideEditItem(draft, index, -1))}
              variant="ghost"
            >
              {c.moveUp}
            </Button>
            <Button
              disabled={index === draft.items.length - 1}
              onPress={() => onChange(moveGuideEditItem(draft, index, 1))}
              variant="ghost"
            >
              {c.moveDown}
            </Button>
          </View>
          <TextField
            label={`${c.questions} ${index + 1}`}
            multiline
            onChangeText={(question) =>
              onChange({
                ...draft,
                items: draft.items.map((current) =>
                  current.itemId === item.itemId ? { ...current, question } : current,
                ),
              })
            }
            value={item.question}
          />
          <TextField
            label={c.intent}
            multiline
            onChangeText={(intent) =>
              onChange({
                ...draft,
                items: draft.items.map((current) =>
                  current.itemId === item.itemId ? { ...current, intent } : current,
                ),
              })
            }
            value={item.intent}
          />
          <TextField
            keyboardType="number-pad"
            label={c.minutes}
            onChangeText={(value) =>
              onChange({
                ...draft,
                items: draft.items.map((current) =>
                  current.itemId === item.itemId
                    ? { ...current, expectedMinutes: Number(value) || 0 }
                    : current,
                ),
              })
            }
            value={String(item.expectedMinutes)}
          />
          {item.followUps.map((followUp, followUpIndex) => (
            <TextField
              key={`${item.itemId}-follow-up-${followUpIndex + 1}`}
              label={`${c.followUps} ${followUpIndex + 1}`}
              multiline
              onChangeText={(value) =>
                onChange({
                  ...draft,
                  items: draft.items.map((current) =>
                    current.itemId === item.itemId
                      ? {
                          ...current,
                          followUps: current.followUps.map((entry, entryIndex) =>
                            entryIndex === followUpIndex ? value : entry,
                          ),
                        }
                      : current,
                  ),
                })
              }
              value={followUp}
            />
          ))}
        </Surface>
      ))}
      <AppText variant="caption">
        {c.minutes}: {draft.items.reduce((sum, item) => sum + item.expectedMinutes, 0)} / {targetMinutes}
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.x3 },
  details: { gap: spacing.x1 },
  header: { gap: spacing.x1 },
  pageActions: { gap: spacing.x2, paddingHorizontal: spacing.x5, paddingVertical: spacing.x3 },
  projectionPicker: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  stageRow: { gap: spacing.x1 },
});
