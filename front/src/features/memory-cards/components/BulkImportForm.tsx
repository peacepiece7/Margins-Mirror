import type { ChangeEvent } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { MemoryCardDuplicatePolicy } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

import {
  memoryCardDuplicatePolicies,
  type MemoryCardBulkImportValues,
  type ParsedMemoryCardUpload,
} from '../types';

interface BulkImportFormProps {
  cardsCount: number;
  duplicateCount: number;
  form: UseFormReturn<MemoryCardBulkImportValues>;
  labels: {
    description: string;
    duplicateHandling: string;
    duplicateIgnore: string;
    duplicateRemove: string;
    duplicateReplace: string;
    existingDuplicates: string;
    fileUpload: string;
    limitNotice: string;
    requiredField: string;
    save: string;
    templateDownload: string;
    title: string;
    validate: string;
    validatedCards: string;
  };
  loading: boolean;
  maxUploadSize: number;
  onDownloadTemplate: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (values: MemoryCardBulkImportValues) => Promise<void>;
  onValidate: () => Promise<void>;
  parsedUpload: ParsedMemoryCardUpload | undefined;
}

export function BulkImportForm({
  cardsCount,
  duplicateCount,
  form,
  labels,
  loading,
  maxUploadSize,
  onDownloadTemplate,
  onFileChange,
  onSubmit,
  onValidate,
  parsedUpload,
}: BulkImportFormProps) {
  const duplicatePolicy = form.watch('duplicatePolicy');
  const uploadError = form.formState.errors.uploadText?.message;
  const duplicatePolicyLabels: Record<MemoryCardDuplicatePolicy, string> = {
    replace: labels.duplicateReplace,
    remove: labels.duplicateRemove,
    ignore: labels.duplicateIgnore,
  };

  return (
    <form
      className="grid gap-3 rounded border border-stone-300 bg-white p-4"
      onSubmit={form.handleSubmit(onSubmit)}
      {...testAttr('memory-card-bulk-form')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{labels.title}</h3>
          <p className="mt-1 text-sm text-stone-600">{labels.description}</p>
        </div>
        <Button
          className="min-h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:border-stone-900"
          onClick={onDownloadTemplate}
          type="button"
          {...testAttr('memory-card-template-download')}
        >
          {labels.templateDownload}
        </Button>
      </div>
      <Label className="sr-only" htmlFor="memory-card-upload-file">
        {labels.fileUpload}
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
        {labels.title}
      </Label>
      <Textarea
        aria-describedby={uploadError ? 'memory-card-upload-text-error' : undefined}
        aria-invalid={Boolean(uploadError)}
        className="min-h-44 w-full resize-y rounded border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-sm"
        id="memory-card-upload-text"
        {...form.register('uploadText', { required: labels.requiredField })}
        {...testAttr('memory-card-upload-text')}
      />
      {uploadError && (
        <Alert id="memory-card-upload-text-error" variant="destructive">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}
      {cardsCount > maxUploadSize && (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          {...testAttr('memory-card-upload-limit-notice')}
        >
          {labels.limitNotice}
        </p>
      )}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{labels.duplicateHandling}</legend>
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
            {labels.validatedCards} {parsedUpload.cards.length}, {labels.existingDuplicates}{' '}
            {duplicateCount}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium"
          onClick={() => void onValidate()}
          type="button"
        >
          {labels.validate}
        </Button>
        <Button
          className="min-h-11 rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={loading || form.formState.isSubmitting}
          loading={loading || form.formState.isSubmitting}
          type="submit"
          {...testAttr('memory-card-upload-submit')}
        >
          {labels.save}
        </Button>
      </div>
    </form>
  );
}
