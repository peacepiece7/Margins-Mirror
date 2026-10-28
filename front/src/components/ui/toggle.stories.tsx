import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toggle } from './toggle';

import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Actions/Toggle',
  component: Toggle,
  parameters: componentDocs(
    '한 가지 모드를 켜거나 끕니다. 제출 동작에는 Button을 사용합니다.',
    'pressed, unpressed, disabled; default/outline와 size.',
    'aria-pressed와 accessible name을 제공합니다.',
    '선택 상태를 색상만으로 설명하지 않습니다.',
  ),
} satisfies Meta<typeof Toggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return <Toggle {...args}>{copy('인용 표시', 'Show quotations')}</Toggle>;
  },
};
export const Pressed: Story = { ...Default, args: { defaultPressed: true } };
export const Disabled: Story = { ...Default, args: { disabled: true } };
export const Outline: Story = { ...Default, args: { variant: 'outline' } };
