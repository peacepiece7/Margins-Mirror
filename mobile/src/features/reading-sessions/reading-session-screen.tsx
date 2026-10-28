import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  AppState,
  findNodeHandle,
  type LayoutChangeEvent,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";

import { useReducedMotion } from "@/shared/accessibility/use-reduced-motion";
import { useI18n } from "@/shared/i18n/i18n-provider";
import type { Locale } from "@/shared/i18n/messages";
import { colors, spacing } from "@/shared/theme/tokens";
import { AppText, Button, EditorialHeader, LoadingState, Notice, Screen, Surface, TextField } from "@/shared/ui";

import { readingCopy } from "./copy";
import {
  useBookReadingSession,
  useArchiveSession,
  useArchiveWindow,
  useCreateQuestion,
  useCreateReadingSession,
  useCreateSessionWindow,
  useCreateHighlight,
  useCreateInsight,
  useCreateTag,
  useDeleteHighlight,
  useDeleteInsight,
  useDeleteMessage,
  useDeleteQuestion,
  useDeleteTag,
  useLatestTimeline,
  useGenerateWindowQuestions,
  useMetricSnapshot,
  useSessionSearch,
  useTimeline,
  useStreamQuestionAnswer,
  useUpdateHighlight,
  useUpdateInsight,
  useUpdateMessage,
  useUpdateSessionTitle,
  useUpdateWindowTitle,
  HIGHLIGHT_LOCATION_MAX_LENGTH,
  HIGHLIGHT_NOTE_MAX_LENGTH,
  HIGHLIGHT_QUOTE_MAX_LENGTH,
  SESSION_TITLE_MAX_LENGTH,
  TAG_MAX_LENGTH,
  WINDOW_TITLE_MAX_LENGTH,
} from "./queries";
import type { SessionHighlight, SessionInsight, SessionMessage } from "./types";
import { readingSessionTranscript } from "./transcript";

type Copy = ReturnType<typeof readingCopy>;
type ReadingArea = "messages" | "progress" | "questions" | "quotes" | "review";

function isAnswered(status: string | null | undefined) {
  return status?.toLowerCase() === "answered";
}

function localizeRole(c: Copy, role: string) {
  switch (role.toLowerCase()) {
    case "user": return c.readerRole;
    case "assistant": return c.assistantRole;
    case "system": return c.systemRole;
    default: return c.unknownRole;
  }
}

function localizeStatus(c: Copy, status: string | null | undefined) {
  switch (status?.toLowerCase()) {
    case "active": return c.activeStatus;
    case "answered": return c.answeredStatus;
    case "archived": return c.archivedStatus;
    case "completed":
    case "done": return c.completedStatus;
    case "failed": return c.failedStatus;
    case "open": return c.openStatus;
    default: return c.unknownStatus;
  }
}

function localizeWindowType(c: Copy, windowType: string) {
  switch (windowType.toLowerCase()) {
    case "debate": return c.debateWindow;
    case "question": return c.questionWindow;
    case "reflection": return c.reflectionWindow;
    default: return c.unknownWindow;
  }
}

function localizeResultType(c: Copy, resultType: string) {
  switch (resultType.toLowerCase()) {
    case "highlight": return c.highlightResult;
    case "insight": return c.insightResult;
    case "message": return c.messageResult;
    case "question": return c.questionResult;
    case "tag": return c.tagResult;
    default: return c.unknownResult;
  }
}

function countLabel(locale: Locale, count: number, singular: string, plural: string) {
  return locale === "ko" ? `${count}${plural}` : `${count} ${count === 1 ? singular : plural}`;
}

export function parseOptionalPageDraft(value: string): { pageNumber?: number; valid: boolean } {
  const normalized = value.trim();
  if (!normalized) return { valid: true };
  if (!/^[1-9]\d*$/.test(normalized)) return { valid: false };
  const pageNumber = Number(normalized);
  return Number.isSafeInteger(pageNumber) ? { pageNumber, valid: true } : { valid: false };
}

function ResultSkeleton({ label, testID }: { label: string; testID: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.skeleton} testID={testID}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
    </View>
  );
}

function confirmRemoval(c: Copy, locale: Locale, remove: () => void) {
  Alert.alert(c.delete, c.confirmDelete, [
    { style: "cancel", text: locale === "ko" ? "취소" : "Cancel" },
    { onPress: remove, style: "destructive", text: c.delete },
  ]);
}

function EditableHighlight({ c, item, locale, sessionId }: { c: Copy; item: SessionHighlight; locale: Locale; sessionId: number }) {
  const update = useUpdateHighlight(sessionId);
  const remove = useDeleteHighlight(sessionId);
  const [quote, setQuote] = useState(item.quoteText);
  const [pageDraft, setPageDraft] = useState(item.pageNumber?.toString() ?? "");
  const [location, setLocation] = useState(item.locationLabel ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const parsedPage = parseOptionalPageDraft(pageDraft);

  return (
    <View style={styles.item}>
      <TextField label={c.quote} maxLength={HIGHLIGHT_QUOTE_MAX_LENGTH} multiline onChangeText={setQuote} value={quote} />
      <TextField error={parsedPage.valid ? undefined : c.pageInvalid} keyboardType="number-pad" label={c.page} onChangeText={setPageDraft} value={pageDraft} />
      <TextField label={c.location} maxLength={HIGHLIGHT_LOCATION_MAX_LENGTH} onChangeText={setLocation} value={location} />
      <TextField label={c.note} maxLength={HIGHLIGHT_NOTE_MAX_LENGTH} multiline onChangeText={setNote} value={note} />
      <View style={styles.actions}>
        <Button
          accessibilityLabel={`${c.update}: ${item.quoteText}`}
          disabled={!quote.trim() || !parsedPage.valid}
          loading={update.isPending}
          onPress={() => update.mutate({
            highlightId: item.highlightId,
            input: {
              locationLabel: location.trim() || undefined,
              note: note.trim() || undefined,
              pageNumber: parsedPage.pageNumber,
              quoteText: quote.trim(),
            },
          })}
          testID={`update-highlight-${item.highlightId}`}
          variant="outline"
        >
          {c.update}
        </Button>
        <Button
          accessibilityLabel={`${c.delete}: ${item.quoteText}`}
          loading={remove.isPending}
          onPress={() => confirmRemoval(c, locale, () => remove.mutate(item.highlightId))}
          variant="destructive"
        >
          {c.delete}
        </Button>
      </View>
      {update.isError || remove.isError ? <Notice title={c.error} tone="error" /> : null}
    </View>
  );
}

function EditableInsight({ c, item, locale, sessionId }: { c: Copy; item: SessionInsight; locale: Locale; sessionId: number }) {
  const update = useUpdateInsight(sessionId);
  const remove = useDeleteInsight(sessionId);
  const [content, setContent] = useState(item.content);

  return (
    <View style={styles.item}>
      {item.authorName || item.reviewedOn ? <AppText variant="caption">{[item.authorName, item.reviewedOn].filter(Boolean).join(" · ")}</AppText> : null}
      <AppText>{item.content}</AppText>
      <TextField label={c.insight} multiline onChangeText={setContent} value={content} />
      <View style={styles.actions}>
        <Button
          accessibilityLabel={`${c.update}: ${item.content}`}
          disabled={!content.trim()}
          loading={update.isPending}
          onPress={() => update.mutate({
            insightId: item.insightId,
            input: {
              authorName: item.authorName,
              content: content.trim(),
              evidence: item.evidence,
              title: item.title,
              reviewedOn: item.reviewedOn,
              visibility: item.visibility,
            },
          })}
          variant="outline"
        >
          {c.update}
        </Button>
        <Button
          accessibilityLabel={`${c.delete}: ${item.content}`}
          loading={remove.isPending}
          onPress={() => confirmRemoval(c, locale, () => remove.mutate(item.insightId))}
          variant="destructive"
        >
          {c.delete}
        </Button>
      </View>
      {update.isError || remove.isError ? <Notice title={c.error} tone="error" /> : null}
    </View>
  );
}

function TagItem({ c, label, locale, sessionId, tagId }: { c: Copy; label: string; locale: Locale; sessionId: number; tagId: number }) {
  const remove = useDeleteTag(sessionId);
  return (
    <View style={styles.tag}>
      <AppText>#{label}</AppText>
      <Button
        accessibilityLabel={`${c.delete}: ${label}`}
        loading={remove.isPending}
        onPress={() => confirmRemoval(c, locale, () => remove.mutate(tagId))}
        variant="ghost"
      >
        ×
      </Button>
      {remove.isError ? <Notice title={c.error} tone="error" /> : null}
    </View>
  );
}

function EditableMessage({
  c,
  item,
  locale,
  remove,
  update,
}: {
  c: Copy;
  item: SessionMessage;
  locale: Locale;
  remove: ReturnType<typeof useDeleteMessage>;
  update: ReturnType<typeof useUpdateMessage>;
}) {
  const [content, setContent] = useState(item.content);
  const userAuthored = item.role === "user" || item.role === "USER";
  return (
    <View style={styles.item}>
      <AppText variant="caption">{localizeRole(c, item.role)} · {c.messageId} {item.messageId}{item.personaId ? ` · #${item.personaId}` : ""}</AppText>
      {userAuthored ? (
        <>
          <TextField label={`${c.messages} #${item.messageId}`} multiline onChangeText={setContent} value={content} />
          <View style={styles.actions}>
            <Button accessibilityLabel={`${c.update}: ${item.content}`} disabled={!content.trim()} loading={update.isPending && update.variables?.messageId === item.messageId} onPress={() => update.mutate({ content: content.trim(), messageId: item.messageId })} variant="outline">{c.update}</Button>
            <Button loading={remove.isPending && remove.variables === item.messageId} onPress={() => confirmRemoval(c, locale, () => remove.mutate(item.messageId))} variant="destructive">{c.delete}</Button>
          </View>
        </>
      ) : <AppText>{item.content}</AppText>}
    </View>
  );
}

export function ReadingSessionScreen({
  bookId,
  bookTitle,
  initialSessionId,
  onArchived,
  onBack,
  onDebate,
  onReflection,
  onSearchResult,
}: {
  bookId: number;
  bookTitle: string;
  initialSessionId?: number;
  onArchived(): void;
  onBack?(): void;
  onDebate(sessionId: number, resolvedBookId: number): void;
  onReflection(sessionId: number, resolvedBookId: number): void;
  onSearchResult(sessionId: number, resolvedBookId: number): void;
}) {
  const { locale } = useI18n();
  const c = readingCopy(locale);
  const reducedMotion = useReducedMotion();
  const scrollViewRef = useRef<ScrollView>(null);
  const [areaOffsets, setAreaOffsets] = useState<Partial<Record<ReadingArea, number>>>({});
  const areaHeadings = useRef<Partial<Record<ReadingArea, View | null>>>({});
  const session = useBookReadingSession(bookId);
  const createSession = useCreateReadingSession(bookId);
  const sessionId = initialSessionId ?? createSession.data?.created.sessionId ?? session.data?.sessionId ?? 0;
  const timeline = useTimeline(sessionId);
  const latest = useLatestTimeline();
  const archiveSession = useArchiveSession(bookId, sessionId);
  const highlight = useCreateHighlight(sessionId);
  const tag = useCreateTag(sessionId);
  const insight = useCreateInsight(sessionId);
  const metric = useMetricSnapshot(sessionId);
  const renameSession = useUpdateSessionTitle(sessionId);
  const createWindow = useCreateSessionWindow(sessionId);
  const renameWindow = useUpdateWindowTitle(sessionId);
  const archiveWindow = useArchiveWindow(sessionId);
  const createQuestion = useCreateQuestion(sessionId);
  const deleteQuestion = useDeleteQuestion(sessionId);
  const generateQuestions = useGenerateWindowQuestions(sessionId);
  const streamAnswer = useStreamQuestionAnswer(sessionId);
  const updateMessage = useUpdateMessage(sessionId);
  const deleteMessage = useDeleteMessage(sessionId);
  const [quote, setQuote] = useState("");
  const [pageDraft, setPageDraft] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [insightText, setInsightText] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearchDraft, setLocalSearchDraft] = useState("");
  const [sessionTitle, setSessionTitle] = useState<string>();
  const [windowTitle, setWindowTitle] = useState("");
  const [selectedWindowId, setSelectedWindowId] = useState<number>();
  const [selectedQuestionId, setSelectedQuestionId] = useState<number>();
  const [questionDraft, setQuestionDraft] = useState("");
  const [questionFocus, setQuestionFocus] = useState("");
  const [questionFilter, setQuestionFilter] = useState<"all" | "answered" | "unanswered">("all");
  const [answerDraft, setAnswerDraft] = useState("");
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [streamedReply, setStreamedReply] = useState("");
  const [streamOutcome, setStreamOutcome] = useState<"error" | "success">();
  const [shareFailed, setShareFailed] = useState(false);
  const answerStreamAbort = useRef<AbortController | undefined>(undefined);
  const search = useSessionSearch(searchQuery);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") answerStreamAbort.current?.abort();
    });
    return () => {
      answerStreamAbort.current?.abort();
      subscription.remove();
    };
  }, []);

  const areaLabels: Record<ReadingArea, string> = {
    messages: c.messages,
    progress: c.progress,
    questions: c.questions,
    quotes: c.quotes,
    review: c.review,
  };
  const handleAreaLayout = (area: ReadingArea, event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    setAreaOffsets((current) => current[area] === y ? current : { ...current, [area]: y });
  };
  const jumpToArea = (area: ReadingArea) => {
    const y = areaOffsets[area];
    if (y !== undefined) {
      scrollViewRef.current?.scrollTo({ animated: !reducedMotion, y: Math.max(0, y - spacing.x2) });
    }
    const nativeHeading = areaHeadings.current[area];
    const handle = nativeHeading ? findNodeHandle(nativeHeading) : null;
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  };

  const pageHeader = (title: string = c.reading, description?: string) => (
    <EditorialHeader
      backLabel={c.back}
      description={description}
      eyebrow={c.reading}
      onBack={onBack}
      title={title}
    />
  );
  if ((session.isLoading && !initialSessionId && !createSession.data) || (sessionId > 0 && timeline.isLoading)) return (
    <Screen scroll={false}>
      {pageHeader()}
      <LoadingState label={c.reading} />
    </Screen>
  );
  if ((session.isError && !initialSessionId && !createSession.data) || timeline.isError) return (
    <Screen testID="reading-session-load-error">
      {pageHeader()}
      <Notice title={c.error} tone="error">
        <Button onPress={() => void Promise.all([session.refetch(), timeline.refetch()])} variant="outline">{c.retry}</Button>
      </Notice>
    </Screen>
  );
  if (!sessionId || !timeline.data) return (
    <Screen testID="reading-session-empty">
      {pageHeader()}
      <Notice title={c.empty} />
      <Button
        loading={createSession.isPending}
        onPress={() => createSession.mutate(bookTitle)}
        testID="create-reading-session"
      >{c.createSession}</Button>
      {createSession.data?.warning ? <Notice title={c.createSessionWarning} /> : null}
      {createSession.isError ? <Notice title={c.error} tone="error" /> : null}
    </Screen>
  );
  const data = timeline.data;
  if (data.bookId !== bookId || data.sessionId !== sessionId) return (
    <Screen testID="reading-session-context-error">
      {pageHeader()}
      <Notice title={c.empty} tone="error" />
    </Screen>
  );
  const activeWindowId = data.windows.some((item) => item.windowId === selectedWindowId)
    ? selectedWindowId
    : data.windows[0]?.windowId;
  const selectedWindow = data.windows.find((item) => item.windowId === activeWindowId);
  const windowQuestions = data.questions.filter((item) => item.windowId === activeWindowId);
  const visibleQuestions = windowQuestions.filter((item) =>
    questionFilter === "all" || (questionFilter === "answered" ? isAnswered(item.status) : !isAnswered(item.status)),
  );
  const selectedQuestion = data.questions.find((item) => item.questionId === selectedQuestionId);
  const answeredCount = windowQuestions.filter((item) => isAnswered(item.status)).length;
  const normalizedLocalSearch = localSearchDraft.trim().toLocaleLowerCase(locale);
  const visibleSessionMessages = data.messages.filter((message) => {
    if (message.windowId !== activeWindowId) return false;
    return !normalizedLocalSearch || message.content.toLocaleLowerCase(locale).includes(normalizedLocalSearch);
  });
  const visibleHighlights = data.highlights.filter((item) => {
    if (!normalizedLocalSearch) return true;
    return [item.quoteText, item.note, item.pageNumber?.toString(), item.locationLabel]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase(locale)
      .includes(normalizedLocalSearch);
  });
  const parsedNewPage = parseOptionalPageDraft(pageDraft);

  return (
    <Screen scrollViewRef={scrollViewRef} testID="reading-session-screen">
      {pageHeader(
        data.title || c.reading,
        `${data.bookTitle}${data.bookAuthor ? ` · ${data.bookAuthor}` : ""}`,
      )}
      {createSession.data?.warning ? <Notice title={c.createSessionWarning} /> : null}

      <Surface>
        <AppText variant="heading">{c.jumpAreas}</AppText>
        <View style={styles.jumpActions} testID="reading-area-jump-controls">
          {(["questions", "progress", "quotes", "messages", "review"] as const).map((area) => (
            <Button
              accessibilityLabel={`${c.jumpAreas}: ${areaLabels[area]}`}
              key={area}
              onPress={() => jumpToArea(area)}
              style={styles.jumpButton}
              testID={`reading-area-jump-${area}`}
              variant="outline"
            >
              {areaLabels[area]}
            </Button>
          ))}
        </View>
      </Surface>

      <Surface>
        <TextField label={c.reading} maxLength={SESSION_TITLE_MAX_LENGTH} onChangeText={setSessionTitle} value={sessionTitle ?? data.title} />
        <View style={styles.actions}>
          <Button loading={createSession.isPending} onPress={() => createSession.mutate(bookTitle)} testID="create-another-reading-session" variant="outline">{c.startAnotherSession}</Button>
          <Button disabled={!(sessionTitle ?? data.title).trim()} loading={renameSession.isPending} onPress={() => renameSession.mutate((sessionTitle ?? data.title).trim(), { onSuccess: () => setSessionTitle(undefined) })} variant="outline">{c.update}</Button>
          <Button
            loading={archiveSession.isPending}
            onPress={() => confirmRemoval(c, locale, () => archiveSession.mutate(undefined, { onSuccess: onArchived }))}
            variant="destructive"
          >{c.archiveSession}</Button>
          <Button onPress={() => {
            setShareFailed(false);
            void Share.share({ message: readingSessionTranscript(data), title: data.title }).catch(() => setShareFailed(true));
          }} variant="outline">{c.shareTranscript}</Button>
        </View>
        {shareFailed ? <Notice title={c.error} tone="error" /> : null}
      </Surface>

      <Surface>
        <AppText variant="heading">{c.latest}</AppText>
        {latest.isError ? <Notice title={c.error} tone="error" /> : <AppText>{latest.data?.title ?? c.empty}</AppText>}
      </Surface>

      <Surface>
        <AppText variant="heading">{c.search}</AppText>
        <TextField
          label={c.search}
          onChangeText={setSearchDraft}
          onSubmitEditing={() => setSearchQuery(searchDraft.trim())}
          placeholder={c.searchPlaceholder}
          returnKeyType="search"
          value={searchDraft}
        />
        <Button disabled={!searchDraft.trim()} loading={search.isFetching} onPress={() => setSearchQuery(searchDraft.trim())}>{c.search}</Button>
        {search.isFetching ? <ResultSkeleton label={c.search} testID="reading-memory-search-skeleton" /> : null}
        {search.isError ? <Notice title={c.error} tone="error" /> : null}
        {search.data && search.data.results.length === 0 ? <Notice title={c.searchEmpty} /> : null}
        {search.data?.results.map((result) => (
          <Button key={`${result.resultType}-${result.sourceId}`} onPress={() => onSearchResult(result.sessionId, result.bookId)} testID={`reading-search-result-${result.sessionId}`} variant="ghost">
            {result.bookTitle} · {result.sessionTitle} · {localizeResultType(c, result.resultType)} · {result.snippet}
          </Button>
        ))}
      </Surface>

      <Surface>
        <AppText variant="heading">{c.localSearch}</AppText>
        <TextField
          label={c.localSearch}
          onChangeText={setLocalSearchDraft}
          placeholder={c.localSearchPlaceholder}
          value={localSearchDraft}
        />
        <AppText testID="session-search-counts" variant="caption">
          {countLabel(locale, visibleSessionMessages.length, c.messageMatch, c.messageMatches)} · {countLabel(locale, visibleHighlights.length, c.highlightMatch, c.highlightMatches)}
        </AppText>
        {normalizedLocalSearch && visibleSessionMessages.length === 0 && visibleHighlights.length === 0 ? <Notice title={c.localSearchEmpty} /> : null}
      </Surface>

      <View onLayout={(event) => handleAreaLayout("progress", event)} testID="reading-area-progress">
      <Surface>
        <View
          accessibilityLabel={c.progress}
          accessibilityRole="header"
          accessible
          collapsable={false}
          ref={(node) => { areaHeadings.current.progress = node; }}
        ><AppText variant="heading">{c.stats}</AppText></View>
        <AppText>{countLabel(locale, data.stats.windowCount, c.windowCount, c.windowsCount)} · {countLabel(locale, data.stats.questionCount, c.questionCount, c.questionsCount)} · {countLabel(locale, data.stats.messageCount, c.messageCount, c.messagesCount)}</AppText>
        <Button loading={metric.isPending} onPress={() => metric.mutate()} variant="outline">{c.metric}</Button>
        {metric.data ? <Notice title={c.metricSaved} tone="success">{`${countLabel(locale, metric.data.highlightCount, c.highlightCount, c.highlightsCount)} · ${countLabel(locale, metric.data.messageCount, c.messageCount, c.messagesCount)}`}</Notice> : null}
        {metric.isError ? <Notice title={c.error} tone="error" /> : null}
        <View style={styles.actions}>
          <Button onPress={() => onReflection(sessionId, data.bookId)}>{c.openReflection}</Button>
          <Button onPress={() => onDebate(sessionId, data.bookId)} variant="outline">{c.debate}</Button>
        </View>
      </Surface>
      </View>

      <Surface>
        <AppText variant="heading">{c.windows}</AppText>
        <TextField label={c.windowTitle} maxLength={WINDOW_TITLE_MAX_LENGTH} onChangeText={setWindowTitle} value={windowTitle} />
        <Button
          disabled={!windowTitle.trim()}
          loading={createWindow.isPending}
          onPress={() => createWindow.mutate(windowTitle.trim(), { onSuccess: (created) => { setSelectedWindowId(created.windowId); setWindowTitle(""); } })}
        >{c.addWindow}</Button>
        {data.windows.map((window) => (
          <View key={window.windowId} style={styles.item}>
            <Button accessibilityState={{ selected: activeWindowId === window.windowId }} onPress={() => { setSelectedWindowId(window.windowId); setSelectedQuestionId(undefined); }} variant={activeWindowId === window.windowId ? "primary" : "outline"}>{window.position + 1}. {window.title}</Button>
            <AppText variant="caption">{localizeWindowType(c, window.windowType)} · {localizeStatus(c, window.status)}</AppText>
          </View>
        ))}
        {selectedWindow ? (
          <View style={styles.actions}>
            <Button disabled={!windowTitle.trim()} loading={renameWindow.isPending} onPress={() => renameWindow.mutate({ title: windowTitle.trim(), windowId: selectedWindow.windowId })} variant="outline">{c.update}</Button>
            <Button loading={archiveWindow.isPending} onPress={() => confirmRemoval(c, locale, () => archiveWindow.mutate(selectedWindow.windowId))} variant="destructive">{c.archiveWindow}</Button>
          </View>
        ) : null}
      </Surface>
      <View onLayout={(event) => handleAreaLayout("questions", event)} testID="reading-area-questions">
      <Surface>
        <View
          accessibilityLabel={c.questions}
          accessibilityRole="header"
          accessible
          collapsable={false}
          ref={(node) => { areaHeadings.current.questions = node; }}
        ><AppText variant="heading">{c.questions} · {answeredCount}/{windowQuestions.length}</AppText></View>
        <View style={styles.actions}>
          {(["all", "unanswered", "answered"] as const).map((filter) => (
            <Button accessibilityState={{ selected: questionFilter === filter }} key={filter} onPress={() => setQuestionFilter(filter)} variant={questionFilter === filter ? "primary" : "outline"}>
              {filter === "all" ? c.allQuestions : filter === "answered" ? c.answeredQuestions : c.unansweredQuestions}
            </Button>
          ))}
        </View>
        {selectedWindow ? (
          <>
            <TextField label={c.focus} onChangeText={setQuestionFocus} value={questionFocus} />
            <Button loading={generateQuestions.isPending} onPress={() => generateQuestions.mutate({
              focus: [`bookId=${data.bookId}`, `title=${data.bookTitle}`, `author=${data.bookAuthor ?? "unknown"}`, questionFocus.trim() ? `focus=${questionFocus.trim()}` : ""].filter(Boolean).join("; "),
              windowId: selectedWindow.windowId,
            })} variant="outline">{c.generateQuestions}</Button>
            {generateQuestions.isPending ? <ResultSkeleton label={c.generateQuestions} testID="question-generation-skeleton" /> : null}
            <TextField label={c.questionDraft} multiline onChangeText={setQuestionDraft} value={questionDraft} />
            <Button disabled={!questionDraft.trim()} loading={createQuestion.isPending} onPress={() => createQuestion.mutate({ questionText: questionDraft.trim(), windowId: selectedWindow.windowId }, { onSuccess: (result) => { setSelectedQuestionId(result.questions.at(-1)?.questionId); setQuestionDraft(""); } })}>{c.addQuestion}</Button>
          </>
        ) : null}
        {visibleQuestions.map((question) => (
          <View key={question.questionId} style={styles.item}>
            <Button accessibilityState={{ selected: selectedQuestionId === question.questionId }} onPress={() => setSelectedQuestionId(question.questionId)} testID={`reading-question-${question.questionId}`} variant={selectedQuestionId === question.questionId ? "primary" : "ghost"}>{question.questionText} · {localizeStatus(c, question.status)}</Button>
            {!isAnswered(question.status) ? <Button accessibilityLabel={`${c.delete}: ${question.questionText}`} onPress={() => confirmRemoval(c, locale, () => deleteQuestion.mutate(question.questionId))} variant="destructive">{c.delete}</Button> : null}
          </View>
        ))}
        {selectedQuestion && selectedWindow ? (
          <View style={styles.questionAnswer} testID="selected-question-answer">
            <AppText variant="label">{c.selectedQuestion}: {selectedQuestion.questionText}</AppText>
            {data.messages.filter((message) => message.questionId === selectedQuestion.questionId).map((message) => <AppText key={message.messageId}>{localizeRole(c, message.role)}: {message.content}</AppText>)}
            {pendingAnswer ? <AppText>{c.readerRole}: {pendingAnswer}</AppText> : null}
            <TextField label={c.answerQuestion} multiline onChangeText={setAnswerDraft} value={answerDraft} />
            <Button disabled={!answerDraft.trim()} loading={streamAnswer.isPending} onPress={() => {
              const submitted = answerDraft.trim();
              answerStreamAbort.current?.abort();
              const controller = new AbortController();
              answerStreamAbort.current = controller;
              setPendingAnswer(submitted);
              setStreamedReply("");
              setStreamOutcome(undefined);
              streamAnswer.mutate(
                { content: submitted, onDelta: (delta) => setStreamedReply((current) => current + delta), questionId: selectedQuestion.questionId, signal: controller.signal, windowId: selectedWindow.windowId },
                {
                  onError: () => {
                    setPendingAnswer("");
                    setStreamedReply("");
                    setStreamOutcome("error");
                    void timeline.refetch();
                  },
                  onSettled: () => {
                    setPendingAnswer("");
                    if (answerStreamAbort.current === controller) answerStreamAbort.current = undefined;
                  },
                  onSuccess: () => {
                    setAnswerDraft("");
                    setStreamedReply("");
                    setStreamOutcome("success");
                  },
                },
              );
            }}>{c.answerQuestion}</Button>
            {streamedReply ? <Surface accessibilityLiveRegion="none" testID="reading-stream-delta"><AppText variant="label">{c.streamReply}</AppText><AppText>{streamedReply}</AppText></Surface> : null}
            {streamOutcome === "success" ? <Notice title={c.streamComplete} tone="success" /> : null}
            {streamOutcome === "error" ? <Notice title={c.error} tone="error" /> : null}
            <Button onPress={() => setSelectedQuestionId(undefined)} variant="ghost">{c.back}</Button>
          </View>
        ) : null}
      </Surface>
      </View>
      <View onLayout={(event) => handleAreaLayout("messages", event)} testID="reading-area-messages">
      <Surface>
        <View
          accessibilityLabel={c.messages}
          accessibilityRole="header"
          accessible
          collapsable={false}
          ref={(node) => { areaHeadings.current.messages = node; }}
        ><AppText variant="heading">{c.messages}</AppText></View>
        {visibleSessionMessages.map((message) => <EditableMessage c={c} item={message} key={`${message.messageId}:${message.content}`} locale={locale} remove={deleteMessage} update={updateMessage} />)}
      </Surface>
      </View>

      <View onLayout={(event) => handleAreaLayout("quotes", event)} testID="reading-area-quotes">
      <Surface>
        <View
          accessibilityLabel={c.quotes}
          accessibilityRole="header"
          accessible
          collapsable={false}
          ref={(node) => { areaHeadings.current.quotes = node; }}
        ><AppText variant="heading">{c.highlight}</AppText></View>
        <TextField label={c.quote} maxLength={HIGHLIGHT_QUOTE_MAX_LENGTH} multiline onChangeText={setQuote} value={quote} />
        <TextField error={parsedNewPage.valid ? undefined : c.pageInvalid} keyboardType="number-pad" label={c.page} onChangeText={setPageDraft} value={pageDraft} />
        <TextField label={c.location} maxLength={HIGHLIGHT_LOCATION_MAX_LENGTH} onChangeText={setLocation} value={location} />
        <TextField label={c.note} maxLength={HIGHLIGHT_NOTE_MAX_LENGTH} multiline onChangeText={setNote} value={note} />
        <Button
          disabled={!quote.trim() || !parsedNewPage.valid}
          loading={highlight.isPending}
          onPress={() => highlight.mutate(
            { quoteText: quote.trim(), pageNumber: parsedNewPage.pageNumber, locationLabel: location.trim() || undefined, note: note.trim() || undefined },
            { onSuccess: () => { setQuote(""); setPageDraft(""); setLocation(""); setNote(""); } },
          )}
          testID="create-highlight"
        >{c.add}</Button>
        {visibleHighlights.map((item) => <EditableHighlight c={c} item={item} key={`${item.highlightId}:${item.quoteText}:${item.locationLabel ?? ''}:${item.note ?? ''}`} locale={locale} sessionId={sessionId} />)}
      </Surface>
      </View>

      <Surface>
        <AppText variant="heading">{c.tag}</AppText>
        <TextField label={c.tag} maxLength={TAG_MAX_LENGTH} onChangeText={setTagLabel} value={tagLabel} />
        <Button disabled={!tagLabel.trim()} loading={tag.isPending} onPress={() => tag.mutate(tagLabel.trim(), { onSuccess: () => setTagLabel("") })}>{c.add}</Button>
        <View style={styles.actions}>
          {data.tags.map((item) => <TagItem c={c} key={item.tagId} label={item.label} locale={locale} sessionId={sessionId} tagId={item.tagId} />)}
        </View>
      </Surface>

      <View onLayout={(event) => handleAreaLayout("review", event)} testID="reading-area-review">
      <Surface>
        <View
          accessibilityLabel={c.review}
          accessibilityRole="header"
          accessible
          collapsable={false}
          ref={(node) => { areaHeadings.current.review = node; }}
        ><AppText variant="heading">{c.insight}</AppText></View>
        <TextField label={c.insight} multiline onChangeText={setInsightText} value={insightText} />
        <Button disabled={!insightText.trim()} loading={insight.isPending} onPress={() => insight.mutate({ content: insightText.trim(), visibility: "PRIVATE" }, { onSuccess: () => setInsightText("") })}>{c.add}</Button>
        {data.insights.map((item) => <EditableInsight c={c} item={item} key={`${item.insightId}:${item.content}`} locale={locale} sessionId={sessionId} />)}
      </Surface>
      </View>

      {highlight.isError || tag.isError || insight.isError || renameSession.isError || createWindow.isError || renameWindow.isError || archiveWindow.isError || createQuestion.isError || deleteQuestion.isError || generateQuestions.isError || updateMessage.isError || deleteMessage.isError || archiveSession.isError ? <Notice title={c.error} tone="error" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  item: { gap: spacing.x2, paddingVertical: spacing.x2 },
  jumpActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  jumpButton: { flexBasis: "30%", flexGrow: 1, paddingHorizontal: spacing.x2 },
  questionAnswer: { gap: spacing.x2, paddingVertical: spacing.x3 },
  skeleton: { gap: spacing.x2, paddingVertical: spacing.x2 },
  skeletonLine: { backgroundColor: colors.line, borderRadius: 4, height: 16, width: "100%" },
  skeletonLineShort: { width: "68%" },
  tag: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.x1 },
});
