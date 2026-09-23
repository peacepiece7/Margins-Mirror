import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFlashAlert } from '@/components/ui/flash-alert';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import { bookKeys } from '@/lib/query-keys';
import { testAttr } from '@/utils/testAttrs';
import { booksApi } from '../api';
import { useCatalogSearch } from '../catalog-queries';
import { useSaveManualBookMutation } from '../queries';
import { useBookSelectionStore } from '../selection-store';
import { AppliedSearchChips } from './AppliedSearchChips';
import { CatalogSearchForm } from './CatalogSearchForm';
import { CatalogCandidateCard } from './CatalogCandidateCard';
import { BookSearchState } from './BookSearchState';
import { ManualBookForm } from './ManualBookForm';

export function BookSearchPanel() {
  const { t, locale } = useI18n();
  const catalog = useCatalogSearch();
  const { search, first, candidates, collection } = catalog;
  const manual = useSaveManualBookMutation();
  const navigate = useNavigate();
  const currentSession = useAuthenticatedSessionGuard();
  const selectBook = useBookSelectionStore((s) => s.selectBook);
  const flash = useFlashAlert();
  const loadMore = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = search;
  useEffect(() => {
    if (
      !loadMore.current ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '240px' },
    );
    observer.observe(loadMore.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  const capabilities = useQuery({
    queryKey: bookKeys.catalogCapabilities(),
    queryFn: ({ signal }) => booksApi.catalogCapabilities(signal),
    staleTime: 60_000,
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
  return (
    <section className="web-discover-page grid gap-5" {...testAttr('book-search-page')}>
      <Card className="web-discover-search rounded border border-stone-300 bg-stone-50/95 p-4 ring-0 sm:p-5">
        <CardContent className="p-0">
          <h2 className="font-display text-3xl font-semibold">{t('searchHeading')}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{t('catalogHint')}</p>
          <CatalogSearchForm
            active={catalog.request}
            onSearch={catalog.submit}
            onFilterChange={catalog.filter}
          />
          <div className="mt-3">
            <AppliedSearchChips query={catalog.request.query} onClear={catalog.clear} />
          </div>
        </CardContent>
      </Card>
      {search.isLoading && <BookSearchState state="pending" />}
      {search.isError && (
        <div
          role="alert"
          className="grid gap-2 rounded border border-destructive/20 p-4 text-sm text-destructive"
        >
          {apiErrorMessage(search.error, t)}
          <Button variant="outline" onClick={catalog.rebuild}>
            {t('catalogRefreshView')}
          </Button>
        </div>
      )}
      {first && (
        <div
          className="grid gap-2 text-sm text-stone-600"
          aria-live="polite"
          {...testAttr('catalog-status')}
        >
          {collection?.state === 'COLLECTING' && (
            <>
              <p>{t('catalogCollecting')}</p>
            </>
          )}
          {collection?.lastOutcome === 'PARTIAL' && <p>{t('catalogPartial')}</p>}
          {first.freshness === 'STALE' && <p>{t('catalogStale')}</p>}
          {(first.resultState === 'UNAVAILABLE' ||
            (!candidates.length &&
              collection?.state === 'IDLE' &&
              collection.lastOutcome === 'FAILED')) && <p>{t('catalogUnavailable')}</p>}
          {!candidates.length && collection?.state === 'IDLE' && first.resultState === 'EMPTY' && (
            <p>{t('catalogEmpty')}</p>
          )}
          {first.lastUpdatedAt && (
            <p className="text-xs">
              {t('catalogUpdated')}: {date(first.lastUpdatedAt)}
              {first.revalidateAfter && (
                <>
                  {' '}
                  · {t('catalogRevalidate')}: {date(first.revalidateAfter)}
                </>
              )}
            </p>
          )}
          {(catalog.hasUpdates || collection?.state === 'COLLECTING' || catalog.pollError) && (
            <Button variant="outline" onClick={catalog.rebuild}>
              {t(catalog.hasUpdates ? 'catalogUpdates' : 'catalogRefreshView')}
            </Button>
          )}
        </div>
      )}
      <div className="web-discover-results grid gap-3" {...testAttr('book-candidate-list')}>
        {candidates.map((candidate) => (
          <CatalogCandidateCard
            key={candidate.catalogBookId}
            candidate={candidate}
            onSaved={(id) => {
              selectBook(id);
              flash.show({ message: t('bookAdded'), variant: 'success' });
              navigate('/book/library');
            }}
          />
        ))}
      </div>
      {search.hasNextPage && (
        <div ref={loadMore}>
          <Button
            variant="outline"
            loading={search.isFetchingNextPage}
            disabled={search.isFetchingNextPage}
            onClick={() => void search.fetchNextPage()}
            {...testAttr('book-candidate-load-more')}
          >
            {t('catalogMore')}
          </Button>
        </div>
      )}
      {first?.truncated && <p className="text-xs text-stone-500">{t('catalogTruncated')}</p>}
      {!search.hasNextPage && collection?.canExtend && collection.state === 'IDLE' && (
        <Button
          variant="outline"
          onClick={catalog.extend}
          disabled={search.isFetching || catalog.extending}
        >
          {t('catalogExtend')}
        </Button>
      )}
      {catalog.extendError && <p role="alert">{apiErrorMessage(catalog.extendError, t)}</p>}
      <ManualBookForm
        saving={manual.isPending}
        onSubmit={async (values) => {
          try {
            const book = await manual.mutateAsync(values);
            if (!currentSession()) return;
            selectBook(book.bookId);
            flash.show({ message: t('bookAdded'), variant: 'success' });
            navigate('/book/library');
          } catch (error) {
            if (currentSession())
              flash.show({ message: apiErrorMessage(error, t), variant: 'destructive' });
          }
        }}
      />
      {capabilities.data?.operator && (
        <Link
          className="text-sm text-stone-500 underline underline-offset-4"
          to="/book/catalog-operations"
        >
          {t('catalogOps')}
        </Link>
      )}
    </section>
  );
}
