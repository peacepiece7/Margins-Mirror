import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { DiscussionGuidePanelProps } from '../discussion-guide-component-types';
import { discussionGuideOriginLabelKeys } from '../discussion-guide-labels';
import { useDiscussionGuide } from '../use-discussion-guide';
import { DiscussionGuideEditor } from './DiscussionGuideEditor';
import { DiscussionGuidePreview } from './DiscussionGuidePreview';
import { DiscussionGuideVersionNavigator } from './DiscussionGuideVersionNavigator';
import { DiscussionGuideActions } from './DiscussionGuideActions';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import { ReflectionOperationStatus } from './ReflectionOperationStatus';

export function DiscussionGuidePanel(props: DiscussionGuidePanelProps) {
  return <GuidePanel key={`${props.bookId}:${props.guideId}`} {...props} />;
}

function GuidePanel(props: DiscussionGuidePanelProps) {
  const { t } = useI18n();
  const guide = useDiscussionGuide(props);
  const { data } = guide;
  return (
    <section
      aria-busy={guide.pending}
      className="web-reflection-page web-discussion-guide grid min-w-0 gap-5"
      {...testAttr('discussion-guide-page')}
    >
      <ReflectionLoopProgress {...guide.progress} />
      <header className="grid gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">
              DISCUSSION GUIDE
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {t('reflectionGuideTitle')}
            </h2>
          </div>
          {data ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant={data.current ? 'default' : 'outline'}>
                v{data.guideVersion} ·{' '}
                {data.current ? t('reflectionGuideCurrent') : t('reflectionGuideArchived')}
              </Badge>
              <Badge variant="outline">
                {discussionGuideOriginLabelKeys[data.origin]
                  ? t(discussionGuideOriginLabelKeys[data.origin])
                  : data.origin}
              </Badge>
            </div>
          ) : null}
        </div>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionGuideDescription')}
        </p>
      </header>
      {guide.feedback.error && (
        <ReflectionOperationStatus
          title={t('reflectionGuideOperationErrorTitle')}
          message={t('reflectionGuideOperationErrorDescription')}
          retryLabel={t('reflectionReload')}
          onRetry={guide.feedback.onRetry}
        />
      )}
      {data && !data.current ? (
        <Alert>
          <AlertTitle>{t('reflectionGuideArchivedTitle')}</AlertTitle>
          <AlertDescription>{t('reflectionGuideArchivedDescription')}</AlertDescription>
          {data.currentGuideId ? (
            <Button
              className="mt-3 min-h-11"
              onClick={guide.onCurrentGuide}
              type="button"
              variant="outline"
            >
              {t('reflectionGuideCurrentVersion')}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <DiscussionGuideVersionNavigator {...guide.versions} />
      <DiscussionGuidePreview {...guide.preview} />
      {guide.editor && <DiscussionGuideEditor {...guide.editor} />}
      <DiscussionGuideActions {...guide.actions} />
    </section>
  );
}
