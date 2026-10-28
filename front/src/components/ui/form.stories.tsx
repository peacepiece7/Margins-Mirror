import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { NoteForm } from '@/testing/storybook-form';
import { componentDocs } from '@/testing/storybook';
const meta = {
  title: 'Components/Forms/Form',
  component: NoteForm,
  parameters: componentDocs(
    'Form은 React Hook Form의 FormProvider alias입니다. 예제는 실제 Form/Input/ref 연결을 사용합니다.',
    '빈 값 검증, 수정, pending, saved, 실패 후 재시도.',
    'Label, aria-invalid, 설명 id와 오류 alert를 연결합니다.',
    'Form 자체는 레이아웃이나 validation 정책을 만들지 않습니다. useForm과 caller가 소유합니다.',
  ),
} satisfies Meta<typeof NoteForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Invalid: Story = { args: { initialInvalid: true } };
export const Save: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /저장하기|Save note/ }));
    await expect(canvas.getByRole('textbox', { name: /제목|Title/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await userEvent.type(canvas.getByRole('textbox', { name: /제목|Title/ }), 'Margins note');
    await userEvent.click(canvas.getByRole('button', { name: /저장하기|Save note/ }));
    await expect(canvas.getByRole('button', { name: /저장 중|Saving/ })).toBeDisabled();
    await expect(await canvas.findByRole('status')).toHaveTextContent('Margins note');
  },
};
export const Retry: Story = {
  args: { failFirst: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole('textbox', { name: /제목|Title/ });
    await userEvent.type(title, 'Preserved draft');
    await userEvent.click(canvas.getByRole('button', { name: /저장하기|Save note/ }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(/유지됩니다|kept/);
    await expect(title).toHaveValue('Preserved draft');
    await userEvent.click(canvas.getByRole('button', { name: /저장하기|Save note/ }));
    await expect(await canvas.findByRole('status')).toBeVisible();
  },
};
