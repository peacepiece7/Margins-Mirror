import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
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
import {
  isValidCatalogQuery,
  normalizeCatalogQuery,
  readCatalogSearchParams,
  writeCatalogSearchParams,
} from './catalog-search-url';
import { booksApi } from './api';

let catalogSearchInstanceSequence = 0;

export function useCatalogSearch() {
  const client = useQueryClient();
  const [instanceId] = useState(() => ++catalogSearchInstanceSequence);
  const location = useLocation();
  const navigationType = useNavigationType();
  const [, setSearchParams] = useSearchParams();
  const request = useMemo(
    () => readCatalogSearchParams(new URLSearchParams(location.search)),
    [location.search],
  );
  const [navigation, setNavigation] = useState({ key: location.key, revision: 0 });
  const navigationReady = navigation.key === location.key;
  const [revision, setRevision] = useState(0);
  const explicitSubmit = useRef(false);
  const refreshSnapshot = useRef<string | null>(null);
  const queryRequest = useMemo(
    () => ({ ...request, query: normalizeCatalogQuery(request.query) }),
    [request],
  );
  const queryKey = bookKeys.catalogSearch(
    queryRequest,
    `${instanceId}:${navigation.revision + revision}`,
  );
  const search = useInfiniteQuery({
    queryKey,
    initialPageParam: null as { snapshotId: string; cursor: string } | null,
    queryFn: ({ pageParam, signal }) => {
      if (pageParam) return booksApi.catalogPage(pageParam.snapshotId, pageParam.cursor, signal);
      if (refreshSnapshot.current)
        return booksApi.catalogPage(refreshSnapshot.current, null, signal);
      const intent = explicitSubmit.current ? 'SUBMIT' : 'REBUILD';
      explicitSubmit.current = false;
      return booksApi.catalogSearch({ ...queryRequest, intent }, signal);
    },
    getNextPageParam: (page) =>
      page.nextCursor ? { snapshotId: page.snapshotId, cursor: page.nextCursor } : undefined,
    enabled: navigationReady && isValidCatalogQuery(request.query),
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
  useEffect(() => {
    if (request.query) return;
    client.removeQueries({
      queryKey: bookKeys.catalog(),
      predicate: (query) =>
        query.queryKey.includes('search') || query.queryKey.includes('collection'),
    });
  }, [client, location.key, request.query]);
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
  const autoUpdateInFlight = useRef<object | null>(null);
  const resetExtension = extension.reset;
  useEffect(() => {
    if (navigation.key === location.key) return;
    resetExtension();
    if (navigationType === 'POP') explicitSubmit.current = false;
    refreshSnapshot.current = null;
    autoUpdateInFlight.current = null;
    startedAt.current = Date.now();
    setNavigation((current) => ({ key: location.key, revision: current.revision + 1 }));
  }, [location.key, navigation.key, navigationType, resetExtension]);
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
    const refresh = {};
    autoUpdateInFlight.current = refresh;
    refreshSnapshot.current = candidates.length > 0 ? first.snapshotId : null;
    void refetchSearch().finally(() => {
      if (autoUpdateInFlight.current !== refresh) return;
      refreshSnapshot.current = null;
      autoUpdateInFlight.current = null;
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
  function changeSearch(next: CatalogSearchRequest, intent: 'SUBMIT' | 'REBUILD' = 'REBUILD') {
    extension.reset();
    void client.cancelQueries({ queryKey: bookKeys.catalog() });
    explicitSubmit.current = intent === 'SUBMIT';
    refreshSnapshot.current = null;
    autoUpdateInFlight.current = null;
    startedAt.current = next.query ? Date.now() : 0;
    const params = writeCatalogSearchParams(new URLSearchParams(location.search), next);
    // Filter changes must not normalize an invalid URL query into a valid search.
    if (next.query && !isValidCatalogQuery(next.query)) params.set('q', next.query);
    setSearchParams(params);
  }
  return {
    search,
    candidates,
    first,
    collection: poll.data ?? first?.collection,
    hasUpdates,
    request,
    submit: (next: CatalogSearchRequest) => {
      if (isValidCatalogQuery(next.query)) changeSearch(next, 'SUBMIT');
    },
    clear: () => changeSearch({ ...request, query: '' }),
    rebuild,
    filter: (next: CatalogSearchRequest) => {
      if (request.query) changeSearch({ ...next, query: request.query });
    },
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
