import { useState } from 'react';
import { useForm } from 'react-hook-form';

const defaults = { title: '' };
const options = { defaultValues: defaults };

export function NamedDefaultsFixture() {
  useForm(options);
  const [title] = useState('');
  return <output>{title}</output>;
}
