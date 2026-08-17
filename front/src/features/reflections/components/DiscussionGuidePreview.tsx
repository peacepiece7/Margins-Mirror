import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DiscussionGuideProjection } from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';

import type { DiscussionGuidePreviewProps } from '../discussion-guide-component-types';
import { DiscussionGuideProjectionPreview } from './DiscussionGuideProjectionPreview';

export function DiscussionGuidePreview({
  draftActive,
  exportPending,
  onExport,
  onProjectionTypeChange,
  projection,
  projectionError,
  projectionType,
}: DiscussionGuidePreviewProps) {
  const previewContent = draftActive ? null : projection ? (
    <DiscussionGuideProjectionPreview projection={projection} />
  ) : (
    <section
      aria-live="polite"
      className="rounded border border-stone-300 bg-stone-50 p-5 text-sm text-stone-600"
      role="status"
    >
      {projectionError
        ? '미리보기를 불러오지 못했습니다. 위의 다시 불러오기를 사용해 주세요.'
        : '발제문 미리보기를 준비하고 있습니다.'}
    </section>
  );

  return (
    <Tabs
      className="gap-4"
      onValueChange={(value) => onProjectionTypeChange(value as DiscussionGuideProjection)}
      value={projectionType}
    >
      <section className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid min-w-0 gap-3">
          <div>
            <h3 className="font-semibold">발제문 미리보기</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              {projectionType === 'FACILITATOR'
                ? '질문 의도와 진행 메모를 확인합니다. 비공개 답변 원문은 여기에도 표시하지 않습니다.'
                : '참여자에게 필요한 목표와 질문만 남기고 진행 메모와 개인 근거는 제외합니다.'}
            </p>
          </div>
          <TabsList
            aria-label="발제문 미리보기 대상"
            className="grid h-auto min-h-11 w-full grid-cols-2 sm:w-fit"
          >
            <TabsTrigger
              className="min-h-11 px-3"
              disabled={draftActive}
              value="FACILITATOR"
              {...testAttr('discussion-guide-facilitator-tab')}
            >
              진행자용
            </TabsTrigger>
            <TabsTrigger
              className="min-h-11 px-3"
              disabled={draftActive}
              value="PARTICIPANT"
              {...testAttr('discussion-guide-participant-tab')}
            >
              참여자용
            </TabsTrigger>
          </TabsList>
        </div>
        <Button
          className="min-h-11 w-full sm:w-auto"
          disabled={!projection || exportPending || draftActive}
          onClick={onExport}
          type="button"
          variant="outline"
          {...testAttr('discussion-guide-download-markdown')}
        >
          {exportPending ? 'Markdown 준비 중…' : '이 화면을 Markdown으로 받기'}
        </Button>
      </section>

      <TabsContent
        className="m-0 data-[state=inactive]:hidden"
        forceMount
        tabIndex={!draftActive && projectionType === 'FACILITATOR' ? 0 : -1}
        value="FACILITATOR"
      >
        {projectionType === 'FACILITATOR' ? previewContent : null}
      </TabsContent>
      <TabsContent
        className="m-0 data-[state=inactive]:hidden"
        forceMount
        tabIndex={!draftActive && projectionType === 'PARTICIPANT' ? 0 : -1}
        value="PARTICIPANT"
      >
        {projectionType === 'PARTICIPANT' ? previewContent : null}
      </TabsContent>
    </Tabs>
  );
}
