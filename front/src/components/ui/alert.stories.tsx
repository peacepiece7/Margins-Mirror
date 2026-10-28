import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
const meta = {
  title: 'Components/Feedback/Alert',
  component: Alert,
  parameters: componentDocs(
    '현재 문맥의 안내와 작업 결과를 표시합니다. route를 넘어 유지할 피드백은 FlashAlert를 사용합니다.',
    'default/info/success/warning/destructive, 긴 내용.',
    '긴급 오류는 alert, 일반 성공은 status 등 목적에 맞는 role을 caller가 지정합니다.',
    '메시지는 caller가 번역합니다. 상태 색상은 semantic token을 사용합니다.',
  ),
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function Example(args) {
    const copy = useStoryCopy();
    return (
      <Alert {...args}>
        <AlertTitle>{copy('다시 시도해 주세요', 'Please try again')}</AlertTitle>
        <AlertDescription>
          {copy(
            '요청을 처리하지 못했습니다. 입력 내용은 유지됩니다.',
            'The request could not be completed. Your input has been kept.',
          )}
        </AlertDescription>
      </Alert>
    );
  },
};
export const Variants: Story = {
  render: function Example() {
    const copy = useStoryCopy();
    return (
      <div className="grid gap-4">
        {(['default', 'info', 'success', 'warning', 'destructive'] as const).map((variant) => (
          <Alert
            key={variant}
            variant={variant}
            role={variant === 'destructive' ? 'alert' : 'status'}
          >
            <AlertTitle>{variant}</AlertTitle>
            <AlertDescription>
              {copy(
                '상태를 색상과 문구로 함께 전달합니다.',
                'Convey the state with both color and text.',
              )}
            </AlertDescription>
          </Alert>
        ))}
      </div>
    );
  },
};
export const LongContent: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Long URL</AlertTitle>
      <AlertDescription>{'https://example.com/' + 'unbroken-content-'.repeat(20)}</AlertDescription>
    </Alert>
  ),
};
