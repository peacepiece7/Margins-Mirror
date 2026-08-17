import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useI18n } from '@/lib/i18n';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Persona } from '@/types/api/persona';
import type { DiscussionNavigation, PerspectiveCandidate } from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';

import { useReflectionTimelineForBook } from '../queries';
import { useDiscussionRunQuery, useGuidedDiscussionTurnMutation } from '../reflection-loop-queries';
import { reflectionErrorMessage } from '../reflection-loop-ui';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import { DiscussionReplySkeleton } from './DiscussionReplySkeleton';

const directorLabelKeys = {
  ASK_FOLLOW_UP: 'reflectionDirectorFollowUp',
  CALL_PERSPECTIVE: 'reflectionDirectorPerspective',
  MOVE_NEXT_TOPIC: 'reflectionDirectorNext',
  SUMMARIZE_TOPIC: 'reflectionDirectorSummary',
  FINISH_DISCUSSION: 'reflectionDirectorFinish',
} as const;

const stageLabelKeys = {
  WARM_UP: 'reflectionStageWarmUp',
  INTERPRETATION: 'reflectionStageInterpretation',
  EXPERIENCE: 'reflectionStageExperience',
  SOCIAL_VALUE: 'reflectionStageSocialValue',
  CLOSING: 'reflectionStageClosing',
} as const;

const sensitivityLabelKeys = {
  LOW: 'reflectionSensitivityLow',
  MEDIUM: 'reflectionSensitivityMedium',
  HIGH: 'reflectionSensitivityHigh',
} as const;

const sourceLabelKeys = {
  REFLECTION: 'reflectionSourceReflection',
  HIGHLIGHT: 'reflectionSourceHighlight',
  BOOK_KNOWLEDGE: 'reflectionSourceBookKnowledge',
  ANSWER: 'reflectionSourceAnswer',
} as const;

export function GuidedDiscussionPanel({
  bookId,
  runId,
  personas,
}: {
  bookId: number;
  runId: number;
  personas: Persona[];
}) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const run = useDiscussionRunQuery(runId);
  const { timeline } = useReflectionTimelineForBook(bookId);
  const turn = useGuidedDiscussionTurnMutation(runId, run.data?.sessionId);
  const [draft, setDraft] = useState('');
  const [optimisticMessage, setOptimisticMessage] = useState<{
    content: string;
    messageId: string;
    persistedMessageIdsAtSubmit: ReadonlySet<number>;
  }>();
  const optimisticMessageSequence = useRef(0);
  const [awaitingPersistedMessage, setAwaitingPersistedMessage] = useState(false);
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const historyRef = useRef<HTMLElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const finishButtonRef = useRef<HTMLButtonElement>(null);
  const finishDialogWasOpenRef = useRef(false);
  const personaById = useMemo(
    () => new Map(personas.map((persona) => [persona.personaId, persona])),
    [personas],
  );
  const persistedMessages = (timeline.data?.messages ?? []).filter(
    (message) => message.windowId === run.data?.windowId,
  );
  const messages = useMemo(() => {
    if (!optimisticMessage) return persistedMessages;
    const alreadyPersisted = persistedMessages.some(
      (message) =>
        message.role === 'user' &&
        message.content === optimisticMessage.content &&
        !optimisticMessage.persistedMessageIdsAtSubmit.has(message.messageId),
    );
    if (alreadyPersisted) return persistedMessages;
    return [
      ...persistedMessages,
      {
        content: optimisticMessage.content,
        messageId: optimisticMessage.messageId,
        role: 'user',
        personaId: undefined,
        windowId: run.data?.windowId,
      },
    ];
  }, [optimisticMessage, persistedMessages, run.data?.windowId]);
  const current = run.data?.currentItem;
  const candidates: PerspectiveCandidate[] = run.data?.perspectiveCandidates ?? [];
  const selectionRequired = Boolean(run.data?.perspectiveSelectionRequired && candidates.length);
  const pending = run.isFetching || !timeline.data || turn.isPending;
  const timelineUnavailable = timeline.isSuccess && !timeline.data;
  const moderation = turn.data?.moderation;
  const blockedModeration = moderation && moderation.decision !== 'ALLOW' ? moderation : null;
  const lastMessageId = messages.at(-1)?.messageId;
  const operationError = run.error ?? timeline.error ?? turn.error;
  const paths = {
    reflect: `/book/${bookId}/reflection`,
    interview: `/book/${bookId}/reflection/interview`,
    guide: run.data ? `/book/${bookId}/reflection/guide/${run.data.guideId}` : undefined,
    discuss: `/book/${bookId}/reflection/discuss/${runId}`,
  };

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [lastMessageId]);

  useEffect(() => {
    if (awaitingPersistedMessage && optimisticMessage) {
      const persisted = persistedMessages.some(
        (message) =>
          message.role === 'user' &&
          message.content === optimisticMessage.content &&
          !optimisticMessage.persistedMessageIdsAtSubmit.has(message.messageId),
      );
      if (persisted) {
        setOptimisticMessage(undefined);
        setAwaitingPersistedMessage(false);
      }
    }
  }, [awaitingPersistedMessage, optimisticMessage, persistedMessages]);

  useEffect(() => {
    if (turn.isError) {
      setOptimisticMessage(undefined);
      setAwaitingPersistedMessage(false);
    }
  }, [turn.isError]);

  useEffect(() => {
    if (finishDialogWasOpenRef.current && !finishConfirmationOpen) {
      finishButtonRef.current?.focus();
    }
    finishDialogWasOpenRef.current = finishConfirmationOpen;
  }, [finishConfirmationOpen]);

  function send(navigation: DiscussionNavigation, personaId?: number) {
    const content = navigation === 'SELECT_PERSPECTIVE' ? '' : draft.trim();
    if ((!content && navigation !== 'SELECT_PERSPECTIVE') || pending) return;
    if (content) {
      setOptimisticMessage({
        content,
        messageId: `pending-discussion-${++optimisticMessageSequence.current}`,
        persistedMessageIdsAtSubmit: new Set(persistedMessages.map((message) => message.messageId)),
      });
      setAwaitingPersistedMessage(false);
    }
    turn.mutate(
      { content, navigation, personaId },
      {
        onSuccess: (result) => {
          if (result.moderation && result.moderation.decision !== 'ALLOW') {
            setOptimisticMessage(undefined);
            setAwaitingPersistedMessage(false);
          } else if (content) {
            setAwaitingPersistedMessage(true);
          }
          if (!result.moderation || result.moderation.decision === 'ALLOW') {
            setDraft('');
          }
          setFinishConfirmationOpen(false);
          if (result.runStatus === 'COMPLETED') {
            navigate(`/book/${bookId}/reflection/refine/${runId}`);
            return;
          }
          requestAnimationFrame(() => draftRef.current?.focus());
        },
      },
    );
  }

  async function confirmFinish() {
    const content = draft.trim();
    if (!content || pending) return;
    setOptimisticMessage({
      content,
      messageId: `pending-discussion-${++optimisticMessageSequence.current}`,
      persistedMessageIdsAtSubmit: new Set(persistedMessages.map((message) => message.messageId)),
    });
    setAwaitingPersistedMessage(false);
    const result = await turn.mutateAsync({ content, navigation: 'FINISH', personaId: undefined });
    if (result.moderation && result.moderation.decision !== 'ALLOW') {
      setOptimisticMessage(undefined);
      setAwaitingPersistedMessage(false);
    } else {
      setAwaitingPersistedMessage(true);
    }
    if (!result.moderation || result.moderation.decision === 'ALLOW') {
      setDraft('');
    }
    setFinishConfirmationOpen(false);
    if (result.runStatus === 'COMPLETED') {
      navigate(`/book/${bookId}/reflection/refine/${runId}`);
      return;
    }
    requestAnimationFrame(() => draftRef.current?.focus());
  }

  if (run.data?.status === 'COMPLETED') {
    return (
      <section className="grid gap-5">
        <ReflectionLoopProgress active="discuss" bookId={bookId} paths={paths} />
        <div className="rounded border border-stone-300 bg-white p-6">
          <h2 className="text-xl font-semibold">{t('reflectionDiscussionCompletedTitle')}</h2>
          <p className="mt-2 text-sm text-stone-600">
            {t('reflectionDiscussionCompletedDescription')}
          </p>
          <Button
            className="mt-4"
            onClick={() => navigate(`/book/${bookId}/reflection/refine/${runId}`)}
            type="button"
          >
            {t('reflectionDiscussionRefine')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-busy={pending} className="grid gap-5" {...testAttr('guided-discussion-page')}>
      <ReflectionLoopProgress active="discuss" bookId={bookId} paths={paths} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">
          {t('reflectionDiscussionPipeline')}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{t('reflectionDiscussionTitle')}</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionDiscussionDescription')}
        </p>
      </header>

      {operationError || timelineUnavailable ? (
        <Alert variant="destructive">
          <AlertTitle>{t('reflectionDiscussionErrorTitle')}</AlertTitle>
          <AlertDescription>
            {reflectionErrorMessage(operationError, t('reflectionDiscussionErrorDescription'))}
          </AlertDescription>
          {run.isError || timeline.isError || timelineUnavailable ? (
            <Button
              className="mt-3"
              onClick={() => {
                if (run.isError) void run.refetch();
                if (timeline.isError || timelineUnavailable) void timeline.refetch();
              }}
              type="button"
              variant="outline"
            >
              {t('reflectionReload')}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {blockedModeration ? (
        <Alert className="border-amber-300 bg-amber-50" variant="warning">
          <AlertTitle>
            {blockedModeration.intent === 'DISCUSSION_STRUCTURE'
              ? t('reflectionDiscussionStructureTitle')
              : blockedModeration.decision === 'REDIRECT'
                ? t('reflectionModerationRedirectTitle')
                : t('reflectionModerationRejectTitle')}
          </AlertTitle>
          <AlertDescription className="grid gap-2 text-current">
            <p>
              {blockedModeration.intent === 'DISCUSSION_STRUCTURE'
                ? (blockedModeration.suggestedQuestion ??
                  t('reflectionDiscussionStructureDescription'))
                : blockedModeration.decision === 'REDIRECT'
                  ? t('reflectionModerationRedirectDescription')
                  : t('reflectionModerationRejectDescription')}
            </p>
            {blockedModeration.decision === 'REDIRECT' &&
            blockedModeration.intent !== 'DISCUSSION_STRUCTURE' &&
            blockedModeration.suggestedQuestion ? (
              <p className="rounded border border-amber-200 bg-white px-3 py-2">
                {blockedModeration.suggestedQuestion}
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {run.data?.lastDirectorAction ? (
        <Alert className="border-stone-300 bg-stone-50">
          <AlertTitle>
            {t('reflectionDirectorFallback')} ·{' '}
            {directorLabelKeys[run.data.lastDirectorAction as keyof typeof directorLabelKeys]
              ? t(directorLabelKeys[run.data.lastDirectorAction as keyof typeof directorLabelKeys])
              : run.data.lastDirectorAction}
          </AlertTitle>
          <AlertDescription>{t('reflectionDiscussionResumeDescription')}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>
            {current?.stage && stageLabelKeys[current.stage as keyof typeof stageLabelKeys]
              ? t(stageLabelKeys[current.stage as keyof typeof stageLabelKeys])
              : (current?.stage ?? t('reflectionPreparing'))}
          </Badge>
          {current ? (
            <Badge variant="outline">
              {current.expectedMinutes}
              {t('reflectionMinutes')}
            </Badge>
          ) : null}
          {current ? (
            <Badge variant="outline">
              {t('reflectionSensitivity')}{' '}
              {sensitivityLabelKeys[current.sensitivity as keyof typeof sensitivityLabelKeys]
                ? t(sensitivityLabelKeys[current.sensitivity as keyof typeof sensitivityLabelKeys])
                : current.sensitivity}
            </Badge>
          ) : null}
        </div>
        <h3 className="text-xl font-semibold leading-8">
          {current?.question ?? t('reflectionCurrentItemLoading')}
        </h3>
        {current ? (
          <details
            className="group rounded border border-stone-200 bg-stone-50 text-sm text-stone-600"
            {...testAttr('guided-discussion-source')}
          >
            <summary className="cursor-pointer list-none px-3 py-2 font-semibold text-stone-800 marker:hidden">
              {t('reflectionSource')} ·{' '}
              {sourceLabelKeys[current.sourceType as keyof typeof sourceLabelKeys]
                ? t(sourceLabelKeys[current.sourceType as keyof typeof sourceLabelKeys])
                : t('reflectionSourceLinked')}
            </summary>
            <p className="border-t border-stone-200 px-3 py-3 leading-6">{current.sourceExcerpt}</p>
          </details>
        ) : null}
      </section>

      {selectionRequired ? (
        <section
          aria-label={t('reflectionPerspectiveCandidatesLabel')}
          className="grid gap-3 rounded border border-amber-300 bg-amber-50 p-4 sm:p-5"
          {...testAttr('guided-perspective-candidates')}
        >
          <div>
            <h3 className="font-semibold text-stone-900">
              {t('reflectionPerspectiveCandidatesTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-stone-700">
              {t('reflectionPerspectiveCandidatesDescription')}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {candidates.map((candidate) => (
              <Button
                className="h-auto justify-start whitespace-normal p-3 text-left"
                data-testid={`guided-perspective-${candidate.personaId}`}
                disabled={pending}
                key={candidate.personaId}
                onClick={() => send('SELECT_PERSPECTIVE', candidate.personaId)}
                type="button"
                variant="outline"
              >
                <span className="grid gap-1">
                  <span className="font-semibold">{candidate.displayName}</span>
                  {candidate.description ? (
                    <span className="text-xs font-normal text-stone-600">
                      {candidate.description}
                    </span>
                  ) : null}
                </span>
              </Button>
            ))}
          </div>
          <Button
            className="w-full sm:w-fit"
            disabled={pending}
            onClick={() => send('SKIP_PERSPECTIVE')}
            type="button"
            variant="ghost"
          >
            {t('reflectionPerspectiveSkip')}
          </Button>
        </section>
      ) : null}

      <section
        aria-label={t('reflectionSavedDiscussionHistory')}
        aria-live="polite"
        className="grid max-h-[30rem] gap-3 overflow-y-auto rounded border border-stone-300 bg-stone-100 p-3 sm:p-4"
        ref={historyRef}
        {...testAttr('guided-discussion-history')}
      >
        {messages.map((message) => {
          const persona = message.personaId ? personaById.get(message.personaId) : undefined;
          return (
            <article
              className={`max-w-[92%] rounded border p-3 sm:max-w-[78%] ${
                message.role === 'user'
                  ? 'ml-auto border-stone-900 bg-stone-950 text-white'
                  : 'mr-auto border-stone-300 bg-white'
              }`}
              key={message.messageId}
            >
              <p className="mb-1 text-xs font-semibold opacity-70">
                {message.role === 'user'
                  ? t('reflectionMe')
                  : (persona?.displayName ??
                    (message.personaId
                      ? t('reflectionPerspectiveFallback')
                      : t('reflectionDirectorFallback')))}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </article>
          );
        })}
        {turn.isPending ? <DiscussionReplySkeleton /> : null}
        {!messages.length ? (
          <p className="p-4 text-center text-sm text-stone-500">
            {t('reflectionDiscussionHistoryEmpty')}
          </p>
        ) : null}
      </section>

      <div className="flex justify-end rounded border border-stone-200 bg-stone-50 p-3">
        <Button
          disabled={pending || selectionRequired || !draft.trim()}
          onClick={() => send('NEXT')}
          type="button"
          variant="outline"
        >
          {turn.isPending && turn.variables?.navigation === 'NEXT'
            ? t('reflectionNextSaving')
            : t('reflectionNextAction')}
        </Button>
      </div>

      <section
        className="sticky bottom-2 grid max-h-[70dvh] gap-3 overflow-y-auto rounded border border-stone-300 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-3 sm:p-4"
        {...testAttr('guided-discussion-composer')}
      >
        <div className="grid gap-2">
          <Textarea
            aria-label={t('reflectionDiscussionAnswerLabel')}
            aria-describedby="guided-discussion-composer-help"
            className="min-h-20 resize-y sm:min-h-24"
            disabled={pending || selectionRequired}
            maxLength={12000}
            onChange={(event) => {
              if (turn.isError) turn.reset();
              setDraft(event.target.value);
            }}
            placeholder={t('reflectionDiscussionPlaceholder')}
            ref={draftRef}
            value={draft}
            {...testAttr('guided-discussion-draft')}
          />
        </div>
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 text-xs text-stone-500"
          id="guided-discussion-composer-help"
        >
          <span>{t('reflectionDiscussionComposerHelp')}</span>
          <span className="shrink-0">
            {draft.trim().length.toLocaleString()}
            {t('reflectionCharacters')}
          </span>
        </div>
        <div className="flex justify-end">
          <Button
            className="w-full sm:w-auto"
            disabled={pending || selectionRequired || !draft.trim()}
            onClick={() => send('RESPOND')}
            type="button"
          >
            {turn.isPending && turn.variables?.navigation === 'RESPOND'
              ? t('reflectionRespondSaving')
              : t('reflectionRespondAction')}
          </Button>
        </div>
      </section>

      <section
        className="flex flex-col gap-3 rounded border border-stone-300 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        {...testAttr('guided-discussion-finish')}
      >
        <p className="text-sm text-stone-600">{t('reflectionFinishConfirmationDescription')}</p>
        <Button
          className="w-full sm:w-auto"
          disabled={pending || selectionRequired || !draft.trim()}
          onClick={() => setFinishConfirmationOpen(true)}
          ref={finishButtonRef}
          type="button"
          variant="outline"
        >
          {turn.isPending && turn.variables?.navigation === 'FINISH'
            ? t('reflectionFinishSaving')
            : t('reflectionFinishAction')}
        </Button>
      </section>

      <ConfirmActionDialog
        cancelLabel={t('reflectionFinishCancel')}
        confirmLabel={t('reflectionFinishConfirm')}
        description={t('reflectionFinishConfirmationDescription')}
        loadingLabel={t('reflectionFinishSaving')}
        onConfirm={confirmFinish}
        onOpenChange={setFinishConfirmationOpen}
        open={finishConfirmationOpen}
        title={t('reflectionFinishConfirmationTitle')}
      />
    </section>
  );
}
