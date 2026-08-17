import { describe, expect, it } from 'vitest';

import type { DiscussionQuestion } from '@/types/api/reflection-loop';

import {
  createGuideEditDraft,
  guideEditValidationMessage,
  moveGuideEditItems,
  toEditDiscussionGuideInput,
  type GuideEditDraft,
} from './discussion-guide-edit';

describe('discussion guide edit helpers', () => {
  it('creates a detached draft and maps a trimmed immutable version request', () => {
    const guide = {
      audienceMode: 'SELF_AI' as const,
      current: true,
      depth: 'SIMPLE' as const,
      disclosureMode: 'PRIVATE_CONTEXT' as const,
      facilitationLevel: 'BEGINNER' as const,
      goal: ' 목표 ',
      guideId: 7,
      guideVersion: 2,
      interviewId: 5,
      issues: [' 논점 '],
      items: requiredItems(),
      origin: 'GENERATED' as const,
      purpose: 'THOUGHT_EXPANSION' as const,
      reflectionId: 3,
      sessionId: 4,
      status: 'READY',
      targetMinutes: 20 as const,
    };

    const draft = createGuideEditDraft(guide);
    draft.items[0].followUps[0] = ' 편집 후속 질문 ';

    expect(guide.items[0].followUps[0]).toBe('후속 질문');
    expect(toEditDiscussionGuideInput(draft, 2)).toEqual({
      expectedVersion: 2,
      goal: '목표',
      issues: ['논점'],
      items: expect.arrayContaining([
        expect.objectContaining({
          followUps: ['편집 후속 질문'],
          itemId: 1,
          question: '질문 1',
        }),
      ]),
    });
  });

  it('explains invalid content, item minutes and total minutes before save', () => {
    const draft = validDraft();

    expect(guideEditValidationMessage({ ...draft, goal: ' ' }, 20)).toMatch(/비어 있는 목표/);
    expect(
      guideEditValidationMessage(
        {
          ...draft,
          items: draft.items.map((item, index) =>
            index === 0 ? { ...item, expectedMinutes: 21 } : item,
          ),
        },
        20,
      ),
    ).toMatch(/1분에서 20분/);
    expect(guideEditValidationMessage(draft, 40)).toBe('질문 시간 합계를 목표 40분에 맞춰 주세요.');
    expect(guideEditValidationMessage(draft, 20)).toBeNull();
  });

  it('allows optional movement but blocks required stage reordering', () => {
    const items = [...requiredItems(), question(6, 'CLOSING', 'OPTIONAL', 0)];

    expect(moveGuideEditItems(items, 0, 1)).toBeNull();
    expect(moveGuideEditItems(items, 5, -1)?.map((item) => item.itemId)).toEqual([
      1, 2, 3, 4, 6, 5,
    ]);
  });
});

function validDraft(): GuideEditDraft {
  return {
    goal: '목표',
    issues: ['논점'],
    items: requiredItems(),
  };
}

function requiredItems(): DiscussionQuestion[] {
  return ['WARM_UP', 'INTERPRETATION', 'EXPERIENCE', 'SOCIAL_VALUE', 'CLOSING'].map(
    (stage, index) => question(index + 1, stage, 'REQUIRED', 4),
  );
}

function question(
  itemId: number,
  stage: string,
  priority: 'REQUIRED' | 'OPTIONAL',
  expectedMinutes: number,
): DiscussionQuestion {
  return {
    expectedMinutes,
    followUps: itemId === 1 ? ['후속 질문'] : [],
    intent: `의도 ${itemId}`,
    itemId,
    order: itemId,
    priority,
    privateSource: false,
    question: `질문 ${itemId}`,
    questionId: itemId + 100,
    sensitivity: 'LOW',
    skippable: true,
    sourceExcerpt: '현재 Reflection',
    sourceRefId: 3,
    sourceType: 'REFLECTION',
    stage,
  };
}
