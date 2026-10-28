import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import type { MemoryCardGroup } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

import { displayDate, interpolate } from '../utils';

export function GroupListView({
  groups,
  onDelete,
  onOpen,
}: {
  groups: MemoryCardGroup[];
  onDelete: (group: MemoryCardGroup) => void;
  onOpen: (group: MemoryCardGroup) => void;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="grid content-start gap-3">
      {groups.map((group) => (
        <article
          className="grid gap-3 rounded border border-stone-300 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          key={group.groupId}
          {...testAttr('memory-card-group-row')}
        >
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold">{group.title}</h2>
            <p className="break-words text-sm text-stone-600">
              {group.description || group.sourceLabel || t('memoryCardNoDescription')}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {interpolate(t('memoryCardGroupMeta'), {
                count: group.cardCount,
                date: displayDate(group.updatedAt, locale),
              })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              onClick={() => onOpen(group)}
              type="button"
              {...testAttr('memory-card-group-open')}
            >
              {t('memoryCardOpen')}
            </Button>
            <Button
              onClick={() => onDelete(group)}
              type="button"
              variant="outline"
              {...testAttr('memory-card-group-delete')}
            >
              {t('delete')}
            </Button>
          </div>
        </article>
      ))}
      {groups.length === 0 && (
        <div className="rounded border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
          {t('memoryCardEmptyGroups')}
        </div>
      )}
    </div>
  );
}
