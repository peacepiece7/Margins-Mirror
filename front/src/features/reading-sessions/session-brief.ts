import type { Question } from '@/types/api/session';
import type { ReadingSessionProjectionState, SessionBriefSummary } from './projection-types';

export type SessionBriefState = ReadingSessionProjectionState & {
  questions: Question[];
  selectedQuestionId?: number;
};

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function focusValue(state: SessionBriefState) {
  const selectedQuestion = state.questions.find(
    (question) => question.questionId === state.selectedQuestionId,
  );
  if (selectedQuestion) {
    return selectedQuestion.questionText;
  }

  return state.session?.title || 'No active focus';
}

export function buildSessionBrief(state: SessionBriefState): SessionBriefSummary {
  const answeredQuestionCount = state.stats?.answeredQuestionCount || 0;
  const personaReplyCount = state.stats?.personaResponseCount || 0;
  const latestHighlight = state.highlights[state.highlights.length - 1];
  const nextAction = state.nextActions[0];

  return {
    headline: 'Reading session brief',
    items: [
      {
        id: 'focus',
        label: 'Focus',
        value: focusValue(state),
        detail: state.window?.title,
      },

      {
        id: 'evidence',
        label: 'Evidence',
        value: countLabel(state.highlights.length, 'quote'),
        detail: latestHighlight?.locationLabel || latestHighlight?.quoteText,
      },
      {
        id: 'discussion',
        label: 'Discussion',
        value: `${countLabel(answeredQuestionCount, 'answer')} - ${countLabel(personaReplyCount, 'persona reply', 'persona replies')}`,
        detail: nextAction ? nextAction.label : undefined,
      },
    ],
  };
}
