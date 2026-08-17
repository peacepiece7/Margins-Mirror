import { Controller, useForm } from 'react-hook-form';

export function WrongControllerOwnerFixture() {
  const first = useForm({ defaultValues: { title: '' } });
  const second = useForm({ defaultValues: { title: '' } });
  return (
    <form onSubmit={first.handleSubmit(() => undefined)}>
      <Controller
        control={second.control}
        name="title"
        render={({ field }) => <input {...field} />}
      />
    </form>
  );
}
