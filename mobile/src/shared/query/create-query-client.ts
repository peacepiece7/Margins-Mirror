import { QueryClient } from '@tanstack/react-query';

import { isRetryableApiError } from '@/shared/api/error';

export function createQueryClient(_principalLifetime: number) {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: {
        gcTime: 10 * 60 * 1000,
        refetchOnReconnect: true,
        retry: (failureCount, error) => failureCount < 2 && isRetryableApiError(error),
        staleTime: 30 * 1000,
      },
    },
  });
}
