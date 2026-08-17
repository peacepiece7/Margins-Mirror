import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ReflectionOperationStatus({
  message,
  onRetry,
  retryLabel,
  title,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel: string;
  title: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      {onRetry && (
        <Button className="mt-3" onClick={onRetry} type="button" variant="outline">
          {retryLabel}
        </Button>
      )}
    </Alert>
  );
}
