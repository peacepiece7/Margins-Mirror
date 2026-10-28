import { useRef, useState, type FormEvent } from 'react';
import { useOptimisticMessage } from '@/hooks/use-optimistic-message';
import type { DebateTurnResponse } from '@/types/api/session';

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
import { DeveloperDraftControl } from '@/components/developer-draft-control';
import { debatesApi } from '../api';
import { debateDeveloperDraftContext } from '../developer-draft-context';

export function DebatePanel({ bookId, windowId }: { bookId: number; windowId: number }) {
  return <DebateRoomPanel bookId={bookId} key={`${bookId}:${windowId}`} windowId={windowId} />;
}

function DebateRoomPanel({ bookId, windowId }: { bookId: number; windowId: number }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const draftVersion = useRef(0);
  const currentDraftVersion = draftVersion.current;
  const inFlight = useRef(false);
  const { sessionId, timeline } = useDebateTimelineForBook(bookId);
  const personas = usePersonasQuery();
  const recommendations = usePersonaRecommendationsQuery(bookId);
  const debate = useDebateMutation(sessionId ?? 0);
  const debateAll = useDebateAllMutation(sessionId ?? 0);
  const moderationFeedback = useModerationFeedbackMutation(sessionId ?? 0);
  const window = timeline.data?.windows.find((item) => item.windowId === windowId);
  const topic = window ? debateTopicFromWindowTitle(window.title) : '';
  const persisted = (timeline.data?.messages ?? []).filter(
    (message) => message.windowId === windowId,
  );
  const optimistic = useOptimisticMessage(persisted);
  const persistedMessages: SessionDisplayMessage[] = persisted.map((message) => ({
    id: String(message.messageId),
    persistedMessageId: message.messageId,
    sessionId: message.sessionId,
    windowId: message.windowId,
    role: message.role,
    content: message.content,
    personaId: message.personaId,
    questionId: message.questionId,
    createdAt: message.createdAt,
  }));
  const messages = optimistic.message
    ? [
        ...persistedMessages,
        {
          id: optimistic.message.messageId,
          content: optimistic.message.content,
          sessionId: sessionId ?? 0,
          windowId,
          role: 'user',
        },
      ]
    : persistedMessages;
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

  function changeDraft(content: string) {
    draftVersion.current += 1;
    setDraft(content);
  }

  function requestReply(personaId?: number) {
    const content = draft.trim() || topic.trim();
    if (!sessionId || window?.windowType !== 'debate' || !content || pending || inFlight.current)
      return;
    if (
      !selectedPersonas.length ||
      (personaId !== undefined && !selectedPersonaIds.includes(personaId))
    )
      return;
    inFlight.current = true;
    const submittedVersion = ++draftVersion.current;
    optimistic.begin(content);
    const callbacks = {
      onSuccess(result: DebateTurnResponse) {
        if (result.moderation && result.moderation.decision !== 'ALLOW') optimistic.clear();
        if (result.messages.length && draftVersion.current === submittedVersion) setDraft('');
        inFlight.current = false;
      },
      onError() {
        optimistic.clear();
        inFlight.current = false;
      },
    };
    if (personaId !== undefined) debate.mutate({ windowId, personaId, content }, callbacks);
    else
      debateAll.mutate(
        {
          windowId,
          content,
          personaIds: selectedPersonas.map((persona) => persona.personaId),
        },
        callbacks,
      );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const persona = selectedPersonas[0];
    if (persona) requestReply(persona.personaId);
  }

  return (
    <div className="grid gap-3">
      <AiProcessingNotice
        action={t('aiActionDebate')}
        dismissDays={QUESTION_AI_NOTICE_DISMISS_DAYS}
        storageKey={QUESTION_AI_NOTICE_COOKIE_KEY}
      />
      <DebatePage
        developerDraftControl={
          <DeveloperDraftControl
            bookId={bookId}
            context={debateDeveloperDraftContext({
              draft,
              messages: persistedMessages,
              question: sourceQuestion?.questionText,
              answer: sourceAnswer?.content,
            })}
            disabled={pending || window?.windowType !== 'debate'}
            draftKey={JSON.stringify([
              windowId,
              topic,
              sourceQuestion?.questionText,
              sourceAnswer?.content,
              persistedMessages.slice(-8).map(({ id, content }) => [id, content]),
            ])}
            generate={debatesApi.developerDraft}
            onGenerated={(content) => {
              if (draftVersion.current === currentDraftVersion) changeDraft(content);
            }}
            subject={topic.slice(0, 2000)}
            target="DISCUSSION_TURN"
          />
        }
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
        onAllReplies={() => requestReply()}
        onDraftChange={changeDraft}
        onPersonaReply={requestReply}
        onModerationFeedback={(eventId, feedback) => {
          if (moderationFeedback.isPending) return;
          moderationFeedback.mutate({ eventId, feedback });
        }}
        onSubmit={submit}
      />
    </div>
  );
}
