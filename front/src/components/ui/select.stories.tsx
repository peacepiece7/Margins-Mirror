import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Label } from './label';
import { componentDocs, useStoryCopy } from '@/testing/storybook';

const meta = {
  title: 'Components/Forms/Select',
  component: Select,
  parameters: componentDocs(
    '후보에서 하나를 선택합니다. 브라우저 기본 UI를 사용하려면 NativeSelect를 고려합니다.',
    'placeholder, selected, disabled.',
    'Label과 SelectTrigger를 연결하고 arrow key/Enter/Escape를 확인합니다.',
    'SelectContent는 portal로 렌더링됩니다. value와 domain mapping은 caller 소유입니다.',
  ),
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  args: { defaultValue: 'reading' },
  render: function Example(args) {
    const copy = useStoryCopy();
    const id = useId();
    return (
      <div className="grid max-w-md gap-2">
        <Label htmlFor={id}>{copy('독서 상태', 'Reading status')}</Label>
        <Select {...args}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={copy('선택해 주세요', 'Choose a status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="want_to_read">{copy('읽을 예정', 'Want to read')}</SelectItem>
            <SelectItem value="reading">{copy('읽는 중', 'Reading')}</SelectItem>
            <SelectItem value="read">{copy('완독', 'Finished')}</SelectItem>
            <SelectItem value="dnf">{copy('중단', 'Did not finish')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  },
};
export const Placeholder: Story = { ...Default, args: { defaultValue: undefined } };
export const Disabled: Story = { ...Default, args: { disabled: true } };
export const Keyboard: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('combobox');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('option', { name: /완독|Finished/ }));
    await expect(trigger).toHaveTextContent(/완독|Finished/);
    await expect(trigger).toHaveFocus();
  },
};
