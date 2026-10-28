import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './spinner';
import { SpinnerInline } from './spinner';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Feedback/Spinner',
  component: Spinner,
  parameters: componentDocs(
    '짧은 작업의 진행을 안내합니다. 내용의 구조가 있으면 Skeleton을 고려합니다.',
    'sm/md/lg, label 있는 status와 장식용 spinner.',
    '단독 진행 표시는 label을, inline은 읽을 수 있는 문구를 제공합니다.',
    'LoadingSpinner는 호환 wrapper입니다. 새 코드는 Spinner/SpinnerInline을 사용합니다.',
  ),
} satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return <Spinner {...args} label={copy('불러오는 중', 'Loading')} />;
  },
};
export const Sizes: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return (
      <div className="flex items-center gap-4">
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Spinner size={size} label={copy('불러오는 중', 'Loading') + ' ' + size} key={size} />
        ))}
      </div>
    );
  },
};
export const Inline: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return <SpinnerInline>{copy('내용을 불러오는 중', 'Loading content')}</SpinnerInline>;
  },
};
