import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import type { MemoryCardInput } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

export function CardForm({
  editing,
  initialValues,
  loading,
  onCancel,
  onSubmit,
}: {
  editing: boolean;
  initialValues: MemoryCardInput;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: MemoryCardInput) => Promise<void>;
}) {
  const { t } = useI18n();
  const form = useForm<MemoryCardInput>({ defaultValues: initialValues });
  const frontText = useWatch({ control: form.control, name: 'frontText', defaultValue: '' });
  const backText = useWatch({ control: form.control, name: 'backText', defaultValue: '' });
  useEffect(() => {
    form.reset(initialValues);
    // Primitive values intentionally define authoritative route-bound defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form,
    initialValues.backText,
    initialValues.exampleText,
    initialValues.frontText,
    initialValues.memo,
  ]);
  return (
    <form
      className="grid gap-3 rounded border border-stone-300 bg-white p-4"
      onSubmit={form.handleSubmit(onSubmit)}
      {...testAttr('memory-card-card-form')}
    >
      <h3 className="text-lg font-semibold">
        {editing ? t('memoryCardCardEdit') : t('memoryCardCardAdd')}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ['frontText', t('memoryCardFront'), true],
            ['backText', t('memoryCardMeaning'), true],
            ['exampleText', t('memoryCardExample'), false],
            ['memo', t('memoryCardMemo'), false],
          ] as const
        ).map(([name, label, required]) => {
          const inputId = `memory-card-${name}`;
          return (
            <div className="grid gap-1 text-sm font-medium" key={name}>
              <label htmlFor={inputId}>{label}</label>
              <Input
                aria-describedby={
                  form.formState.errors[name] ? `memory-card-${name}-error` : undefined
                }
                aria-invalid={Boolean(form.formState.errors[name])}
                id={inputId}
                required={required}
                {...form.register(name, { required: required ? t('requiredField') : false })}
              />
              {form.formState.errors[name]?.message && (
                <span className="text-xs leading-5 text-red-700" id={`memory-card-${name}-error`}>
                  {form.formState.errors[name]?.message}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={loading || !frontText.trim() || !backText.trim()}
          loading={loading || form.formState.isSubmitting}
          type="submit"
        >
          {editing ? t('edit') : t('memoryCardAdd')}
        </Button>
        {editing && (
          <Button onClick={onCancel} type="button" variant="outline">
            {t('memoryCardCancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
