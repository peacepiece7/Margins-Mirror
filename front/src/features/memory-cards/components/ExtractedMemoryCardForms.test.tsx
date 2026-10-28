import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider, useI18n } from '@/lib/i18n';

import { CardForm } from './CardForm';
import { BulkImportForm } from './BulkImportForm';
import { GroupForm } from './GroupForm';
import type { MemoryCardBulkImportValues } from '../types';

function LocaleSwitch() {
  const { setLocale } = useI18n();
  return <button onClick={() => setLocale('ko')}>Switch locale</button>;
}

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
      <LocaleSwitch />
      <BulkImportForm
        cardsCount={0}
        duplicateCount={0}
        form={form}
        loading={false}
        onFileChange={vi.fn()}
        onSubmit={onSubmit}
        onValidate={async () => undefined}
        parsedUpload={undefined}
      />
    </I18nProvider>
  );
}

describe('extracted Memory Card forms', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('relocalizes bulk controls without clearing the JSON draft or duplicate policy', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <BulkImportHarness
        defaultValues={{ uploadText: '{"cards":[]}', duplicatePolicy: 'replace' }}
        onSubmit={onSubmit}
      />,
    );
    const draft = '{"cards":[{"frontText":"cloak","backText":"망토"}]}';
    fireEvent.change(screen.getByTestId('memory-card-upload-text'), { target: { value: draft } });
    fireEvent.click(screen.getByLabelText('Remove upload duplicates'));
    fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }));

    expect(screen.getByLabelText('JSON 파일 업로드')).toBeVisible();
    expect(screen.getByLabelText('JSON 카드 일괄 등록')).toHaveValue(draft);
    expect(screen.getByLabelText('업로드 중복 제거')).toBeChecked();
    expect(screen.getByRole('group', { name: '중복 처리' })).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByTestId('memory-card-bulk-form'));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { uploadText: draft, duplicatePolicy: 'remove' },
        expect.anything(),
      ),
    );
  });

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
    expect(screen.getByLabelText('Bulk add JSON cards')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Duplicate handling' })).toBeInTheDocument();
  });

  it('preserves a card draft on same-entity refresh and resets it for a different key', () => {
    const props = {
      editing: true,
      loading: false,
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      initialValues: { frontText: 'wand', backText: '지팡이' },
    };
    const view = render(
      <I18nProvider>
        <CardForm key="7:11" {...props} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('English front'), { target: { value: 'my draft' } });
    view.rerender(
      <I18nProvider>
        <CardForm
          key="7:11"
          {...props}
          initialValues={{ frontText: 'server update', backText: '새 의미' }}
        />
      </I18nProvider>,
    );
    expect(screen.getByLabelText('English front')).toHaveValue('my draft');
    view.rerender(
      <I18nProvider>
        <CardForm key="7:12" {...props} initialValues={{ frontText: 'cloak', backText: '망토' }} />
      </I18nProvider>,
    );
    expect(screen.getByLabelText('English front')).toHaveValue('cloak');
  });

  it('does not replace an edited group title on background refresh', () => {
    const props = {
      loading: false,
      title: 'Edit group',
      onSubmit: vi.fn(),
      initialValues: { title: 'Fantasy', description: '', sourceLabel: '' },
    };
    const view = render(
      <I18nProvider>
        <GroupForm key="7" {...props} />
      </I18nProvider>,
    );
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'my title' } });
    view.rerender(
      <I18nProvider>
        <GroupForm
          key="7"
          {...props}
          initialValues={{ ...props.initialValues, title: 'server title' }}
        />
      </I18nProvider>,
    );
    expect(screen.getByLabelText('Group name')).toHaveValue('my title');
  });
});
