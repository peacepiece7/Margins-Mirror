import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import type { DiscussionGuideProjection } from '@/types/api/reflection-loop';
import type { DiscussionGuidePanelProps } from './discussion-guide-component-types';
import {
  createGuideEditDraft,
  guideEditMinutes,
  guideEditValidationMessage,
  toEditDiscussionGuideInput,
  type GuideEditDraft,
} from './discussion-guide-edit';
import { downloadDiscussionGuideMarkdown } from './discussion-guide-export';
import {
  useCreateDiscussionRunMutation,
  useDiscussionGuideMarkdownExportMutation,
  useDiscussionGuideProjectionQuery,
  useDiscussionGuideQuery,
  useDiscussionGuideVersionsQuery,
  useEditDiscussionGuideMutation,
  useRegenerateDiscussionGuideMutation,
} from './reflection-loop-queries';

export function useDiscussionGuide({ bookId, guideId }: DiscussionGuidePanelProps) {
  const navigate = useNavigate();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const guide = useDiscussionGuideQuery(guideId);
  const data = guide.data;
  const versions = useDiscussionGuideVersionsQuery(data?.interviewId);
  const createRun = useCreateDiscussionRunMutation(guideId);
  const edit = useEditDiscussionGuideMutation(guideId, data?.interviewId);
  const regenerate = useRegenerateDiscussionGuideMutation(guideId, data?.interviewId);
  const exportGuide = useDiscussionGuideMarkdownExportMutation(guideId);
  const [projectionType, setProjectionType] = useState<DiscussionGuideProjection>('FACILITATOR');
  const projection = useDiscussionGuideProjectionQuery(guideId, projectionType);
  const [draft, setDraft] = useState<GuideEditDraft | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const inFlight = useRef(false);
  const reads = [guide, versions, projection];
  const pending =
    reads.some((query) => query.isFetching) ||
    [createRun, edit, regenerate, exportGuide].some((mutation) => mutation.isPending);
  const ready = Boolean(data && data.guideId === guideId && !reads.some((query) => query.isError));
  const validationMessage =
    draft && data ? guideEditValidationMessage(draft, data.targetMinutes) : null;
  const canEdit = ready && data?.current && projectionType === 'FACILITATOR';
  const unavailable = !data && !guide.isFetching;

  function navigateToGuide(nextGuideId: number) {
    if (pending || inFlight.current || !isCurrentSession()) return;
    setDraft(null);
    navigate(`/book/${bookId}/reflection/guide/${nextGuideId}`);
  }

  const changedGuide = {
    onSuccess: (next: { guideId: number }) => {
      if (isCurrentSession()) navigate(`/book/${bookId}/reflection/guide/${next.guideId}`);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  };

  function saveEdit() {
    if (!canEdit || !data || !draft || validationMessage || pending || inFlight.current) return;
    inFlight.current = true;
    edit.mutate(toEditDiscussionGuideInput(draft, data.guideVersion), changedGuide);
  }

  async function regenerateGuide() {
    if (!canEdit || !data || draft || pending || inFlight.current)
      throw new Error('Guide action unavailable');
    inFlight.current = true;
    try {
      await regenerate.mutateAsync(
        {
          expectedVersion: data.guideVersion,
          brief: {
            purpose: data.purpose,
            facilitationLevel: data.facilitationLevel,
            audienceMode: data.audienceMode,
            targetMinutes: data.targetMinutes,
            disclosureMode: data.disclosureMode,
          },
        },
        changedGuide,
      );
    } finally {
      inFlight.current = false;
    }
  }

  function startOrResumeRun() {
    if (!ready || !data || draft || pending || inFlight.current || (!data.current && !data.runId))
      return;
    if (data.runId) return navigate(`/book/${bookId}/reflection/discuss/${data.runId}`);
    inFlight.current = true;
    createRun.mutate(undefined, {
      onSuccess: (run) => {
        if (isCurrentSession()) navigate(`/book/${bookId}/reflection/discuss/${run.runId}`);
      },
      onSettled: changedGuide.onSettled,
    });
  }

  return {
    data,
    pending,
    progress: {
      active: 'guide' as const,
      bookId,
      paths: {
        reflect: `/book/${bookId}/reflection`,
        interview: `/book/${bookId}/reflection/interview`,
        guide: `/book/${bookId}/reflection/guide/${guideId}`,
      },
    },
    feedback: {
      error:
        reads.find((query) => query.error)?.error ??
        createRun.error ??
        edit.error ??
        regenerate.error ??
        exportGuide.error ??
        unavailable,
      onRetry:
        reads.some((query) => query.isError) || unavailable
          ? () => {
              for (const query of reads) if (query.isError) void query.refetch();
              if (unavailable) void guide.refetch();
            }
          : undefined,
    },
    versions: {
      disabled: pending,
      guideId,
      onSelect: navigateToGuide,
      versions: versions.data?.versions ?? [],
    },
    preview: {
      draftActive: Boolean(draft),
      exportPending: exportGuide.isPending,
      projection: projection.data,
      projectionError: projection.isError,
      projectionType,
      onProjectionTypeChange: (type: DiscussionGuideProjection) => {
        if (!draft && !pending) setProjectionType(type);
      },
      onExport: () => {
        if (!ready || !projection.data || draft || pending || inFlight.current) return;
        inFlight.current = true;
        exportGuide.mutate(projectionType, {
          onSuccess: (result) => {
            if (isCurrentSession()) downloadDiscussionGuideMarkdown(result);
          },
          onSettled: changedGuide.onSettled,
        });
      },
    },
    editor:
      draft && data
        ? { disabled: pending || !ready, draft, guide: data, onChange: setDraft }
        : null,
    actions: {
      data,
      draftActive: Boolean(draft),
      pending,
      projectionType,
      validationMessage,
      editedMinutes: draft ? guideEditMinutes(draft) : 0,
      canEdit: Boolean(canEdit) && !pending,
      canSave: Boolean(canEdit && draft && !validationMessage) && !pending,
      onEdit: () => {
        if (canEdit && data && !pending) setDraft(createGuideEditDraft(data));
      },
      onCancel: () => {
        if (!pending) setDraft(null);
      },
      onSave: saveEdit,
      savePending: edit.isPending,
      runPending: createRun.isPending,
      canStart: ready && !pending && !draft && Boolean(data?.current || data?.runId),
      onStart: startOrResumeRun,
      regenerate: {
        open: regenerateOpen,
        onOpenChange: setRegenerateOpen,
        onConfirm: regenerateGuide,
        error: regenerate.error,
      },
    },
    onCurrentGuide: () => {
      if (data?.currentGuideId) navigateToGuide(data.currentGuideId);
    },
  };
}

export type DiscussionGuide = ReturnType<typeof useDiscussionGuide>;
