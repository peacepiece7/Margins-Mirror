import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { TranslationKey } from '@/lib/i18n';
import type { ContactCategory } from '@/types/api/contact';

export type ContactFormValues = {
  email: string;
  category: ContactCategory | '';
  subject: string;
  message: string;
};

export type ContactFeedback =
  { kind: 'success'; inquiryId: number } | { kind: 'error'; messageKey: TranslationKey };

export type ContactTextFieldProps = {
  form: UseFormReturn<ContactFormValues>;
  name: Exclude<keyof ContactFormValues, 'category'>;
  onChange?: () => void;
};

export type ContactFieldProps = {
  children: ReactNode;
  error?: string;
  htmlFor: string;
  label: string;
};
