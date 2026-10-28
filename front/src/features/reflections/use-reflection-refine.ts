import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import {
  useDiscussionRunQuery,
  useReflectionRefinementQuery,
  useSaveReflectionRefinementMutation,
} from './reflection-loop-queries';
import type { ReflectionRefineFields, ReflectionRefinePanelProps } from './types/editor-workflow';

export function useReflectionRefine({ bookId, runId }: ReflectionRefinePanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const run = useDiscussionRunQuery(runId);
  const refinement = useReflectionRefinementQuery(runId);
  const save = useSaveReflectionRefinementMutation(runId);
  const inFlight = useRef(false);
  const data = refinement.data;
  const form = useForm<ReflectionRefineFields>({
    values: { content: data?.currentContent ?? '', mode: 'EDITED', outcome: 'DEEPENED' },
    resetOptions: { keepDirtyValues: true },
  });
  const fields = useWatch({ control: form.control });
  const content = fields.content ?? '';
  const mode = fields.mode ?? 'EDITED';
  const { dirtyFields } = form.formState;
  const isDirty =
    Boolean(dirtyFields.content) && content.trim() !== (data?.currentContent ?? '').trim();
  const [beforeSuggestion, setBeforeSuggestion] = useState<Pick<
    ReflectionRefineFields,
    'content' | 'mode'
  > | null>(null);
  const ready = Boolean(
    data &&
    data.runId === runId &&
    run.data?.runId === runId &&
    run.data.status === 'COMPLETED' &&
    !run.error &&
    !refinement.error,
  );
  const disabled = !ready || save.isPending;
  const paths = {
    reflect: `/book/${bookId}/reflection`,
    interview: `/book/${bookId}/reflection/interview`,
    guide: run.data ? `/book/${bookId}/reflection/guide/${run.data.guideId}` : undefined,
    discuss: `/book/${bookId}/reflection/discuss/${runId}`,
    refine: `/book/${bookId}/reflection/refine/${runId}`,
  };

  function commit(keep = false) {
    const fields = form.getValues();
    if (disabled || inFlight.current || (!keep && (!fields.content.trim() || !isDirty))) return;
    inFlight.current = true;
    save.mutate(
      keep
        ? { mode: 'KEPT', outcome: 'KEPT' }
        : {
            mode: fields.mode,
            outcome: fields.outcome,
            finalContent: fields.content.trim(),
          },
      {
        onSuccess: () => {
          if (isCurrentSession()) navigate(paths.reflect);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  }

  const unavailable = (!data && !refinement.isFetching) || (run.isSuccess && !run.data);
  return {
    pending: save.isPending,
    progress: { active: 'refine' as const, bookId, paths },
    feedback: {
      error: run.error ?? refinement.error ?? save.error ?? unavailable,
      onRetry:
        run.isError || refinement.isError || unavailable
          ? () => {
              if (run.isError || !run.data) void run.refetch();
              if (refinement.isError || unavailable) void refinement.refetch();
            }
          : undefined,
    },
    comparison: {
      data,
      disabled,
      canUndo: beforeSuggestion !== null,
      onApply() {
        if (disabled || !data?.suggestedContent || data.suggestionStatus !== 'READY') return;
        if (content !== data.suggestedContent) setBeforeSuggestion({ content, mode });
        form.setValue('content', data.suggestedContent, { shouldDirty: true });
        form.setValue('mode', 'ACCEPTED_SUGGESTION', { shouldDirty: true });
      },
      onUndo() {
        if (disabled || !beforeSuggestion) return;
        form.setValue('content', beforeSuggestion.content, { shouldDirty: true });
        form.setValue('mode', beforeSuggestion.mode, { shouldDirty: true });
        setBeforeSuggestion(null);
      },
    },
    editor: {
      form,
      disabled,
      isDirty,
      canSave: !disabled && isDirty && Boolean(content.trim()),
      onSave: () => commit(),
      onKeep: () => commit(true),
      onChange() {
        if (save.isError) save.reset();
        if (form.getValues('mode') !== 'EDITED')
          form.setValue('mode', 'EDITED', { shouldDirty: true });
      },
      status: t(
        save.isPending
          ? 'reflectionRefineSaving'
          : mode === 'ACCEPTED_SUGGESTION' && isDirty
            ? 'reflectionRefineSuggestionApplied'
            : isDirty
              ? 'reflectionRefineDraftUnsaved'
              : 'reflectionRefineDraftUnchanged',
      ),
      keepPending: save.isPending && save.variables?.mode === 'KEPT',
      savePending: save.isPending && save.variables?.mode !== 'KEPT',
    },
  };
}

export type ReflectionRefine = ReturnType<typeof useReflectionRefine>;
