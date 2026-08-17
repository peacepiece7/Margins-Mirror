import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { FlashAlertProvider } from '@/components/ui/flash-alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/lib/i18n';
import { appQueryClient } from '@/lib/query-client';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={appQueryClient}>
      <I18nProvider>
        <FlashAlertProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </FlashAlertProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
