import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ReflectionLoopProgress } from './ReflectionLoopProgress';

describe('ReflectionLoopProgress', () => {
  it('keeps all five stages in the available mobile width without an inner minimum width', () => {
    render(
      <MemoryRouter>
        <ReflectionLoopProgress
          active="refine"
          bookId={42}
          paths={{
            discuss: '/book/42/reflection/discuss/9',
            guide: '/book/42/reflection/guide/7',
            interview: '/book/42/reflection/interview',
            refine: '/book/42/reflection/refine/9',
          }}
        />
      </MemoryRouter>,
    );

    const progress = screen.getByRole('navigation', { name: 'Reflection 진행 단계' });
    const list = progress.querySelector('ol');

    expect(progress).toHaveClass('overflow-hidden');
    expect(list).toHaveClass('grid-cols-5', 'min-w-0');
    expect(list).not.toHaveClass('min-w-[34rem]');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    const activeStep = screen.getByRole('link', { name: /05.*다듬기/ });
    expect(activeStep).toHaveAttribute('aria-current', 'step');
    expect(activeStep.querySelector('span')).toHaveClass('text-stone-200');
  });
});
