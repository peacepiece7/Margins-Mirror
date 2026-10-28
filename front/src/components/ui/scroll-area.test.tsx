import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScrollArea } from './scroll-area';

describe('ScrollArea', () => {
  it('provides a keyboard focus target even without interactive children', () => {
    const { container } = render(
      <ScrollArea>
        <p>Long reading note</p>
      </ScrollArea>,
    );
    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});
