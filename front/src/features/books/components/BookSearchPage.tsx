import { Card, CardContent } from '@/components/ui/card';
import { SpinnerInline } from '@/components/ui/spinner';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { BookSearchPageProps } from '../panel-types';
import { AppliedSearchChips } from './AppliedSearchChips';
import { BookSearchForm } from './BookSearchForm';
import { BookSearchResults } from './BookSearchResults';
import { ManualBookForm } from './ManualBookForm';

export function BookSearchPage({
  candidateHasMore,
  candidateTotalItems,
  candidates,
  error,
  loadMoreRef,
  loading,
  loadingMore,
  query,
  saving,
  onClear,
  onManualSubmit,
  onRetry,
  onSaveCandidate,
  onSearch,
}: BookSearchPageProps) {
  const { t } = useI18n();
  return (
    <section className="grid gap-5" {...testAttr('book-search-page')}>
      <Card className="rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.06)] ring-0 sm:p-5">
        <CardContent className="p-0">
          <h2 className="font-display text-3xl font-semibold tracking-normal">
            {t('searchHeading')}
          </h2>
          <BookSearchForm activeQuery={query} loading={loading} onSearch={onSearch} />
          <div className="mt-3">
            <AppliedSearchChips onClear={onClear} query={query} />
          </div>
        </CardContent>
      </Card>
      <BookSearchResults
        candidates={candidates}
        error={error}
        loading={loading}
        onRetry={onRetry}
        onSave={onSaveCandidate}
        query={query}
        saving={saving}
      />
      {(candidates.length > 0 || loadingMore) && (
        <div
          className="flex min-h-10 items-center justify-center text-sm text-stone-500"
          ref={loadMoreRef}
          {...testAttr('book-candidate-load-more')}
        >
          {loadingMore && <SpinnerInline>{t('loadingSearch')}</SpinnerInline>}
          {!loadingMore && !candidateHasMore && candidateTotalItems !== undefined && (
            <span>
              {candidateTotalItems} {t('searchResults')}
            </span>
          )}
        </div>
      )}
      <ManualBookForm onSubmit={onManualSubmit} saving={saving} />
    </section>
  );
}
