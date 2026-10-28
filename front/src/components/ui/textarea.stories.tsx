import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './textarea';
import { Label } from './label';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Forms/Textarea',
  component: Textarea,
  parameters: componentDocs(
    '여러 줄의 생각이나 기록을 입력합니다.',
    '기본, disabled, invalid, 긴 내용.',
    'Label과 오류 설명을 id로 연결합니다.',
    'form 상태와 내용 길이 제한은 caller가 결정합니다.',
  ),
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <div className="grid max-w-md gap-2">
        <Label htmlFor={id}>{copy('독서 메모', 'Reading note')}</Label>
        <Textarea
          {...args}
          id={id}
          aria-describedby={`${id}-hint`}
          placeholder={copy('어떤 생각이 들었나요?', 'What came to mind?')}
        />
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {copy('입력한 내용은 예제 안에서만 유지됩니다.', 'Your text stays in this example only.')}
        </p>
      </div>
    );
  },
};
export const Disabled: Story = { ...Default, args: { disabled: true } };
export const Invalid: Story = { ...Default, args: { 'aria-invalid': true } };
export const LongContent: Story = {
  ...Default,
  args: {
    defaultValue: '긴 문장과 URL도 입력할 수 있습니다. https://example.com/reading/'.repeat(5),
  },
};
