import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { FlashAlertProvider, useFlashAlert } from './flash-alert';
import { Button } from './button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Feedback/FlashAlert',
  component: FlashAlertProvider,
  args: { children: null },
  parameters: componentDocs(
    '작업 결과를 route 이동과 무관하게 표시합니다. application root의 provider를 사용합니다.',
    'info/success/warning/destructive, 교체, 닫기, 자동 닫기.',
    'aria-live 안내와 번역된 닫기 버튼을 제공합니다.',
    '이 예제는 preview root provider를 사용합니다. durationMs=0이면 자동 닫기를 사용하지 않습니다.',
  ),
} satisfies Meta<typeof FlashAlertProvider>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    const { show } = useFlashAlert();
    return (
      <div className="flex flex-wrap gap-2">
        {(['info', 'success', 'warning', 'destructive'] as const).map((variant) => (
          <Button
            key={variant}
            onClick={() =>
              show({
                variant,
                message: copy(
                  '입력한 기록을 보존했습니다.',
                  'Your reading note has been preserved.',
                ),
                title: variant,
                durationMs: 0,
              })
            }
          >
            {variant}
          </Button>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'success' }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText(/입력한 기록을 보존|Your reading note has been/),
    ).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: /닫기|Close/ }));
    await expect(
      body.queryByText(/입력한 기록을 보존|Your reading note has been/),
    ).not.toBeInTheDocument();
  },
};
