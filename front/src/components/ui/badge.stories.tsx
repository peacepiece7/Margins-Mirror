import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';

import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Content/Badge',
  component: Badge,
  parameters: componentDocs(
    '짧은 상태를 텍스트로 표시합니다. 작업 실행에는 Button을 사용합니다.',
    '모든 semantic variant, 링크 composition.',
    '의미를 텍스트와 함께 표시합니다.',
    'Badge의 asChild는 하나의 element만 받습니다.',
  ),
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return <Badge {...args}>{copy('초안', 'Draft')}</Badge>;
  },
};
export const Variants: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return (
      <div className="flex flex-wrap gap-2">
        {(
          [
            'default',
            'secondary',
            'destructive',
            'outline',
            'success',
            'warning',
            'info',
            'ghost',
            'link',
          ] as const
        ).map((variant) => (
          <Badge variant={variant} key={variant}>
            {variant} · {copy('상태', 'Status')}
          </Badge>
        ))}
      </div>
    );
  },
};
