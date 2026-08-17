import { useIsFetching } from '@tanstack/react-query';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/utils/cn';

export function GlobalLoadingIndicator({ className }: { className?: string }) {
  const foregroundRequests = useIsFetching({
    predicate: (query) =>
      query.state.fetchStatus === 'fetching' && query.state.status === 'pending',
  });

  if (foregroundRequests === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed right-3 top-16 z-40 flex items-center rounded-full border border-border bg-background/90 p-2 text-foreground shadow-sm backdrop-blur',
        className,
      )}
      data-slot="global-loading-indicator"
    >
      <Spinner size="sm" />
    </div>
  );
}
