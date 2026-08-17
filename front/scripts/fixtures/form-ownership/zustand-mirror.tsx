import { useForm } from 'react-hook-form';

declare function useDraftStore<T>(selector: (state: { title: string }) => T): T;

export function ZustandMirrorFixture() {
  const form = useForm({ defaultValues: { title: '' } });
  const title = useDraftStore((state) => state.title);
  return <input {...form.register('title')} value={title} readOnly />;
}
