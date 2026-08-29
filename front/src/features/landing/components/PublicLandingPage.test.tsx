import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { I18nProvider } from '@/lib/i18n';

import { PublicLandingPage } from './PublicLandingPage';

function renderLanding() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <PublicLandingPage />
      </I18nProvider>
    </MemoryRouter>,
  );
}

function stackCaptions(stack: HTMLElement) {
  return Array.from(stack.querySelectorAll('[data-stack-caption]')).map((node) => node.textContent);
}

function stackCard(stack: HTMLElement, caption: string) {
  return Array.from(stack.querySelectorAll<HTMLElement>('.landing-version-card')).find(
    (card) => card.querySelector('[data-stack-caption]')?.textContent === caption,
  ) as HTMLElement;
}

function frontStackCaption(stack: HTMLElement) {
  return stack.querySelector('[data-stack-front] [data-stack-caption]')?.textContent;
}

describe('PublicLandingPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('keeps the public story semantic and authentication on separate links', async () => {
    renderLanding();

    const page = screen.getByTestId('public-landing-page');
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Record your thinking');
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-login')).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('landing-signup')).toHaveAttribute('href', '/login?mode=register');
    expect(screen.getByTestId('landing-workflow').querySelectorAll('li')).toHaveLength(6);
    expect(screen.queryByTestId('landing-bookshelf')).not.toBeInTheDocument();
    expect(page.querySelector('.landing-hero-art')).toHaveAttribute(
      'src',
      '/landing/hero-reader.webp',
    );
    expect(page.querySelector('[data-landing-book-deck]')).not.toBeInTheDocument();
    expect(page.querySelectorAll('.landing-journey-stage')).toHaveLength(6);
    expect(page.querySelector('[data-landing-page]')).not.toBeInTheDocument();
    expect(page.querySelector('.landing-memory-note')).not.toBeInTheDocument();
    expect(page).not.toHaveTextContent('Memory Cards stay beside the reading loop');
    expect(page.querySelector('.landing-screen-frame img')).toHaveAttribute('loading', 'lazy');

    fireEvent.click(screen.getByRole('radio', { name: 'KO' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('생각을 기록하다'),
    );
    expect(page).not.toHaveTextContent('Memory Card는 독서 흐름 옆에서');
  });

  it('keeps card instances stable and derives the visual order from the current index', () => {
    renderLanding();

    const stack = screen.getByTestId('landing-version-stack');
    expect(stack.querySelectorAll('.landing-version-card')).toHaveLength(4);
    expect(stackCaptions(stack)).toEqual(['ORIGINAL', 'INTERVIEW', 'GUIDE', 'REVISION']);
    expect(frontStackCaption(stack)).toBe('REVISION');
    expect(stackCard(stack, 'ORIGINAL')).toHaveAttribute('data-stack-visual-index', '3');
    expect(stackCard(stack, 'INTERVIEW')).toHaveAttribute('data-stack-visual-index', '2');
    expect(stackCard(stack, 'GUIDE')).toHaveAttribute('data-stack-visual-index', '1');
    expect(stackCard(stack, 'REVISION')).toHaveAttribute('data-stack-visual-index', '0');
  });

  it('sequences exit, reorder, and reveal while ignoring duplicate activation', async () => {
    renderLanding();

    const stack = screen.getByTestId('landing-version-stack');
    const cardsBefore = new Map(
      stackCaptions(stack).map((caption) => [caption, stackCard(stack, caption ?? '')]),
    );
    stack.focus();
    fireEvent.click(stack);
    expect(stack).toHaveAttribute('aria-busy', 'true');
    expect(stack).toHaveAttribute('aria-disabled', 'true');
    expect(stack).toHaveAttribute('data-stack-phase', 'exiting');
    expect(stack).toHaveFocus();
    expect(frontStackCaption(stack)).toBe('REVISION');

    fireEvent.click(stack);
    expect(frontStackCaption(stack)).toBe('REVISION');

    await waitFor(() => expect(stack).toHaveAttribute('data-stack-phase', 'idle'), {
      timeout: 2_000,
    });
    expect(stack).toHaveAttribute('aria-busy', 'false');
    expect(stack).toHaveAttribute('aria-disabled', 'false');
    expect(frontStackCaption(stack)).toBe('GUIDE');
    expect(stackCaptions(stack)).toEqual(['ORIGINAL', 'INTERVIEW', 'GUIDE', 'REVISION']);
    cardsBefore.forEach((card, caption) => expect(stackCard(stack, caption ?? '')).toBe(card));

    fireEvent.click(stack);
    await waitFor(() => expect(stack).toHaveAttribute('data-stack-phase', 'idle'), {
      timeout: 2_000,
    });
    expect(frontStackCaption(stack)).toBe('INTERVIEW');
  });

  it('keeps automatic reveals static while explicit stack interactions animate for reduced motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    const addEventListener = vi.spyOn(window, 'addEventListener');

    renderLanding();

    const page = screen.getByTestId('public-landing-page');
    expect(page).toHaveAttribute('data-motion', 'reduced');
    expect(page.querySelectorAll('[data-landing-reveal][data-visible="true"]')).toHaveLength(12);
    expect(addEventListener).not.toHaveBeenCalledWith('scroll', expect.any(Function), {
      passive: true,
    });

    const stack = screen.getByTestId('landing-version-stack');
    expect(stack).toHaveAttribute('data-reduced-motion', 'true');
    expect(stack).toHaveAttribute('data-stack-motion', 'interactive');
    fireEvent.click(stack);
    expect(stack).toHaveAttribute('aria-disabled', 'true');
    expect(stack).toHaveAttribute('data-stack-phase', 'exiting');
    expect(frontStackCaption(stack)).toBe('REVISION');

    fireEvent.click(stack);
    expect(frontStackCaption(stack)).toBe('REVISION');

    await waitFor(() => expect(stack).toHaveAttribute('data-stack-phase', 'idle'), {
      timeout: 2_000,
    });
    expect(stackCaptions(stack)).toEqual(['ORIGINAL', 'INTERVIEW', 'GUIDE', 'REVISION']);
    expect(frontStackCaption(stack)).toBe('GUIDE');

    fireEvent.click(stack);
    await waitFor(() => expect(stack).toHaveAttribute('data-stack-phase', 'idle'), {
      timeout: 2_000,
    });
    expect(frontStackCaption(stack)).toBe('INTERVIEW');
  });
});
