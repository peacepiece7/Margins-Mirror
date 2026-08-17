import { useEffect, useRef, useState } from 'react';

import { useI18n, type Locale } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: 'auto';
      language: Locale;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const siteKey = import.meta.env.VITE_MARGINS_TURNSTILE_SITE_KEY?.trim() ?? '';
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function isTurnstileConfigured(): boolean {
  return siteKey.length > 0;
}

type TurnstileWidgetProps = {
  locale: Locale;
  onTokenChange: (token: string | undefined) => void;
  resetSignal: number;
};

export function TurnstileWidget({ locale, onTokenChange, resetSignal }: TurnstileWidgetProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading');

  useEffect(() => {
    if (!siteKey) return undefined;
    let disposed = false;
    onTokenChange(undefined);
    setStatus('loading');

    function resetWithStatus(nextStatus: 'expired' | 'error') {
      onTokenChange(undefined);
      setStatus(nextStatus);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }

    function renderWidget() {
      if (disposed || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'email_verification',
        theme: 'auto',
        language: locale,
        callback(token) {
          onTokenChange(token);
          setStatus('ready');
        },
        'expired-callback': () => resetWithStatus('expired'),
        'error-callback': () => resetWithStatus('error'),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.defer = true;
        document.head.append(script);
      }
      script.addEventListener('load', renderWidget);
      const handleScriptError = () => resetWithStatus('error');
      script.addEventListener('error', handleScriptError);
      return () => {
        disposed = true;
        script?.removeEventListener('load', renderWidget);
        script?.removeEventListener('error', handleScriptError);
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      };
    }

    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [locale, onTokenChange]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenChange(undefined);
      setStatus('loading');
    }
  }, [onTokenChange, resetSignal]);

  if (!siteKey) return null;

  const statusMessage =
    status === 'expired'
      ? t('botChallengeExpired')
      : status === 'error'
        ? t('botChallengeError')
        : status === 'ready'
          ? t('botChallengeReady')
          : t('botChallengePrompt');

  return (
    <div className="grid gap-2" {...testAttr('register-bot-challenge')}>
      <div ref={containerRef} />
      <p
        aria-live="polite"
        className={status === 'error' ? 'text-sm text-red-700' : 'text-sm text-stone-600'}
        {...testAttr('register-bot-challenge-status')}
      >
        {statusMessage}
      </p>
    </div>
  );
}
