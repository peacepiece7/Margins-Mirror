import { createContext, useContext } from 'react';

export type AuthenticatedSessionScope = {
  active: boolean;
};

export const AuthenticatedSessionGuardContext = createContext<() => boolean>(() => true);

/**
 * Returns a guard for async work started by the current authenticated tree.
 * The default keeps isolated feature tests renderable without the app boundary.
 */
export function useAuthenticatedSessionGuard() {
  return useContext(AuthenticatedSessionGuardContext);
}
