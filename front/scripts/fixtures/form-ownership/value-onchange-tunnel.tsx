import { useState } from 'react';
import { useForm } from 'react-hook-form';

const defaults = { title: '' };

export function ValueOnChangeTunnelFixture() {
  useForm({ defaultValues: defaults });
  const [draftTitle, setTitle] = useState('');
  return <TitleEditor value={draftTitle} onChange={setTitle} />;
}

function TitleEditor(_: { value: string; onChange: (value: string) => void }) {
  return null;
}
