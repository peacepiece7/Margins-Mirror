import { Alert, AlertDescription } from '@/components/ui/alert';
import { SpinnerInline } from '@/components/ui/spinner';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

export function MemoryCardStatus({
  error,
  loading,
  message,
}: {
  error?: string;
  loading: boolean;
  message?: string;
}) {
  const { t } = useI18n();
  if (!error && !message && !loading) return null;

  let variant: 'default' | 'destructive' | 'success' = 'default';
  if (error) {
    variant = 'destructive';
  } else if (message && !loading) {
    variant = 'success';
  }

  return (
    <Alert variant={variant} {...testAttr('memory-card-status')}>
      <AlertDescription>
        {loading ? <SpinnerInline>{t('memoryCardProcessing')}</SpinnerInline> : error || message}
      </AlertDescription>
    </Alert>
  );
}
