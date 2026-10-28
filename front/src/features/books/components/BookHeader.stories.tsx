import { useId, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BookHeader } from './BookHeader';
import { BookStatusSelect } from './BookStatusSelect';
import { BookRatingInput } from './BookRatingInput';
import type { BookReadingStatus } from '../types';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

function BookExample({
  cover = true,
  longTitle = false,
}: {
  cover?: boolean;
  longTitle?: boolean;
}) {
  const copy = useStoryCopy();
  const { t } = useI18n();
  const statusId = useId();
  const [status, setStatus] = useState<BookReadingStatus>('reading');
  const [rating, setRating] = useState<number | undefined>(3.5);
  const statusLabel = (value: BookReadingStatus) =>
    t(
      (
        {
          want_to_read: 'shelfStatusWantToRead',
          reading: 'shelfStatusReading',
          read: 'shelfStatusRead',
          dnf: 'shelfStatusDnf',
        } as const
      )[value],
    );
  const title = longTitle
    ? copy(
        '공백없는아주긴책제목을작은화면에서도읽을수있도록',
        'AVeryLongUnbrokenBookTitleThatRemainsReadableInANarrowViewport',
      ).repeat(4)
    : copy('여백의 발견', 'Discovering the margins');
  return (
    <MemoryRouter>
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">
          {copy('책 정보와 독서 상태', 'Book and reading state')}
        </h1>
        <BookHeader
          book={{
            bookId: 1,
            title,
            author: copy('예제 작가', 'Example author'),
            readingStatus: status,
            rating,
            coverImageUrl: cover
              ? new URL('../../../assets/storybook-cover.svg', import.meta.url).href
              : undefined,
          }}
        />
        <Card>
          <CardContent className="space-y-4">
            <BookStatusSelect
              id={`book-pattern-status-${statusId}`}
              name="readingStatus-example"
              status={status}
              statusLabel={statusLabel}
              onChange={setStatus}
            />
            <BookRatingInput rating={rating} onChange={setRating} />
            <p role="status">
              {statusLabel(status)} · {rating ?? copy('별점 없음', 'Not rated')}
            </p>
          </CardContent>
        </Card>
      </section>
    </MemoryRouter>
  );
}
const meta = {
  title: 'Patterns/Books',
  component: BookExample,
  parameters: componentDocs(
    '기존 books feature의 BookHeader/BookStatusSelect/BookRatingInput을 그대로 조합합니다.',
    '표지 있음/없음, 긴 제목, want_to_read/reading/read/dnf, 0.5단위 별점/초기화.',
    '책 제목은 실제 route link이며 선택 control은 이름과 keyboard 의미를 유지합니다.',
    'domain component는 feature 안에 둡니다. 예제의 변경은 React state뿐이며 실제 shelf API를 호출하지 않습니다.',
  ),
} satisfies Meta<typeof BookExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const NoCover: Story = { args: { cover: false } };
export const LongTitle: Story = { args: { longTitle: true } };
export const Selection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '4.5 stars' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('4.5');
    await userEvent.click(canvas.getByRole('button', { name: /별점 지우기|Clear rating/ }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/별점 없음|Not rated/);
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('option', {
        name: /^읽음$|^Read$/,
      }),
    );
    await expect(canvas.getByRole('status')).toHaveTextContent(/읽음|Read/);
  },
};
