import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AiProcessingNotice } from './ai-processing-notice';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Integrations/AiProcessingNotice',
  component: AiProcessingNotice,
  parameters: componentDocs(
    'AI 실행 전에 전송 목적과 개인정보 안내 링크를 표시합니다.',
    '일반 안내, 현재 view 닫기, 7일 opt-out.',
    'privacy link, checkbox와 번역된 닫기 버튼을 제공합니다.',
    '예제는 margins.storybook.ai-notice cookie만 사용하며 story 전환 시 초기화합니다. 실제 AI는 실행하지 않습니다.',
  ),
} satisfies Meta<typeof AiProcessingNotice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: { action: '' },
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <AiProcessingNotice {...args} action={copy('질문 생성 시', 'When generating a question,')} />
    );
  },
};
export const Dismissible: Story = {
  ...Default,
  args: { action: '', storageKey: 'margins.storybook.ai-notice', dismissDays: 7 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox'));
    await userEvent.click(canvas.getByRole('button', { name: /닫기|Dismiss/ }));
    await expect(canvas.queryByRole('note')).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.cookie).toContain('margins.storybook.ai-notice');
  },
};
