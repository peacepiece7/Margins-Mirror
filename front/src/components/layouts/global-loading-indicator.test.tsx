import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GlobalLoadingIndicator } from './global-loading-indicator';

function PendingQuery() {
  useQuery({ queryKey: ['pending'], queryFn: () => new Promise(() => undefined) });
  return null;
}

describe('GlobalLoadingIndicator', () => {
  it('shows a non-announced indicator for an initial foreground query', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PendingQuery />
        <GlobalLoadingIndicator />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(document.querySelector('[data-slot="global-loading-indicator"]')).toBeVisible(),
    );
    expect(document.querySelector('[data-slot="global-loading-indicator"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
