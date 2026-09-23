export type RootSessionStatus =
  | 'anonymous'
  | 'authenticated'
  | 'consent-required'
  | 'restore-error'
  | 'restoring';

export function rootRouteAccess(status: RootSessionStatus) {
  return {
    consent: status === 'consent-required',
    protected: status === 'authenticated',
    publicAuth: status === 'anonymous' || status === 'restore-error',
  };
}
