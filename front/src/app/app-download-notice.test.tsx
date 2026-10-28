import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { APP_DOWNLOAD_NOTICE_KEY, AppDownloadNotice } from './app-download-notice';

function setSmallViewport(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(max-width: 1024px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  );
}

function renderNotice() {
  return render(
    <I18nProvider>
      <AppDownloadNotice />
    </I18nProvider>,
  );
}

describe('AppDownloadNotice', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens once on a small initial viewport and keeps the app action unavailable', async () => {
    setSmallViewport(true);
    window.localStorage.setItem('margins.locale', 'ko');

    const firstMount = renderNotice();

    expect(await screen.findByTestId('app-download-notice')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Margins 앱을 준비하고 있어요' })).toBeVisible();
    expect(screen.getByText('아직 준비 중입니다')).toBeVisible();
    expect(screen.getByTestId('app-download-action')).toBeDisabled();

    fireEvent.click(screen.getByTestId('app-download-close'));
    expect(screen.queryByTestId('app-download-notice')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(APP_DOWNLOAD_NOTICE_KEY)).toBeNull();

    firstMount.unmount();
    renderNotice();
    expect(await screen.findByTestId('app-download-notice')).toBeVisible();
  });

  it('persists do-not-show and stays closed on later mounts', async () => {
    setSmallViewport(true);

    const firstMount = renderNotice();
    fireEvent.click(await screen.findByTestId('app-download-dismiss'));

    expect(window.localStorage.getItem(APP_DOWNLOAD_NOTICE_KEY)).toBe('dismissed');
    firstMount.unmount();
    renderNotice();

    expect(screen.queryByTestId('app-download-notice')).not.toBeInTheDocument();
  });

  it('does not open above the tablet breakpoint', () => {
    setSmallViewport(false);
    renderNotice();

    expect(screen.queryByTestId('app-download-notice')).not.toBeInTheDocument();
  });

  it.each(['/terms', '/terms/', '/terms/history', '/privacy', '/privacy/history', '/contact'])(
    'does not interrupt the public document path %s',
    (path) => {
      setSmallViewport(true);
      window.history.replaceState({}, '', path);

      renderNotice();

      expect(screen.queryByTestId('app-download-notice')).not.toBeInTheDocument();
    },
  );
});
