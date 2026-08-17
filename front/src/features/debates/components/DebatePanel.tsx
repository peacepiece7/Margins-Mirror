import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { debateTopicFromWindowTitle } from '../display';
import {
  useDebateAllMutation,
  useDebateMutation,
  useDebateTimelineForBook,
  useModerationFeedbackMutation,
  usePersonaRecommendationsQuery,
  usePersonasQuery,
} from '../queries';
import type { SessionDisplayMessage } from '../panel-types';
import { resolveDebatePersonaIds } from '../persona-selection';
import { DebatePage } from './DebatePage';
import { AiProcessingNotice } from '@/components/ui/ai-processing-notice';
import {
  QUESTION_AI_NOTICE_DISMISS_DAYS,
  QUESTION_AI_NOTICE_COOKIE_KEY,
} from '@/lib/dismissible-notice';
import { useI18n } from '@/lib/i18n';

type OptimisticDebateMessage = SessionDisplayMessage & {
  persistedMessageIdsAtSubmit: ReadonlySet<number>;
};

export function DebatePanel({ bookId, windowId }: { bookId: number; windowId: number }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [optimisticMessage, setOptimisticMessage] = useState<OptimisticDebateMessage>();
  const [awaitingPersistedMessage, setAwaitingPersistedMessage] = useState(false);
  const optimisticMessageSequence = useRef(0);
  const { sessionId, timeline } = useDebateTimelineForBook(bookId);
  const personas = usePersonasQuery();
  const recommendations = usePersonaRecommendationsQuery(bookId);
  const debate = useDebateMutation(sessionId ?? 0);
  const debateAll = useDebateAllMutation(sessionId ?? 0);
  const moderationFeedback = useModerationFeedbackMutation(sessionId ?? 0);
  const window = timeline.data?.windows.find((item) => item.windowId === windowId);
  const topic = window ? debateTopicFromWindowTitle(window.title) : '';
  const persistedMessages = useMemo<SessionDisplayMessage[]>(
    () =>
      (timeline.data?.messages ?? [])
        .filter((message) => message.windowId === windowId)
        .map((message) => ({
          id: String(message.messageId),
          persistedMessageId: message.messageId,
          sessionId: message.sessionId,
          windowId: message.windowId,
          role: message.role,
          content: message.content,
          personaId: message.personaId,
          questionId: message.questionId,
          createdAt: message.createdAt,
        })),
    [timeline.data?.messages, windowId],
  );
  const messages = useMemo<SessionDisplayMessage[]>(() => {
    if (!optimisticMessage) return persistedMessages;
    const alreadyPersisted = persistedMessages.some(
      (message) =>
        message.role === 'user' &&
        message.content === optimisticMessage.content &&
        message.windowId === optimisticMessage.windowId &&
        message.persistedMessageId !== undefined &&
        !optimisticMessage.persistedMessageIdsAtSubmit.has(message.persistedMessageId),
    );
    return alreadyPersisted ? persistedMessages : [...persistedMessages, optimisticMessage];
  }, [optimisticMessage, persistedMessages]);
  const moderationEvents = (timeline.data?.moderationEvents ?? []).filter(
    (event) => event.windowId === windowId,
  );
  const allPersonas = personas.data?.personas ?? [];
  const recommendedPersonaIds = (recommendations.data?.personas ?? []).map(
    (persona) => persona.personaId,
  );
  const selectedPersonaIds = resolveDebatePersonaIds(window?.personaIds, recommendedPersonaIds);
  const selectedPersonas = selectedPersonaIds
    .map((id) => allPersonas.find((persona) => persona.personaId === id))
    .filter((persona): persona is (typeof allPersonas)[number] => Boolean(persona));
  const sourceQuestion = timeline.data?.questions.find(
    (question) => question.questionId === window?.sourceQuestionId,
  );
  const sourceAnswer = timeline.data?.insights.find(
    (insight) =>
      insight.questionId === window?.sourceQuestionId && insight.insightType === 'question_answer',
  );
  const pending = debate.isPending || debateAll.isPending || timeline.isFetching;

  useEffect(() => {
    if (awaitingPersistedMessage && optimisticMessage) {
      const persisted = persistedMessages.some(
        (message) =>
          message.role === 'user' &&
          message.content === optimisticMessage.content &&
          message.windowId === optimisticMessage.windowId &&
          message.persistedMessageId !== undefined &&
          !optimisticMessage.persistedMessageIdsAtSubmit.has(message.persistedMessageId),
      );
      if (persisted) {
        setOptimisticMessage(undefined);
        setAwaitingPersistedMessage(false);
      }
    }
  }, [awaitingPersistedMessage, optimisticMessage, persistedMessages]);

  useEffect(() => {
    if (debate.isError || debateAll.isError) {
      setOptimisticMessage(undefined);
      setAwaitingPersistedMessage(false);
    }
  }, [debate.isError, debateAll.isError]);

  function prompt() {
    return draft.trim() || topic.trim();
  }

  function requestPersona(personaId: number) {
    const content = prompt();
    if (!sessionId || !window || !content || pending) return;
    setOptimisticMessage({
      id: `pending-debate-${++optimisticMessageSequence.current}`,
      sessionId,
      windowId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      persistedMessageIdsAtSubmit: new Set(
        persistedMessages.flatMap((message) =>
          message.persistedMessageId === undefined ? [] : [message.persistedMessageId],
        ),
      ),
    });
    setAwaitingPersistedMessage(false);
    debate.mutate(
      { windowId, personaId, content },
      {
        onSuccess: (result) => {
          if (result.moderation && result.moderation.decision !== 'ALLOW') {
            setOptimisticMessage(undefined);
            setAwaitingPersistedMessage(false);
          } else {
            setAwaitingPersistedMessage(true);
          }
          if (result.messages.length > 0) setDraft('');
        },
      },
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const persona = selectedPersonas[0];
    if (persona) requestPersona(persona.personaId);
  }

  return (
    <div className="grid gap-3">
      <AiProcessingNotice
        action={t('aiActionDebate')}
        dismissDays={QUESTION_AI_NOTICE_DISMISS_DAYS}
        storageKey={QUESTION_AI_NOTICE_COOKIE_KEY}
      />
      <DebatePage
        draft={draft}
        loading={pending}
        messages={messages}
        moderationEvents={moderationEvents}
        personas={allPersonas}
        selectedPersonas={selectedPersonas}
        showReplySkeleton={debate.isPending || debateAll.isPending}
        sourceAnswer={sourceAnswer}
        sourceQuestion={sourceQuestion}
        topic={topic}
        window={window}
        onAllReplies={() => {
          const content = prompt();
          if (!sessionId || !window || !content || pending) return;
          setOptimisticMessage({
            id: `pending-debate-${++optimisticMessageSequence.current}`,
            sessionId,
            windowId,
            role: 'user',
            content,
            createdAt: new Date().toISOString(),
            persistedMessageIdsAtSubmit: new Set(
              persistedMessages.flatMap((message) =>
                message.persistedMessageId === undefined ? [] : [message.persistedMessageId],
              ),
            ),
          });
          setAwaitingPersistedMessage(false);
          debateAll.mutate(
            {
              windowId,
              content,
              personaIds: selectedPersonas.map((persona) => persona.personaId),
            },
            {
              onSuccess: (result) => {
                if (result.moderation && result.moderation.decision !== 'ALLOW') {
                  setOptimisticMessage(undefined);
                  setAwaitingPersistedMessage(false);
                } else {
                  setAwaitingPersistedMessage(true);
                }
                if (result.messages.length > 0) setDraft('');
              },
            },
          );
        }}
        onDraftChange={setDraft}
        onPersonaReply={requestPersona}
        onModerationFeedback={(eventId, feedback) => {
          if (moderationFeedback.isPending) return;
          moderationFeedback.mutate({ eventId, feedback });
        }}
        onSubmit={submit}
      />
    </div>
  );
}
