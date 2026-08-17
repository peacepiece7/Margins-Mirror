import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingSpinner } from './loading-spinner';

describe('LoadingSpinner', () => {
  it('renders a decorative spinner hidden from assistive tech', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('span[aria-hidden="true"]');

    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass('animate-spin', 'rounded-full');
  });

  it('merges optional className onto base styles', () => {
    const { container } = render(<LoadingSpinner className="text-stone-500" />);
    const spinner = container.querySelector('span[aria-hidden="true"]');

    expect(spinner).toHaveClass('text-stone-500', 'animate-spin');
  });
});
