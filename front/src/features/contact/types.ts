import type { ContactCategory } from '@/types/api/contact';

export type ContactFormValues = {
  email: string;
  category: ContactCategory | '';
  subject: string;
  message: string;
};
