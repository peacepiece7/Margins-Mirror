import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './skeleton';
import { SpinnerInline } from './spinner';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Feedback/Skeleton',
  component: Skeleton,
  parameters: componentDocs(
    '곧 표시될 콘텐츠의 구조를 미리 보여줍니다.',
    '문단/카드 구조와 reduced motion.',
    'skeleton은 aria-hidden이며 별도 loading 문구와 aria-busy를 제공합니다.',
    'legacy-skeleton은 호환 wrapper입니다. 새 composition은 현재 Skeleton을 사용합니다.',
  ),
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return (
      <div className="max-w-md space-y-3" aria-busy="true">
        <SpinnerInline>{copy('기록을 불러오는 중', 'Loading notes')}</SpinnerInline>
        <Skeleton aria-hidden="true" className="h-5 w-3/4" />
        <Skeleton aria-hidden="true" className="h-4 w-full" />
        <Skeleton aria-hidden="true" className="h-4 w-1/2" />
      </div>
    );
  },
};
