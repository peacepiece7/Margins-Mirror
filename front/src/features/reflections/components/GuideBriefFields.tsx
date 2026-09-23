import type {
  GuideAudienceMode,
  GuideBriefInput,
  GuideDisclosureMode,
  GuideFacilitationLevel,
  GuidePurpose,
  GuideTargetMinutes,
} from '@/types/api/reflection-loop';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/utils/cn';

type GuideChoice<T> = {
  value: T;
  label: TranslationKey;
  description: TranslationKey;
};

const purposes: Array<GuideChoice<GuidePurpose>> = [
  {
    value: 'THOUGHT_EXPANSION',
    label: 'reflectionBriefThoughtExpansion',
    description: 'reflectionBriefThoughtExpansionDescription',
  },
  {
    value: 'ISSUE_EXPLORATION',
    label: 'reflectionBriefIssueExploration',
    description: 'reflectionBriefIssueExplorationDescription',
  },
  {
    value: 'DISCUSSION_PREP',
    label: 'reflectionBriefDiscussionPrep',
    description: 'reflectionBriefDiscussionPrepDescription',
  },
];

const audiences: Array<GuideChoice<GuideAudienceMode>> = [
  {
    value: 'SMALL_GROUP',
    label: 'reflectionBriefSmallGroup',
    description: 'reflectionBriefSmallGroupDescription',
  },
  {
    value: 'SELF_AI',
    label: 'reflectionBriefSelfAi',
    description: 'reflectionBriefSelfAiDescription',
  },
];

const disclosures: Array<GuideChoice<GuideDisclosureMode>> = [
  {
    value: 'PRIVATE_CONTEXT',
    label: 'reflectionBriefPrivateContext',
    description: 'reflectionBriefPrivateContextDescription',
  },
  {
    value: 'REFLECTION_ONLY',
    label: 'reflectionBriefReflectionOnly',
    description: 'reflectionBriefReflectionOnlyDescription',
  },
];

const facilitationLevels: Array<GuideChoice<GuideFacilitationLevel>> = [
  {
    value: 'BEGINNER',
    label: 'reflectionBriefBeginner',
    description: 'reflectionBriefBeginnerDescription',
  },
  {
    value: 'EXPERIENCED',
    label: 'reflectionBriefExperienced',
    description: 'reflectionBriefExperiencedDescription',
  },
  {
    value: 'EXPERT',
    label: 'reflectionBriefExpert',
    description: 'reflectionBriefExpertDescription',
  },
];

function choiceClass(selected: boolean) {
  return cn(
    'grid min-h-14 cursor-pointer gap-1 rounded-lg border px-3 py-2.5 transition-colors',
    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stone-950 has-[:focus-visible]:ring-offset-2',
    'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
    selected
      ? 'border-stone-950 bg-stone-950 text-white'
      : 'border-stone-300 bg-white hover:bg-stone-50',
  );
}

export function GuideBriefFields({
  value,
  onChange,
  disabled = false,
}: {
  value: GuideBriefInput;
  onChange: (next: GuideBriefInput) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="grid gap-4">
      <fieldset disabled={disabled}>
        <legend className="text-sm font-semibold">{t('reflectionBriefDifficulty')}</legend>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          {t('reflectionBriefDifficultyDescription')}
        </p>
        <RadioGroup
          className="mt-2 grid gap-2 md:grid-cols-3"
          disabled={disabled}
          onValueChange={(facilitationLevel) =>
            onChange({
              ...value,
              facilitationLevel: facilitationLevel as GuideFacilitationLevel,
            })
          }
          value={value.facilitationLevel}
        >
          {facilitationLevels.map((option) => (
            <Label
              className={choiceClass(value.facilitationLevel === option.value)}
              htmlFor={`guide-facilitation-${option.value}`}
              key={option.value}
            >
              <span className="flex items-center gap-2 font-medium">
                <RadioGroupItem
                  className="border-current text-current"
                  id={`guide-facilitation-${option.value}`}
                  value={option.value}
                />
                {t(option.label)}
              </span>
              <span
                className={cn(
                  'pl-6 text-xs leading-5',
                  value.facilitationLevel === option.value ? 'text-stone-200' : 'text-stone-500',
                )}
              >
                {t(option.description)}
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <details
        aria-disabled={disabled}
        className={cn('rounded-lg border border-stone-300 bg-white', disabled && 'opacity-70')}
      >
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-inset">
          <span>{t('reflectionBriefAdvanced')}</span>
          <span className="text-xs font-normal text-stone-500">
            {t('reflectionBriefAdvancedSummary')}
          </span>
        </summary>
        <div className="grid gap-5 border-t border-stone-200 p-3 sm:p-4">
          <fieldset disabled={disabled}>
            <legend className="text-sm font-semibold">{t('reflectionBriefPurpose')}</legend>
            <RadioGroup
              className="mt-2 grid gap-2 md:grid-cols-3"
              disabled={disabled}
              onValueChange={(purpose) => onChange({ ...value, purpose: purpose as GuidePurpose })}
              value={value.purpose}
            >
              {purposes.map((option) => (
                <Label
                  className={choiceClass(value.purpose === option.value)}
                  htmlFor={`guide-purpose-${option.value}`}
                  key={option.value}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <RadioGroupItem
                      className="border-current text-current"
                      id={`guide-purpose-${option.value}`}
                      value={option.value}
                    />
                    {t(option.label)}
                  </span>
                  <span
                    className={cn(
                      'pl-6 text-xs leading-5',
                      value.purpose === option.value ? 'text-stone-200' : 'text-stone-500',
                    )}
                  >
                    {t(option.description)}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <fieldset disabled={disabled}>
              <legend className="text-sm font-semibold">{t('reflectionBriefAudience')}</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {t('reflectionBriefAudienceDescription')}
              </p>
              <RadioGroup
                className="mt-2 grid gap-2"
                disabled={disabled}
                onValueChange={(audienceMode) =>
                  onChange({ ...value, audienceMode: audienceMode as GuideAudienceMode })
                }
                value={value.audienceMode}
              >
                {audiences.map((option) => (
                  <Label
                    className={choiceClass(value.audienceMode === option.value)}
                    htmlFor={`guide-audience-${option.value}`}
                    key={option.value}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <RadioGroupItem
                        className="border-current text-current"
                        id={`guide-audience-${option.value}`}
                        value={option.value}
                      />
                      {t(option.label)}
                    </span>
                    <span
                      className={cn(
                        'pl-6 text-xs leading-5',
                        value.audienceMode === option.value ? 'text-stone-200' : 'text-stone-500',
                      )}
                    >
                      {t(option.description)}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>

            <fieldset disabled={disabled}>
              <legend className="text-sm font-semibold">{t('reflectionBriefTargetMinutes')}</legend>
              <RadioGroup
                className="mt-2 grid grid-cols-3 gap-2"
                disabled={disabled}
                onValueChange={(targetMinutes) =>
                  onChange({
                    ...value,
                    targetMinutes: Number(targetMinutes) as GuideTargetMinutes,
                  })
                }
                value={String(value.targetMinutes)}
              >
                {([20, 40, 60] as GuideTargetMinutes[]).map((minutes) => (
                  <Label
                    className={cn(
                      choiceClass(value.targetMinutes === minutes),
                      'min-h-14 place-content-center text-center',
                    )}
                    htmlFor={`guide-minutes-${minutes}`}
                    key={minutes}
                  >
                    <RadioGroupItem
                      className="sr-only"
                      id={`guide-minutes-${minutes}`}
                      value={String(minutes)}
                    />
                    <span className="font-semibold">
                      {t('reflectionBriefMinutes').replace('{minutes}', String(minutes))}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          </div>

          <fieldset disabled={disabled}>
            <legend className="text-sm font-semibold">{t('reflectionBriefAiContext')}</legend>
            <RadioGroup
              className="mt-2 grid gap-2 md:grid-cols-2"
              disabled={disabled}
              onValueChange={(disclosureMode) =>
                onChange({
                  ...value,
                  disclosureMode: disclosureMode as GuideDisclosureMode,
                })
              }
              value={value.disclosureMode}
            >
              {disclosures.map((option) => (
                <Label
                  className={choiceClass(value.disclosureMode === option.value)}
                  htmlFor={`guide-disclosure-${option.value}`}
                  key={option.value}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <RadioGroupItem
                      className="border-current text-current"
                      id={`guide-disclosure-${option.value}`}
                      value={option.value}
                    />
                    {t(option.label)}
                  </span>
                  <span
                    className={cn(
                      'pl-6 text-xs leading-5',
                      value.disclosureMode === option.value ? 'text-stone-200' : 'text-stone-500',
                    )}
                  >
                    {t(option.description)}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
        </div>
      </details>
    </div>
  );
}
