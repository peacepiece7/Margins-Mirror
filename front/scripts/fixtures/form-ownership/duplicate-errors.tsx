import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function DuplicateErrorsFixture() {
  const form = useForm({ defaultValues: { title: '' } });
  const [errors] = useState<Record<string, string>>({});
  return <input {...form.register('title')} aria-invalid={Boolean(errors.title)} />;
}
