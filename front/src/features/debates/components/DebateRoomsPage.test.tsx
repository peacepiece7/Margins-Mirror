import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { DebateRoomsPage } from './DebateRoomsPage';

const room = {
  windowId: 7,
  sessionId: 3,
  windowType: 'debate',
  title: 'debate: A very long room title that must remain inside its button',
  position: 0,
  status: 'active',
  personaIds: [],
};

describe('DebateRoomsPage', () => {
  it('truncates long room titles without changing the accessible button or click handler', async () => {
    const onSelectWindow = vi.fn();

    render(
      <I18nProvider>
        <MemoryRouter>
          <DebateRoomsPage onSelectWindow={onSelectWindow} windows={[room]} />
        </MemoryRouter>
      </I18nProvider>,
    );

    const button = screen.getByRole('button', { name: /A very long room title/ });
    expect(button).toHaveClass('min-w-0', 'max-w-full');
    expect(button.querySelector('span')).toHaveClass('truncate');
    await button.click();
    expect(onSelectWindow).toHaveBeenCalledWith(room);
  });
});
