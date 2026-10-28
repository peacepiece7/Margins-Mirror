import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './label';
import { Input } from './input';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Forms/Label',
  component: Label,
  parameters: componentDocs(
    '입력의 목적을 설명하며 클릭하면 연결한 입력에 focus를 줍니다.',
    '일반, 필수 안내.',
    'htmlFor는 정확한 input id와 일치해야 합니다.',
    'placeholder를 Label 대신 사용하지 않습니다.',
  ),
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <div className="grid max-w-md gap-2">
        <Label htmlFor={id}>{copy('제목 (필수)', 'Title (required)')}</Label>
        <Input id={id} required />
      </div>
    );
  },
};
