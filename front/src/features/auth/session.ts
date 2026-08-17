export {
  clearAuthSession,
  markLegacyRefreshAttempted,
  onAuthSessionChanged,
  onAuthSessionExpired,
  readAuthSession,
  readRefreshSessionHint,
  shouldAttemptBootstrapRefresh,
  writeAuthSession,
} from '@/lib/auth-session';
export { shouldMarkInvalidRefresh as isInvalidRefreshFailure } from '@/lib/api-client';
