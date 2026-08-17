import { describe, expect, it } from 'vitest';

import type { DiscussionQuestion } from '@/types/api/reflection-loop';
import type { SessionInsight } from '@/types/api/session';

import {
  findPrimaryReflection,
  hasFiveRequiredGuideStages,
  interviewProgressState,
} from './reflection-loop-state';

describe('Reflection Loop state contract', () => {
  it('uses the approved 3 / 5 / 7 Interview thresholds', () => {
    expect(interviewProgressState(2, 2)).toEqual({
      canGenerateGuide: false,
      targetReached: false,
      maxReached: false,
    });
    expect(interviewProgressState(3, 3).canGenerateGuide).toBe(true);
    expect(interviewProgressState(5, 5).targetReached).toBe(true);
    expect(interviewProgressState(3, 7).maxReached).toBe(true);
  });

  it('requires exactly one required item for each of the five guide stages', () => {
    const item = (stage: string, itemId: number): DiscussionQuestion => ({
      itemId,
      questionId: itemId,
      stage,
      priority: 'REQUIRED',
      order: itemId,
      question: stage,
      intent: stage,
      sourceType: 'REFLECTION',
      sourceExcerpt: 'source',
      sensitivity: 'LOW',
      skippable: true,
      expectedMinutes: 5,
      followUps: [],
    });
    const valid = [
      item('WARM_UP', 1),
      item('INTERPRETATION', 2),
      item('EXPERIENCE', 3),
      item('SOCIAL_VALUE', 4),
      item('CLOSING', 5),
    ];

    expect(hasFiveRequiredGuideStages(valid)).toBe(true);
    expect(hasFiveRequiredGuideStages(valid.slice(0, 4))).toBe(false);
    expect(hasFiveRequiredGuideStages([...valid, item('CLOSING', 6)])).toBe(false);
  });

  it('selects the latest legacy Reflection as the primary projection', () => {
    const reflection = (
      insightId: number,
      updatedAt: string,
      insightType = 'reflection',
    ): SessionInsight => ({
      insightId,
      sessionId: 10,
      insightType,
      content: `reflection ${insightId}`,
      insightOrder: insightId,
      updatedAt,
    });

    expect(
      findPrimaryReflection([
        reflection(11, '2026-07-01T00:00:00'),
        reflection(12, '2026-08-01T00:00:00'),
        reflection(13, '2026-09-01T00:00:00', 'takeaway'),
      ])?.insightId,
    ).toBe(12);
  });
});
