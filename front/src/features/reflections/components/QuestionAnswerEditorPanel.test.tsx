import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { QuestionAnswerEditorPanel } from './QuestionAnswerEditorPanel';

const saveMutate = vi.fn();

vi.mock('../queries', () => ({
  useReflectionTimelineForBook: () => ({
    sessionId: 3,
    timeline: {
      data: {
        insights: [],
        questions: [{ questionId: 5, questionText: '왜 이런 선택을 했나요?' }],
      },
      isFetching: false,
    },
  }),
  useSaveAnswerMutation: () => ({ isPending: false, mutate: saveMutate }),
}));

vi.mock('./DeveloperDraftControl', () => ({
  DeveloperDraftControl: ({
    onGenerated,
    target,
  }: {
    onGenerated: (value: string) => void;
    target: string;
  }) => (
    <button onClick={() => onGenerated(`draft-${target}`)} type="button">
      debug-{target}
    </button>
  ),
}));

describe('QuestionAnswerEditorPanel developer draft', () => {
  beforeEach(() => {
    saveMutate.mockClear();
    window.localStorage.setItem('margins.locale', 'ko');
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('puts a legacy Question draft in the editor without saving it', () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <QuestionAnswerEditorPanel bookId={1} questionId={5} />
        </MemoryRouter>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'debug-QUESTION_ANSWER' }));

    expect(screen.getByTestId('question-answer-textarea')).toHaveValue('draft-QUESTION_ANSWER');
    expect(saveMutate).not.toHaveBeenCalled();
  });
});
