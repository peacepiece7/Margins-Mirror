import { expect, it, vi } from 'vitest';
import { installTurnstileFixture } from './storybook';

it('shares the fixture until its last consumer leaves and removes widget callbacks', () => {
  const previous = window.turnstile;
  const releaseFirst = installTurnstileFixture();
  const sdk = window.turnstile!;
  const releaseSecond = installTurnstileFixture();
  const example = document.createElement('div');
  const container = document.createElement('div');
  example.append(container);
  document.body.append(example);
  const callback = vi.fn();
  const expired = vi.fn();
  const error = vi.fn();
  const widget = sdk.render(container, {
    sitekey: 'fixture',
    action: 'email_verification',
    theme: 'auto',
    language: 'ko',
    callback,
    'expired-callback': expired,
    'error-callback': error,
  });
  const dispatch = (state: string) =>
    example.dispatchEvent(new CustomEvent('storybook:turnstile', { detail: state, bubbles: true }));
  try {
    expect(window.turnstile).toBe(sdk);
    releaseFirst();
    expect(window.turnstile).toBe(sdk);
    dispatch('unknown');
    expect(callback).not.toHaveBeenCalled();
    dispatch('ready');
    expect(callback).toHaveBeenCalledExactlyOnceWith('local-fixture-token');
    dispatch('expired');
    dispatch('error');
    expect(expired).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    sdk.remove(widget);
    expect(container).toBeEmptyDOMElement();
    dispatch('ready');
    expect(callback).toHaveBeenCalledTimes(1);
  } finally {
    releaseSecond();
    example.remove();
  }
  expect(window.turnstile).toBe(previous);
  dispatch('ready');
  expect(callback).toHaveBeenCalledTimes(1);
});
