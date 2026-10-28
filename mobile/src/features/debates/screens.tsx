import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Modal, Pressable, StyleSheet, View } from "react-native";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { colors, radius, spacing } from "@/shared/theme/tokens";
import { AppText, Button, EditorialHeader, LoadingState, Notice, Screen, Surface, TextField } from "@/shared/ui";

import { debateCopy } from "./copy";
import {
  debateTopicFromWindowTitle,
  localizedPersonaDisplay,
  SafeDebateMessage,
  SpeakerGlyph,
} from "./display";
import {
  initialDebatePersonaIds,
  nextDebatePersonaId,
  resolveActiveDebatePersonaIds,
  resolveDebatePersonaIdsByKey,
  resolveNewDebatePersonaIds,
  shouldClearDebateDraft,
} from "./persona-selection";
import {
  useArchiveDebateWindow,
  useBookDebateSession,
  useCreatePersona,
  useDebateTimeline,
  useDeleteDebateMessage,
  useEditDebateMessage,
  useEnsureQuestionDebateWindow,
  useModerationFeedback,
  usePersonaDebate,
  usePersonaCatalog,
  usePersonaRecommendations,
  useRenameDebateWindow,
  useStreamMessage,
} from "./queries";
import type { AiMessage, DebateTurn, DebateWindow, Persona } from "./types";

function CurrentBookContext({ author, label, title }: { author?: string; label: string; title: string }) {
  return (
    <View
      accessibilityLabel={`${label}: ${title}${author ? `, ${author}` : ""}`}
      accessible
      style={styles.bookContext}
      testID="debate-current-book"
    >
      <AppText variant="label">{label}</AppText>
      <AppText>{title}{author ? ` · ${author}` : ""}</AppText>
    </View>
  );
}

function formatMessageTimestamp(value: string | undefined, locale: "en" | "ko") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

export type CreateDebateRoomIntent = {
  personaIds: number[];
  topic: string;
};

export function DebateRoomsScreen({
  bookAuthor,
  bookId,
  bookTitle,
  createRoomError,
  createRoomPending,
  onBack,
  onCreateRoom,
  onReloadSession,
  onRoom,
  questionId,
  recommendedPersonaKeys,
  recommendedTopic,
  sessionError,
  sessionId,
  sessionLoading,
}: {
  bookAuthor?: string;
  bookId: number;
  bookTitle: string;
  createRoomError: boolean;
  createRoomPending: boolean;
  onBack?(): void;
  onCreateRoom(intent: CreateDebateRoomIntent): void;
  onReloadSession(): void;
  onRoom(windowId: number): void;
  questionId?: number;
  recommendedPersonaKeys?: string[];
  recommendedTopic?: string;
  sessionError: boolean;
  sessionId?: number;
  sessionLoading: boolean;
}) {
  const { locale } = useI18n();
  const c = debateCopy(locale);
  const timeline = useDebateTimeline(sessionId ?? 0);
  const personas = usePersonaCatalog();
  const recommendations = usePersonaRecommendations(bookId);
  const ensureQuestionRoom = useEnsureQuestionDebateWindow();
  const ensuredQuestion = useRef<number | undefined>(undefined);
  const authoritativeTimeline = sessionId && timeline.data
    && timeline.data.bookId === bookId
    && timeline.data.sessionId === sessionId
    ? timeline.data
    : undefined;
  const hasAuthoritativeQuestion = questionId === undefined
    || authoritativeTimeline?.questions.some((question) => question.questionId === questionId) === true;

  useEffect(() => {
    if (!questionId || !authoritativeTimeline || !hasAuthoritativeQuestion || ensuredQuestion.current === questionId) return;
    ensuredQuestion.current = questionId;
    ensureQuestionRoom.mutate(questionId, { onSuccess: (window) => onRoom(window.windowId) });
  }, [authoritativeTimeline, ensureQuestionRoom, hasAuthoritativeQuestion, onRoom, questionId]);

  const reloadRooms = () => {
    if (ensureQuestionRoom.isError) {
      ensuredQuestion.current = undefined;
      ensureQuestionRoom.reset();
    }
    onReloadSession();
    void timeline.refetch();
  };

  const hasBookKnowledgeRecommendation = Boolean(recommendedTopic);
  const pageHeader = (page = false) => (
    <EditorialHeader backLabel={c.back} onBack={onBack} page={page} title={c.room} />
  );
  if (sessionLoading || personas.isLoading || (!hasBookKnowledgeRecommendation && recommendations.isLoading)) {
    return <Screen scroll={false}>{pageHeader()}<LoadingState label={c.room} /></Screen>;
  }
  if (sessionError || personas.isError) {
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.loadError} tone="error">
          <Button onPress={() => { onReloadSession(); void personas.refetch(); }} variant="outline">{c.retry}</Button>
        </Notice>
      </Screen>
    );
  }
  if (questionId && !sessionId) return <Screen>{pageHeader()}<Notice title={c.notFound} tone="error" /></Screen>;
  if (questionId && timeline.isLoading) {
    return <Screen scroll={false}>{pageHeader()}<LoadingState label={c.room} /></Screen>;
  }
  if (questionId && timeline.isError) {
    return <Screen>{pageHeader()}<Notice title={c.loadError} tone="error"><Button onPress={reloadRooms}>{c.retry}</Button></Notice></Screen>;
  }
  if (sessionId && timeline.data && (!authoritativeTimeline || !hasAuthoritativeQuestion)) {
    return <Screen>{pageHeader()}<Notice title={c.notFound} tone="error" /></Screen>;
  }

  const availablePersonas = personas.data?.personas ?? [];
  const recommendedPersonaIds = hasBookKnowledgeRecommendation
    ? resolveDebatePersonaIdsByKey(availablePersonas, recommendedPersonaKeys ?? [])
    : recommendations.data?.personas.map((persona) => persona.personaId) ?? [];
  const rooms = timeline.data?.windows.filter((window) => window.windowType === "debate") ?? [];
  return (
    <DebateRoomPicker
      availablePersonas={availablePersonas}
      bookAuthor={bookAuthor}
      bookTitle={bookTitle}
      createRoomError={createRoomError}
      createRoomPending={createRoomPending}
      initialSelected={initialDebatePersonaIds(availablePersonas.map((persona) => persona.personaId), recommendedPersonaIds)}
      initialTopic={recommendedTopic}
      loadingRooms={timeline.isLoading || ensureQuestionRoom.isPending}
      onBack={onBack}
      onCreateRoom={onCreateRoom}
      onReload={reloadRooms}
      onRoom={onRoom}
      recommendationFailed={!hasBookKnowledgeRecommendation && recommendations.isError}
      roomLoadFailed={timeline.isError || ensureQuestionRoom.isError}
      rooms={rooms}
    />
  );
}

function DebateRoomPicker({ availablePersonas, bookAuthor, bookTitle, createRoomError, createRoomPending, initialSelected, initialTopic, loadingRooms, onBack, onCreateRoom, onReload, onRoom, recommendationFailed, roomLoadFailed, rooms }: {
  availablePersonas: Persona[];
  bookAuthor?: string;
  bookTitle: string;
  createRoomError: boolean;
  createRoomPending: boolean;
  initialSelected: number[];
  initialTopic?: string;
  loadingRooms: boolean;
  onBack?(): void;
  onCreateRoom(intent: CreateDebateRoomIntent): void;
  onReload(): void;
  onRoom(windowId: number): void;
  recommendationFailed: boolean;
  roomLoadFailed: boolean;
  rooms: DebateWindow[];
}) {
  const { locale } = useI18n();
  const c = debateCopy(locale);
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [dialogSelected, setDialogSelected] = useState<number[]>([]);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [topicDraft, setTopicDraft] = useState(initialTopic ?? "");
  const [customName, setCustomName] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const createPersona = useCreatePersona();
  const effectiveSelected = resolveNewDebatePersonaIds(
    selected,
    initialSelected,
    availablePersonas.map((persona) => persona.personaId),
  );
  const toggleDialog = (id: number) => setDialogSelected((current) => current.includes(id)
    ? current.filter((value) => value !== id)
    : current.length < 2 ? [...current, id] : current);
  return (
    <Screen layout="edge" testID="debate-rooms-screen">
      <EditorialHeader backLabel={c.back} onBack={onBack} page title={c.room} />
      <CurrentBookContext author={bookAuthor} label={c.currentBook} title={bookTitle} />
      <Surface variant="section">
        <AppText style={styles.roomsDescription}>{c.roomsDescription}</AppText>
      </Surface>
      <View style={[styles.row, styles.sectionActions]}>
        <AppText variant="heading">{c.reload}</AppText>
        <Button accessibilityLabel={c.reload} loading={loadingRooms} onPress={onReload} variant="outline">{c.reload}</Button>
      </View>
      {roomLoadFailed ? <Notice title={c.loadError} tone="error" /> : null}
      {rooms.map((room) => (
        <Pressable
          accessibilityHint={`#${room.windowId}`}
          accessibilityLabel={room.title}
          accessibilityRole="button"
          key={room.windowId}
          onPress={() => onRoom(room.windowId)}
          style={({ pressed }) => [styles.roomRow, pressed && styles.pressed]}
        >
          <View style={styles.roomCopy}>
            <AppText style={styles.roomKicker} variant="eyebrow">Window {room.windowId}</AppText>
            <AppText variant="heading">{room.title}</AppText>
            <View style={styles.roomMeta}>
              {room.personaIds.map((personaId) => {
                const persona = availablePersonas.find((candidate) => candidate.personaId === personaId);
                return (
                  <AppText key={personaId} style={styles.roomTag} variant="caption">
                    {persona ? localizedPersonaDisplay(persona, locale).displayName : c.participantUnavailable}
                  </AppText>
                );
              })}
              <AppText style={styles.roomStatus} variant="caption">
                {room.status === "active"
                  ? c.activeRoom
                  : room.status === "archived"
                    ? c.archivedRoom
                    : room.status}
              </AppText>
            </View>
          </View>
          <AppText accessibilityElementsHidden style={styles.chevron}>›</AppText>
        </Pressable>
      ))}
      {!loadingRooms && rooms.length === 0 ? <Notice title={c.noRooms} /> : null}
      <Surface variant="section">
        <AppText variant="heading">{c.create}</AppText>
        <AppText>{c.empty}</AppText>
        <TextField
          label={c.topic}
          maxLength={240}
          onChangeText={setTopicDraft}
          value={topicDraft}
        />
      </Surface>
      {recommendationFailed ? <Notice title={c.recommendationError} /> : null}
      <Surface testID="debate-speaker-summary" variant="section">
        <AppText variant="heading">{c.speakers}</AppText>
        {effectiveSelected.map((personaId) => {
          const persona = availablePersonas.find((candidate) => candidate.personaId === personaId);
          if (!persona) return null;
          return (
            <View key={personaId} style={styles.personaChoice}>
              <SpeakerGlyph />
              <AppText>{localizedPersonaDisplay(persona, locale).displayName}</AppText>
            </View>
          );
        })}
        {!effectiveSelected.length ? <Notice title={c.noSpeakers} /> : null}
        <Button onPress={() => {
          setDialogSelected(effectiveSelected);
          setSpeakerDialogOpen(true);
        }} variant="outline">{c.changeSpeakers}</Button>
      </Surface>
      <Modal animationType="fade" onRequestClose={() => setSpeakerDialogOpen(false)} transparent visible={speakerDialogOpen}>
        <View style={styles.dialogBackdrop}>
          <Surface accessibilityViewIsModal style={styles.dialog} testID="change-speakers-dialog">
            <AppText variant="title">{c.changeSpeakers}</AppText>
            {availablePersonas.map((persona) => {
              const selectedInDialog = dialogSelected.includes(persona.personaId);
              return (
                <View key={persona.personaId} style={styles.personaChoice} testID={`debate-persona-${persona.personaId}`}>
                  <SpeakerGlyph />
                  <View style={styles.personaDetails}>
                    <AppText variant="heading">{localizedPersonaDisplay(persona, locale).displayName}</AppText>
                    {localizedPersonaDisplay(persona, locale).tone ? <AppText variant="caption">{localizedPersonaDisplay(persona, locale).tone}</AppText> : null}
                    {persona.description ? <AppText>{persona.description}</AppText> : null}
                  </View>
                  <Button
                    accessibilityLabel={`${localizedPersonaDisplay(persona, locale).displayName}: ${selectedInDialog ? c.selected : c.select}`}
                    accessibilityState={{ selected: selectedInDialog }}
                    disabled={!selectedInDialog && dialogSelected.length >= 2}
                    onPress={() => toggleDialog(persona.personaId)}
                    variant={selectedInDialog ? "primary" : "outline"}
                  >
                    {selectedInDialog ? c.selected : c.select}
                  </Button>
                </View>
              );
            })}
            <View style={styles.row}>
              <Button onPress={() => setSpeakerDialogOpen(false)} variant="ghost">{c.cancel}</Button>
              <Button onPress={() => { setSelected(dialogSelected); setSpeakerDialogOpen(false); }}>{c.applySpeakers}</Button>
            </View>
          </Surface>
        </View>
      </Modal>
      <Surface testID="bdd-front-129-custom-persona" variant="section">
        <AppText variant="heading">{c.customPersona}</AppText>
        <TextField label={c.customName} maxLength={120} onChangeText={setCustomName} value={customName} />
        <TextField label={c.customDescription} multiline onChangeText={setCustomInstructions} value={customInstructions} />
        <Button
          disabled={!customName.trim() || !customInstructions.trim()}
          loading={createPersona.isPending}
          onPress={() => {
            const existingIds = new Set(availablePersonas.map((persona) => persona.personaId));
            createPersona.mutate({
              description: customInstructions.trim(),
              displayName: customName.trim(),
              systemPrompt: customInstructions.trim(),
            }, {
              onSuccess: (result) => {
                const created = result.personas.find((persona) => !existingIds.has(persona.personaId))
                  ?? result.personas.find((persona) => persona.displayName === customName.trim());
                if (created) setSelected([created.personaId]);
                setCustomName("");
                setCustomInstructions("");
              },
            });
          }}
        >{c.customSave}</Button>
        {createPersona.isError ? <Notice title={c.customPersonaError} tone="error" /> : null}
      </Surface>
      <View style={styles.sectionActions}>
        {createRoomError ? <Notice title={c.createRoomError} tone="error" /> : null}
        <Button
          disabled={!effectiveSelected.length || !topicDraft.trim()}
          loading={createRoomPending}
          onPress={() => onCreateRoom({
            personaIds: effectiveSelected,
            topic: topicDraft.trim(),
          })}
        >{c.create}</Button>
      </View>
    </Screen>
  );
}

type OptimisticMessage = AiMessage & { clientId: string; persistedIdsAtSubmit: ReadonlySet<number> };

export function DebateRoomScreen({ bookAuthor, bookId, bookTitle, onArchived, onBack, windowId }: {
  bookAuthor?: string;
  bookId: number;
  bookTitle: string;
  onArchived(): void;
  onBack?(): void;
  windowId: number;
}) {
  const { locale } = useI18n();
  const c = debateCopy(locale);
  const session = useBookDebateSession(bookId);
  const sessionId = session.data?.sessionId ?? 0;
  const personas = usePersonaCatalog();
  const recommendations = usePersonaRecommendations(bookId);
  const timeline = useDebateTimeline(sessionId);
  const [draft, setDraft] = useState("");
  const [delta, setDelta] = useState("");
  const [streamComplete, setStreamComplete] = useState(false);
  const [optimistic, setOptimistic] = useState<OptimisticMessage>();
  const [renameDraft, setRenameDraft] = useState<string>();
  const [editingMessageId, setEditingMessageId] = useState<number>();
  const [editingContent, setEditingContent] = useState("");
  const optimisticSequence = useRef(0);
  const topicInitializedWindow = useRef<number | undefined>(undefined);
  const streamAbort = useRef<AbortController | undefined>(undefined);
  const room = timeline.data?.windows.find((value) => value.windowId === windowId);
  const activePersonaIds = personas.data?.personas.map((persona) => persona.personaId) ?? [];
  const participantIds = resolveActiveDebatePersonaIds(
    room?.personaIds,
    recommendations.data?.personas.map((persona) => persona.personaId) ?? [],
    activePersonaIds,
  );
  const personaById = useMemo(
    () => new Map((personas.data?.personas ?? []).map((persona) => [persona.personaId, persona])),
    [personas.data?.personas],
  );
  const persistedMessages = useMemo(() => timeline.data?.messages
    .filter((message) => message.windowId === windowId)
    .sort((a, b) => a.messageOrder - b.messageOrder) ?? [], [timeline.data, windowId]);

  useEffect(() => {
    if (!room || persistedMessages.length || topicInitializedWindow.current === windowId) return;
    topicInitializedWindow.current = windowId;
    setDraft((current) => current || debateTopicFromWindowTitle(room.title));
  }, [persistedMessages.length, room, windowId]);
  const optimisticPersisted = optimistic ? persistedMessages.some((message) =>
    message.role === "user" && message.content === optimistic.content && !optimistic.persistedIdsAtSubmit.has(message.messageId)) : false;
  const messages = optimistic && !optimisticPersisted ? [...persistedMessages, optimistic] : persistedMessages;
  const debate = usePersonaDebate(sessionId, windowId);
  const stream = useStreamMessage(sessionId, windowId, (value) => setDelta((current) => current + value));
  const rename = useRenameDebateWindow(sessionId);
  const archive = useArchiveDebateWindow(sessionId);
  const editMessage = useEditDebateMessage(sessionId);
  const deleteMessage = useDeleteDebateMessage(sessionId);
  const moderationFeedback = useModerationFeedback(sessionId);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") streamAbort.current?.abort(); });
    return () => { streamAbort.current?.abort(); subscription.remove(); };
  }, []);

  const pageHeader = (page = false, title: string = c.room) => (
    <EditorialHeader backLabel={c.back} onBack={onBack} page={page} title={title} />
  );
  if (session.isLoading || timeline.isLoading || personas.isLoading || recommendations.isLoading) {
    return <Screen scroll={false}>{pageHeader()}<LoadingState label={c.room} /></Screen>;
  }
  if (session.isError || timeline.isError || personas.isError) {
    return (
      <Screen>
        {pageHeader()}
        <Notice title={c.loadError} tone="error">
          <Button
            onPress={() => { void session.refetch(); void timeline.refetch(); void personas.refetch(); }}
            variant="outline"
          >
            {c.retry}
          </Button>
        </Notice>
      </Screen>
    );
  }
  if (
    !session.data ||
    !timeline.data ||
    !room ||
    timeline.data.bookId !== bookId ||
    timeline.data.sessionId !== session.data.sessionId ||
    room.sessionId !== session.data.sessionId
  ) {
    return <Screen>{pageHeader()}<Notice title={c.notFound} tone="error" /></Screen>;
  }

  const sourceQuestion = timeline.data.questions.find((question) => question.questionId === room.sourceQuestionId);
  const sourceAnswer = timeline.data.insights.find((insight) => insight.questionId === room.sourceQuestionId && insight.insightType === "question_answer");
  const moderationEvents = timeline.data.moderationEvents.filter((event) => event.windowId === windowId && event.decision !== "ALLOW");
  const timelineItems = [
    ...messages.map((message, index) => ({ createdAt: message.createdAt, index, kind: "message" as const, message })),
    ...moderationEvents.map((event, index) => ({ createdAt: event.createdAt, event, index: messages.length + index, kind: "moderation" as const })),
  ].sort((left, right) => {
    const difference = Date.parse(left.createdAt ?? "") - Date.parse(right.createdAt ?? "");
    return Number.isNaN(difference) || difference === 0 ? left.index - right.index : difference;
  });
  const renameValue = renameDraft ?? room.title;
  const topic = debateTopicFromWindowTitle(room.title);
  const nextPersonaId = nextDebatePersonaId(participantIds, persistedMessages);

  function submitDebate(requestedPersonaIds = participantIds, allowTopicFallback = false) {
    const content = draft.trim() || (allowTopicFallback ? topic.trim() : "");
    if (!content || !requestedPersonaIds.length || debate.isPending) return;
    const pending: OptimisticMessage = {
      clientId: `pending-debate-${++optimisticSequence.current}`,
      content,
      createdAt: new Date().toISOString(),
      messageId: -optimisticSequence.current,
      persistedIdsAtSubmit: new Set(persistedMessages.map((message) => message.messageId)),
      role: "user",
      windowId,
    };
    setOptimistic(pending);
    setDraft("");
    debate.mutate({ content, personaIds: requestedPersonaIds }, {
      onError: () => {
        setOptimistic(undefined);
        setDraft((current) => current.trim() ? current : content);
      },
      onSuccess: (result: DebateTurn) => {
        if (!shouldClearDebateDraft(result)) {
          setOptimistic(undefined);
          setDraft((current) => current.trim() ? current : content);
        }
      },
    });
  }

  return (
    <Screen layout="edge" testID="debate-room-screen">
      {pageHeader(true, room.title)}
      <CurrentBookContext author={bookAuthor} label={c.currentBook} title={bookTitle} />
      <Surface style={styles.topicSection} variant="section">
        <AppText testID="bdd-front-123-current-topic" variant="heading">{topic}</AppText>
      </Surface>
      <Surface variant="section">
        <TextField label={c.rename} onChangeText={setRenameDraft} value={renameValue} />
        <View style={styles.row}>
          <Button disabled={!renameValue.trim() || renameValue.trim() === room.title} loading={rename.isPending} onPress={() => rename.mutate({ title: renameValue.trim(), windowId })} variant="outline">{c.rename}</Button>
          <Button loading={archive.isPending} onPress={() => Alert.alert(c.archive, c.archiveConfirm, [
            { style: "cancel", text: c.cancel },
            { style: "destructive", text: c.archive, onPress: () => archive.mutate(windowId, { onSuccess: onArchived }) },
          ])} variant="destructive">{c.archive}</Button>
        </View>
      </Surface>
      {sourceQuestion ? (
        <Surface accessibilityLabel={c.sourceQuestion} variant="section">
          <AppText variant="label">{c.sourceQuestion}</AppText>
          <AppText>{sourceQuestion.questionText}</AppText>
          {sourceAnswer ? <><AppText variant="caption">{c.sourceAnswer}</AppText><AppText>{sourceAnswer.content}</AppText></> : null}
        </Surface>
      ) : null}
      <View style={[styles.speakerStrip, styles.sectionActions]} testID="bdd-front-128-speaker-strip">
        {participantIds.map((personaId) => {
          const persona = personaById.get(personaId);
          const name = persona ? localizedPersonaDisplay(persona, locale).displayName : `${c.participantUnavailable} (#${personaId})`;
          return (
            <View key={personaId} style={styles.personaChoice}>
              {persona ? <SpeakerGlyph /> : null}
              <Button
                accessibilityLabel={`${c.replyAs}: ${name}`}
                disabled={debate.isPending}
                onPress={() => submitDebate([personaId], true)}
                variant="outline"
              >{name}</Button>
            </View>
          );
        })}
      </View>
      {timelineItems.map((item) => {
        if (item.kind === "moderation") {
          const event = item.event;
          return (
            <Surface accessibilityRole="alert" key={`moderation-${event.eventId}`}>
              <AppText variant="label">{event.suggestedQuestion || (event.decision === "REDIRECT" ? c.moderationRedirect : c.moderationReject)}</AppText>
              {event.userFeedback ? <AppText variant="caption">{c.feedbackSaved}</AppText> : (
                <>
                  <AppText variant="caption">{c.feedbackPrompt}</AppText>
                  <View style={styles.row}>
                    <Button disabled={moderationFeedback.isPending} onPress={() => moderationFeedback.mutate({ eventId: event.eventId, feedback: "RELATED" })} variant="outline">{c.related}</Button>
                    <Button disabled={moderationFeedback.isPending} onPress={() => moderationFeedback.mutate({ eventId: event.eventId, feedback: "NOT_RELATED" })} variant="outline">{c.notRelated}</Button>
                  </View>
                </>
              )}
            </Surface>
          );
        }
        const message = item.message;
        const isReader = message.role === "user";
        const persona = message.personaId ? personaById.get(message.personaId) : undefined;
        const speaker = isReader ? c.reader : persona ? localizedPersonaDisplay(persona, locale).displayName : message.personaId ? `#${message.personaId}` : c.stream;
        const timestamp = formatMessageTimestamp(message.createdAt, locale);
        return <View key={"clientId" in message ? message.clientId : message.messageId} style={[styles.messageRow, isReader ? styles.readerRow : styles.personaRow]} testID={isReader ? "bdd-front-042-reader-message" : "bdd-front-042-persona-message"}>
          <Surface style={[styles.messageBubble, isReader ? styles.readerBubble : styles.personaBubble]}>
            <AppText variant="caption">{speaker}</AppText>
            {timestamp ? (
              <AppText
                accessibilityLabel={message.createdAt}
                testID={`debate-message-time-${message.messageId}`}
                variant="caption"
              >
                {timestamp}
              </AppText>
            ) : null}
            {editingMessageId === message.messageId ? (
              <>
                <TextField label={c.editMessage} multiline onChangeText={setEditingContent} value={editingContent} />
                <View style={styles.row}>
                  <Button disabled={!editingContent.trim()} loading={editMessage.isPending} onPress={() => editMessage.mutate(
                    { content: editingContent.trim(), messageId: message.messageId },
                    { onSuccess: () => setEditingMessageId(undefined) },
                  )}>{c.save}</Button>
                  <Button onPress={() => setEditingMessageId(undefined)} variant="ghost">{c.cancel}</Button>
                </View>
              </>
            ) : (
              <>
                {!isReader && message.messageId > 0 ? <AppText variant="caption">{c.messageId}: {message.messageId}</AppText> : null}
                <SafeDebateMessage content={message.content} locale={locale} structure={message.structure} />
                {message.role === "user" && message.messageId > 0 ? (
                  <View style={styles.row}>
                    <Button onPress={() => { setEditingMessageId(message.messageId); setEditingContent(message.content); }} variant="ghost">{c.edit}</Button>
                    <Button onPress={() => Alert.alert(c.delete, c.deleteConfirm, [
                      { style: "cancel", text: c.cancel },
                      { style: "destructive", text: c.delete, onPress: () => deleteMessage.mutate(message.messageId) },
                    ])} variant="ghost">{c.delete}</Button>
                  </View>
                ) : null}
              </>
            )}
          </Surface>
        </View>;
      })}
      {debate.isPending ? (
        <View accessibilityLabel={c.replyPending} accessibilityRole="progressbar" style={styles.replySkeleton} testID="bdd-front-043-reply-skeleton">
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        </View>
      ) : null}
      {delta ? <Surface accessibilityLiveRegion="none" testID="debate-stream-delta"><AppText>{delta}</AppText></Surface> : null}
      {streamComplete ? <Notice title={c.streamComplete} tone="success" /> : null}
      <View style={styles.composer}>
      <TextField label={c.room} multiline onChangeText={setDraft} value={draft} />
      <View style={styles.row}>
        <Button disabled={!draft.trim() || participantIds.length === 0} loading={debate.isPending} onPress={() => submitDebate()} testID="bdd-front-043-submit">{c.ask}</Button>
        <Button disabled={!nextPersonaId || debate.isPending || (!draft.trim() && !topic.trim())} onPress={() => nextPersonaId && submitDebate([nextPersonaId], true)} variant="outline">{c.nextReply}</Button>
        <Button disabled={!draft.trim()} loading={stream.isPending} onPress={() => {
          streamAbort.current?.abort();
          const controller = new AbortController();
          streamAbort.current = controller;
          setDelta("");
          setStreamComplete(false);
          stream.mutate({ content: draft.trim(), signal: controller.signal }, {
            onError: () => setDelta(""),
            onSettled: () => { if (streamAbort.current === controller) streamAbort.current = undefined; },
            onSuccess: () => { setDraft(""); setDelta(""); setStreamComplete(true); },
          });
        }} variant="outline">{c.stream}</Button>
      </View>
      </View>
      {participantIds.length === 0 ? <Notice title={c.legacyRoom} /> : null}
      {recommendations.isError && room.personaIds.length === 0 ? <Notice title={c.recommendationError} /> : null}
      {debate.isError || stream.isError || rename.isError || archive.isError || editMessage.isError || deleteMessage.isError || moderationFeedback.isError ? <Notice title={c.error} tone="error" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bookContext: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.x1,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
  },
  chevron: { color: colors.muted, fontSize: 24 },
  composer: {
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.x3,
    padding: spacing.x5,
  },
  dialog: { maxHeight: "88%", width: "92%" },
  dialogBackdrop: { alignItems: "center", backgroundColor: "rgba(38, 34, 30, 0.45)", flex: 1, justifyContent: "center" },
  messageBubble: { maxWidth: "82%", padding: spacing.x3 },
  messageRow: { flexDirection: "row", width: "100%" },
  personaBubble: { borderBottomLeftRadius: radius.small },
  personaChoice: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  personaDetails: { flex: 1, gap: spacing.x1, minWidth: 0 },
  personaRow: { justifyContent: "flex-start" },
  pressed: { opacity: 0.62 },
  readerBubble: { backgroundColor: colors.canvas, borderBottomRightRadius: radius.small, borderColor: colors.navy },
  readerRow: { justifyContent: "flex-end" },
  replySkeleton: { gap: spacing.x2, paddingVertical: spacing.x3 },
  roomCopy: { flex: 1, gap: spacing.x1, minWidth: 0 },
  roomMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  roomsDescription: { color: colors.muted },
  roomStatus: { color: colors.muted },
  roomTag: {
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  roomKicker: { color: colors.accentDeep },
  roomRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.x3,
    minHeight: 88,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x4,
  },
  row: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  sectionActions: { paddingHorizontal: spacing.x5, paddingVertical: spacing.x3 },
  skeletonLine: { backgroundColor: colors.line, borderRadius: radius.small, height: 18, width: "82%" },
  skeletonLineShort: { width: "56%" },
  speakerStrip: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  topicSection: { backgroundColor: colors.surface },
});
