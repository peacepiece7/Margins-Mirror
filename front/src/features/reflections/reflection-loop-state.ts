import type { DiscussionQuestion } from '@/types/api/reflection-loop';
import type { SessionInsight } from '@/types/api/session';

const requiredStages = new Set([
  'WARM_UP',
  'INTERPRETATION',
  'EXPERIENCE',
  'SOCIAL_VALUE',
  'CLOSING',
]);

export function interviewProgressState(answeredCount: number, generatedCount: number) {
  return {
    canGenerateGuide: answeredCount >= 3,
    targetReached: answeredCount >= 5,
    maxReached: generatedCount >= 7,
  };
}

export function hasFiveRequiredGuideStages(items: DiscussionQuestion[]) {
  const required = items.filter((item) => item.priority === 'REQUIRED');
  return (
    required.length === 5 &&
    required.every((item) => requiredStages.has(item.stage)) &&
    new Set(required.map((item) => item.stage)).size === 5
  );
}

export function findPrimaryReflection(insights: SessionInsight[] | undefined) {
  return (insights ?? [])
    .filter((insight) => insight.insightType === 'reflection')
    .reduce<SessionInsight | undefined>((latest, insight) => {
      if (!latest) return insight;
      const updatedOrder = (insight.updatedAt ?? '').localeCompare(latest.updatedAt ?? '');
      if (updatedOrder !== 0) return updatedOrder > 0 ? insight : latest;
      return insight.insightId > latest.insightId ? insight : latest;
    }, undefined);
}
