import { useForm } from 'react-hook-form';

export function WrongSubmitOwnerFixture() {
  const first = useForm({ defaultValues: { title: '' } });
  const second = useForm({ defaultValues: { title: '' } });
  const secondSubmit = second.handleSubmit(() => undefined);
  return (
    <form onSubmit={secondSubmit}>
      <input {...first.register('title')} />
    </form>
  );
}
