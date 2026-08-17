import { X } from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription } from './alert';
import { Button } from './button';
import { useI18n } from '@/lib/i18n';
import { dismissNoticeCookie, isNoticeDismissedCookie } from '@/lib/dismissible-notice';
import { cn } from '@/utils/cn';
import { testAttr } from '@/utils/testAttrs';

interface AiProcessingNoticeProps {
  action: string;
  className?: string;
  dismissDays?: number;
  storageKey?: string;
}

export function AiProcessingNotice({
  action,
  className,
  dismissDays,
  storageKey,
}: AiProcessingNoticeProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(
    () => !storageKey || !isNoticeDismissedCookie(storageKey),
  );
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);

  if (!isVisible) return null;

  return (
    <Alert
      className={cn('flex items-start gap-2 text-xs leading-5', className)}
      role="note"
      variant="warning"
      {...testAttr('ai-processing-notice')}
    >
      <AlertDescription className="min-w-0 flex-1 text-current">
        {action} {t('aiProcessingNotice')}{' '}
        <a className="font-medium underline" href="/privacy">
          {t('learnMore')}
        </a>
      </AlertDescription>
      {storageKey && dismissDays ? (
        <div className="flex shrink-0 items-start gap-2">
          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs">
            <input
              aria-label={t('doNotShowAiNoticeAgain')}
              checked={doNotShowAgain}
              onChange={(event) => setDoNotShowAgain(event.target.checked)}
              type="checkbox"
            />
            {t('doNotShowAiNoticeAgain')}
          </label>
          <Button
            aria-label={t('dismissAiNotice')}
            className="-mr-1 size-7"
            onClick={() => {
              if (doNotShowAgain) dismissNoticeCookie(storageKey, dismissDays);
              setIsVisible(false);
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
            {...testAttr('ai-processing-notice-dismiss')}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}
