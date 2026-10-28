import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToggleGroup } from './toggle-group';
import { ToggleGroupItem } from './toggle-group';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Actions/ToggleGroup',
  component: ToggleGroup,
  parameters: componentDocs(
    '관련된 표시 모드를 선택합니다.',
    'single/multiple, 선택, disabled, spacing=0 결합형.',
    '그룹 이름과 item 이름, Radix keyboard 계약을 유지합니다.',
    '기본 spacing=1은 4px입니다. 명시적 spacing=0은 결합형입니다.',
  ),
} satisfies Meta<typeof ToggleGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: 'single', defaultValue: 'list' },
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <ToggleGroup {...args} aria-label={copy('표시 방식', 'Display mode')}>
        <ToggleGroupItem value="list">{copy('목록', 'List')}</ToggleGroupItem>
        <ToggleGroupItem value="grid">{copy('격자', 'Grid')}</ToggleGroupItem>
      </ToggleGroup>
    );
  },
};
export const Joined: Story = {
  ...Default,
  args: { type: 'single', defaultValue: 'list', spacing: 0, variant: 'outline' },
};
export const Disabled: Story = { ...Default, args: { type: 'single', disabled: true } };
export const Multiple: Story = {
  ...Default,
  args: { type: 'multiple', defaultValue: ['list', 'grid'] },
};
