import React from "react";
import {
  Controller,
  useForm,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { Alert, ScrollView, Share, StyleSheet, View } from "react-native";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { colors, spacing } from "@/shared/theme/tokens";
import {
  AppText,
  Button,
  LoadingState,
  Notice,
  Screen,
  Surface,
  TextField,
} from "@/shared/ui";

import { memoryCopy } from "./copy";
import {
  useCardMutations,
  useGroupMutations,
  useMemoryCardGroup,
} from "./queries";
import type { DuplicatePolicy, MemoryCard, MemoryCardInput } from "./types";
import {
  MAX_MEMORY_CARD_UPLOAD_SIZE,
  MemoryCardUploadError,
  duplicateMemoryCardFronts,
  memoryCardsJson,
  memoryCardTemplateJson,
  parseMemoryCardUpload,
} from "./upload";

type ImportForm = {
  duplicatePolicy: DuplicatePolicy;
  uploadText: string;
};

export function MemoryCardGroupScreen({
  groupId,
  mode = "detail",
  onBack,
  onOpenStudy,
  premium,
}: {
  groupId: number;
  mode?: "detail" | "study";
  onBack(): void;
  onOpenStudy?(): void;
  premium: boolean;
}) {
  const { locale } = useI18n();
  const c = memoryCopy(locale);
  const query = useMemoryCardGroup(groupId, premium);
  const groupMutations = useGroupMutations();
  const cardMutations = useCardMutations(groupId);
  const groupForm = useForm<{
    title: string;
    description: string;
    sourceLabel: string;
  }>({
    values: {
      title: query.data?.title ?? "",
      description: query.data?.description ?? "",
      sourceLabel: query.data?.sourceLabel ?? "",
    },
  });
  const cardForm = useForm<MemoryCardInput>({
    defaultValues: { frontText: "", backText: "", exampleText: "", memo: "" },
  });
  const importForm = useForm<ImportForm>({
    defaultValues: {
      duplicatePolicy: "replace",
      uploadText: memoryCardTemplateJson(),
    },
  });
  const duplicatePolicy = useWatch({
    control: importForm.control,
    name: "duplicatePolicy",
  });
  const uploadText = useWatch({
    control: importForm.control,
    name: "uploadText",
  });
  const initializedImportGroupId = React.useRef<number | undefined>(undefined);
  const [editingCard, setEditingCard] = React.useState<MemoryCard>();
  const [validatedImportCount, setValidatedImportCount] = React.useState<number>();
  const [detectedDuplicateFronts, setDetectedDuplicateFronts] = React.useState<string[]>([]);
  const [validatedUploadText, setValidatedUploadText] = React.useState<string>();
  const [studyIndex, setStudyIndex] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const mutationError =
    cardMutations.memorize.isError ||
    cardMutations.remove.isError;

  React.useEffect(() => {
    if (!query.data || initializedImportGroupId.current === query.data.groupId) return;
    initializedImportGroupId.current = query.data.groupId;
    importForm.reset({
      duplicatePolicy: importForm.getValues("duplicatePolicy"),
      uploadText: query.data.cards?.length
        ? memoryCardsJson(query.data.cards)
        : memoryCardTemplateJson(),
    });
  }, [importForm, query.data]);

  if (!premium)
    return (
      <Screen>
        <Notice title={c.premium}>
          <Button onPress={onBack}>{c.back}</Button>
        </Notice>
      </Screen>
    );
  if (!Number.isSafeInteger(groupId) || groupId <= 0)
    return (
      <Screen>
        <Notice title={c.error}>
          <Button onPress={onBack}>{c.back}</Button>
        </Notice>
      </Screen>
    );
  if (query.isPending)
    return (
      <Screen>
        <Surface variant="section">
          <Button onPress={onBack} variant="ghost">← {c.back}</Button>
        </Surface>
        <LoadingState label={c.title} />
      </Screen>
    );
  if (query.isError || !query.data)
    return (
      <Screen>
        <Surface variant="section">
          <Button onPress={onBack} variant="ghost">← {c.back}</Button>
        </Surface>
        <Notice title={c.error} tone="error">
          <Button onPress={() => void query.refetch()}>{c.retry}</Button>
        </Notice>
      </Screen>
    );
  const cards = query.data.cards ?? [];
  const saveGroup = groupForm.handleSubmit(async (input) => {
    try {
      await groupMutations.update.mutateAsync({ groupId, input });
    } catch {
      groupForm.setError("root.server", { message: c.error });
    }
  });
  const saveCard = cardForm.handleSubmit(async (input) => {
    try {
      const response = editingCard
        ? await cardMutations.update.mutateAsync({
          cardId: editingCard.cardId,
          input,
          })
        : await cardMutations.create.mutateAsync(input);
      syncGeneratedJson(response.cards);
      setEditingCard(undefined);
      cardForm.reset();
    } catch {
      cardForm.setError("root.server", { message: c.error });
    }
  });
  const startEdit = (card: MemoryCard) => {
    setEditingCard(card);
    cardForm.reset({
      frontText: card.frontText,
      backText: card.backText,
      exampleText: card.exampleText ?? "",
      memo: card.memo ?? "",
    });
  };
  const syncGeneratedJson = (nextCards: MemoryCard[], force = false) => {
    if (force || !importForm.getFieldState("uploadText").isDirty) {
      importForm.reset({
        duplicatePolicy: importForm.getValues("duplicatePolicy"),
        uploadText: nextCards.length
          ? memoryCardsJson(nextCards)
          : memoryCardTemplateJson(),
      });
    }
  };
  const validationMessage = (error: unknown) => {
    if (!(error instanceof MemoryCardUploadError)) {
      return c.validationObject("JSON");
    }
    switch (error.rule) {
      case "array":
        return c.validationArray(error.path);
      case "length":
        return c.validationLength(error.path, error.limit ?? MAX_MEMORY_CARD_UPLOAD_SIZE);
      case "required":
        return c.validationRequired(error.path);
      case "string":
        return c.validationString(error.path);
      case "max":
        return c.validationMax(error.path, error.limit ?? 0);
      default:
        return c.validationObject(error.path);
    }
  };
  const validateImport = () => {
    try {
      const cards = parseMemoryCardUpload(importForm.getValues("uploadText"));
      importForm.clearErrors("uploadText");
      setValidatedImportCount(cards.length);
      setDetectedDuplicateFronts(duplicateMemoryCardFronts(cards, query.data?.cards ?? []));
      setValidatedUploadText(importForm.getValues("uploadText"));
      return cards;
    } catch (error) {
      setValidatedImportCount(undefined);
      setDetectedDuplicateFronts([]);
      setValidatedUploadText(undefined);
      importForm.setError("uploadText", { message: validationMessage(error) });
      return undefined;
    }
  };
  const bulkImport = importForm.handleSubmit(async ({ duplicatePolicy }) => {
    const reviewedCurrentDraft = validatedUploadText === importForm.getValues("uploadText");
    const cards = validateImport();
    if (!cards) return;
    if (duplicateMemoryCardFronts(cards, query.data?.cards ?? []).length > 0 && !reviewedCurrentDraft) return;
    try {
      const response = await cardMutations.bulk.mutateAsync({
        cards,
        duplicatePolicy,
      });
      syncGeneratedJson(response.cards, true);
      setValidatedImportCount(undefined);
      setDetectedDuplicateFronts([]);
      setValidatedUploadText(undefined);
    } catch {
      setValidatedImportCount(undefined);
      importForm.setError("root.server", { message: c.bulkSaveError });
    }
  });
  if (mode === "study")
    return (
      <StudyView
        cards={cards}
        index={studyIndex}
        memorizeError={cardMutations.memorize.isError}
        memorizePending={cardMutations.memorize.isPending}
        onClose={onBack}
        onMemorizedChange={(card, memorized) =>
          cardMutations.memorize.mutate({ cardId: card.cardId, memorized })
        }
        onNext={() => {
          setRevealed(false);
          setStudyIndex((current) => (current + 1) % cards.length);
        }}
        onReveal={() => setRevealed(true)}
        revealed={revealed}
      />
    );

  return (
    <Screen layout="edge" testID="memory-card-group-screen">
      <Surface variant="section">
        <Button onPress={onBack} variant="ghost">
          ← {c.back}
        </Button>
      </Surface>
      {mutationError ? <Notice title={c.error} tone="error" /> : null}
      <Surface variant="section">
        {groupForm.formState.errors.root?.server?.message ? (
          <Notice
            title={groupForm.formState.errors.root.server.message}
            tone="error"
          />
        ) : null}
        <Controller
          control={groupForm.control}
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
          control={groupForm.control}
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
          control={groupForm.control}
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
          loading={groupMutations.update.isPending}
          onPress={() => void saveGroup()}
        >
          {c.save}
        </Button>
      </Surface>
      <View style={styles.row}>
        <Button
          disabled={cards.length === 0}
          onPress={() => {
            setStudyIndex(0);
            setRevealed(false);
            onOpenStudy?.();
          }}
          testID="memory-card-study-open"
        >
          {c.study}
        </Button>
        <Button
          disabled={cards.length === 0}
          onPress={() =>
            void Share.share({
              message: memoryCardsJson(cards),
              title: query.data.title,
            })
          }
          variant="outline"
        >
          {c.export}
        </Button>
      </View>
      <AppText accessibilityRole="header" variant="heading">
        {c.cards} ({cards.length})
      </AppText>
      {cards.map((card) => (
        <Surface key={card.cardId} variant="section">
          <AppText variant="heading">{card.frontText}</AppText>
          <AppText>{card.backText}</AppText>
          {card.exampleText ? (
            <AppText variant="caption">{card.exampleText}</AppText>
          ) : null}
          {card.memo ? <AppText variant="caption">{card.memo}</AppText> : null}
          <View style={styles.row}>
            <Button
              accessibilityLabel={
                card.memorized ? c.markUnmemorized : c.markMemorized
              }
              accessibilityState={{
                checked: card.memorized,
                selected: card.memorized,
              }}
              onPress={() =>
                cardMutations.memorize.mutate({
                  cardId: card.cardId,
                  memorized: !card.memorized,
                })
              }
              variant={card.memorized ? "primary" : "outline"}
            >
              {c.memorized}
            </Button>
            <Button onPress={() => startEdit(card)} variant="ghost">
              {c.edit}
            </Button>
            <Button
              onPress={() =>
                Alert.alert(c.remove, c.confirmDelete, [
                  { text: c.cancel, style: "cancel" },
                  {
                    text: c.remove,
                    style: "destructive",
                    onPress: () =>
                      cardMutations.remove.mutate(card.cardId, {
                        onSuccess: (response) =>
                          syncGeneratedJson(response.cards),
                      }),
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
      <Surface>
        <AppText accessibilityRole="header" variant="heading">
          {editingCard ? c.edit : c.createCard}
        </AppText>
        {cardForm.formState.errors.root?.server?.message ? (
          <Notice
            title={cardForm.formState.errors.root.server.message}
            tone="error"
          />
        ) : null}
        <CardFields form={cardForm} />
        <View style={styles.row}>
          {editingCard ? (
            <Button
              onPress={() => {
                setEditingCard(undefined);
                cardForm.reset();
              }}
              variant="ghost"
            >
              {c.cancel}
            </Button>
          ) : null}
          <Button
            loading={
              cardMutations.create.isPending || cardMutations.update.isPending
            }
            onPress={() => void saveCard()}
          >
            {c.save}
          </Button>
        </View>
      </Surface>
      <Surface>
        <AppText accessibilityRole="header" variant="heading">
          {c.import}
        </AppText>
        <AppText>{c.importHelp}</AppText>
        <Button
          onPress={() => void Share.share({ message: memoryCardTemplateJson(), title: c.templateTitle })}
          testID="memory-card-template-share"
          variant="outline"
        >
          {c.shareTemplate}
        </Button>
        {cards.length > MAX_MEMORY_CARD_UPLOAD_SIZE ? (
          <View testID="memory-card-upload-limit-notice">
            <Notice
              title={c.uploadLimit(cards.length, MAX_MEMORY_CARD_UPLOAD_SIZE)}
            />
          </View>
        ) : null}
        {importForm.formState.errors.root?.server?.message ? (
          <View testID="memory-card-upload-server-error">
            <Notice
              title={importForm.formState.errors.root.server.message}
              tone="error"
            />
          </View>
        ) : null}
        {importForm.formState.errors.uploadText?.message ? (
          <View testID="memory-card-upload-validation-error">
            <Notice
              title={importForm.formState.errors.uploadText.message}
              tone="error"
            />
          </View>
        ) : null}
        {validatedImportCount !== undefined ? (
          <View testID="memory-card-upload-validated">
            <Notice title={c.validated(validatedImportCount)} />
          </View>
        ) : null}
        <Controller
          control={importForm.control}
          name="uploadText"
          render={({ field, fieldState }) => (
            <TextField
              aria-invalid={Boolean(fieldState.error)}
              label={c.importJson}
              multiline
              onChangeText={(value) => {
                importForm.clearErrors();
                setValidatedImportCount(undefined);
                setDetectedDuplicateFronts([]);
                setValidatedUploadText(undefined);
                field.onChange(value);
              }}
              testID="memory-card-upload-text"
              value={field.value}
            />
          )}
        />
        {detectedDuplicateFronts.length > 0 && validatedUploadText === uploadText ? (
        <View style={styles.duplicateReview} testID="memory-card-duplicate-review">
          <Notice title={c.duplicatesDetected(detectedDuplicateFronts.length)} />
          <AppText variant="caption">{detectedDuplicateFronts.join(", ")}</AppText>
          <View style={styles.row}>
          {(["replace", "ignore", "remove"] as DuplicatePolicy[]).map(
            (value) => (
              <Button
                accessibilityState={{
                  selected: duplicatePolicy === value,
                }}
                key={value}
                onPress={() =>
                  importForm.setValue("duplicatePolicy", value, {
                    shouldDirty: true,
                  })
                }
                variant={
                  duplicatePolicy === value
                    ? "primary"
                    : "outline"
                }
              >
                {value === "replace"
                  ? c.replace
                  : value === "ignore"
                    ? c.ignore
                    : c.removeDuplicates}
              </Button>
            ),
          )}
          </View>
        </View>
        ) : null}
        <Button onPress={validateImport} variant="outline">
          {c.validate}
        </Button>
        <Button
          disabled={!uploadText.trim()}
          loading={cardMutations.bulk.isPending}
          onPress={() => void bulkImport()}
          testID="memory-card-upload-submit"
        >
          {c.runImport}
        </Button>
      </Surface>
    </Screen>
  );
}

function CardFields({ form }: { form: UseFormReturn<MemoryCardInput> }) {
  const { locale } = useI18n();
  const c = memoryCopy(locale);
  return (
    <>
      <Controller
        control={form.control}
        name="frontText"
        rules={{ required: c.front }}
        render={({ field, fieldState }) => (
          <TextField
            error={fieldState.error?.message}
            label={c.front}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="backText"
        rules={{ required: c.backText }}
        render={({ field, fieldState }) => (
          <TextField
            error={fieldState.error?.message}
            label={c.backText}
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="exampleText"
        render={({ field }) => (
          <TextField
            label={c.example}
            multiline
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={form.control}
        name="memo"
        render={({ field }) => (
          <TextField
            label={c.memo}
            multiline
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
    </>
  );
}
function StudyView({
  cards,
  index,
  memorizeError,
  memorizePending,
  onClose,
  onMemorizedChange,
  onNext,
  onReveal,
  revealed,
}: {
  cards: MemoryCard[];
  index: number;
  memorizeError: boolean;
  memorizePending: boolean;
  onClose(): void;
  onMemorizedChange(card: MemoryCard, memorized: boolean): void;
  onNext(): void;
  onReveal(): void;
  revealed: boolean;
}) {
  const { locale } = useI18n();
  const c = memoryCopy(locale);
  const card = cards[index];
  const memorizedCount = cards.filter((candidate) => candidate.memorized).length;
  if (!card)
    return (
      <Screen>
        <Notice title={c.done}>
          <Button onPress={onClose}>{c.backToGroup}</Button>
        </Notice>
      </Screen>
    );
  return (
    <Screen layout="edge" scroll={false} testID="memory-card-study-screen">
      <View style={styles.studyHeader}>
        <Button onPress={onClose} testID="memory-card-study-back" variant="ghost">
          ← {c.backToGroup}
        </Button>
        <View style={styles.studyProgress}>
          <AppText variant="caption">{index + 1} / {cards.length}</AppText>
          <AppText testID="memory-card-study-memorized-count" variant="caption">
            {c.memorizedCount(memorizedCount, cards.length)}
          </AppText>
        </View>
      </View>
      {memorizeError ? (
        <View testID="memory-card-study-memorized-error">
          <Notice title={c.memorizedSaveError} tone="error" />
        </View>
      ) : null}
      <Surface style={styles.study} variant="section">
        <ScrollView contentContainerStyle={styles.studyCardContent} testID="memory-card-study-card-scroll">
          <AppText accessibilityRole="header" style={styles.studyWord} variant="title">
            {card.frontText}
          </AppText>
          {revealed ? (
            <>
              <View style={styles.rule} />
              <AppText variant="heading">{card.backText}</AppText>
              {card.exampleText ? <AppText>{card.exampleText}</AppText> : null}
            </>
          ) : (
            <AppText style={styles.studyHidden} variant="eyebrow">{c.answerHidden}</AppText>
          )}
        </ScrollView>
      </Surface>
      <View style={styles.studyActions} testID="memory-card-study-actions">
      <Button
        accessibilityLabel={
          card.memorized ? c.markUnmemorized : c.markMemorized
        }
        accessibilityState={{
          busy: memorizePending,
          checked: card.memorized,
          disabled: memorizePending,
          selected: card.memorized,
        }}
        disabled={memorizePending}
        onPress={() => onMemorizedChange(card, !card.memorized)}
        testID="memory-card-study-memorized-toggle"
        variant={card.memorized ? "primary" : "outline"}
      >
        {c.memorized}
      </Button>
      {revealed ? (
        <Button onPress={onNext}>{c.next}</Button>
      ) : (
        <Button onPress={onReveal} testID="memory-card-study-reveal">{c.reveal}</Button>
      )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  duplicateReview: { gap: spacing.x2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  rule: { backgroundColor: colors.line, height: 1, width: "100%" },
  study: { flex: 1, minHeight: 0 },
  studyActions: { gap: spacing.x2, marginTop: "auto", padding: spacing.x5 },
  studyCardContent: { alignItems: "center", flexGrow: 1, gap: spacing.x3, justifyContent: "center", minWidth: 0 },
  studyHeader: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x2,
  },
  studyHidden: { color: colors.muted, textAlign: "center" },
  studyProgress: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.x1 },
  studyWord: { fontSize: 44, lineHeight: 52, textAlign: "center" },
});
