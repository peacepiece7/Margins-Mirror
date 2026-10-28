import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import type { ReflectionRefinePanelProps } from '../types/editor-workflow';
import { useReflectionRefine } from '../use-reflection-refine';
import { ReflectionOperationStatus } from './ReflectionOperationStatus';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import { ReflectionComparison, ReflectionRefineEditor } from './ReflectionRefineSections';

export function ReflectionRefinePanel(props: ReflectionRefinePanelProps) {
  return <RefinePanel key={`${props.bookId}:${props.runId}`} {...props} />;
}

function RefinePanel(props: ReflectionRefinePanelProps) {
  const { t } = useI18n();
  const refinement = useReflectionRefine(props);
  return (
    <section
      aria-busy={refinement.pending}
      className="web-reflection-page web-reflection-refine grid gap-5"
      {...testAttr('reflection-refine-page')}
    >
      <ReflectionLoopProgress {...refinement.progress} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">REFINE / CONFIRM</p>
        <h2 className="text-2xl font-semibold tracking-tight">{t('reflectionRefineTitle')}</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionRefineDescription')}
        </p>
      </header>
      {refinement.feedback.error && (
        <ReflectionOperationStatus
          message={t('reflectionRefineOperationErrorDescription')}
          title={t('reflectionRefineOperationErrorTitle')}
          retryLabel={t('reflectionReload')}
          onRetry={refinement.feedback.onRetry}
        />
      )}
      <ReflectionComparison {...refinement.comparison} />
      <ReflectionRefineEditor {...refinement.editor} />
    </section>
  );
}
