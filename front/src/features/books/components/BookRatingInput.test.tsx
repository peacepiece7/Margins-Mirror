import { cleanup, fireEvent, render as testingRender, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { BookRatingInput } from './BookRatingInput';

function render(ui: ReactElement) {
  return testingRender(<I18nProvider>{ui}</I18nProvider>);
}

describe('BookRatingInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders half-step ratings with a half-filled star', () => {
    const { container } = render(<BookRatingInput onChange={vi.fn()} rating={4.5} />);

    const filledStars = container.querySelectorAll('[data-fill]');

    expect(filledStars).toHaveLength(5);
    expect(filledStars[0]).toHaveAttribute('data-fill', 'full');
    expect(filledStars[3]).toHaveAttribute('data-fill', 'full');
    expect(filledStars[4]).toHaveAttribute('data-fill', 'half');
    expect(filledStars[4]).toHaveClass('w-1/2');
    expect(filledStars[4].querySelector('svg')).toHaveClass('h-7', 'w-7', 'max-w-none');
  });

  it.each([0.5, 1.5, 2.5, 3.5, 4.5])(
    'keeps the final star half clipped for a %s rating',
    (rating) => {
      const { container } = render(<BookRatingInput onChange={vi.fn()} rating={rating} />);
      const filledStars = container.querySelectorAll('[data-fill]');

      expect(filledStars).toHaveLength(Math.ceil(rating));
      expect(filledStars[filledStars.length - 1]).toHaveAttribute('data-fill', 'half');
      expect(filledStars[filledStars.length - 1]).toHaveClass('w-1/2', 'overflow-hidden');
    },
  );

  it('emits 0.5 step values from each star half', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<BookRatingInput onChange={onChange} />);
    const ratingGroup = getByRole('group');

    fireEvent.click(within(ratingGroup).getByLabelText('0.5 stars'));
    fireEvent.click(within(ratingGroup).getByLabelText('4.5 stars'));

    expect(onChange).toHaveBeenNthCalledWith(1, 0.5);
    expect(onChange).toHaveBeenNthCalledWith(2, 4.5);
  });

  it('keeps the star hit targets transparent so they do not cover the rating color', () => {
    const { getByRole } = render(<BookRatingInput onChange={vi.fn()} rating={3} />);
    const ratingGroup = getByRole('group');

    expect(within(ratingGroup).getByLabelText('0.5 stars')).toHaveClass(
      'bg-transparent',
      'hover:bg-transparent',
      'h-auto',
    );
  });

  it('renders rating clear as an accessible X icon button', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<BookRatingInput onChange={onChange} rating={3} />);
    const clearButton = getByLabelText('Clear rating');

    expect(clearButton.querySelector('svg')).toBeInTheDocument();
    expect(clearButton).not.toHaveTextContent('X');

    fireEvent.click(clearButton);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
