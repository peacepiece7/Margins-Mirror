import { cn } from '@/utils/cn';

function Skeleton({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
