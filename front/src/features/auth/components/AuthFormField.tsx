import type { PropsWithChildren } from 'react';
import { type FieldPath, useFormContext } from 'react-hook-form';

import { testAttr } from '@/utils/testAttrs';

import type { AuthFormValues } from './auth-form';

export function AuthFormField({
  children,
  errorTestId,
  name,
}: PropsWithChildren<{ errorTestId: string; name: FieldPath<AuthFormValues> }>) {
  const { formState, getFieldState } = useFormContext<AuthFormValues>();
  const error = getFieldState(name, formState).error?.message;

  if (!children && !error) return null;
  return (
    <div>
      {children}
      {error && (
        <p
          className="mt-1 text-xs leading-5 text-red-700"
          id={errorTestId}
          {...testAttr(errorTestId)}
        >
          {error}
        </p>
      )}
    </div>
  );
}
