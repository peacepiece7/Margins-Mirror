import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import type { BookBackground } from '@/types/api/book';
import { testAttr } from '@/utils/testAttrs';
import { bookPath } from '../routes';
import {
  useBookBackgroundQuery,
  useBookKnowledgeQuery,
  useUpdateBookBackgroundMutation,
} from '../queries';

export function BookBackgroundEditor({ bookId }: { bookId: number }) {
  const { t } = useI18n();
  const background = useBookBackgroundQuery(bookId);
  const knowledge = useBookKnowledgeQuery(bookId);
  if (background.isPending || (!background.data?.summary && knowledge.isPending))
    return <p role="status">{t('bookKnowledgeLoading')}</p>;
  if (!background.data)
    return (
      <div role="alert">
        <p>{t('bookBackgroundLoadError')}</p>
        <Button onClick={() => void background.refetch()}>{t('libraryRetry')}</Button>
      </div>
    );
  return (
    <BackgroundForm
      key={bookId}
      background={background.data}
      bookId={bookId}
      aiSummary={knowledge.data?.summary ?? ''}
    />
  );
}

function BackgroundForm({
  background,
  bookId,
  aiSummary,
}: {
  background: BookBackground;
  bookId: number;
  aiSummary: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(() => background.summary ?? aiSummary);
  const [revision] = useState(background.revision);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const save = useUpdateBookBackgroundMutation(bookId);
  const back = () => navigate(bookPath('book-detail', { bookId }));
  const persist = (value: string | null) =>
    save.mutate({ summary: value, expectedRevision: revision }, { onSuccess: back });
  return (
    <section
      className="grid min-w-0 gap-4 rounded border bg-white p-4 sm:p-5"
      {...testAttr('book-background-editor')}
    >
      <h2 className="text-xl font-semibold">{t('bookBackgroundEdit')}</h2>
      <p className="text-sm text-stone-600">{t('bookBackgroundEditorHelp')}</p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (summary.trim() && summary.length <= 10000 && !save.isPending) persist(summary);
        }}
      >
        <label className="grid gap-2">
          <span>{t('bookBackgroundTitle')}</span>
          <Textarea
            className="min-h-64 resize-y"
            disabled={save.isPending}
            maxLength={10000}
            onChange={(event) => setSummary(event.target.value)}
            value={summary}
            {...testAttr('book-background-summary-input')}
          />
        </label>
        <p className="text-xs text-stone-500">{summary.length.toLocaleString()} / 10,000</p>
        {save.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t('bookBackgroundSaveError')}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={save.isPending || !summary.trim() || summary.length > 10000}
            type="submit"
          >
            {save.isPending ? t('bookBackgroundSaving') : t('saveEdit')}
          </Button>
          <Button disabled={save.isPending} onClick={back} type="button" variant="outline">
            {t('cancel')}
          </Button>
          {background.summary !== null ? (
            <Button
              disabled={save.isPending}
              onClick={() => setRestoreOpen(true)}
              type="button"
              variant="outline"
            >
              {t('bookBackgroundRestore')}
            </Button>
          ) : null}
        </div>
      </form>
      <details>
        <summary className="min-h-11 cursor-pointer text-sm">
          {t('bookBackgroundAiOriginal')}
        </summary>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-600">
          {aiSummary || t('bookBackgroundUnavailable')}
        </p>
      </details>
      <ConfirmActionDialog
        cancelLabel={t('cancel')}
        confirmLabel={t('bookBackgroundRestore')}
        description={t(save.isError ? 'bookBackgroundSaveError' : 'bookBackgroundRestoreHelp')}
        loadingLabel={t('bookBackgroundSaving')}
        onConfirm={async () => {
          await save.mutateAsync({ summary: null, expectedRevision: revision });
          back();
        }}
        onOpenChange={setRestoreOpen}
        open={restoreOpen}
        title={t('bookBackgroundRestoreConfirm')}
      />
    </section>
  );
}
