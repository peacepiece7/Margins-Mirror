import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function DuplicateValueFixture() {
  const form = useForm({ defaultValues: { title: '' } });
  const [title] = useState('');
  return <input {...form.register('title')} value={title} readOnly />;
}
