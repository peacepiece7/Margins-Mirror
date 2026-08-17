import type { PropsWithChildren } from 'react';

import { testAttr } from '@/utils/testAttrs';

export function AuthShell({ children, promotion }: PropsWithChildren<{ promotion: boolean }>) {
  return (
    <main
      className={`blueprint-login-page margins-page-gutter mx-auto grid min-h-screen w-full items-center gap-8 py-8 ${
        promotion ? 'max-w-6xl lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,420px)]' : 'max-w-md'
      }`}
      {...(promotion ? testAttr('main-promotion-page') : {})}
    >
      {children}
    </main>
  );
}
