import { useController, useForm } from 'react-hook-form';

export function WrongUseControllerOwnerFixture() {
  const first = useForm({ defaultValues: { title: '' } });
  const second = useForm({ defaultValues: { title: '' } });
  const field = useController({ control: second.control, name: 'title' });
  return (
    <form onSubmit={first.handleSubmit(() => undefined)}>
      <input {...field.field} />
    </form>
  );
}
