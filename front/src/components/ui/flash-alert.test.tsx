import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { FlashAlertProvider, useFlashAlert } from './flash-alert';

function Harness() {
  const { show } = useFlashAlert();
  return (
    <button
      onClick={() => show({ message: '책이 추가되었습니다.', variant: 'success' })}
      type="button"
    >
      Show alert
    </button>
  );
}

describe('FlashAlertProvider', () => {
  beforeEach(() => window.localStorage.setItem('margins.locale', 'ko'));
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('renders shared semantic feedback and exposes a localized dismiss action', () => {
    render(
      <I18nProvider>
        <FlashAlertProvider>
          <Harness />
        </FlashAlertProvider>
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show alert' }));

    expect(screen.getByTestId('flash-alert')).toHaveTextContent('책이 추가되었습니다.');
    expect(screen.getByTestId('flash-alert')).toHaveAttribute('data-slot', 'flash-alert');
    expect(screen.getByRole('button', { name: '닫기' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByTestId('flash-alert')).not.toBeInTheDocument();
  });
});
