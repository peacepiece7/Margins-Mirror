import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

export function MemoryCardHeader({
  canStudy,
  onGroups,
  onStudy,
}: {
  canStudy: boolean;
  onGroups: () => void;
  onStudy: () => void;
}) {
  const { t } = useI18n();
  return (
    <header className="blueprint-memory-header flex flex-wrap items-center justify-between gap-3">
      <div>
        <span className="blueprint-unit-label">UNIT / MEMORY CARDS</span>
        <h1 className="font-display text-4xl font-semibold tracking-normal">
          {t('memoryCardTitle')}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onGroups}
          type="button"
          variant="outline"
          {...testAttr('memory-card-group-list-nav')}
        >
          {t('memoryCardGroupList')}
        </Button>
        <Button
          disabled={!canStudy}
          onClick={onStudy}
          type="button"
          {...testAttr('memory-card-study-start')}
        >
          {t('memoryCardStartStudy')}
        </Button>
      </div>
    </header>
  );
}
