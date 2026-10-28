import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { useI18n } from '@/lib/i18n';
import type { SaveBookResponse } from '@/types/api/book';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

import { BookListPage } from './BookListPage';
import type { BookShelfSort, BookReadingStatus } from '../types';

function LibraryControlsExample({ loading = false }: { loading?: boolean }) {
  const copy = useStoryCopy();
  const { t } = useI18n();
  const [books, setBooks] = useState<SaveBookResponse[]>([
    {
      bookId: 401,
      title: copy(
        '여백 없는 아주 긴 도서관 제목도 좁은 화면에서 확인하기',
        'A deliberately long library title for narrow screens',
      ),
      author: copy('긴 이름의 예제 작가', 'An Author With a Longer Name'),
      readingStatus: 'reading',
      rating: 4,
    },
    {
      bookId: 402,
      title: copy('유리 정원', 'The Glass Garden'),
      author: copy('예제 작가', 'Example Author'),
      readingStatus: 'want_to_read',
    },
  ]);
  const [sort, setSort] = useState<BookShelfSort>('recent');
  const [pendingDelete, setPendingDelete] = useState<SaveBookResponse>();
  const [removed, setRemoved] = useState(false);

  const statusLabel = (status: BookReadingStatus) =>
    t(
      (
        {
          want_to_read: 'shelfStatusWantToRead',
          reading: 'shelfStatusReading',
          read: 'shelfStatusRead',
          dnf: 'shelfStatusDnf',
        } as const
      )[status],
    );

  return (
    <MemoryRouter>
      <section className="grid gap-4">
        <BookListPage
          books={books}
          loading={loading}
          onDelete={(book) => setPendingDelete(book)}
          onRatingChange={() => {}}
          onSelect={() => {}}
          onSortChange={setSort}
          onStatusChange={(bookId, readingStatus) =>
            setBooks((current) =>
              current.map((book) => (book.bookId === bookId ? { ...book, readingStatus } : book)),
            )
          }
          sort={sort}
        />
        {removed && (
          <p className="rounded bg-muted p-3" role="status">
            {copy('삭제 완료', 'Book removed')}
          </p>
        )}
        <ConfirmActionDialog
          cancelLabel={t('cancel')}
          confirmLabel={t('delete')}
          description={t('deleteConfirm')}
          loadingLabel={t('editorLoading')}
          onConfirm={() => {
            if (pendingDelete) {
              setBooks((current) => current.filter((book) => book.bookId !== pendingDelete.bookId));
              setRemoved(true);
            }
            setPendingDelete(undefined);
          }}
          onOpenChange={(open: boolean) => {
            if (!open) setPendingDelete(undefined);
          }}
          open={Boolean(pendingDelete)}
          title={t('delete')}
        />
      </section>
    </MemoryRouter>
  );
}

const meta = {
  title: 'Patterns/Books/LibraryControls',
  component: LibraryControlsExample,
  parameters: componentDocs(
    '도서관 목록의 정렬, 읽기 상태, 삭제 동작을 실제 BookListPage와 확인 대화상자로 보여줍니다.',
    '긴 한국어/영어 책 제목, native 정렬, 항목별 읽기 상태, 삭제 취소와 확정.',
    '각 select는 접근 가능한 이름과 고유 식별자를 유지하고, 정렬 화살표와 삭제 위험 상태를 분명히 구분합니다.',
    '예제는 React state만 사용하며 실제 저장소 API를 호출하지 않습니다.',
  ),
} satisfies Meta<typeof LibraryControlsExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { loading: true },
};

export const Interactions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const sort = canvas.getByTestId('book-shelf-sort');

    sort.focus();
    await expect(sort).toHaveFocus();
    await userEvent.selectOptions(sort, 'title_asc');
    await expect(sort).toHaveValue('title_asc');

    const status = canvas.getByTestId('saved-book-status-401');
    await userEvent.click(status);
    await userEvent.click(await body.findByRole('option', { name: /^읽음$|^Read$/ }));
    await expect(status).toHaveTextContent(/읽음|Read/);

    const deleteButton = canvas.getAllByTestId('saved-book-delete')[0];

    await userEvent.click(deleteButton);
    const cancelDialog = await body.findByRole('alertdialog');
    await userEvent.click(within(cancelDialog).getByRole('button', { name: /취소|Cancel/ }));
    await expect(cancelDialog).not.toBeInTheDocument();
    await expect(deleteButton).toHaveFocus();

    await userEvent.click(deleteButton);
    const confirmDialog = await body.findByRole('alertdialog');
    await userEvent.click(within(confirmDialog).getByRole('button', { name: /삭제|Delete/ }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/삭제 완료|Book removed/);
  },
};
