import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { bookKeys } from '@/lib/query-keys';
import { booksApi } from '../api';

const sourceLabels: Record<string, TranslationKey> = {
  READY: 'catalogReady',
  MISSING_KEY: 'catalogMissingKey',
  REVIEW_REQUIRED: 'catalogReviewRequired',
  ACTIVE: 'catalogReady',
  PAUSED: 'catalogPaused',
  DISABLED: 'catalogDisabled',
  REVOKED: 'catalogRevoked',
  ALLOWED: 'catalogAllowed',
  UNREVIEWED: 'catalogUnreviewed',
  DENIED: 'catalogUnreviewed',
};
export function CatalogOperationsPanel() {
  const { t } = useI18n();
  const client = useQueryClient();
  const [withdrawId, setWithdrawId] = useState<number>();
  const form = useForm<{ coverId: number }>();
  const capabilities = useQuery({
    queryKey: bookKeys.catalogCapabilities(),
    queryFn: ({ signal }) => booksApi.catalogCapabilities(signal),
  });
  const operations = useQuery({
    queryKey: bookKeys.catalogOperations(),
    queryFn: ({ signal }) => booksApi.catalogOperations(signal),
    enabled: capabilities.data?.operator === true,
    refetchInterval: 30_000,
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'PAUSE' | 'RESUME' }) =>
      booksApi.catalogSource(id, action),
    onSuccess: () => client.invalidateQueries({ queryKey: bookKeys.catalogOperations() }),
  });
  const withdraw = useMutation({
    mutationFn: booksApi.catalogWithdraw,
    onSuccess: () => {
      form.reset();
      return client.invalidateQueries({ queryKey: bookKeys.catalogOperations() });
    },
  });
  if (capabilities.isError) return <p role="alert">{apiErrorMessage(capabilities.error, t)}</p>;
  if (capabilities.data && !capabilities.data.operator)
    return <p role="alert">{t('requestForbidden')}</p>;
  const data = operations.data;
  return (
    <section className="mx-auto grid w-full max-w-4xl gap-5 p-4 sm:p-6">
      <Link to="/book/discover" className="text-sm underline underline-offset-4">
        {t('searchHeading')}
      </Link>
      <header>
        <h1 className="font-display text-3xl">{t('catalogOps')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('catalogOpsHint')}</p>
      </header>
      {(capabilities.isLoading || operations.isLoading) && (
        <p role="status">{t('loadingSearch')}</p>
      )}
      {operations.isError && <p role="alert">{apiErrorMessage(operations.error, t)}</p>}
      {action.isError && <p role="alert">{apiErrorMessage(action.error, t)}</p>}
      {data && (
        <>
          <Card className="rounded border border-stone-300 p-4 ring-0">
            <CardContent className="grid gap-2 p-0">
              <h2 className="font-semibold">{t('catalogStorage')}</h2>
              <p>
                {(data.usedBytes / 1e9).toFixed(3)} / {(data.limitBytes / 1e9).toFixed(0)} GB ·{' '}
                {data.coverCount.toLocaleString()} {t('catalogCoverCount')}
              </p>
              <progress
                aria-label={t('catalogStorage')}
                className="h-3 w-full accent-stone-700"
                value={data.usedBytes}
                max={data.limitBytes}
              />
              {(data.usedBytes / data.limitBytes) * 100 >= data.warningPercent && (
                <p role="status" className="text-sm text-warning-ink">
                  {t('catalogStorageWarning')}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-3">
            <h2 className="font-semibold">{t('catalogSources')}</h2>
            {data.sources.map((source) => (
              <Card key={source.id} className="rounded border border-stone-300 p-4 ring-0">
                <CardContent className="grid gap-3 p-0 sm:grid-cols-[1fr_auto]">
                  <div className="grid gap-1 text-sm">
                    <h3 className="font-semibold">
                      {source.label}{' '}
                      <span className="text-xs font-normal text-stone-500">
                        {source.adapterType}
                      </span>
                    </h3>
                    <p>
                      {t('catalogState')}: {t(sourceLabels[source.state] ?? 'catalogDisabled')} ·{' '}
                      {t(sourceLabels[source.readiness] ?? 'catalogReviewRequired')}
                    </p>
                    <p>
                      {t('catalogRequests')}: {source.requestsToday} / {source.dailyLimit}
                    </p>
                    <p>
                      {t('catalogCoverPolicy')}:{' '}
                      {t(sourceLabels[source.coverPolicy] ?? 'catalogUnreviewed')}
                    </p>
                    <a
                      href={source.policyReference}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline underline-offset-4"
                    >
                      {t('catalogPolicy')}
                    </a>
                  </div>
                  <Button
                    variant="outline"
                    disabled={
                      action.isPending || source.readiness !== 'READY' || source.state === 'REVOKED'
                    }
                    onClick={() =>
                      action.mutate({
                        id: source.id,
                        action: source.state === 'ACTIVE' ? 'PAUSE' : 'RESUME',
                      })
                    }
                  >
                    {t(source.state === 'ACTIVE' ? 'catalogPause' : 'catalogResume')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-2">
            <h2 className="font-semibold">{t('catalogJobs')}</h2>
            {!data.jobs.length && <p className="text-sm text-stone-500">{t('catalogNoJobs')}</p>}
            <ul className="grid gap-2">
              {data.jobs.map((job) => (
                <li key={job.id} className="rounded border border-stone-200 p-3 text-xs">
                  #{job.id} · {job.source} · {job.kind} · {job.state} · {job.attempts}/3
                  {job.errorCode && <span className="ml-2 text-destructive">{job.errorCode}</span>}
                </li>
              ))}
            </ul>
          </div>
          <form
            className="grid gap-2 rounded border border-destructive/20 p-4"
            onSubmit={form.handleSubmit(({ coverId }) => setWithdrawId(coverId))}
          >
            <h2 className="font-semibold">{t('catalogWithdraw')}</h2>
            <p className="text-sm">{t('catalogWithdrawHint')}</p>
            <label className="grid gap-1 text-sm">
              {t('catalogCoverId')}
              <Input
                type="number"
                min="1"
                required
                {...form.register('coverId', {
                  required: true,
                  min: 1,
                  valueAsNumber: true,
                  validate: Number.isSafeInteger,
                })}
              />
            </label>
            <Button variant="outline" type="submit" disabled={withdraw.isPending}>
              {t('catalogWithdraw')}
            </Button>
            {withdraw.isError && <p role="alert">{apiErrorMessage(withdraw.error, t)}</p>}
          </form>
        </>
      )}
      <AlertDialog
        open={withdrawId !== undefined}
        onOpenChange={(open) => {
          if (!open) setWithdrawId(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('catalogConfirmWithdraw')}</AlertDialogTitle>
            <AlertDialogDescription>{t('catalogWithdrawHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('catalogCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (withdrawId) withdraw.mutate(withdrawId);
              }}
            >
              {t('catalogWithdraw')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
