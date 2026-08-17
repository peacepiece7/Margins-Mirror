import { Controller, type FieldPathByValue, useFormContext } from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';
import { testAttr } from '@/utils/testAttrs';

import type { AuthFormValues } from './auth-form';

export function ConsentCheckbox({
  disabled = false,
  label,
  name,
  testId,
}: {
  disabled?: boolean;
  label: string;
  name: FieldPathByValue<AuthFormValues, boolean>;
  testId: string;
}) {
  const { control } = useFormContext<AuthFormValues>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex items-start gap-2 text-sm leading-5">
          <Checkbox
            checked={field.value}
            className="mt-1"
            disabled={disabled}
            onCheckedChange={(nextChecked) => field.onChange(nextChecked === true)}
            {...testAttr(testId)}
          />
          <span>{label}</span>
        </label>
      )}
      rules={{ required: true }}
    />
  );
}
