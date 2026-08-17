import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { X } from 'lucide-react';

import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { Alert, AlertAction, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';

type FlashAlertVariant = 'info' | 'success' | 'warning' | 'destructive';

export interface FlashAlertInput {
  durationMs?: number;
  message: string;
  title?: string;
  variant?: FlashAlertVariant;
}

interface FlashAlertState extends Required<Pick<FlashAlertInput, 'message' | 'variant'>> {
  id: number;
  title?: string;
}

interface FlashAlertContextValue {
  dismiss: () => void;
  show: (input: FlashAlertInput) => void;
}

const FlashAlertContext = createContext<FlashAlertContextValue | undefined>(undefined);

export function FlashAlertProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [alert, setAlert] = useState<FlashAlertState>();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    setAlert(undefined);
  }, []);

  const show = useCallback(
    ({ durationMs = 5000, message, title, variant = 'info' }: FlashAlertInput) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const nextAlert: FlashAlertState = {
        id: Date.now(),
        message,
        title,
        variant,
      };
      setAlert(nextAlert);
      if (durationMs > 0) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = undefined;
          setAlert(undefined);
        }, durationMs);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return (
    <FlashAlertContext.Provider value={{ dismiss, show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex justify-center sm:inset-x-auto sm:right-4 sm:w-[min(32rem,calc(100%-2rem))]"
      >
        {alert ? (
          <div
            className="pointer-events-auto w-full"
            data-slot="flash-alert"
            key={alert.id}
            {...testAttr('flash-alert')}
          >
            <Alert variant={alert.variant}>
              {alert.title ? <AlertTitle>{alert.title}</AlertTitle> : null}
              <AlertDescription>{alert.message}</AlertDescription>
              <AlertAction>
                <Button
                  aria-label={t('close')}
                  onClick={dismiss}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              </AlertAction>
            </Alert>
          </div>
        ) : null}
      </div>
    </FlashAlertContext.Provider>
  );
}

export function useFlashAlert() {
  const context = useContext(FlashAlertContext);
  if (!context) {
    throw new Error('useFlashAlert must be used inside FlashAlertProvider');
  }

  return context;
}
