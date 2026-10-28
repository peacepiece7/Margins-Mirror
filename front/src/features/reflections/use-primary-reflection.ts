import { useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ApiRequestError } from '@/lib/api-client';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import {
  useSessionReflectionQuery,
  useSavePrimaryReflectionMutation,
  useStartReflectionInterviewMutation,
} from './reflection-loop-queries';
import type { PrimaryReflectionFields, PrimaryReflectionPanelProps } from './types/editor-workflow';

export function usePrimaryReflection({
  bookId,
  session: { sessionId, sessions },
}: PrimaryReflectionPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const reflection = useSessionReflectionQuery(sessionId);
  const data = reflection.data;
  const save = useSavePrimaryReflectionMutation(bookId, sessionId, data?.reflectionId);
  const start = useStartReflectionInterviewMutation();
  const inFlight = useRef(false);
  const baseline: PrimaryReflectionFields = {
    content: data?.currentRevision.content ?? '',
    visibility: data?.visibility ?? 'PRIVATE',
  };
  const form = useForm<PrimaryReflectionFields>({
    values: baseline,
    resetOptions: { keepDirtyValues: true },
  });
  const fields = useWatch({ control: form.control });
  const { dirtyFields } = form.formState;
  const content = fields.content ?? '';
  const isDirty =
    Boolean(dirtyFields.content || dirtyFields.visibility) &&
    (content.trim() !== baseline.content.trim() || fields.visibility !== baseline.visibility);
  const missingReflection =
    reflection.error instanceof ApiRequestError && reflection.error.status === 404;
  const loadError = sessions.error ?? (missingReflection ? null : reflection.error);
  const ready =
    !loadError &&
    !sessions.isLoading &&
    (!sessionId || Boolean(data && data.sessionId === sessionId) || missingReflection);
  const pending = save.isPending || start.isPending;
  const disabled = !ready || pending;
  const runCompleted = data?.runStatus === 'COMPLETED';
  const resumeLabel = data?.runId
    ? t(runCompleted ? 'reflectionRefineResume' : 'reflectionDiscussionResume')
    : data?.guideId
      ? t('reflectionGuideViewCurrent')
      : data?.activeInterviewId
        ? t('reflectionInterviewResume')
        : t('reflectionInterviewStart');

  function submit(input: PrimaryReflectionFields) {
    const content = input.content.trim();
    if (disabled || inFlight.current || !content || (data && !isDirty)) return;
    inFlight.current = true;
    save.mutate(
      { content, title: 'Reflection', visibility: input.visibility },
      {
        onSuccess(result) {
          if (isCurrentSession())
            form.reset(
              { content: result.currentRevision.content, visibility: result.visibility },
              { keepDirtyValues: false },
            );
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  }

  function resume() {
    if (disabled || inFlight.current || isDirty || !data) return;
    const path = `/book/${bookId}/reflection`;
    if (data.runId) return navigate(`${path}/${runCompleted ? 'refine' : 'discuss'}/${data.runId}`);
    if (data.guideId) return navigate(`${path}/guide/${data.guideId}`);
    if (data.activeInterviewId) return navigate(`${path}/interview`);
    inFlight.current = true;
    start.mutate(data.reflectionId, {
      onSuccess: () => {
        if (isCurrentSession()) navigate(`${path}/interview`);
      },
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  const unavailable = Boolean(sessionId && !data && !missingReflection && !reflection.isFetching);
  return {
    progress: { active: 'reflect' as const, bookId },
    feedback: {
      runId: data?.runId,
      runCompleted,
      missingReflection,
      error: loadError ?? save.error ?? start.error ?? unavailable,
      onRetry:
        loadError || unavailable
          ? () => {
              if (sessions.isError) void sessions.refetch();
              if (reflection.isError || unavailable) void reflection.refetch();
            }
          : undefined,
    },
    editor: {
      bookId,
      form,
      content,
      disabled,
      busy: sessions.isLoading || reflection.isFetching || pending,
      isDirty,
      draftKey: data?.currentRevision.revisionId ?? 'initial',
      onSubmit: submit,
      onResume: resume,
      onChange: () => {
        if (save.isError) save.reset();
      },
      onGenerated: (content: string) => form.setValue('content', content, { shouldDirty: true }),
      canSave: !disabled && Boolean(content.trim()) && (!data || isDirty),
      canResume: !disabled && Boolean(data) && !isDirty,
      status: t(
        save.isPending
          ? 'reflectionEditorSaving'
          : isDirty
            ? 'reflectionEditorUnsaved'
            : data
              ? 'reflectionEditorSaved'
              : 'reflectionEditorStart',
      ),
      saveLabel: t(
        save.isPending
          ? 'reflectionSavePending'
          : data
            ? 'reflectionSaveRevision'
            : 'reflectionSaveInitial',
      ),
      resumeLabel: start.isPending ? t('reflectionInterviewPreparing') : resumeLabel,
    },
    history: { revisions: data?.revisions ?? [] },
  };
}

export type PrimaryReflection = ReturnType<typeof usePrimaryReflection>;
