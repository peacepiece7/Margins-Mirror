import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/legacy-skeleton';
import type { BookKnowledge } from '@/types/api/book';
import { testAttr } from '@/utils/testAttrs';

export function BookKnowledgeStatus({
  error,
  knowledge,
  onRefresh,
  pending,
  refreshing,
}: {
  error: boolean;
  knowledge?: BookKnowledge;
  onRefresh: () => void;
  pending: boolean;
  refreshing: boolean;
}) {
  const { t } = useI18n();

  if (pending && !knowledge) {
    return (
      <Card
        aria-busy="true"
        aria-label={t('bookKnowledgeLoading')}
        className="rounded border border-stone-200 bg-white p-4 ring-0"
        {...testAttr('book-knowledge-status')}
      >
        <CardContent className="grid gap-3 p-0">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !knowledge) {
    return (
      <Alert
        aria-live="polite"
        className="grid gap-3 rounded border border-amber-300 bg-amber-50 p-4"
        variant="warning"
        {...testAttr('book-knowledge-status')}
      >
        <div>
          <AlertTitle>{t('bookKnowledgeErrorTitle')}</AlertTitle>
          <AlertDescription className="mt-1">{t('bookKnowledgeErrorDescription')}</AlertDescription>
        </div>
        <Button
          className="min-h-11 w-full sm:w-fit"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
          variant="outline"
        >
          {refreshing ? t('bookKnowledgeRefreshLoading') : t('bookKnowledgeRefresh')}
        </Button>
      </Alert>
    );
  }

  if (!knowledge) return null;

  const needsRefresh = Boolean(knowledge.stale || knowledge.fallbackUsed);
  return (
    <Card
      aria-busy={refreshing || Boolean(knowledge.refreshPending)}
      aria-live="polite"
      className="rounded border border-stone-200 bg-white p-4 ring-0"
      {...testAttr('book-knowledge-status')}
    >
      <CardContent className="grid gap-3 p-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-stone-500">BOOK KNOWLEDGE</p>
            <h3 className="mt-1 font-semibold">{t('bookKnowledgeTitle')}</h3>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            <Badge variant="outline">{knowledge.version}</Badge>
            {knowledge.refreshPending ? (
              <Badge variant="info">{t('bookKnowledgeRefreshing')}</Badge>
            ) : null}
            {knowledge.stale ? (
              <Badge variant="warning">{t('bookKnowledgeNeedsRefresh')}</Badge>
            ) : null}
            {knowledge.fallbackUsed ? (
              <Badge variant="warning">{t('bookKnowledgeFallback')}</Badge>
            ) : null}
            {!needsRefresh && !knowledge.refreshPending ? (
              <Badge variant="success">{t('bookKnowledgeFresh')}</Badge>
            ) : null}
          </div>
        </div>
        {knowledge.summary ? (
          <p className="break-words text-sm leading-6 text-stone-600">{knowledge.summary}</p>
        ) : null}
        {needsRefresh ? (
          <div className="flex flex-col gap-3 rounded bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-stone-700">{t('bookKnowledgeStaleDescription')}</p>
            <Button
              className="min-h-11 shrink-0"
              disabled={refreshing || Boolean(knowledge.refreshPending)}
              onClick={onRefresh}
              type="button"
              variant="outline"
            >
              {refreshing || knowledge.refreshPending
                ? t('bookKnowledgeRefreshing')
                : t('bookKnowledgeRefreshNow')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
