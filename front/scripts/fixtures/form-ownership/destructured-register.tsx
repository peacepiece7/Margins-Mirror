import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function DestructuredRegisterFixture() {
  const { handleSubmit, register } = useForm({ defaultValues: { title: '' } });
  const [title] = useState('');
  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <input {...register('title')} value={title} readOnly />
    </form>
  );
}
