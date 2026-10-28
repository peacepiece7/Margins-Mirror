import { useCallback, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TurnstileWidget } from './turnstile-widget';
import { Button } from './button';
import { useI18n } from '@/lib/i18n';
import { componentDocs, useStoryCopy } from '@/testing/storybook';
function TurnstileExample() {
  const { locale } = useI18n();
  const copy = useStoryCopy();
  const exampleRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | undefined>();
  const onTokenChange = useCallback((value: string | undefined) => setToken(value), []);
  return (
    <div ref={exampleRef} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {copy(
          '외부 인증을 수행하지 않는 SDK 대역입니다.',
          'A local SDK fixture, not real verification.',
        )}
      </p>
      <TurnstileWidget locale={locale} onTokenChange={onTokenChange} resetSignal={0} />
      <div className="flex flex-wrap gap-2">
        {(['ready', 'expired', 'error'] as const).map((state) => (
          <Button
            key={state}
            onClick={() =>
              exampleRef.current?.dispatchEvent(
                new CustomEvent('storybook:turnstile', { detail: state, bubbles: true }),
              )
            }
          >
            {state}
          </Button>
        ))}
      </div>
      <p role="status">
        {token
          ? copy('예제 인증 완료', 'Example verified')
          : copy('예제 토큰 없음', 'No example token')}
      </p>
    </div>
  );
}
const meta = {
  title: 'Components/Integrations/TurnstileWidget',
  component: TurnstileExample,
  parameters: componentDocs(
    '앱의 실제 widget lifecycle을 로컬 SDK 대역으로 관찰합니다.',
    'loading → ready, expired, error, 재설정.',
    '변경된 안내는 aria-live로 전달됩니다.',
    '실제 인증 검증의 증거가 아닙니다. Storybook은 public fixture key만 사용하고 SDK network script를 로드하지 않습니다.',
  ),
} satisfies Meta<typeof TurnstileExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Lifecycle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'ready' }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/인증 완료|verified/);
    await userEvent.click(canvas.getByRole('button', { name: 'expired' }));
    await expect(canvas.getByRole('status')).toHaveTextContent(/토큰 없음|No example token/);
    await userEvent.click(canvas.getByRole('button', { name: 'error' }));
    await expect(canvas.getByText(/확인을 불러오지|check could not load/i)).toBeVisible();
  },
};
