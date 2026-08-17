const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;

export const QUESTION_AI_NOTICE_COOKIE_KEY = 'margins.question-ai-notice.hidden-until';
export const QUESTION_AI_NOTICE_DISMISS_DAYS = 7;

export function isNoticeDismissed(
  storageKey: string,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
  now = Date.now(),
): boolean {
  try {
    const hiddenUntil = Number(storage.getItem(storageKey));
    return Number.isFinite(hiddenUntil) && hiddenUntil > now;
  } catch {
    return false;
  }
}

export function dismissNotice(
  storageKey: string,
  days: number,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
  now = Date.now(),
): void {
  try {
    storage.setItem(storageKey, String(now + days * MILLISECONDS_PER_DAY));
  } catch {
    // The current view can still dismiss the notice when browser storage is unavailable.
  }
}

export function isNoticeDismissedCookie(
  cookieName: string,
  documentRef: Pick<Document, 'cookie'> = document,
  legacyStorage: Pick<Storage, 'getItem'> | undefined = typeof window === 'undefined'
    ? undefined
    : window.localStorage,
  now = Date.now(),
): boolean {
  try {
    if (documentRef.cookie.split(';').some((entry) => entry.trim().startsWith(`${cookieName}=`))) {
      return true;
    }
  } catch {
    // Fall through to the legacy local-storage compatibility read.
  }

  try {
    const hiddenUntil = Number(legacyStorage?.getItem(cookieName));
    return Number.isFinite(hiddenUntil) && hiddenUntil > now;
  } catch {
    return false;
  }
}

export function dismissNoticeCookie(
  cookieName: string,
  days: number,
  documentRef: Pick<Document, 'cookie'> = document,
): void {
  try {
    documentRef.cookie = `${cookieName}=1; Max-Age=${Math.max(0, Math.floor(days * SECONDS_PER_DAY))}; Path=/; SameSite=Lax`;
  } catch {
    // The current view can still dismiss the notice when cookies are unavailable.
  }
}
