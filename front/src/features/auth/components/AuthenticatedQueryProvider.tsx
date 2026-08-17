import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import type { LoginResponse } from '@/types/api/auth';
import {
  AuthenticatedSessionGuardContext,
  type AuthenticatedSessionScope,
} from '@/lib/authenticated-session-guard';
import { createAppQueryClient } from '@/lib/query-client';

export function AuthenticatedQueryProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: LoginResponse;
}) {
  const sessionScope = useMemo<AuthenticatedSessionScope>(
    () => ({ active: true }),
    // Session identity deliberately creates a new guard scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.userId],
  );

  // Routine token rotation must not discard in-flight work or protected cache.
  // Logout/account changes unmount or key this provider by principal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queryClient = useMemo(() => createAppQueryClient(), [session.userId]);
  const isCurrentSession = useCallback(() => sessionScope.active, [sessionScope]);

  useEffect(() => {
    return () => {
      sessionScope.active = false;
      void queryClient.cancelQueries();
      queryClient.clear();
    };
  }, [queryClient, sessionScope]);

  return (
    <AuthenticatedSessionGuardContext.Provider value={isCurrentSession}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthenticatedSessionGuardContext.Provider>
  );
}
