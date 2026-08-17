import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { CardForm } from './CardForm';
import { BulkImportForm } from './BulkImportForm';
import { GroupForm } from './GroupForm';
import type { MemoryCardBulkImportValues } from '../types';

const bulkLabels = {
  description: 'Import cards as JSON.',
  duplicateHandling: 'Duplicate handling',
  duplicateIgnore: 'Ignore',
  duplicateRemove: 'Remove',
  duplicateReplace: 'Replace',
  existingDuplicates: 'Existing duplicates',
  fileUpload: 'JSON file upload',
  limitNotice: 'Upload limit',
  requiredField: 'This field is required.',
  save: 'Save cards',
  templateDownload: 'Download template',
  title: 'Bulk import',
  validate: 'Validate JSON',
  validatedCards: 'Validated cards',
};

function BulkImportHarness({
  defaultValues,
  onSubmit,
}: {
  defaultValues: MemoryCardBulkImportValues;
  onSubmit: (values: MemoryCardBulkImportValues) => Promise<void>;
}) {
  const form = useForm<MemoryCardBulkImportValues>({ defaultValues });
  return (
    <I18nProvider>
      <BulkImportForm
        cardsCount={0}
        duplicateCount={0}
        form={form}
        labels={bulkLabels}
        loading={false}
        maxUploadSize={500}
        onDownloadTemplate={vi.fn()}
        onFileChange={vi.fn()}
        onSubmit={onSubmit}
        onValidate={async () => undefined}
        parsedUpload={undefined}
      />
    </I18nProvider>
  );
}

describe('extracted Memory Card forms', () => {
  afterEach(cleanup);

  it('blocks an empty group submit and associates the visible title error', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nProvider>
        <GroupForm
          initialValues={{ title: '', description: '', sourceLabel: '' }}
          loading={false}
          onSubmit={onSubmit}
          title="Create group"
        />
      </I18nProvider>,
    );
    const title = screen.getByLabelText('Group name');

    fireEvent.submit(title.closest('form')!);

    expect(await screen.findByText('This field is required.')).toHaveAttribute(
      'id',
      'memory-card-group-title-error',
    );
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAttribute('aria-describedby', 'memory-card-group-title-error');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks an empty card submit and reports both required fields', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nProvider>
        <CardForm
          editing={false}
          initialValues={{ frontText: '', backText: '', exampleText: '', memo: '' }}
          loading={false}
          onCancel={vi.fn()}
          onSubmit={onSubmit}
        />
      </I18nProvider>,
    );
    const front = screen.getByLabelText('English front');

    fireEvent.submit(front.closest('form')!);

    await waitFor(() => expect(screen.getAllByText('This field is required.')).toHaveLength(2));
    expect(front).toHaveAttribute('aria-invalid', 'true');
    expect(front).toHaveAttribute('aria-describedby', 'memory-card-frontText-error');
    expect(screen.getByLabelText(/^Meaning/)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits bulk imports through RHF and owns the submitting state', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(
      <BulkImportHarness
        defaultValues={{
          uploadText: '{"cards":[{"frontText":"wand","backText":"지팡이"}]}',
          duplicatePolicy: 'replace',
        }}
        onSubmit={onSubmit}
      />,
    );

    const form = screen.getByTestId('memory-card-bulk-form');
    fireEvent.submit(form);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('memory-card-upload-submit')).toBeDisabled();
    resolveSubmit();
    await waitFor(() => expect(screen.getByTestId('memory-card-upload-submit')).toBeEnabled());
  });

  it('blocks an empty bulk import with a visible RHF field error', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <BulkImportHarness
        defaultValues={{ uploadText: '', duplicatePolicy: 'replace' }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.submit(screen.getByTestId('memory-card-bulk-form'));

    expect(await screen.findByText('This field is required.')).toBeVisible();
    expect(screen.getByTestId('memory-card-upload-text')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('exposes labels for file, JSON, and duplicate-policy controls', () => {
    render(
      <BulkImportHarness
        defaultValues={{ uploadText: '{"cards":[]}', duplicatePolicy: 'ignore' }}
        onSubmit={async () => undefined}
      />,
    );

    expect(screen.getByLabelText('JSON file upload')).toBeInTheDocument();
    expect(screen.getByLabelText('Bulk import')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Duplicate handling' })).toBeInTheDocument();
  });
});
