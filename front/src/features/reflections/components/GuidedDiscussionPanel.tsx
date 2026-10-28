import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { GuidedDiscussionPanelProps } from '../panel-types';
import { useGuidedDiscussion } from '../use-guided-discussion';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import {
  DiscussionCompleted,
  DiscussionFeedback,
  DiscussionCurrentTopic,
  PerspectiveSelector,
  DiscussionHistory,
  DiscussionComposer,
  DiscussionFinishDialog,
} from './GuidedDiscussionSections';

export function GuidedDiscussionPanel(props: GuidedDiscussionPanelProps) {
  return <DiscussionPanel key={`${props.bookId}:${props.runId}`} {...props} />;
}

function DiscussionPanel(props: GuidedDiscussionPanelProps) {
  const { t } = useI18n();
  const discussion = useGuidedDiscussion(props);

  if (discussion.isCompleted) {
    return (
      <section className="grid gap-5">
        <ReflectionLoopProgress {...discussion.progress} />
        <DiscussionCompleted {...discussion.completed} />
      </section>
    );
  }

  return (
    <section
      aria-busy={discussion.pending}
      className="web-reflection-page web-guided-discussion grid gap-5"
      {...testAttr('guided-discussion-page')}
    >
      <ReflectionLoopProgress {...discussion.progress} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">
          {t('reflectionDiscussionPipeline')}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{t('reflectionDiscussionTitle')}</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionDiscussionDescription')}
        </p>
      </header>
      <DiscussionFeedback {...discussion.feedback} />
      <DiscussionCurrentTopic {...discussion.topic} />
      <PerspectiveSelector {...discussion.perspectives} />
      <DiscussionHistory {...discussion.history} />
      <DiscussionComposer {...discussion.composer} />
      <DiscussionFinishDialog {...discussion.finish} />
    </section>
  );
}
