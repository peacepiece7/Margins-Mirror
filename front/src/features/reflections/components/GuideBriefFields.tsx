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
import { cn } from '@/utils/cn';

const purposes: Array<{
  value: GuidePurpose;
  label: string;
  description: string;
}> = [
  {
    value: 'THOUGHT_EXPANSION',
    label: '생각 확장',
    description: '처음 생각의 근거와 다른 가능성을 넓혀요.',
  },
  {
    value: 'ISSUE_EXPLORATION',
    label: '쟁점 탐색',
    description: '핵심 논점과 충돌하는 관점을 선명하게 봐요.',
  },
  {
    value: 'DISCUSSION_PREP',
    label: '토론 준비',
    description: '함께 이야기하기 좋은 흐름과 질문을 만들어요.',
  },
];

const audiences: Array<{
  value: GuideAudienceMode;
  label: string;
  description: string;
}> = [
  {
    value: 'SMALL_GROUP',
    label: '소그룹',
    description: 'AI가 진행을 돕고, 여러 사람이 차례로 답하기 좋은 흐름으로 준비해요.',
  },
  {
    value: 'SELF_AI',
    label: '나와 AI',
    description: 'AI와 혼자 천천히 답하며 사고를 정리해요.',
  },
];

const disclosures: Array<{
  value: GuideDisclosureMode;
  label: string;
  description: string;
}> = [
  {
    value: 'PRIVATE_CONTEXT',
    label: '비공개 답변도 AI가 참고',
    description: '답변 원문은 발제안에 표시하지 않고 생성 문맥으로만 사용해요.',
  },
  {
    value: 'REFLECTION_ONLY',
    label: '비공개 답변 제외',
    description:
      '인터뷰 답변을 AI에게 보내지 않고 Reflection, 저장한 하이라이트와 책 배경 정보만 사용해요.',
  },
];

const facilitationLevels: Array<{
  value: GuideFacilitationLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'BEGINNER',
    label: '초심자',
    description: '질문 수를 줄이고 답하기 쉬운 흐름으로 시작해요.',
  },
  {
    value: 'EXPERIENCED',
    label: '경험자',
    description: '근거와 다른 관점을 균형 있게 오가요.',
  },
  {
    value: 'EXPERT',
    label: '전문가',
    description: '논점 사이의 긴장과 후속 질문을 깊게 다뤄요.',
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
  return (
    <div className="grid gap-4">
      <fieldset disabled={disabled}>
        <legend className="text-sm font-semibold">진행 난이도</legend>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          발제안의 질문 깊이와 진행 속도를 정해요. 책의 내용 난이도와는 달라요.
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
                {option.label}
              </span>
              <span
                className={cn(
                  'pl-6 text-xs leading-5',
                  value.facilitationLevel === option.value ? 'text-stone-200' : 'text-stone-500',
                )}
              >
                {option.description}
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
          <span>고급 설정</span>
          <span className="text-xs font-normal text-stone-500">목적·참여 형태·시간·AI 문맥</span>
        </summary>
        <div className="grid gap-5 border-t border-stone-200 p-3 sm:p-4">
          <fieldset disabled={disabled}>
            <legend className="text-sm font-semibold">발제 목적</legend>
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
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      'pl-6 text-xs leading-5',
                      value.purpose === option.value ? 'text-stone-200' : 'text-stone-500',
                    )}
                  >
                    {option.description}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <fieldset disabled={disabled}>
              <legend className="text-sm font-semibold">참여 형태</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                어떤 형태든 AI가 질문 진행을 도와요.
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
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        'pl-6 text-xs leading-5',
                        value.audienceMode === option.value ? 'text-stone-200' : 'text-stone-500',
                      )}
                    >
                      {option.description}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>

            <fieldset disabled={disabled}>
              <legend className="text-sm font-semibold">목표 시간</legend>
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
                    <span className="font-semibold">{minutes}분</span>
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
          </div>

          <fieldset disabled={disabled}>
            <legend className="text-sm font-semibold">AI 문맥 범위</legend>
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
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      'pl-6 text-xs leading-5',
                      value.disclosureMode === option.value ? 'text-stone-200' : 'text-stone-500',
                    )}
                  >
                    {option.description}
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
