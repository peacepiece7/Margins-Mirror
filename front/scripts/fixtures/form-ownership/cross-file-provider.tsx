import type { PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

const defaults = { title: '' };

export function CrossFileProvider({ children }: PropsWithChildren) {
  const form = useForm({ defaultValues: defaults });
  return <FormProvider {...form}>{children}</FormProvider>;
}
