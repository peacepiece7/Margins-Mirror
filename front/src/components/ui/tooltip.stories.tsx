import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Search } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip';
import { Button } from './button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Overlays/Tooltip',
  component: Tooltip,
  parameters: componentDocs(
    '짧은 보조 설명에 사용합니다. 필수 설명은 화면에 직접 표시합니다.',
    '닫힘, hover/focus 열림.',
    'trigger 자체의 accessible name을 유지합니다. keyboard focus에서도 설명을 제공합니다.',
    'TooltipProvider는 root에 하나만 둡니다. touch 사용자가 tooltip 없이도 행동을 이해할 수 있어야 합니다.',
  ),
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <Tooltip {...args} delayDuration={0}>
        <TooltipTrigger asChild>
          <Button aria-label={copy('검색', 'Search')} size="icon">
            <Search aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {copy('책 제목이나 저자로 검색합니다.', 'Search by book title or author.')}
        </TooltipContent>
      </Tooltip>
    );
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');
    await userEvent.tab();
    trigger.focus();
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole('tooltip'),
    ).toBeVisible();
    await userEvent.keyboard('{Escape}');
  },
};
