import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function DuplicateSubmittingFixture() {
  const form = useForm({ defaultValues: { title: '' } });
  const [isSubmitting] = useState(false);
  return <button disabled={isSubmitting || form.formState.isSubmitting}>Save</button>;
}
