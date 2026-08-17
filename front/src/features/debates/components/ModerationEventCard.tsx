import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { ModerationFeedback } from '@/types/api/session';
import { testAttr } from '@/utils/testAttrs';

import type { DebatePageProps } from '../panel-types';

export function ModerationEventCard({
  event,
  onFeedback,
}: {
  event: NonNullable<DebatePageProps['moderationEvents']>[number];
  onFeedback: (eventId: number, feedback: ModerationFeedback) => void;
}) {
  const { t } = useI18n();
  const redirected = event.decision === 'REDIRECT';
  return (
    <Alert className="mx-auto max-w-2xl" variant="warning" {...testAttr('debate-moderation-event')}>
      <AlertTitle>{t('moderationTitle')}</AlertTitle>
      <AlertDescription className="grid gap-2 text-current">
        <div>{redirected ? t('moderationRedirected') : t('moderationRejected')}</div>
        {event.suggestedQuestion && (
          <div className="rounded bg-white px-3 py-2">
            <span className="font-medium">{t('moderationSuggestedQuestion')} </span>
            {event.suggestedQuestion}
          </div>
        )}
        {event.userFeedback ? (
          <div className="text-xs">{t('moderationFeedbackSaved')}</div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs">{t('moderationFeedbackPrompt')}</span>
            <Button onClick={() => onFeedback(event.eventId, 'RELATED')} size="sm" type="button">
              {t('moderationRelated')}
            </Button>
            <Button
              onClick={() => onFeedback(event.eventId, 'NOT_RELATED')}
              size="sm"
              type="button"
            >
              {t('moderationNotRelated')}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
