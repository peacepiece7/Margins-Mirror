import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownContent } from './markdown-content';

import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Content/MarkdownContent',
  component: MarkdownContent,
  parameters: componentDocs(
    '저장된 독서 기록과 AI 문장을 프로젝트 소유 renderer로 표시합니다.',
    'heading/quote/list/link/code, line breaks, legacy HTML.',
    '문서 순서를 유지하고 링크 이름을 제공합니다.',
    '임의 HTML renderer가 아닙니다. 허용하지 않는 URL protocol은 링크로 만들지 않습니다.',
  ),
} satisfies Meta<typeof MarkdownContent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <MarkdownContent
        {...args}
        value={
          args.value ||
          copy(
            '## 오래 남은 질문\n\n**주장**과 근거를 함께 남깁니다.\n\n> 우리는 무엇을 기억할까요?\n\n- 한 문장\n- 다음 질문\n\n[사용 가이드](https://example.com/guide)\n\n`reading`',
            '## A lasting question\n\nKeep a **claim** with its evidence.\n\n> What do we remember?\n\n- One sentence\n- The next question\n\n[Guide](https://example.com/guide)\n\n`reading`',
          )
        }
      />
    );
  },
  args: { value: '' },
};
export const LongContent: Story = {
  ...Default,
  args: { value: 'https://example.com/' + 'long-unbroken-reading-path-'.repeat(18) },
};
export const PreserveLineBreaks: Story = {
  ...Default,
  args: { preserveLineBreaks: true, value: '첫 번째 문장\nSecond sentence' },
};
