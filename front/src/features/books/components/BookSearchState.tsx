import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/legacy-skeleton';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

export function BookSearchState({
  state,
  onRetry,
}: {
  state: 'idle' | 'pending' | 'error' | 'empty';
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  if (state === 'idle') return null;
  if (state === 'pending') {
    return (
      <>
        {[0, 1, 2].map((item) => (
          <Card
            className="rounded border border-stone-300 bg-white p-4 ring-0"
            key={item}
            {...testAttr('book-candidate-skeleton')}
          >
            <CardContent className="grid gap-2 p-0">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </>
    );
  }
  if (state === 'error') {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-3">
          {t('requestFailed')}
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            {t('publicReviewRetry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Card
      className="rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_12px_36px_rgba(23,23,23,0.05)] ring-0"
      tone="muted"
    >
      <CardContent className="p-0">{t('candidateEmptyTitle')}</CardContent>
    </Card>
  );
}
