import * as React from 'react';

import { cn } from '@/utils/cn';

interface SpinnerProps extends React.ComponentProps<'span'> {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'size-3.5 border-2',
  md: 'size-5 border-2',
  lg: 'size-7 border-[3px]',
} as const;

const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, label, size = 'md', ...props }, ref) => (
    <span
      ref={ref}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-slot="spinner"
      role={label ? 'status' : undefined}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent',
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Spinner.displayName = 'Spinner';

function SpinnerInline({
  children,
  className,
  ...props
}: React.ComponentProps<'span'> & { children: React.ReactNode }) {
  return (
    <span
      aria-live="polite"
      className={cn('inline-flex items-center gap-2', className)}
      data-slot="spinner-inline"
      {...props}
    >
      <Spinner size="sm" />
      <span>{children}</span>
    </span>
  );
}

export { Spinner, SpinnerInline };
