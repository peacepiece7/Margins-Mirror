import { useForm } from 'react-hook-form';

export function MixedSubmitHandlers() {
  const form = useForm({ defaultValues: { title: '' } });
  const submit = form.handleSubmit(() => undefined);
  return (
    <>
      <form onSubmit={submit}>
        <input {...form.register('title')} />
      </form>
      <form>
        <input {...form.register('title')} />
      </form>
    </>
  );
}
