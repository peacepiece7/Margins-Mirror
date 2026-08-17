import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './legacy-skeleton';

describe('Skeleton', () => {
  it('renders a pulse placeholder hidden from assistive tech', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('span[aria-hidden="true"]');

    expect(skeleton).not.toBeNull();
    expect(skeleton).toHaveClass('animate-pulse', 'bg-stone-200');
  });

  it('merges optional className onto base styles', () => {
    const { container } = render(<Skeleton className="h-8 w-full" />);
    const skeleton = container.querySelector('span[aria-hidden="true"]');

    expect(skeleton).toHaveClass('h-8', 'w-full', 'animate-pulse');
  });
});
