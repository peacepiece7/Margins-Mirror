import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { BookBackground, BookKnowledge } from '@/types/api/book';
import { testAttr } from '@/utils/testAttrs';

export function BookKnowledgeStatus({
  background,
  backgroundError = false,
  backgroundPending = false,
  error,
  knowledge,
  onEdit,
  onRefresh,
  pending,
  refreshing,
}: {
  background?: BookBackground;
  backgroundError?: boolean;
  backgroundPending?: boolean;
  error: boolean;
  knowledge?: BookKnowledge;
  onEdit?: () => void;
  onRefresh: () => void;
  pending: boolean;
  refreshing: boolean;
}) {
  const { t } = useI18n();
  const hasPersonalSummary = Boolean(background?.summary);
  const summary =
    backgroundPending || backgroundError ? undefined : (background?.summary ?? knowledge?.summary);
  const needsRefresh = Boolean(knowledge?.stale || knowledge?.fallbackUsed);
  const busy = refreshing || Boolean(knowledge?.refreshPending);
  const state =
    backgroundPending || pending || busy
      ? t('bookKnowledgeLoading')
      : backgroundError
        ? t('bookBackgroundErrorState')
        : hasPersonalSummary
          ? t('bookBackgroundPersonal')
          : error && !knowledge
            ? t('bookBackgroundUnavailable')
            : needsRefresh
              ? t('bookKnowledgeNeedsRefresh')
              : t('bookKnowledgeFresh');
  return (
    <details
      aria-busy={backgroundPending || pending || busy}
      className="min-w-0 rounded border border-stone-200 bg-white p-4 ring-0"
      {...testAttr('book-knowledge-status')}
    >
      <summary className="min-h-11 cursor-pointer break-words text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
        {t('bookBackgroundTitle')}
        <span className="ml-2 text-xs font-normal text-stone-500">{state}</span>
      </summary>
      <div className="mt-3 grid min-w-0 gap-3">
        {backgroundError ? <p role="alert">{t('bookBackgroundLoadError')}</p> : null}
        {summary ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">
            {summary}
          </p>
        ) : null}
        {pending && !knowledge ? (
          <p className="text-sm text-stone-500">{t('bookKnowledgeLoading')}</p>
        ) : null}
        {error && !knowledge ? (
          <p className="text-sm text-stone-600">{t('bookKnowledgeErrorDescription')}</p>
        ) : null}
        {knowledge && (knowledge.stale || knowledge.fallbackUsed || knowledge.refreshPending) ? (
          <div className="flex flex-wrap gap-1">
            {knowledge.stale ? (
              <Badge variant="warning">{t('bookKnowledgeNeedsRefresh')}</Badge>
            ) : null}
            {knowledge.fallbackUsed ? (
              <Badge variant="warning">{t('bookKnowledgeFallback')}</Badge>
            ) : null}
            {knowledge.refreshPending ? (
              <Badge variant="info">{t('bookKnowledgeRefreshing')}</Badge>
            ) : null}
          </div>
        ) : null}
        {hasPersonalSummary ? (
          <p className="text-xs text-stone-500">{t('bookBackgroundProtected')}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {onEdit ? (
            <Button
              disabled={backgroundPending || backgroundError}
              onClick={onEdit}
              type="button"
              variant="outline"
            >
              {t('bookBackgroundEdit')}
            </Button>
          ) : null}
          <Button disabled={busy} onClick={onRefresh} type="button" variant="outline">
            {busy ? t('bookKnowledgeRefreshLoading') : t('bookKnowledgeRefresh')}
          </Button>
        </div>
      </div>
    </details>
  );
}
