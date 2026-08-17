import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function ApprovedWorkflowPropsFixture() {
  const form = useForm({ defaultValues: { title: '' } });
  const [step, setStep] = useState('draft');
  return (
    <>
      <input {...form.register('title')} />
      <WorkflowStep value={step} onChange={setStep} />
    </>
  );
}

function WorkflowStep(_: { value: string; onChange: (value: string) => void }) {
  return null;
}
