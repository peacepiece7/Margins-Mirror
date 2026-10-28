import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { expect, it } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import type { AuthFormValues } from './components/auth-form';
import { useRegistration } from './use-registration';

it('keeps the CAPTCHA callback stable when its token state changes', () => {
  const { result } = renderHook(
    () => {
      const form = useForm<AuthFormValues>({
        defaultValues: { email: 'reader@example.com', emailVerificationCode: '' },
      });
      return useRegistration(form, 'register');
    },
    { wrapper: I18nProvider },
  );
  const onTokenChange = result.current.onBotChallengeTokenChange;
  act(() => onTokenChange('one-time-token'));
  expect(result.current.botChallengeToken).toBe('one-time-token');
  expect(result.current.onBotChallengeTokenChange).toBe(onTokenChange);
  act(() => onTokenChange(undefined));
  expect(result.current.botChallengeToken).toBeUndefined();
  expect(result.current.onBotChallengeTokenChange).toBe(onTokenChange);
});
