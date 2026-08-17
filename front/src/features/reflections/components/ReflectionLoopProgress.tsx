import { Link } from 'react-router-dom';

import { translationCatalog } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

const steps = [
  { id: 'reflect', label: 'reflectionStepReflect' },
  { id: 'interview', label: 'reflectionStepInterview' },
  { id: 'guide', label: 'reflectionStepGuide' },
  { id: 'discuss', label: 'reflectionStepDiscuss' },
  { id: 'refine', label: 'reflectionStepRefine' },
] as const;

export type ReflectionLoopStep = (typeof steps)[number]['id'];

export function ReflectionLoopProgress({
  active,
  bookId,
  paths = {},
}: {
  active: ReflectionLoopStep;
  bookId: number;
  paths?: Partial<Record<ReflectionLoopStep, string>>;
}) {
  const locale =
    typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ko';
  const t = translationCatalog[locale];
  const activeIndex = steps.findIndex((step) => step.id === active);
  return (
    <nav
      aria-label={t.reflectionProgressLabel}
      className="overflow-hidden rounded border border-stone-300 bg-white p-1 sm:p-2"
      {...testAttr('reflection-loop-progress')}
    >
      <ol className="grid min-w-0 grid-cols-5 gap-1">
        {steps.map((step, index) => {
          const path =
            paths[step.id] ?? (step.id === 'reflect' ? `/book/${bookId}/reflection` : undefined);
          const content = (
            <>
              <span
                className={`text-[0.62rem] font-semibold tracking-[0.12em] sm:text-[0.68rem] sm:tracking-[0.16em] ${
                  index === activeIndex ? 'text-stone-200' : 'text-stone-500'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-xs font-medium sm:text-sm">{t[step.label]}</span>
            </>
          );
          const className = `flex min-h-14 min-w-0 flex-col justify-center rounded px-1 py-2 sm:px-3 ${
            index === activeIndex
              ? 'bg-stone-950 text-white'
              : index < activeIndex
                ? 'bg-stone-100 text-stone-800'
                : 'text-stone-500'
          }`;
          return (
            <li key={step.id}>
              {path && index <= activeIndex ? (
                <Link
                  aria-current={index === activeIndex ? 'step' : undefined}
                  className={className}
                  to={path}
                >
                  {content}
                </Link>
              ) : (
                <div
                  aria-current={index === activeIndex ? 'step' : undefined}
                  className={className}
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
