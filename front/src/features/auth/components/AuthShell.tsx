import type { PropsWithChildren } from 'react';

import { testAttr } from '@/utils/testAttrs';

type AuthShellProps = PropsWithChildren<{ wide?: boolean }>;

export function AuthShell({ children, wide = false }: AuthShellProps) {
  return (
    <main
      className={`auth-dark-shell blueprint-auth-page blueprint-login-page margins-page-gutter mx-auto grid min-h-screen w-full items-center gap-8 py-8 ${wide ? 'auth-dark-shell-wide max-w-3xl' : 'max-w-md'}`}
      {...testAttr('auth-page')}
    >
      {children}
    </main>
  );
}
