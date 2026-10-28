import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ConfirmExample } from '@/testing/storybook-confirm';
import { componentDocs } from '@/testing/storybook';

const meta = {
  title: 'Components/Overlays/ConfirmActionDialog',
  component: ConfirmActionDialog,
  render: (args) => <ConfirmExample labels={args} />,
  argTypes: {
    open: { control: false },
    onConfirm: { control: false },
    onOpenChange: { control: false },
  },
  parameters: componentDocs(
    '삭제 전에 확인하고 비동기 작업을 한 번 실행합니다.',
    '취소, pending, 성공, 실패 후 재시도.',
    '취소/focus return과 pending의 disabled 상태를 유지합니다.',
    '실패 시 dialog를 유지합니다. 오류 메시지는 caller가 description으로 제공합니다. Controls에서 title/description과 label을 바꿀 수 있습니다. 빈 값은 locale 기본 예시를 사용합니다. open/onConfirm/onOpenChange는 로컬 caller가 소유합니다.',
  ),
} satisfies Meta<typeof ConfirmActionDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
// Required API props are supplied by the executable caller example.
export const Default: Story = {
  args: {
    open: false,
    title: '',
    description: '',
    cancelLabel: '',
    confirmLabel: '',
    onConfirm: () => {},
    onOpenChange: () => {},
  },
};
export const Retry: Story = {
  ...Default,
  render: (args) => <ConfirmExample labels={args} failFirst />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement),
      body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: /삭제 확인 열기|Confirm deletion/ });
    await userEvent.click(trigger);
    await userEvent.click(body.getByRole('button', { name: /취소|Cancel/ }));
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(body.getByRole('button', { name: /삭제하기|^Delete$/ }));
    await expect(body.getByRole('button', { name: /삭제 중|Deleting/ })).toBeDisabled();
    await expect(await body.findByText(/삭제하지 못했습니다|Deletion failed/)).toBeVisible();
    await expect(body.getByRole('alertdialog')).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: /삭제하기|^Delete$/ }));
    await expect(await canvas.findByRole('status')).toHaveTextContent(/삭제했습니다|deleted/);
    await expect(trigger).toHaveFocus();
  },
};
