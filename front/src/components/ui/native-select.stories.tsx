import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NativeSelect } from './native-select';
import { Label } from './label';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Forms/NativeSelect',
  component: NativeSelect,
  parameters: componentDocs(
    '브라우저 기본 선택 UI를 유지해야 할 때 사용합니다. 일반 앱 선택은 Select와 비교합니다.',
    '기본, 선택, disabled.',
    'native keyboard와 Label 연결을 유지합니다.',
    'options와 controlled value는 caller가 제공합니다.',
  ),
} satisfies Meta<typeof NativeSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <div className="grid max-w-md gap-2">
        <Label htmlFor={id}>{copy('독서 상태', 'Reading status')}</Label>
        <NativeSelect {...args} id={id}>
          <option value="reading">{copy('읽는 중', 'Reading')}</option>
          <option value="read">{copy('완독', 'Finished')}</option>
        </NativeSelect>
      </div>
    );
  },
};
export const Disabled: Story = { ...Default, args: { disabled: true } };
