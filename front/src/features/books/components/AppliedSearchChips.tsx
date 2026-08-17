import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export function AppliedSearchChips({ query, onClear }: { query: string; onClear: () => void }) {
  const { t } = useI18n();
  if (!query) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="info">{query}</Badge>
      <Button onClick={onClear} size="sm" type="button" variant="ghost">
        {t('workbenchClear')}
      </Button>
    </div>
  );
}
