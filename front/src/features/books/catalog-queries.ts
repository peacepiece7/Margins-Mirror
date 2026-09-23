import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { bookKeys } from '@/lib/query-keys';
import { ApiRequestError } from '@/lib/api-client';
import type { CatalogSearchRequest } from '@/types/api/catalog';
import { booksApi } from './api';

export function useCatalogSearch() {
  const client = useQueryClient();
  const command = useQuery<CatalogSearchRequest>({
    queryKey: bookKeys.catalogCommand(),
    queryFn: async () => ({ query: '', field: 'ALL', language: 'ALL', format: 'ALL', limit: 20 }),
    initialData: { query: '', field: 'ALL', language: 'ALL', format: 'ALL', limit: 20 },
    enabled: false,
    staleTime: Infinity,
    gcTime: 15 * 60_000,
  });
  const request = command.data;
  function setRequest(
    next: CatalogSearchRequest | ((value: CatalogSearchRequest) => CatalogSearchRequest),
  ) {
    client.setQueryData(
      bookKeys.catalogCommand(),
      typeof next === 'function' ? next(request) : next,
    );
  }
  const [revision, setRevision] = useState(0);
  const explicitSubmit = useRef(false);
  const refreshSnapshot = useRef<string | null>(null);
  const queryKey = bookKeys.catalogSearch(request, revision);
  const search = useInfiniteQuery({
    queryKey,
    initialPageParam: null as { snapshotId: string; cursor: string } | null,
    queryFn: ({ pageParam, signal }) => {
      if (pageParam) return booksApi.catalogPage(pageParam.snapshotId, pageParam.cursor, signal);
      if (refreshSnapshot.current)
        return booksApi.catalogPage(refreshSnapshot.current, null, signal);
      const intent = explicitSubmit.current ? 'SUBMIT' : 'REBUILD';
      explicitSubmit.current = false;
      return booksApi.catalogSearch({ ...request, intent }, signal);
    },
    getNextPageParam: (page) =>
      page.nextCursor ? { snapshotId: page.snapshotId, cursor: page.nextCursor } : undefined,
    enabled: Boolean(request.query),
    retry: false,
    staleTime: Infinity,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const refetchSearch = search.refetch;
  const first = search.data?.pages[0];
  const candidates = useMemo(
    () => [
      ...new Map(
        (search.data?.pages.flatMap((p) => p.candidates) ?? []).map((candidate) => [
          candidate.catalogBookId,
          candidate,
        ]),
      ).values(),
    ],
    [search.data],
  );
  const coverPending = candidates.some((candidate) => candidate.coverStatus === 'PENDING');
  const snapshotExpired =
    search.error instanceof ApiRequestError && search.error.code === 'CATALOG_SNAPSHOT_EXPIRED';
  const searchBusy = useRef(false);
  useEffect(() => {
    searchBusy.current = search.isFetching;
  }, [search.isFetching]);
  const startedAt = useRef(0);
  const pollKey = [
    ...bookKeys.collection(first?.collection.id ?? '', first?.collection.generation ?? 0),
    revision,
  ];
  const poll = useQuery({
    queryKey: pollKey,
    queryFn: ({ signal }) => booksApi.catalogCollection(first!.collection.id, signal),
    enabled: Boolean(first),
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (query) => {
      if (snapshotExpired) return false;
      const elapsed = Date.now() - startedAt.current;
      if (
        query.state.data?.state === 'IDLE' &&
        !coverPending &&
        (candidates.length > 0 ||
          query.state.data.resultVersion <=
            (first?.appliedResultVersion ?? first?.collection.resultVersion ?? 0))
      )
        return false;
      return elapsed < 6000 ? 2000 : elapsed < 12000 ? 3000 : elapsed < 60_000 ? 5000 : 10_000;
    },
  });
  const extension = useMutation({
    mutationFn: ({ command }: { command: CatalogSearchRequest; key: QueryKey }) =>
      booksApi.catalogSearch({ ...command, intent: 'EXTEND' }),
    onSuccess: (response, { key }) => client.setQueryData(key, response.collection),
  });
  const hasUpdates = Boolean(
    poll.data &&
    first &&
    poll.data.resultVersion > (first.appliedResultVersion ?? first.collection.resultVersion),
  );
  const autoUpdateInFlight = useRef(false);
  const coverOnlyUpdate = Boolean(
    coverPending &&
    first &&
    poll.data &&
    ((poll.data.coverVersion ?? 0) > (first.collection.coverVersion ?? 0) ||
      poll.dataUpdatedAt - search.dataUpdatedAt >= 5000),
  );
  function rebuild() {
    explicitSubmit.current = false;
    refreshSnapshot.current = null;
    startedAt.current = Date.now();
    void poll.refetch();
    setRevision((value) => value + 1);
  }
  useEffect(() => {
    if ((!hasUpdates || candidates.length > 0) && !coverOnlyUpdate) return;
    if (!first || !poll.data || snapshotExpired || autoUpdateInFlight.current || searchBusy.current)
      return;
    autoUpdateInFlight.current = true;
    refreshSnapshot.current = candidates.length > 0 ? first.snapshotId : null;
    void refetchSearch().finally(() => {
      refreshSnapshot.current = null;
      autoUpdateInFlight.current = false;
    });
    // A failed refresh can retry on the next status response, including the same version.
  }, [
    hasUpdates,
    coverOnlyUpdate,
    candidates.length,
    first,
    poll.data,
    poll.dataUpdatedAt,
    refetchSearch,
    snapshotExpired,
  ]);
  function submit(next: CatalogSearchRequest) {
    extension.reset();
    void client.cancelQueries({ queryKey: bookKeys.catalog() });
    explicitSubmit.current = true;
    refreshSnapshot.current = null;
    startedAt.current = Date.now();
    setRequest({ ...next, query: next.query.trim(), limit: 20 });
    setRevision((value) => value + 1);
  }
  function clear() {
    extension.reset();
    void client.cancelQueries({ queryKey: bookKeys.catalog() });
    explicitSubmit.current = false;
    refreshSnapshot.current = null;
    startedAt.current = 0;
    setRequest((value) => ({ ...value, query: '' }));
    client.removeQueries({
      queryKey: bookKeys.catalog(),
      predicate: (q) => q.queryKey.includes('search') || q.queryKey.includes('collection'),
    });
  }
  function filter(next: CatalogSearchRequest) {
    extension.reset();
    void client.cancelQueries({ queryKey: bookKeys.catalog() });
    explicitSubmit.current = false;
    refreshSnapshot.current = null;
    setRequest(next);
    setRevision((value) => value + 1);
  }
  return {
    search,
    candidates,
    first,
    collection: poll.data ?? first?.collection,
    hasUpdates,
    request,
    submit,
    clear,
    rebuild,
    filter,
    pollError: poll.isError,
    extending: extension.isPending,
    extendError: extension.error,
    extend: () => {
      startedAt.current = Date.now();
      extension.mutate({ command: request, key: pollKey });
    },
  };
}
export function useSaveCatalogMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: booksApi.saveCatalog,
    onSuccess: () => client.invalidateQueries({ queryKey: bookKeys.lists() }),
  });
}
