import { useEffect, useState } from 'react';

export const brandedLaunchMinimumMs = 650;

export function useBrandedLaunch(restoring: boolean) {
  const [minimumElapsed, setMinimumElapsed] = useState(!restoring);

  useEffect(() => {
    if (minimumElapsed) return;
    const timeout = setTimeout(() => setMinimumElapsed(true), brandedLaunchMinimumMs);
    return () => clearTimeout(timeout);
  }, [minimumElapsed]);

  return restoring || !minimumElapsed;
}
