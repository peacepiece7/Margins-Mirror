import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Navigation/Tabs',
  component: Tabs,
  parameters: componentDocs(
    '같은 문맥의 내용을 전환합니다. 다른 route 이동은 링크를 사용합니다.',
    '선택, disabled trigger, keyboard navigation.',
    'tablist 이름과 tabpanel 관계를 유지합니다. 화살표 키로 선택과 focus가 이동합니다.',
    '기본 trigger 간격은 4px입니다. route 상태를 별도 store에 복제하지 않습니다.',
  ),
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: { defaultValue: 'notes' },
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <Tabs {...args}>
        <TabsList aria-label={copy('기록 보기', 'Reading views')}>
          <TabsTrigger value="notes">{copy('기록', 'Notes')}</TabsTrigger>
          <TabsTrigger value="discussion">{copy('대화', 'Discussion')}</TabsTrigger>
          <TabsTrigger value="unavailable" disabled>
            {copy('준비 중', 'Coming soon')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          {copy('책에서 발견한 생각을 기록합니다.', 'Record a thought from the book.')}
        </TabsContent>
        <TabsContent value="discussion">
          {copy('다양한 관점으로 생각을 나눕니다.', 'Explore different perspectives.')}
        </TabsContent>
      </Tabs>
    );
  },
};
export const Keyboard: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    tabs[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
      /다양한 관점|different perspectives/,
    );
  },
};
