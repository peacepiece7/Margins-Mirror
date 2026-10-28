import { useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Textarea } from '@/components/ui/textarea';
import { testAttr } from '@/utils/testAttrs';
import type { GuidedDiscussion } from '../use-guided-discussion';
import { DiscussionReplySkeleton } from './DiscussionReplySkeleton';
import { DeveloperDraftControl } from './DeveloperDraftControl';

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

export function DiscussionCompleted({ onRefine }: GuidedDiscussion['completed']) {
  const { t } = useI18n();
  return (
    <div className="rounded border border-stone-300 bg-white p-6">
      <h2 className="text-xl font-semibold">{t('reflectionDiscussionCompletedTitle')}</h2>
      <p className="mt-2 text-sm text-stone-600">{t('reflectionDiscussionCompletedDescription')}</p>
      <Button className="mt-4" onClick={onRefine} type="button">
        {t('reflectionDiscussionRefine')}
      </Button>
    </div>
  );
}

export function DiscussionFeedback({
  error,
  timelineUnavailable,
  canRetry,
  onRetry,
  moderation,
  directorAction,
}: GuidedDiscussion['feedback']) {
  const { t } = useI18n();
  return (
    <>
      {error || timelineUnavailable ? (
        <Alert variant="destructive">
          <AlertTitle>{t('reflectionDiscussionErrorTitle')}</AlertTitle>
          <AlertDescription>{t('reflectionDiscussionErrorDescription')}</AlertDescription>
          {canRetry ? (
            <Button className="mt-3" onClick={onRetry} type="button" variant="outline">
              {t('reflectionReload')}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {moderation ? (
        <Alert variant="warning">
          <AlertTitle>
            {moderation.intent === 'DISCUSSION_STRUCTURE'
              ? t('reflectionDiscussionStructureTitle')
              : moderation.decision === 'REDIRECT'
                ? t('reflectionModerationRedirectTitle')
                : t('reflectionModerationRejectTitle')}
          </AlertTitle>
          <AlertDescription className="grid gap-2 text-current">
            <p>
              {moderation.intent === 'DISCUSSION_STRUCTURE'
                ? (moderation.suggestedQuestion ?? t('reflectionDiscussionStructureDescription'))
                : moderation.decision === 'REDIRECT'
                  ? t('reflectionModerationRedirectDescription')
                  : t('reflectionModerationRejectDescription')}
            </p>
            {moderation.decision === 'REDIRECT' &&
            moderation.intent !== 'DISCUSSION_STRUCTURE' &&
            moderation.suggestedQuestion ? (
              <p className="rounded border border-warning-border bg-white px-3 py-2">
                {moderation.suggestedQuestion}
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {directorAction ? (
        <Alert className="border-stone-300 bg-stone-50">
          <AlertTitle>
            {t('reflectionDirectorFallback')} ·{' '}
            {directorLabelKeys[directorAction as keyof typeof directorLabelKeys]
              ? t(directorLabelKeys[directorAction as keyof typeof directorLabelKeys])
              : directorAction}
          </AlertTitle>
          <AlertDescription>{t('reflectionDiscussionResumeDescription')}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

export function DiscussionCurrentTopic({ current }: GuidedDiscussion['topic']) {
  const { t } = useI18n();
  return (
    <section className="web-guided-discussion-current grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6">
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
  );
}

export function PerspectiveSelector({
  required,
  candidates,
  disabled,
  onSelect,
  onSkip,
}: GuidedDiscussion['perspectives']) {
  const { t } = useI18n();
  if (!required) return null;
  return (
    <section
      aria-label={t('reflectionPerspectiveCandidatesLabel')}
      className="grid gap-3 rounded border border-warning-border bg-warning-surface p-4 sm:p-5"
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
            disabled={disabled}
            key={candidate.personaId}
            onClick={() => onSelect(candidate.personaId)}
            type="button"
            variant="outline"
          >
            <span className="grid gap-1">
              <span className="font-semibold">{candidate.displayName}</span>
              {candidate.description ? (
                <span className="text-xs font-normal text-stone-600">{candidate.description}</span>
              ) : null}
            </span>
          </Button>
        ))}
      </div>
      <Button
        className="w-full sm:w-fit"
        disabled={disabled}
        onClick={onSkip}
        type="button"
        variant="ghost"
      >
        {t('reflectionPerspectiveSkip')}
      </Button>
    </section>
  );
}

export function DiscussionHistory({
  messages,
  personas,
  replyPending,
}: GuidedDiscussion['history']) {
  const { t } = useI18n();
  const historyRef = useRef<HTMLElement>(null);
  const lastMessageId = messages.at(-1)?.messageId;
  const personaById = new Map(personas.map((persona) => [persona.personaId, persona]));
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [lastMessageId]);
  return (
    <section
      aria-label={t('reflectionSavedDiscussionHistory')}
      aria-live="polite"
      className="grid max-h-[30rem] gap-3 overflow-y-auto rounded border border-stone-300 bg-stone-100 p-3 sm:p-4"
      ref={historyRef}
      data-ui="guided-discussion-history"
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
      {replyPending ? <DiscussionReplySkeleton /> : null}
      {!messages.length ? (
        <p className="p-4 text-center text-sm text-stone-500">
          {t('reflectionDiscussionHistoryEmpty')}
        </p>
      ) : null}
    </section>
  );
}

export function DiscussionComposer({
  bookId,
  runId,
  current,
  lastMessageId,
  draft,
  draftRef,
  disabled,
  canSubmit,
  pendingNavigation,
  onDraftChange,
  onRespond,
  onNext,
}: GuidedDiscussion['composer']) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex justify-end rounded border border-stone-200 bg-stone-50 p-3">
        <Button disabled={!canSubmit} onClick={onNext} type="button" variant="outline">
          {pendingNavigation === 'NEXT' ? t('reflectionNextSaving') : t('reflectionNextAction')}
        </Button>
      </div>

      <section
        className="sticky bottom-2 grid max-h-[70dvh] gap-3 overflow-y-auto rounded border border-stone-300 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-3 sm:p-4"
        data-ui="guided-discussion-composer"
        {...testAttr('guided-discussion-composer')}
      >
        <div className="grid gap-2">
          <Textarea
            aria-label={t('reflectionDiscussionAnswerLabel')}
            aria-describedby="guided-discussion-composer-help"
            className="min-h-20 resize-y sm:min-h-24"
            disabled={disabled}
            maxLength={12000}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={t('reflectionDiscussionPlaceholder')}
            ref={draftRef}
            value={draft}
            {...testAttr('guided-discussion-draft')}
          />
          <DeveloperDraftControl
            bookId={bookId}
            draftKey={`${runId}:${current?.itemId}:${lastMessageId ?? 'initial'}`}
            context={[current?.sourceExcerpt, draft].filter(Boolean).join('\n\n')}
            disabled={disabled}
            onGenerated={onDraftChange}
            subject={current?.question}
            target="DISCUSSION_TURN"
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
            disabled={!canSubmit}
            onClick={onRespond}
            type="button"
          >
            {pendingNavigation === 'RESPOND'
              ? t('reflectionRespondSaving')
              : t('reflectionRespondAction')}
          </Button>
        </div>
      </section>
    </>
  );
}

export function DiscussionFinishDialog({
  open,
  onOpenChange,
  onConfirm,
  canSubmit,
  pending,
}: GuidedDiscussion['finish']) {
  const { t } = useI18n();
  return (
    <>
      <section
        className="flex flex-col gap-3 rounded border border-stone-300 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        {...testAttr('guided-discussion-finish')}
      >
        <p className="text-sm text-stone-600">{t('reflectionFinishConfirmationDescription')}</p>
        <Button
          className="w-full sm:w-auto"
          disabled={!canSubmit}
          onClick={(event) => {
            event.currentTarget.focus();
            onOpenChange(true);
          }}
          type="button"
          variant="outline"
        >
          {pending ? t('reflectionFinishSaving') : t('reflectionFinishAction')}
        </Button>
      </section>

      <ConfirmActionDialog
        cancelLabel={t('reflectionFinishCancel')}
        confirmLabel={t('reflectionFinishConfirm')}
        description={t('reflectionFinishConfirmationDescription')}
        loadingLabel={t('reflectionFinishSaving')}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open={open}
        title={t('reflectionFinishConfirmationTitle')}
      />
    </>
  );
}
