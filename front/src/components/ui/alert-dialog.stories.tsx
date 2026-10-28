import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from './alert-dialog';
import { Button } from './button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Overlays/AlertDialog',
  component: AlertDialog,
  parameters: componentDocs(
    '진행 전에 중요한 결정을 확인합니다. 비동기 삭제에는 ConfirmActionDialog를 사용합니다.',
    '닫힘, 열림, 취소/확인.',
    'title/description, cancel의 초기 focus, 닫은 뒤 focus 복귀를 확인합니다.',
    '비동기 처리는 primitive 자체가 소유하지 않습니다. pending/error는 caller 또는 ConfirmActionDialog로 처리합니다.',
  ),
} satisfies Meta<typeof AlertDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <AlertDialog {...args}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">{copy('삭제 확인 열기', 'Confirm deletion')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {copy('예시 기록을 삭제할까요?', 'Delete this example note?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {copy(
                '실제 독서 기록에는 영향을 주지 않습니다.',
                'Your real reading records are not affected.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy('취소', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive">{copy('삭제', 'Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
};
export const Keyboard: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('alertdialog')).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: /취소|Cancel/ }));
    await expect(trigger).toHaveFocus();
  },
};
