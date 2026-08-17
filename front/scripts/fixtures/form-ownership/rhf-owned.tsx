import { useForm } from 'react-hook-form';

export function RhfOwnedFixture() {
  const form = useForm({ defaultValues: { title: '' } });
  return <input {...form.register('title')} />;
}
