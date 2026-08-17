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
        className={`inline-flex min-h-9 items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-medium ${
          speech.listening
            ? 'border-red-700 bg-red-50 text-red-800'
            : 'border-stone-300 bg-white text-stone-700 hover:border-stone-950'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={blocked}
        onClick={speech.toggle}
        type="button"
        {...testAttr(`${label}-speech-toggle`)}
      >
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${speech.listening ? 'bg-red-600' : 'bg-stone-400'}`}
        />
        {speech.listening ? t('speechStop') : t('speechInput')}
      </Button>
      {!speech.supported && (
        <div className="text-xs text-stone-500" {...testAttr(`${label}-speech-unsupported`)}>
          {t('speechUnsupported')}
        </div>
      )}
      {speech.error && (
        <div className="text-xs text-red-700" role="status" {...testAttr(`${label}-speech-error`)}>
          {speech.error}
        </div>
      )}
    </div>
  );
}
