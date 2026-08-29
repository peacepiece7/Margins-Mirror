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

  return (
    <div>
      {children}
      <p
        aria-hidden={error ? undefined : true}
        aria-live={error ? 'polite' : undefined}
        className="mt-1 min-h-5 text-xs leading-5 text-red-700"
        id={errorTestId}
        {...testAttr(errorTestId)}
      >
        {error}
      </p>
    </div>
  );
}
