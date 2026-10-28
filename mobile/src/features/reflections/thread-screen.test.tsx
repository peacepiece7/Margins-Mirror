import { fireEvent, render } from '@testing-library/react-native';

import { formatThreadActivity, ReflectionThreadScreen } from './thread-screen';
import { useReflectionThreads } from './queries';

jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => ({ locale: 'ko' }),
}));
jest.mock('./queries', () => ({ useReflectionThreads: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

// BDD: MOBILE-017
// BDD: RLOOP-058
it('renders one server aggregate as stage-specific reading-thread actions', async () => {
  const onOpenThread = jest.fn();
  jest.mocked(useReflectionThreads).mockReturnValue({
    data: {
      threads: [
        {
          bookAuthor: '작가 1', bookId: 1, bookTitle: '기록할 책',
          lastActivityAt: '2026-08-31T09:00:00', revisionCount: 0,
        },
        {
          bookId: 4, bookTitle: '기록한 책', lastActivityAt: '2026-08-31T08:00:00',
          reflectionId: 22, reflectionPreview: '남겨 둔 첫 생각', revisionCount: 1, sessionId: 12,
        },
        {
          answeredCount: 3, bookId: 2, bookTitle: '인터뷰 책',
          currentQuestion: '이 장면을 다르게 볼 수 있을까요?', interviewId: 30,
          lastActivityAt: '2026-08-31T10:00:00', reflectionId: 20,
          revisionCount: 1, sessionId: 10, targetAnswers: 5,
        },
        {
          bookId: 3, bookTitle: '토론한 책', guideId: 40,
          lastActivityAt: '2026-08-31T11:00:00', reflectionId: 21,
          revisionCount: 1, runId: 50, runStatus: 'COMPLETED', sessionId: 11,
        },
        {
          bookId: 5, bookTitle: '완료한 책', guideId: 41,
          lastActivityAt: '2026-08-31T12:00:00', reflectionId: 23,
          refinementOutcome: 'KEPT', revisionCount: 1, runId: 51,
          runStatus: 'COMPLETED', sessionId: 13,
        },
      ],
    },
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useReflectionThreads>);

  const view = await render(
    <ReflectionThreadScreen onOpenLibrary={jest.fn()} onOpenThread={onOpenThread} />,
  );

  expect(useReflectionThreads).toHaveBeenCalledTimes(1);
  expect(view.getByText('읽는 중인 스레드')).toBeTruthy();
  expect(view.getByText('기록 남기기')).toBeTruthy();
  expect(view.getAllByText('토론하기')).toHaveLength(2);
  expect(view.getByText('인터뷰 · 답변 3/5')).toBeTruthy();
  expect(view.getByText('이 장면을 다르게 볼 수 있을까요?')).toBeTruthy();
  expect(view.getByText('성찰 다듬기')).toBeTruthy();

  await fireEvent.press(view.getByRole('button', { name: '완료한 책, 토론하기' }));
  expect(onOpenThread).toHaveBeenCalledWith(
    expect.objectContaining({ bookId: 5 }),
    { bookId: 5, kind: 'reflection', sessionId: 13 },
  );

  await fireEvent.press(view.getByRole('button', { name: '인터뷰 책, 인터뷰 이어가기' }));
  expect(onOpenThread).toHaveBeenCalledWith(
    expect.objectContaining({ bookId: 2 }),
    { bookId: 2, interviewId: 30, kind: 'interview', sessionId: 10 },
  );
});

it('offers the shelf when there are no reading threads', async () => {
  const onOpenLibrary = jest.fn();
  jest.mocked(useReflectionThreads).mockReturnValue({
    data: { threads: [] },
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useReflectionThreads>);

  const view = await render(
    <ReflectionThreadScreen onOpenLibrary={onOpenLibrary} onOpenThread={jest.fn()} />,
  );
  await fireEvent.press(view.getByRole('button', { name: '책장 열기' }));
  expect(onOpenLibrary).toHaveBeenCalledTimes(1);
});

it('formats recent activity without future negative values', () => {
  const now = new Date('2026-08-31T12:00:00').getTime();
  expect(formatThreadActivity('2026-08-31T10:00:00', 'ko', now)).toBe('2시간 전');
  expect(formatThreadActivity('2026-09-01T10:00:00', 'en', now)).toBe('now');
  expect(formatThreadActivity('invalid', 'ko', now)).toBe('');
});
