import { describe, expect, it, vi } from 'vitest';

import {
  dismissNotice,
  dismissNoticeCookie,
  isNoticeDismissed,
  isNoticeDismissedCookie,
} from './dismissible-notice';

describe('dismissible notices', () => {
  it('hides a local-storage notice until the configured expiry', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } as unknown as Storage;
    dismissNotice('notice', 7, storage, 1_000);

    expect(isNoticeDismissed('notice', storage, 1_000 + 7 * 24 * 60 * 60 * 1000 - 1)).toBe(true);
    expect(isNoticeDismissed('notice', storage, 1_000 + 7 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('does not throw when local storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    } as unknown as Storage;

    expect(isNoticeDismissed('notice', storage)).toBe(false);
    expect(() => dismissNotice('notice', 7, storage)).not.toThrow();
  });

  it('writes a seven-day cookie and reads it before expiry', () => {
    let cookie = '';
    const documentRef = {
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        cookie = value;
      },
    } as Document;

    dismissNoticeCookie('notice', 7, documentRef);

    expect(cookie).toContain('notice=');
    expect(cookie).toContain('Max-Age=604800');
    expect(isNoticeDismissedCookie('notice', documentRef)).toBe(true);
  });

  it('reads an unexpired legacy local-storage dismissal without writing local storage', () => {
    const storage = {
      getItem: vi.fn(() => String(1_000 + 7 * 24 * 60 * 60 * 1000)),
    } as unknown as Storage;
    const documentRef = { cookie: '' } as Document;

    expect(isNoticeDismissedCookie('notice', documentRef, storage, 1_000)).toBe(true);
    expect(storage.getItem).toHaveBeenCalledWith('notice');
  });

  it('does not honor an expired legacy local-storage dismissal', () => {
    const storage = {
      getItem: vi.fn(() => String(1_000)),
    } as unknown as Storage;
    const documentRef = { cookie: '' } as Document;

    expect(isNoticeDismissedCookie('notice', documentRef, storage, 1_001)).toBe(false);
  });
});
