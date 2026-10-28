import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n';
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
  const { t } = useI18n();
  const previewContent = draftActive ? null : projection ? (
    <DiscussionGuideProjectionPreview projection={projection} />
  ) : (
    <section
      aria-live="polite"
      className="rounded border border-stone-300 bg-stone-50 p-5 text-sm text-stone-600"
      role="status"
    >
      {projectionError ? t('reflectionGuidePreviewError') : t('reflectionGuidePreviewLoading')}
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
            <h3 className="font-semibold">{t('reflectionGuidePreviewTitle')}</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              {projectionType === 'FACILITATOR'
                ? t('reflectionGuidePreviewFacilitatorDescription')
                : t('reflectionGuidePreviewParticipantDescription')}
            </p>
          </div>
          <TabsList
            aria-label={t('reflectionGuidePreviewAudience')}
            className="grid h-auto min-h-11 w-full grid-cols-2 sm:w-fit"
          >
            <TabsTrigger
              className="min-h-11 px-3"
              disabled={draftActive}
              value="FACILITATOR"
              {...testAttr('discussion-guide-facilitator-tab')}
            >
              {t('reflectionGuideFacilitator')}
            </TabsTrigger>
            <TabsTrigger
              className="min-h-11 px-3"
              disabled={draftActive}
              value="PARTICIPANT"
              {...testAttr('discussion-guide-participant-tab')}
            >
              {t('reflectionGuideParticipant')}
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
          {exportPending ? t('reflectionGuideExportPending') : t('reflectionGuideExport')}
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
