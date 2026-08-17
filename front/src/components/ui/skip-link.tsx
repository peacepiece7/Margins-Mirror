import * as React from 'react';

import { cn } from '@/utils/cn';

function SkipLink({
  children = 'Skip to main content',
  className,
  href = '#main-content',
  ...props
}: React.ComponentProps<'a'>) {
  return (
    <a
      className={cn(
        'fixed left-3 top-3 z-50 -translate-y-20 rounded bg-primary px-4 py-2 text-primary-foreground shadow-lg transition-transform focus:translate-y-0',
        className,
      )}
      href={href}
      {...props}
    >
      {children}
    </a>
  );
}

export { SkipLink };
