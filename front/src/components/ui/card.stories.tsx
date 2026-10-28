import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './card';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
import { Button } from './button';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Content/Card',
  component: Card,
  parameters: componentDocs(
    '관련된 정보와 행동을 묶습니다. 전체 카드를 버튼처럼 사용하지 않습니다.',
    'default/muted/success/warning/danger, default/sm.',
    '필요한 heading/section 의미는 caller가 구성합니다.',
    '기본 안쪽 간격 16px, sm 12px입니다. domain widget을 Card 자체에 넣지 않습니다.',
  ),
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <Card {...args} className="max-w-lg">
        <CardHeader>
          <CardTitle>{copy('여백에 남긴 생각', 'Thoughts in the margins')}</CardTitle>
          <CardDescription>
            {copy(
              '한 문장에서 시작하는 독서 기록',
              'A reading record that starts with one sentence',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            {copy(
              '책에서 발견한 질문을 다음 독서로 이어갑니다.',
              'Carry a question from this book into your next reading.',
            )}
          </p>
        </CardContent>
        <CardFooter>
          <Button>{copy('기록 보기', 'View notes')}</Button>
        </CardFooter>
      </Card>
    );
  },
};
export const Small: Story = { ...Default, args: { size: 'sm' } };
export const Tones: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {(['default', 'muted', 'success', 'warning', 'danger'] as const).map((tone) => (
          <Card tone={tone} key={tone}>
            <CardContent>
              {tone} · {copy('같은 내용, 다른 의미', 'Same content, different meaning')}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  },
};
