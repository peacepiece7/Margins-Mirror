import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';
import { Label } from './label';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Forms/Input',
  component: Input,
  parameters: componentDocs(
    '단일 행 텍스트 입력입니다. 선택 상태는 Checkbox/RadioGroup을 사용합니다.',
    '기본, disabled, readOnly, invalid, 긴 안내, compact 날짜 입력.',
    'Label htmlFor, input id, aria-describedby와 aria-invalid를 연결합니다.',
    '값·검증·오류 문구는 caller 소유입니다. checkbox 타입으로 우회하지 않습니다.',
  ),
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <div className="grid max-w-md gap-2">
        <Label htmlFor={id}>{copy('제목', 'Title')}</Label>
        <Input
          {...args}
          id={id}
          aria-describedby={`${id}-hint`}
          placeholder={copy('기억하고 싶은 한 문장', 'A sentence to remember')}
        />
        <p
          id={`${id}-hint`}
          className={
            args['aria-invalid'] ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
          }
        >
          {args['aria-invalid']
            ? copy('제목을 입력해 주세요.', 'Enter a title.')
            : copy(
                '책을 다시 펼칠 때 떠올릴 수 있는 제목이면 좋아요.',
                'Choose a title that brings this reading back to mind.',
              )}
        </p>
      </div>
    );
  },
};
export const Disabled: Story = { ...Default, args: { disabled: true, defaultValue: 'Margins' } };
export const ReadOnly: Story = { ...Default, args: { readOnly: true, defaultValue: 'Margins' } };
export const Invalid: Story = { ...Default, args: { 'aria-invalid': true } };
export const Date: Story = {
  ...Default,
  args: { type: 'date', className: 'text-sm', defaultValue: '2026-01-01' },
};
