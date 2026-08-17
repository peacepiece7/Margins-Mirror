import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner, SpinnerInline } from './spinner';

describe('Spinner', () => {
  it('is decorative without a label and announced with one', () => {
    const { rerender } = render(<Spinner />);
    expect(document.querySelector('[data-slot="spinner"]')).toHaveAttribute('aria-hidden', 'true');

    rerender(<Spinner label="Loading books" />);
    expect(screen.getByRole('status', { name: 'Loading books' })).toBeVisible();
  });

  it('composes an inline live status', () => {
    render(<SpinnerInline>Loading more</SpinnerInline>);
    expect(screen.getByText('Loading more').parentElement).toHaveAttribute('aria-live', 'polite');
  });
});
