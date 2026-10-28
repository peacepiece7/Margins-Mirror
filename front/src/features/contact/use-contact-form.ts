import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { isTurnstileConfigured } from '@/components/ui/turnstile-widget';
import { apiErrorTranslationKey } from '@/lib/api-error-i18n';
import { ApiRequestError } from '@/lib/api-client';
import { readAuthSession } from '@/lib/auth-session';
import type { ContactCategory } from '@/types/api/contact';

import { contactApi } from './api';
import type { ContactFeedback, ContactFormValues } from './types';

export function useContactForm() {
  const form = useForm<ContactFormValues>({
    defaultValues: { email: '', category: '', subject: '', message: '' },
  });
  const { getValues, setValue, reset } = form;
  const emailEdited = useRef(false);
  const [botChallengeToken, setBotChallengeToken] = useState<string>();
  const [botChallengeResetSignal, setBotChallengeResetSignal] = useState(0);
  const [feedback, setFeedback] = useState<ContactFeedback>();

  useEffect(() => {
    if (!readAuthSession()) return;
    let active = true;
    void contactApi
      .accountEmail()
      .then(({ email }) => {
        if (active && !emailEdited.current && !getValues('email')) setValue('email', email);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [getValues, setValue]);

  async function submit(values: ContactFormValues) {
    setFeedback(undefined);
    if (isTurnstileConfigured() && !botChallengeToken) {
      setFeedback({ kind: 'error', messageKey: 'contactBotChallengeRequired' });
      return;
    }

    try {
      const result = await contactApi.submit({
        email: values.email.trim().toLowerCase(),
        category: values.category as ContactCategory,
        subject: values.subject.trim(),
        message: values.message.trim(),
        botChallengeToken: botChallengeToken ?? '',
      });
      reset({ ...values, subject: '', message: '' });
      setFeedback({ kind: 'success', inquiryId: result.inquiryId });
    } catch (error) {
      setFeedback({
        kind: 'error',
        messageKey: apiErrorTranslationKey(
          error instanceof ApiRequestError ? error.code : undefined,
          'contactSubmitFailed',
        ),
      });
    } finally {
      if (isTurnstileConfigured()) {
        setBotChallengeToken(undefined);
        setBotChallengeResetSignal((signal) => signal + 1);
      }
    }
  }

  return {
    form,
    feedback,
    submit,
    onEmailChange: () => {
      emailEdited.current = true;
    },
    challenge: { onTokenChange: setBotChallengeToken, resetSignal: botChallengeResetSignal },
  };
}
