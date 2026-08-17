import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';

export function UrlMirrorFixture() {
  const form = useForm({ defaultValues: { title: '' } });
  const [params] = useSearchParams();
  params.set('title', form.watch('title'));
  return null;
}
