import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './dialog';
import { Button } from './button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Overlays/Dialog',
  component: Dialog,
  parameters: componentDocs(
    '현재 문맥에서 상세 확인이나 편집을 제공합니다. 삭제 확인은 AlertDialog를 사용합니다.',
    '닫힘, 열림, 긴 제목/본문.',
    'title/description과 번역된 closeLabel을 제공합니다. Escape, focus trap과 trigger 복귀를 유지합니다.',
    '좌우 16px inset, 100dvh 안의 내부 scroll을 사용합니다.',
  ),
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;
function DialogExample(args: ComponentProps<typeof Dialog>) {
  const copy = useStoryCopy();
  return (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">{copy('상세 보기', 'View details')}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={copy('닫기', 'Close')}>
        <DialogHeader>
          <DialogTitle>{copy('기록 미리보기', 'Preview note')}</DialogTitle>
          <DialogDescription>
            {copy(
              '긴 내용도 화면 안에서 읽을 수 있습니다.',
              'Long content stays inside the viewport.',
            )}
          </DialogDescription>
        </DialogHeader>
        <p className="break-words leading-7">
          {copy(
            '공백없는긴제목과문장도안전하게줄바꿈합니다',
            'LongUnbrokenTitlesAndSentencesWrapSafely',
          ).repeat(15)}
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button>{copy('확인', 'Done')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export const Default: Story = { render: (args) => <DialogExample {...args} /> };
export const Open: Story = {
  ...Default,
  args: { defaultOpen: true },
  // The standard Docs iframe omits globals; pass locale explicitly to keep the example localized.
  render: (args, context) =>
    context.viewMode === 'docs' ? (
      <iframe
        data-ui="storybook-dialog-frame"
        title={context.globals.locale === 'en' ? 'Open dialog example' : '열린 Dialog 예제'}
        className="h-[520px] w-full border-0"
        src={`./iframe.html?id=${encodeURIComponent(context.id)}&viewMode=story&globals=locale:${context.globals.locale === 'en' ? 'en' : 'ko'}`}
      />
    ) : (
      <DialogExample {...args} />
    ),
};
export const Keyboard: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(body.queryByRole('dialog')).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  },
};
