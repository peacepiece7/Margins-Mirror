import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOptimisticMessage } from '@/hooks/use-optimistic-message';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import type { DiscussionNavigation } from '@/types/api/reflection-loop';

import type { GuidedDiscussionPanelProps } from './panel-types';
import { useReflectionTimelineForBook } from './queries';
import { useDiscussionRunQuery, useGuidedDiscussionTurnMutation } from './reflection-loop-queries';

export function useGuidedDiscussion({ bookId, runId, personas }: GuidedDiscussionPanelProps) {
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const run = useDiscussionRunQuery(runId);
  const { timeline } = useReflectionTimelineForBook(bookId);
  const turn = useGuidedDiscussionTurnMutation(runId, run.data?.sessionId);
  const [draft, setDraft] = useState('');
  const [finishOpen, setFinishOpen] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const current = run.data?.currentItem;
  const persistedMessages = (timeline.data?.messages ?? []).filter(
    (message) => message.windowId === run.data?.windowId,
  );
  const optimistic = useOptimisticMessage(persistedMessages);
  const messages = optimistic.message
    ? [...persistedMessages, { ...optimistic.message, role: 'user', personaId: undefined }]
    : persistedMessages;
  const candidates = run.data?.perspectiveCandidates ?? [];
  const selectionRequired = Boolean(run.data?.perspectiveSelectionRequired);
  const isCompleted = run.data?.status === 'COMPLETED';
  const pending =
    run.isFetching ||
    run.isError ||
    turn.isPending ||
    !run.data ||
    !current ||
    !timeline.data ||
    timeline.isError ||
    !['READY', 'ACTIVE'].includes(run.data.status);
  const canSubmit = !pending && !selectionRequired && Boolean(draft.trim());
  const pendingNavigation = turn.isPending ? turn.variables?.navigation : undefined;
  const lastMessageId = messages.at(-1)?.messageId;
  const moderation = turn.data?.moderation;
  const refine = () => navigate(`/book/${bookId}/reflection/refine/${runId}`);

  async function send(navigation: DiscussionNavigation, personaId?: number) {
    const perspectiveControl =
      navigation === 'SELECT_PERSPECTIVE' || navigation === 'SKIP_PERSPECTIVE';
    const content = perspectiveControl ? '' : draft.trim();
    if (pending || inFlight.current) return;
    if (perspectiveControl ? !selectionRequired : selectionRequired || !content) return;
    if (
      navigation === 'SELECT_PERSPECTIVE' &&
      !candidates.some((candidate) => candidate.personaId === personaId)
    )
      return;

    inFlight.current = true;
    if (content) optimistic.begin(content);
    try {
      await turn.mutateAsync(
        { content, navigation, personaId },
        {
          onSuccess(result) {
            if (!isCurrentSession()) return;
            const blocked = result.moderation && result.moderation.decision !== 'ALLOW';
            if (blocked) optimistic.clear();
            else if (content) setDraft('');
            setFinishOpen(false);
            if (result.runStatus === 'COMPLETED') refine();
            else requestAnimationFrame(() => draftRef.current?.focus());
          },
          onError() {
            if (isCurrentSession()) optimistic.clear();
          },
        },
      );
    } finally {
      inFlight.current = false;
    }
  }

  function submit(navigation: DiscussionNavigation, personaId?: number) {
    void send(navigation, personaId).catch(() => {
      // The mutation owns the error shown by DiscussionFeedback; preserve the draft for retry.
    });
  }

  return {
    isCompleted,
    pending,
    progress: {
      active: 'discuss' as const,
      bookId,
      paths: {
        reflect: `/book/${bookId}/reflection`,
        interview: `/book/${bookId}/reflection/interview`,
        guide: run.data ? `/book/${bookId}/reflection/guide/${run.data.guideId}` : undefined,
        discuss: `/book/${bookId}/reflection/discuss/${runId}`,
      },
    },
    completed: { onRefine: refine },
    feedback: {
      error: run.error ?? timeline.error ?? turn.error,
      timelineUnavailable: timeline.isSuccess && !timeline.data,
      canRetry: run.isError || timeline.isError || (timeline.isSuccess && !timeline.data),
      onRetry() {
        if (run.isError) void run.refetch();
        if (timeline.isError || !timeline.data) void timeline.refetch();
      },
      moderation: moderation && moderation.decision !== 'ALLOW' ? moderation : null,
      directorAction: run.data?.lastDirectorAction,
    },
    topic: { current },
    perspectives: {
      required: selectionRequired,
      candidates,
      disabled: pending,
      onSelect: (personaId: number) => submit('SELECT_PERSPECTIVE', personaId),
      onSkip: () => submit('SKIP_PERSPECTIVE'),
    },
    history: { messages, personas, replyPending: turn.isPending },
    composer: {
      bookId,
      runId,
      current,
      lastMessageId,
      draft,
      draftRef,
      disabled: pending || selectionRequired,
      canSubmit,
      pendingNavigation,
      onDraftChange(content: string) {
        if (turn.isError) turn.reset();
        setDraft(content);
      },
      onRespond: () => submit('RESPOND'),
      onNext: () => submit('NEXT'),
    },
    finish: {
      open: finishOpen,
      onOpenChange: setFinishOpen,
      onConfirm: () => send('FINISH'),
      canSubmit,
      pending: pendingNavigation === 'FINISH',
    },
  };
}

export type GuidedDiscussion = ReturnType<typeof useGuidedDiscussion>;
