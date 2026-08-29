import type { LoginResponse } from '@/types/api/auth';

const AUTH_STORAGE_KEY = 'margins.auth';
const AUTH_REFRESH_HINT_KEY = 'margins.auth.refreshAvailable';
const AUTH_EXPLICIT_LOGOUT_KEY = 'margins.auth.explicitLogout';
const AUTH_LEGACY_REFRESH_ATTEMPTED_KEY = 'margins.auth.legacyRefreshAttempted';

function localStorageOrUndefined(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function sessionStorageOrUndefined(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function readLocalFlag(key: string): boolean {
  try {
    return localStorageOrUndefined()?.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeLocalFlag(key: string) {
  try {
    localStorageOrUndefined()?.setItem(key, 'true');
  } catch {
    // Storage-denied browsers continue with the current tab session only.
  }
}

function clearLocalFlag(key: string) {
  try {
    localStorageOrUndefined()?.removeItem(key);
  } catch {
    // There is no available hint to clear.
  }
}

export function readRefreshSessionHint(): boolean {
  return readLocalFlag(AUTH_REFRESH_HINT_KEY);
}

export function readExplicitLogoutHint(): boolean {
  return readLocalFlag(AUTH_EXPLICIT_LOGOUT_KEY);
}

export function readLegacyRefreshAttemptedHint(): boolean {
  return readLocalFlag(AUTH_LEGACY_REFRESH_ATTEMPTED_KEY);
}

type AuthSessionExpiredListener = () => void;
const authSessionExpiredListeners = new Set<AuthSessionExpiredListener>();
type AuthSessionChangedListener = (session: LoginResponse) => void;
const authSessionChangedListeners = new Set<AuthSessionChangedListener>();
let authSessionRevision = 0;
let authSessionLifetime = 0;

export function readAuthSessionRevision(): number {
  return authSessionRevision;
}

export function readAuthSessionLifetime(): number {
  return authSessionLifetime;
}

export function shouldAttemptBootstrapRefresh(): boolean {
  if (readRefreshSessionHint()) return true;
  return !readExplicitLogoutHint() && !readLegacyRefreshAttemptedHint();
}

export function markLegacyRefreshAttempted() {
  writeLocalFlag(AUTH_LEGACY_REFRESH_ATTEMPTED_KEY);
}

export function readAuthSession(): LoginResponse | undefined {
  const storage = sessionStorageOrUndefined();
  if (!storage) return undefined;

  let value: string | null;
  try {
    value = storage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!value) return undefined;

  try {
    return JSON.parse(value) as LoginResponse;
  } catch {
    try {
      storage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // The inaccessible cache cannot be repaired.
    }
    return undefined;
  }
}

export function writeAuthSession(
  session: LoginResponse,
  options: { preserveLifetime?: boolean } = {},
) {
  if (!options.preserveLifetime) authSessionLifetime += 1;
  authSessionRevision += 1;
  try {
    sessionStorageOrUndefined()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The refresh-cookie hint still enables bootstrap recovery.
  }
  clearLocalFlag(AUTH_EXPLICIT_LOGOUT_KEY);
  clearLocalFlag(AUTH_LEGACY_REFRESH_ATTEMPTED_KEY);
  writeLocalFlag(AUTH_REFRESH_HINT_KEY);
  authSessionChangedListeners.forEach((listener) => listener(session));
}

export function markAuthSessionConsentSatisfied(): LoginResponse | undefined {
  const session = readAuthSession();
  if (!session) return undefined;
  const updated = { ...session, consentRequired: false };
  writeAuthSession(updated, { preserveLifetime: true });
  return updated;
}

export function updateAuthSessionPreferredLocale(
  preferredLocale: NonNullable<LoginResponse['preferredLocale']>,
): LoginResponse | undefined {
  const session = readAuthSession();
  if (!session) return undefined;
  const updated = { ...session, preferredLocale };
  writeAuthSession(updated, { preserveLifetime: true });
  return updated;
}

export type ClearAuthSessionOptions = {
  clearRefreshHint?: boolean;
  markExplicitLogout?: boolean;
};

export function clearAuthSession(options: ClearAuthSessionOptions = {}) {
  authSessionLifetime += 1;
  authSessionRevision += 1;
  try {
    sessionStorageOrUndefined()?.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // The inaccessible cache is already unusable.
  }
  if (options.clearRefreshHint) clearLocalFlag(AUTH_REFRESH_HINT_KEY);
  if (options.markExplicitLogout) writeLocalFlag(AUTH_EXPLICIT_LOGOUT_KEY);
}

export function notifyAuthSessionExpired() {
  authSessionExpiredListeners.forEach((listener) => listener());
}

export function onAuthSessionExpired(listener: AuthSessionExpiredListener): () => void {
  authSessionExpiredListeners.add(listener);
  return () => authSessionExpiredListeners.delete(listener);
}

export function onAuthSessionChanged(listener: AuthSessionChangedListener): () => void {
  authSessionChangedListeners.add(listener);
  return () => authSessionChangedListeners.delete(listener);
}
