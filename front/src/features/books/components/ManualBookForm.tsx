import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

export function ManualBookForm({
  saving,
  onSubmit,
}: {
  saving: boolean;
  onSubmit: (values: { title: string; author: string }) => Promise<void> | void;
}) {
  const { t } = useI18n();
  const form = useForm<{ title: string; author: string }>({
    defaultValues: { title: '', author: '' },
  });
  const title = useWatch({ control: form.control, name: 'title', defaultValue: '' });
  const author = useWatch({ control: form.control, name: 'author', defaultValue: '' });

  return (
    <Card className="rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_18px_50px_rgba(23,23,23,0.06)] ring-0 sm:p-5">
      <CardContent className="p-0">
        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit({ title: values.title.trim(), author: values.author.trim() });
          })}
          {...testAttr('manual-book-form')}
        >
          <div>
            <h3 className="font-semibold">{t('candidateEmptyTitle')}</h3>
            <p className="text-sm text-stone-600">{t('candidateEmptyDescription')}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              aria-describedby={form.formState.errors.title ? 'manual-book-title-error' : undefined}
              aria-invalid={Boolean(form.formState.errors.title)}
              placeholder={t('searchPlaceholder')}
              required
              {...form.register('title', { required: t('requiredField') })}
              {...testAttr('manual-book-title-input')}
            />
            {form.formState.errors.title?.message && (
              <p className="text-xs leading-5 text-red-700" id="manual-book-title-error">
                {form.formState.errors.title.message}
              </p>
            )}
            <Input
              aria-describedby={
                form.formState.errors.author ? 'manual-book-author-error' : undefined
              }
              aria-invalid={Boolean(form.formState.errors.author)}
              placeholder={t('bookAuthorPlaceholder')}
              required
              {...form.register('author', { required: t('requiredField') })}
              {...testAttr('manual-book-author-input')}
            />
            {form.formState.errors.author?.message && (
              <p className="text-xs leading-5 text-red-700" id="manual-book-author-error">
                {form.formState.errors.author.message}
              </p>
            )}
            <Button
              disabled={saving || !title.trim() || !author.trim()}
              loading={saving || form.formState.isSubmitting}
              type="submit"
              {...testAttr('manual-book-submit')}
            >
              {t('manualAdd')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
