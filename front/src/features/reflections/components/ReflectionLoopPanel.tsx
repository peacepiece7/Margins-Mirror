import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import { useReflectionSessionForBook } from '../queries';
import { usePrimaryReflection } from '../use-primary-reflection';
import type { PrimaryReflectionPanelProps } from '../types/editor-workflow';
import { ReflectionLoopProgress } from './ReflectionLoopProgress';
import {
  PrimaryReflectionFeedback,
  PrimaryReflectionEditor,
  ReflectionRevisionHistory,
} from './PrimaryReflectionSections';

export function ReflectionLoopPanel({ bookId }: { bookId: number }) {
  const session = useReflectionSessionForBook(bookId);
  return (
    <PrimaryReflectionPanel
      key={`${bookId}:${session.sessionId ?? 'new'}`}
      bookId={bookId}
      session={session}
    />
  );
}

function PrimaryReflectionPanel(props: PrimaryReflectionPanelProps) {
  const { t } = useI18n();
  const reflection = usePrimaryReflection(props);
  return (
    <section
      className="web-reflection-page web-reflection-compose grid gap-5"
      {...testAttr('reflection-loop-page')}
    >
      <ReflectionLoopProgress {...reflection.progress} />
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-stone-500">REFLECT / MVP2</p>
        <h2 className="text-2xl font-semibold tracking-tight">{t('reflectionComposeTitle')}</h2>
        <p className="max-w-3xl text-sm leading-6 text-stone-600">
          {t('reflectionComposeDescription')}
        </p>
      </header>
      <PrimaryReflectionFeedback {...reflection.feedback} />
      <PrimaryReflectionEditor {...reflection.editor} />
      <ReflectionRevisionHistory {...reflection.history} />
    </section>
  );
}
