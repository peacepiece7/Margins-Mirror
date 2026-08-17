import { Badge } from '@/components/ui/badge';
import { translationCatalog } from '@/lib/i18n';
import type {
  DiscussionGuideProjectionResponse,
  FacilitatorDiscussionQuestion,
} from '@/types/api/reflection-loop';
import { testAttr } from '@/utils/testAttrs';
import { SourceFreshnessBadges } from './SourceFreshnessBadges';

const stageLabels = {
  WARM_UP: 'reflectionStageWarmUp',
  INTERPRETATION: 'reflectionStageInterpretation',
  EXPERIENCE: 'reflectionStageExperience',
  SOCIAL_VALUE: 'reflectionStageSocialValue',
  CLOSING: 'reflectionStageClosing',
} as const;

const sensitivityLabelKeys = {
  LOW: 'reflectionSensitivityLow',
  MEDIUM: 'reflectionSensitivityMedium',
  HIGH: 'reflectionSensitivityHigh',
} as const;

const sourceLabelKeys = {
  REFLECTION: 'reflectionSourceReflection',
  HIGHLIGHT: 'reflectionSourceHighlight',
  BOOK_KNOWLEDGE: 'reflectionSourceBookKnowledge',
  ANSWER: 'reflectionSourceAnswer',
} as const;

type Translate = (key: keyof typeof translationCatalog.en) => string;

function currentTranslations(): Translate {
  const locale =
    typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ko';
  return (key) => translationCatalog[locale][key];
}

function localizedStageLabel(stage: string, t: Translate) {
  const key = stageLabels[stage as keyof typeof stageLabels];
  return key ? t(key) : stage;
}

function localizedSourceLabel(
  item: Pick<FacilitatorDiscussionQuestion, 'sourceType'>,
  t: Translate,
) {
  const key = sourceLabelKeys[item.sourceType as keyof typeof sourceLabelKeys];
  return key ? t(key) : t('reflectionSourceLinked');
}

function localizedTargetMinutes(targetMinutes: number, t: Translate) {
  return t('reflectionGuideTargetMinutes').replace('{minutes}', String(targetMinutes));
}

function PriorityBadge({ priority, t }: { priority: 'REQUIRED' | 'OPTIONAL'; t: Translate }) {
  const label =
    priority === 'REQUIRED'
      ? t('reflectionGuidePriorityRequired')
      : t('reflectionGuidePriorityOptional');

  return <Badge variant={priority === 'REQUIRED' ? 'default' : 'outline'}>{label}</Badge>;
}

function FacilitatorQuestion({ item, t }: { item: FacilitatorDiscussionQuestion; t: Translate }) {
  const sensitivityKey = sensitivityLabelKeys[item.sensitivity];
  const sourceLabel = localizedSourceLabel(item, t);

  return (
    <li
      className="grid min-w-0 gap-4 rounded border border-stone-300 bg-white p-4 md:grid-cols-[8rem_minmax(0,1fr)] md:p-5"
      {...testAttr('discussion-guide-projection-item')}
    >
      <div>
        <span className="text-xs font-semibold tracking-[0.12em] text-stone-500">
          {String(item.order).padStart(2, '0')} / {localizedStageLabel(item.stage, t)}
        </span>
        <div className="mt-2 flex flex-wrap gap-1">
          <PriorityBadge priority={item.priority} t={t} />
          <Badge variant="outline">
            {item.expectedMinutes}
            {t('reflectionMinutes')}
          </Badge>
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="break-words text-lg font-semibold leading-7">{item.question}</h3>
        <p className="mt-2 break-words text-sm leading-6 text-stone-600">{item.intent}</p>
        <div className="mt-3 grid gap-2 rounded bg-stone-50 p-3 text-sm leading-6 text-stone-600">
          <div className="flex flex-wrap gap-2">
            <span className="font-semibold text-stone-800">
              {t('reflectionSource')} · {sourceLabel}
            </span>
            <span>{sensitivityKey ? t(sensitivityKey) : item.sensitivity}</span>
            <span>
              {item.skippable ? t('reflectionGuideSkippable') : t('reflectionGuideRecommended')}
            </span>
            <SourceFreshnessBadges
              fallback={item.sourceFallback}
              stale={item.sourceStale}
              version={item.sourceVersion}
            />
          </div>
          {item.privateSource ? (
            <p>{t('reflectionGuidePrivateSourceNotice')}</p>
          ) : (
            <p className="break-words whitespace-pre-wrap">
              {item.sourceExcerpt ?? t('reflectionGuideSourceUnavailable')}
            </p>
          )}
        </div>
        {item.followUps.length ? (
          <div className="mt-3">
            <p className="text-xs font-semibold tracking-[0.1em] text-stone-500">
              {t('reflectionGuideFollowUps')}
            </p>
            <ul className="mt-1 grid gap-1 text-sm leading-6 text-stone-600">
              {item.followUps.map((followUp, index) => (
                <li className="break-words" key={`${item.order}-follow-up-${index + 1}`}>
                  {followUp}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function DiscussionGuideProjectionPreview({
  projection,
}: {
  projection: DiscussionGuideProjectionResponse;
}) {
  const t = currentTranslations();
  const facilitator = projection.projection === 'FACILITATOR';

  return (
    <section
      className="grid min-w-0 gap-4"
      {...testAttr(
        facilitator
          ? 'discussion-guide-facilitator-preview'
          : 'discussion-guide-participant-preview',
      )}
    >
      <div
        className={
          facilitator
            ? 'grid gap-4 rounded border border-stone-300 bg-white p-4 sm:p-6'
            : 'grid gap-4 rounded border border-stone-300 bg-stone-50 p-4 sm:p-6'
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-stone-900">
              《{projection.bookTitle}》
              {projection.bookAuthor ? (
                <span className="font-normal text-stone-500"> · {projection.bookAuthor}</span>
              ) : null}
            </p>
            <h3 className="mt-3 text-lg font-semibold">
              {facilitator
                ? t('reflectionGuideFacilitatorTitle')
                : t('reflectionGuideParticipantTitle')}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant={projection.current ? 'default' : 'outline'}>
              v{projection.guideVersion} ·{' '}
              {projection.current ? t('reflectionGuideCurrent') : t('reflectionGuideArchived')}
            </Badge>
            {facilitator ? (
              <Badge variant="outline">{localizedTargetMinutes(projection.targetMinutes, t)}</Badge>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-stone-500">
            {t('reflectionGuideGoal')}
          </p>
          <p className="mt-2 break-words text-base leading-7">{projection.goal}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-stone-500">
            {t('reflectionGuideIssues')}
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {projection.issues.map((issue, index) => (
              <li
                className="break-words rounded bg-white px-3 py-2 text-sm"
                key={`${projection.guideId}-issue-${index + 1}`}
              >
                {issue}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {facilitator ? (
        <ol className="grid min-w-0 gap-3">
          {projection.items.map((item) => (
            <FacilitatorQuestion item={item} key={item.order} t={t} />
          ))}
        </ol>
      ) : (
        <ol className="grid min-w-0 gap-3">
          {projection.items.map((item) => (
            <li
              className="grid min-w-0 gap-3 rounded border border-stone-300 bg-white p-4 md:grid-cols-[8rem_minmax(0,1fr)] md:p-5"
              key={item.order}
              {...testAttr('discussion-guide-projection-item')}
            >
              <div>
                <span className="text-xs font-semibold tracking-[0.12em] text-stone-500">
                  {String(item.order).padStart(2, '0')} / {localizedStageLabel(item.stage, t)}
                </span>
                <div className="mt-2">
                  <PriorityBadge priority={item.priority} t={t} />
                </div>
              </div>
              <p className="min-w-0 break-words text-base font-medium leading-7">{item.question}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
