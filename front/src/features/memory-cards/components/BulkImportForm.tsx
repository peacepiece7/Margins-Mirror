import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { memoryCardDuplicatePolicies, type MemoryCardWorkspace } from '../types';
import { downloadTemplate, interpolate, MAX_MEMORY_CARD_UPLOAD_SIZE } from '../utils';

export function BulkImportForm({
  cardsCount,
  duplicateCount,
  form,
  loading,
  onFileChange,
  onSubmit,
  onValidate,
  parsedUpload,
}: NonNullable<MemoryCardWorkspace['detail']>['bulkImport']) {
  const { t } = useI18n();
  const duplicatePolicy = form.watch('duplicatePolicy');
  const uploadError = form.formState.errors.uploadText?.message;
  const duplicatePolicyLabels = {
    replace: t('memoryCardDuplicateReplace'),
    remove: t('memoryCardDuplicateRemove'),
    ignore: t('memoryCardDuplicateIgnore'),
  };

  return (
    <form
      className="grid gap-3 rounded border border-stone-300 bg-white p-4"
      onSubmit={form.handleSubmit(onSubmit)}
      {...testAttr('memory-card-bulk-form')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t('memoryCardBulkTitle')}</h3>
          <p className="mt-1 text-sm text-stone-600">{t('memoryCardBulkDescription')}</p>
        </div>
        <Button
          className="min-h-11 px-3 py-2"
          onClick={downloadTemplate}
          type="button"
          variant="outline"
          {...testAttr('memory-card-template-download')}
        >
          {t('memoryCardTemplateDownload')}
        </Button>
      </div>
      <Label className="sr-only" htmlFor="memory-card-upload-file">
        {t('memoryCardFileUpload')}
      </Label>
      <Input
        accept="application/json,.json"
        className="min-h-11 text-sm"
        id="memory-card-upload-file"
        onChange={onFileChange}
        type="file"
        {...testAttr('memory-card-upload-file')}
      />
      <Label className="sr-only" htmlFor="memory-card-upload-text">
        {t('memoryCardBulkTitle')}
      </Label>
      <Textarea
        aria-describedby={uploadError ? 'memory-card-upload-text-error' : undefined}
        aria-invalid={Boolean(uploadError)}
        className="min-h-44 w-full resize-y rounded border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-sm"
        id="memory-card-upload-text"
        {...form.register('uploadText', { required: t('requiredField') })}
        {...testAttr('memory-card-upload-text')}
      />
      {uploadError && (
        <Alert id="memory-card-upload-text-error" variant="destructive">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}
      {cardsCount > MAX_MEMORY_CARD_UPLOAD_SIZE && (
        <p
          className="rounded border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-ink"
          {...testAttr('memory-card-upload-limit-notice')}
        >
          {interpolate(t('memoryCardPrefillLimitNotice'), {
            count: cardsCount,
            limit: MAX_MEMORY_CARD_UPLOAD_SIZE,
          })}
        </p>
      )}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t('memoryCardDuplicateHandling')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {memoryCardDuplicatePolicies.map((policy) => (
            <label
              className={`flex min-h-11 items-center gap-2 rounded border px-3 py-2 text-sm ${
                duplicatePolicy === policy
                  ? 'border-stone-900 bg-stone-100'
                  : 'border-stone-300 bg-white'
              }`}
              key={policy}
            >
              <Input type="radio" value={policy} {...form.register('duplicatePolicy')} />
              {duplicatePolicyLabels[policy]}
            </label>
          ))}
        </div>
        {parsedUpload && (
          <p className="break-words text-sm text-stone-600">
            {t('memoryCardValidatedCards')} {parsedUpload.cards.length},{' '}
            {t('memoryCardExistingDuplicates')} {duplicateCount}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 px-3 py-2"
          onClick={() => void onValidate()}
          type="button"
          variant="outline"
        >
          {t('memoryCardJsonValidate')}
        </Button>
        <Button
          className="min-h-11 px-3 py-2"
          disabled={loading || form.formState.isSubmitting}
          loading={loading || form.formState.isSubmitting}
          type="submit"
          variant="default"
          {...testAttr('memory-card-upload-submit')}
        >
          {t('memoryCardSave')}
        </Button>
      </div>
    </form>
  );
}
