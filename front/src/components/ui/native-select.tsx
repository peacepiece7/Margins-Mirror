import * as React from 'react';

import { cn } from '@/utils/cn';

/**
 * Styled native select for forms whose existing event contract is intentionally
 * preserved. Domain pickers that need richer keyboard behavior use Select.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      data-slot="native-select"
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
