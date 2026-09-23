import { Button } from '@/components/ui/button';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import type { SpeechDraftControlProps } from './types';

export function SpeechDraftControl({
  disabled = false,
  label,
  onChange,
  value,
}: SpeechDraftControlProps) {
  const { locale, t } = useI18n();
  const speech = useSpeechRecognition({
    language: locale === 'ko' ? 'ko-KR' : 'en-US',
    messages: {
      permissionDenied: t('speechPermissionDenied'),
      retry: t('speechRetry'),
      startFailed: t('speechStartFailed'),
      unsupported: t('speechUnsupported'),
    },
    onTranscript: onChange,
    value,
  });
  const blocked = disabled || !speech.supported;

  return (
    <div className="grid gap-1">
      <Button
        aria-label={speech.listening ? t('speechListeningStop') : t('speechStart')}
        aria-pressed={speech.listening}
        className="min-h-9 px-3 py-2"
        disabled={blocked}
        onClick={speech.toggle}
        type="button"
        variant={speech.listening ? 'destructive' : 'outline'}
        {...testAttr(`${label}-speech-toggle`)}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${speech.listening ? 'bg-destructive' : 'bg-stone-400'}`}
        />
        {speech.listening ? t('speechStop') : t('speechInput')}
      </Button>
      {!speech.supported && (
        <div className="text-xs text-stone-500" {...testAttr(`${label}-speech-unsupported`)}>
          {t('speechUnsupported')}
        </div>
      )}
      {speech.error && (
        <div
          className="text-xs text-destructive"
          role="status"
          {...testAttr(`${label}-speech-error`)}
        >
          {speech.error}
        </div>
      )}
    </div>
  );
}
