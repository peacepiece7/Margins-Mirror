import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

export type GroupFormValues = { title: string; description: string; sourceLabel: string };

export function GroupForm({
  initialValues,
  loading,
  onSubmit,
  title,
}: {
  initialValues: GroupFormValues;
  loading: boolean;
  onSubmit: (values: GroupFormValues) => Promise<void>;
  title: string;
}) {
  const { t } = useI18n();
  const form = useForm({ defaultValues: initialValues });
  const groupTitle = useWatch({ control: form.control, name: 'title', defaultValue: '' });
  useEffect(() => {
    form.reset(initialValues);
    // Primitive values intentionally define authoritative route-bound defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, initialValues.description, initialValues.sourceLabel, initialValues.title]);
  return (
    <form
      className="grid content-start gap-3 rounded border border-stone-300 bg-white p-4"
      onSubmit={form.handleSubmit(onSubmit)}
      {...testAttr('memory-card-group-form')}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-1 text-sm font-medium">
        <label htmlFor="memory-card-group-title">{t('memoryCardGroupName')}</label>
        <Input
          aria-describedby={
            form.formState.errors.title ? 'memory-card-group-title-error' : undefined
          }
          aria-invalid={Boolean(form.formState.errors.title)}
          id="memory-card-group-title"
          maxLength={255}
          required
          {...form.register('title', { required: t('requiredField') })}
        />
        {form.formState.errors.title?.message && (
          <span className="text-xs leading-5 text-red-700" id="memory-card-group-title-error">
            {form.formState.errors.title.message}
          </span>
        )}
      </div>
      <label className="grid gap-1 text-sm font-medium">
        {t('memoryCardDescription')}
        <Textarea className="min-h-24" maxLength={1000} {...form.register('description')} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t('memoryCardSource')}
        <Input maxLength={255} {...form.register('sourceLabel')} />
      </label>
      <Button
        disabled={loading || !groupTitle.trim()}
        loading={loading || form.formState.isSubmitting}
        type="submit"
      >
        {t('memoryCardSave')}
      </Button>
    </form>
  );
}
