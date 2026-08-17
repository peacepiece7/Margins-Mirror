import { useForm } from 'react-hook-form';

export function MissingSubmitHandler() {
  const form = useForm({ defaultValues: { value: '' } });
  return (
    <form>
      <input {...form.register('value')} />
    </form>
  );
}
