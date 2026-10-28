import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { QuestionPanel } from './QuestionPanel';

const queryMocks = vi.hoisted(() => ({
  deleteQuestion: vi.fn(),
  generateQuestions: vi.fn(),
}));

vi.mock('../queries', () => ({
  useDeleteQuestionMutation: () => ({
    isPending: false,
    mutate: queryMocks.deleteQuestion,
  }),
  useGenerateQuestionsForBookMutation: () => ({
    isPending: false,
    mutate: queryMocks.generateQuestions,
  }),
  useReflectionTimelineForBook: () => ({
    sessionId: 10,
    timeline: {
      data: {
        insights: [],
        messages: [
          {
            messageId: 31,
            questionId: 21,
            role: 'user',
          },
        ],
        questions: [
          {
            questionId: 21,
            questionText: 'What changed after the final chapter?',
          },
          {
            questionId: 22,
            questionText: 'Which detail remains unresolved?',
          },
        ],
      },
    },
  }),
}));

describe('QuestionPanel', () => {
  it('places each action area below its question without the descriptive OpenAI copy', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <QuestionPanel bookId={7} />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByText('Answer AI-generated prompts based on the book and author.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('OpenAI가 책과 저자를 바탕으로 만든 질문에 답변합니다.'),
    ).not.toBeInTheDocument();

    const rows = screen.getAllByTestId('book-question-row');
    for (const row of rows) {
      const question = within(row).getByTestId('book-question-text');
      const actions = within(row).getByTestId('book-question-actions');
      expect(row).toHaveClass('grid', 'gap-3');
      expect(row).not.toHaveClass('md:grid-cols-[minmax(0,1fr)_auto]');
      expect(question.nextElementSibling).toBe(actions);
      expect(actions).not.toHaveClass('justify-end');
    }

    expect(within(rows[0]).getByTestId('book-question-answered')).toHaveTextContent('Answered');
    expect(within(rows[0]).queryByTestId('book-question-delete')).not.toBeInTheDocument();
    expect(within(rows[1]).getByTestId('book-question-delete')).toBeVisible();
  });
});
