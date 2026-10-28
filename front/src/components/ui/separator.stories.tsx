import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from './separator';

import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Content/Separator',
  component: Separator,
  parameters: componentDocs(
    '인접한 콘텐츠 사이를 시각적으로 구분합니다.',
    'horizontal/vertical, decorative.',
    '장식 구분선은 decorative를 유지합니다. 정보 관계는 heading으로 제공합니다.',
    'vertical separator의 높이는 caller가 지정합니다.',
  ),
} satisfies Meta<typeof Separator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <div className="grid gap-4">
        <p>{copy('기록', 'Notes')}</p>
        <Separator {...args} />
        <p>{copy('대화', 'Discussion')}</p>
      </div>
    );
  },
};
export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <div className="flex h-12 items-center gap-4">
        <span>{copy('기록', 'Notes')}</span>
        <Separator {...args} />
        <span>{copy('대화', 'Discussion')}</span>
      </div>
    );
  },
};
