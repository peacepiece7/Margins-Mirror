import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './checkbox';
import { Label } from './label';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Forms/Checkbox',
  component: Checkbox,
  parameters: componentDocs(
    '독립적인 boolean 선택에 사용합니다.',
    'unchecked, checked, indeterminate, disabled.',
    'Label 연결과 checked 의미를 제공합니다. Space로 선택합니다.',
    'onCheckedChange는 true/false/indeterminate를 반환합니다.',
  ),
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <div className="flex items-center gap-2">
        <Checkbox {...args} id={id} />
        <Label htmlFor={id}>{copy('나중에 다시 읽기', 'Read again later')}</Label>
      </div>
    );
  },
};
export const Checked: Story = { ...Default, args: { defaultChecked: true } };
export const Indeterminate: Story = { ...Default, args: { checked: 'indeterminate' } };
export const Disabled: Story = { ...Default, args: { disabled: true } };
