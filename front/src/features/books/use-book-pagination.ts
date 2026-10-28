import { useEffect, useRef } from 'react';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';

export function useBookPagination({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
}: Pick<
  UseInfiniteQueryResult,
  'fetchNextPage' | 'hasNextPage' | 'isFetchingNextPage' | 'isFetchNextPageError'
>) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !sentinel.current ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    let observing = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (observing && entry.isIntersecting) void fetchNextPage({ cancelRefetch: false });
      },
      { rootMargin: '240px' },
    );
    observer.observe(sentinel.current);
    return () => {
      observing = false;
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);
  return sentinel;
}
