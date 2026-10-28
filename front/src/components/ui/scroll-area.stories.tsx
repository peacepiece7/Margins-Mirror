import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from './scroll-area';
import { Separator } from './separator';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Content/ScrollArea',
  component: ScrollArea,
  parameters: componentDocs(
    '의도적으로 제한한 콘텐츠 영역을 스크롤합니다.',
    '긴 목록, 고정 높이.',
    '접근성 이름과 keyboard focus가 가능한 viewport를 제공합니다.',
    '일반 페이지 전체의 가로 넘침을 숨기는 용도로 사용하지 않습니다.',
  ),
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <ScrollArea {...args} className="h-60 max-w-md rounded border">
        <div className="space-y-3 p-4">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i}>
              <p>
                {copy('독서 기록', 'Reading note')} {i + 1}
              </p>
              <Separator className="mt-3" />
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  },
};
