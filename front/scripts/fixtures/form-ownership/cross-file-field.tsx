import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

export function CrossFileField() {
  const form = useFormContext<{ title: string }>();
  const [title] = useState('');
  return <input {...form.register('title')} value={title} readOnly />;
}
