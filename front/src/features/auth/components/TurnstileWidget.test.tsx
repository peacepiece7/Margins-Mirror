import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  delete window.turnstile;
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('renders explicitly and handles ready, expiry, error, and parent reset', async () => {
  vi.stubEnv('VITE_MARGINS_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
  const reset = vi.fn();
  const remove = vi.fn();
  let options:
    | {
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
        action: string;
        language: string;
        theme: string;
      }
    | undefined;
  window.turnstile = {
    render: vi.fn((_container, receivedOptions) => {
      options = receivedOptions;
      return 'widget-1';
    }),
    reset,
    remove,
  };
  const [{ TurnstileWidget }, { I18nProvider }] = await Promise.all([
    import('@/components/ui/turnstile-widget'),
    import('@/lib/i18n'),
  ]);
  const onTokenChange = vi.fn();
  const view = render(
    createElement(
      I18nProvider,
      null,
      createElement(TurnstileWidget, {
        action: 'email_verification',
        locale: 'en',
        onTokenChange,
        resetSignal: 0,
      }),
    ),
  );

  expect(options).toMatchObject({
    action: 'email_verification',
    language: 'en',
    theme: 'auto',
  });
  act(() => options?.callback('one-time-token'));
  expect(onTokenChange).toHaveBeenLastCalledWith('one-time-token');
  expect(screen.getByTestId('register-bot-challenge-status')).toHaveTextContent(
    'Bot check complete.',
  );

  act(() => options?.['expired-callback']());
  expect(reset).toHaveBeenCalledWith('widget-1');
  expect(onTokenChange).toHaveBeenLastCalledWith(undefined);
  expect(screen.getByTestId('register-bot-challenge-status')).toHaveTextContent('expired');

  act(() => options?.['error-callback']());
  expect(screen.getByTestId('register-bot-challenge-status')).toHaveTextContent('could not load');

  view.rerender(
    createElement(
      I18nProvider,
      null,
      createElement(TurnstileWidget, {
        action: 'email_verification',
        locale: 'en',
        onTokenChange,
        resetSignal: 1,
      }),
    ),
  );
  expect(reset).toHaveBeenCalledWith('widget-1');
});

it('binds a contact challenge to the contact inquiry action', async () => {
  vi.stubEnv('VITE_MARGINS_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
  let action: string | undefined;
  window.turnstile = {
    render: vi.fn((_container, options) => {
      action = options.action;
      return 'widget-contact';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  const [{ TurnstileWidget }, { I18nProvider }] = await Promise.all([
    import('@/components/ui/turnstile-widget'),
    import('@/lib/i18n'),
  ]);

  render(
    createElement(
      I18nProvider,
      null,
      createElement(TurnstileWidget, {
        action: 'contact_inquiry',
        locale: 'en',
        onTokenChange: vi.fn(),
        resetSignal: 0,
        testId: 'contact-bot-challenge',
      }),
    ),
  );

  expect(action).toBe('contact_inquiry');
  expect(screen.getByTestId('contact-bot-challenge')).toBeVisible();
});
