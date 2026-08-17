import type { PropsWithChildren, ReactNode } from 'react';

import { Label } from '@/components/ui/label';

export function AccountFormField({
  children,
  description,
  error,
  htmlFor,
  label,
}: PropsWithChildren<{
  description?: string;
  error?: ReactNode;
  htmlFor: string;
  label: string;
}>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description && <p className="text-xs leading-5 text-stone-500">{description}</p>}
      {error && (
        <p className="text-xs leading-5 text-red-700" id={`${htmlFor}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
