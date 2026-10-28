import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { DebateEntryPanel } from './DebateEntryPanel';

const fixture = vi.hoisted(() => ({
  personas: [1, 2, 3].map((personaId) => ({
    personaId,
    name: `p${personaId}`,
    displayName: `Speaker ${personaId}`,
    tone: '',
    description: '',
    active: true,
  })),
  create: vi.fn(),
  recommendedIds: [1, 2],
}));
vi.mock('../queries', () => ({
  usePersonasQuery: () => ({ data: { personas: fixture.personas } }),
  usePersonaRecommendationsQuery: () => ({
    data: {
      personas: fixture.recommendedIds.map((id) =>
        fixture.personas.find((persona) => persona.personaId === id),
      ),
    },
  }),
  useDebateTimelineForBook: () => ({ sessionId: 9 }),
  useCreateDebateRoomMutation: () => ({ isPending: false, mutate: fixture.create }),
}));

describe('DebateEntryPanel compact chooser', () => {
  beforeEach(() => {
    fixture.create.mockClear();
    fixture.recommendedIds = [1, 2];
    localStorage.setItem('margins.locale', 'en');
  });
  it('does not reselect recommendations after the reader explicitly clears both speakers', async () => {
    const view = render(
      <I18nProvider>
        <MemoryRouter>
          <DebateEntryPanel bookId={7} />
        </MemoryRouter>
      </I18nProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('debate-entry-selected-personas')).toHaveTextContent('Speaker 1'),
    );
    fireEvent.click(screen.getByText('Change speakers'));
    fireEvent.click(screen.getByRole('button', { name: 'Speaker 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speaker 2' }));
    view.rerender(
      <I18nProvider>
        <MemoryRouter>
          <DebateEntryPanel bookId={7} />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByTestId('debate-entry-selected-personas')).toHaveTextContent(
      'No speakers selected',
    );
    expect(screen.getByTestId('debate-enter-submit')).toBeDisabled();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
  it('starts collapsed, retains order and sends only the selected two speakers', async () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <DebateEntryPanel bookId={7} />
        </MemoryRouter>
      </I18nProvider>,
    );
    const picker = screen.getByTestId('debate-participant-picker');
    await waitFor(() =>
      expect(screen.getByTestId('debate-entry-selected-personas')).toHaveTextContent('Speaker 1'),
    );
    expect(picker).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Speaker 3', hidden: true })).not.toBeVisible();
    fireEvent.click(screen.getByText('Change speakers'));
    const first = screen.getByRole('button', { name: 'Speaker 1' });
    const third = screen.getByRole('button', { name: 'Speaker 3' });
    expect(first).toHaveAttribute('data-variant', 'default');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(third).toHaveAttribute('data-variant', 'secondary');
    expect(third).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Speaker 3' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Speaker 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speaker 3' }));
    fireEvent.click(screen.getByText('Change speakers'));
    fireEvent.change(screen.getByTestId('debate-topic-input'), { target: { value: 'My topic' } });
    expect(fixture.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('debate-enter-submit'));
    expect(fixture.create).toHaveBeenCalledWith(
      { sessionId: 9, topic: 'My topic', personaIds: [2, 3] },
      expect.any(Object),
    );
  });

  it('updates untouched defaults but keeps an explicit selection when recommendations change', () => {
    const ui = () => (
      <I18nProvider>
        <MemoryRouter>
          <DebateEntryPanel bookId={7} />
        </MemoryRouter>
      </I18nProvider>
    );
    const view = render(ui());
    fixture.recommendedIds = [2, 3];
    view.rerender(ui());
    expect(screen.getByTestId('debate-entry-selected-personas')).toHaveTextContent('Speaker 2');
    expect(screen.getByTestId('debate-entry-selected-personas')).not.toHaveTextContent('Speaker 1');
    fireEvent.click(screen.getByText('Change speakers'));
    fireEvent.click(screen.getByRole('button', { name: 'Speaker 3' }));
    fixture.recommendedIds = [1, 3];
    view.rerender(ui());
    expect(screen.getByTestId('debate-entry-selected-personas')).toHaveTextContent('Speaker 2');
    expect(screen.getByTestId('debate-entry-selected-personas')).not.toHaveTextContent('Speaker 1');
    expect(screen.getByTestId('debate-entry-selected-personas')).not.toHaveTextContent('Speaker 3');
  });
});
