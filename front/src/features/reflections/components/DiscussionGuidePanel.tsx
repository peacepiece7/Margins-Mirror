import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { DiscussionGuideProjection } from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';

import type { DiscussionGuidePanelProps } from '../discussion-guide-component-types';
import {
  createGuideEditDraft,
  guideEditMinutes,
  guideEditValidationMessage,
  toEditDiscussionGuideInput,
  type GuideEditDraft,
} from '../discussion-guide-edit';
import { downloadDiscussionGuideMarkdown } from '../discussion-guide-export';
import { discussionGuideOriginLabels } from '../discussion-guide-labels';
import {
  useCreateDiscussionRunMutation,
  useDiscussionGuideMarkdownExportMutation,
  useDiscussionGuideProjectionQuery,
  useDiscussionGuideQuery,
  useDiscussionGuideVersionsQuery,
  useEditDiscussionGuideMutation,
  useRegenerateDiscussionGuideMutation,
} from '../reflection-loop-queries';
import { reflectionErrorMessage } from '../reflection-loop-ui';
import { DiscussionGuideEditor } from './DiscussionGuideEditor';
import { DiscussionGuidePreview } from './DiscussionGuidePreview';
import { DiscussionGuideVersionNavigator } from './DiscussionGuideVersionNavigator';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';

export function DiscussionGuidePanel({ bookId, guideId }: DiscussionGuidePanelProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const guide = useDiscussionGuideQuery(guideId);
  const interviewId = guide.data?.interviewId;
  const versions = useDiscussionGuideVersionsQuery(interviewId);
  const createRun = useCreateDiscussionRunMutation(guideId);
  const editGuide = useEditDiscussionGuideMutation(guideId, interviewId);
  const regenerate = useRegenerateDiscussionGuideMutation(guideId, interviewId);
  const [projectionType, setProjectionType] = useState<DiscussionGuideProjection>('FACILITATOR');
  const projection = useDiscussionGuideProjectionQuery(guideId, projectionType);
  const exportGuide = useDiscussionGuideMarkdownExportMutation(guideId);
  const [draft, setDraft] = useState<GuideEditDraft | null>(null);

  useEffect(() => {
    setDraft(null);
    setProjectionType('FACILITATOR');
  }, [guideId]);

  const paths = {
    reflect: `/book/${bookId}/reflection`,
    interview: `/book/${bookId}/reflection/interview`,
    guide: `/book/${bookId}/reflection/guide/${guideId}`,
  };
  const data = guide.data;
  const pending =
    guide.isFetching ||
    versions.isFetching ||
    createRun.isPending ||
    editGuide.isPending ||
    regenerate.isPending ||
    projection.isFetching ||
    exportGuide.isPending;
  const operationError =
    guide.error ??
    versions.error ??
    projection.error ??
    createRun.error ??
    editGuide.error ??
    regenerate.error ??
    exportGuide.error;
  const validationMessage =
    draft && data ? guideEditValidationMessage(draft, data.targetMinutes) : null;
  const saveDisabled = !draft || Boolean(validationMessage);

  function navigateToGuide(nextGuideId: number) {
    setDraft(null);
    navigate(`/book/${bookId}/reflection/guide/${nextGuideId}`);
  }

  function saveEdit() {
    if (!data || !draft || saveDisabled) return;
    editGuide.mutate(toEditDiscussionGuideInput(draft, data.guideVersion), {
      onSuccess: (nextGuide) => navigateToGuide(nextGuide.guideId),
    });
  }

  function regenerateGuide() {
    if (!data) return;
    regenerate.mutate(
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
      {
        onSuccess: (nextGuide) => navigateToGuide(nextGuide.guideId),
      },
    );
  }

  function startOrResumeRun() {
    if (!data) return;
    if (data.runId) {
      navigate(`/book/${bookId}/reflection/discuss/${data.runId}`);
      return;
    }
    createRun.mutate(undefined, {
      onSuccess: (run) => navigate(`/book/${bookId}/reflection/discuss/${run.runId}`),
    });
  }

  return (
    <section
      aria-busy={pending}
      className="grid min-w-0 gap-5"
      {...testAttr('discussion-guide-page')}
    >
      <ReflectionLoopProgress active="guide" bookId={bookId} paths={paths} />
      <header className="grid gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">
              DISCUSSION GUIDE
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              나의 생각에서 출발한 발제안
            </h2>
          </div>
          {data ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant={data.current ? 'default' : 'outline'}>
                v{data.guideVersion} · {data.current ? '현재' : '보관'}
              </Badge>
              <Badge variant="outline">
                {discussionGuideOriginLabels[data.origin] ?? data.origin}
              </Badge>
            </div>
          ) : null}
        </div>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          version마다 발제안과 질문이 그대로 보존됩니다. 비공개 인터뷰 답변 원문은 발제안에 표시되지
          않습니다.
        </p>
      </header>

      {operationError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('reflectionGuideOperationErrorTitle')}</AlertTitle>
          <AlertDescription>
            {reflectionErrorMessage(operationError, t('reflectionGuideOperationErrorDescription'))}
          </AlertDescription>
          {guide.isError || versions.isError || projection.isError ? (
            <Button
              className="mt-3 min-h-11"
              onClick={() => {
                if (guide.isError) void guide.refetch();
                if (versions.isError) void versions.refetch();
                if (projection.isError) void projection.refetch();
              }}
              type="button"
              variant="outline"
            >
              {t('reflectionReload')}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {data && !data.current ? (
        <Alert>
          <AlertTitle>{t('reflectionGuideArchivedTitle')}</AlertTitle>
          <AlertDescription>{t('reflectionGuideArchivedDescription')}</AlertDescription>
          {data.currentGuideId ? (
            <Button
              className="mt-3 min-h-11"
              onClick={() => navigateToGuide(data.currentGuideId!)}
              type="button"
              variant="outline"
            >
              {t('reflectionGuideCurrentVersion')}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <DiscussionGuideVersionNavigator
        disabled={pending}
        guideId={guideId}
        onSelect={navigateToGuide}
        versions={versions.data?.versions ?? []}
      />

      <DiscussionGuidePreview
        draftActive={Boolean(draft)}
        exportPending={exportGuide.isPending}
        onExport={() =>
          exportGuide.mutate(projectionType, {
            onSuccess: downloadDiscussionGuideMarkdown,
          })
        }
        onProjectionTypeChange={setProjectionType}
        projection={projection.data}
        projectionError={projection.isError}
        projectionType={projectionType}
      />

      {draft && data ? (
        <DiscussionGuideEditor disabled={pending} draft={draft} guide={data} onChange={setDraft} />
      ) : null}

      {data?.current ? (
        <section className="flex flex-col gap-3 rounded border border-stone-300 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold">발제안을 다듬어도 이전 version은 그대로 남아요</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              {projectionType === 'PARTICIPANT'
                ? '진행자용으로 전환하면 직접 편집하거나 새 version을 만들 수 있습니다.'
                : '직접 편집하거나 같은 설정으로 다시 생성하면 새 version이 만들어집니다.'}
              {draft
                ? ` 편집 시간 합계 ${guideEditMinutes(draft)}분 / 목표 ${data.targetMinutes}분`
                : ''}
            </p>
            {draft && validationMessage ? (
              <p
                aria-live="polite"
                className="mt-2 text-sm font-medium leading-6 text-amber-800"
                id="discussion-guide-edit-validation"
              >
                {validationMessage}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 min-[390px]:grid-cols-2 sm:flex">
            {draft ? (
              <>
                <Button
                  className="min-h-11 whitespace-normal"
                  disabled={pending}
                  onClick={() => setDraft(null)}
                  type="button"
                  variant="outline"
                >
                  편집 취소
                </Button>
                <Button
                  aria-describedby={
                    validationMessage ? 'discussion-guide-edit-validation' : undefined
                  }
                  className="min-h-11 whitespace-normal"
                  disabled={pending || saveDisabled}
                  onClick={saveEdit}
                  type="button"
                  {...testAttr('discussion-guide-save-version')}
                >
                  {editGuide.isPending ? '새 version 저장 중…' : '새 version으로 저장'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="min-h-11 whitespace-normal"
                  disabled={pending || projectionType === 'PARTICIPANT'}
                  onClick={() => {
                    setProjectionType('FACILITATOR');
                    setDraft(createGuideEditDraft(data));
                  }}
                  type="button"
                  variant="outline"
                  {...testAttr('discussion-guide-edit')}
                >
                  직접 편집
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="min-h-11 whitespace-normal"
                      disabled={pending || projectionType === 'PARTICIPANT'}
                      type="button"
                      {...testAttr('discussion-guide-regenerate')}
                    >
                      {t('reflectionGuideRegenerate')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('reflectionGuideRegenerateTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('reflectionGuideRegenerateDescription').replace(
                          '{version}',
                          String(data.guideVersion),
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="min-h-11">{t('cancel')}</AlertDialogCancel>
                      <AlertDialogAction className="min-h-11" onClick={regenerateGuide}>
                        {t('reflectionGuideRegenerateConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-2 z-10 flex justify-end rounded border border-stone-300 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-3">
        <Button
          className="min-h-11 w-full whitespace-normal sm:w-auto"
          disabled={
            !data || createRun.isPending || Boolean(draft) || (!data.current && !data.runId)
          }
          onClick={startOrResumeRun}
          type="button"
          {...testAttr('discussion-start-run')}
        >
          {createRun.isPending
            ? '토론 준비 중…'
            : data?.runId
              ? '이 version의 토론 이어가기'
              : data && !data.current
                ? '보관 version은 새 토론을 시작할 수 없어요'
                : '이 발제안으로 토론 시작'}
        </Button>
      </div>
    </section>
  );
}
