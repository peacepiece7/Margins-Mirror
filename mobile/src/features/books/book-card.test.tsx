import { fireEvent, render } from '@testing-library/react-native';

import { useReducedMotion } from '@/shared/accessibility/use-reduced-motion';

import { BookCard } from './book-card';

jest.mock('@/shared/accessibility/use-reduced-motion', () => ({
  useReducedMotion: jest.fn(),
}));

describe('BookCard', () => {
  beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));

  it('announces localized author, reading status, and rating without removing visible author copy', async () => {
    const view = await render(
      <BookCard
        book={{ author: '한강', bookId: 1, rating: 4.5, readingStatus: 'reading', title: '소년이 온다' }}
        locale="ko"
        onPress={jest.fn()}
      />,
    );

    const card = view.getByRole('button', { name: '소년이 온다, 저자 한강' });
    expect(card.props.accessibilityHint).toBe('책 세부 정보 열기');
    expect(card.props.accessibilityValue).toEqual({ text: '읽는 중, 별점: 5점 만점에 4.5점' });
    expect(view.getByText('한강')).toBeTruthy();
  });

  it('removes pressed translation for reduced motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const view = await render(
      <BookCard book={{ author: 'Ursula K. Le Guin', bookId: 2, title: 'The Dispossessed' }} locale="en" onPress={jest.fn()} />,
    );
    const card = view.getByRole('button', { name: 'The Dispossessed, by Ursula K. Le Guin' });

    await fireEvent(card, 'pressIn');

    expect(card).not.toHaveStyle({ transform: [{ translateY: 1 }] });
  });

  it('does not announce or render a zero rating when the API returns null', async () => {
    const view = await render(
      <BookCard
        book={{ author: 'Author', bookId: 3, rating: null, title: 'Unrated' }}
        locale="en"
        onPress={jest.fn()}
      />,
    );
    const card = view.getByRole('button', { name: 'Unrated, by Author' });

    expect(card.props.accessibilityValue?.text).toBeUndefined();
    expect(view.queryByTestId('book-rating-display')).toBeNull();
  });
});
