import * as React from 'react';

import { cn } from '@/utils/cn';

function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="Breadcrumb" className={cn('text-sm', className)} {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      className={cn('flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground', className)}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('inline-flex min-w-0 items-center gap-1.5', className)} {...props} />;
}

function BreadcrumbSeparator({ children = '/', ...props }: React.ComponentProps<'li'>) {
  return (
    <li aria-hidden="true" role="presentation" {...props}>
      {children}
    </li>
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-current="page"
      className={cn('truncate font-medium text-foreground', className)}
      {...props}
    />
  );
}

export { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator };
