import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

export const APP_DOWNLOAD_NOTICE_KEY = 'margins.app-download-notice.v1';
const UNINTERRUPTED_PUBLIC_PATHS = new Set([
  '/contact',
  '/privacy',
  '/privacy/history',
  '/terms',
  '/terms/history',
]);

function isUninterruptedPublicPath(pathname: string) {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return UNINTERRUPTED_PUBLIC_PATHS.has(normalizedPath);
}

export function AppDownloadNotice() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isUninterruptedPublicPath(window.location.pathname)) {
      return;
    }

    if (!window.matchMedia('(max-width: 1024px)').matches) {
      return;
    }

    try {
      if (window.localStorage.getItem(APP_DOWNLOAD_NOTICE_KEY) === 'dismissed') {
        return;
      }
    } catch {
      // Storage can be unavailable in private browsing. The notice still works for this mount.
    }

    setOpen(true);
  }, []);

  function dismissPermanently() {
    try {
      window.localStorage.setItem(APP_DOWNLOAD_NOTICE_KEY, 'dismissed');
    } catch {
      // Closing the notice must not depend on browser storage availability.
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        data-ui="app-download-notice"
        {...testAttr('app-download-notice')}
      >
        <DialogHeader>
          <DialogTitle>{t('appNoticeTitle')}</DialogTitle>
          <DialogDescription>{t('appNoticeDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5 rounded-lg border bg-muted/40 p-3 text-center">
          <p className="text-xs text-muted-foreground" id="app-download-status">
            {t('appNoticeUnavailable')}
          </p>
          <Button
            aria-describedby="app-download-status"
            disabled
            type="button"
            data-ui="app-download-action"
            {...testAttr('app-download-action')}
          >
            {t('appNoticeAction')}
          </Button>
        </div>

        <DialogFooter>
          <Button
            onClick={dismissPermanently}
            type="button"
            variant="ghost"
            {...testAttr('app-download-dismiss')}
          >
            {t('appNoticeNeverShow')}
          </Button>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
            {...testAttr('app-download-close')}
          >
            {t('appNoticeClose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
