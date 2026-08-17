import type { ReactNode } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';

import type { LoginResponse } from '@/types/api/auth';

type PremiumRouteProps = {
  children: ReactNode;
};

export function PremiumRoute({ children }: PremiumRouteProps) {
  const session = useOutletContext<LoginResponse>();
  return session.membershipTier === 'PREMIUM' ? children : <Navigate replace to="/" />;
}
