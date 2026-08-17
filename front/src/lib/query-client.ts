import { QueryClient } from '@tanstack/react-query';

import { protectedQueryRoots } from './query-keys';

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const appQueryClient = createAppQueryClient();

export function removeProtectedQueries(queryClient: QueryClient) {
  for (const queryKey of Object.values(protectedQueryRoots)) {
    queryClient.removeQueries({ queryKey });
  }
}
