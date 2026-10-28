import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup } from './radio-group';
import { RadioGroupItem } from './radio-group';
import { Label } from './label';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Forms/RadioGroup',
  component: RadioGroup,
  parameters: componentDocs(
    '여러 선택지 중 하나만 고릅니다.',
    '선택, disabled, horizontal/vertical.',
    '그룹 이름과 각 선택지 Label을 제공하고 arrow key로 이동합니다.',
    '독립 boolean 선택은 Checkbox를 사용합니다.',
  ),
} satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: 'private' },
  render: function Example(args) {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <RadioGroup {...args} aria-label={copy('공개 범위', 'Visibility')}>
        {['private', 'public'].map((value, index) => (
          <div className="flex items-center gap-2" key={value}>
            <RadioGroupItem value={value} id={`${id}-${value}`} />
            <Label htmlFor={`${id}-${value}`}>
              {index === 0 ? copy('비공개', 'Private') : copy('공개', 'Public')}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  },
};
export const Disabled: Story = { ...Default, args: { defaultValue: 'private', disabled: true } };
