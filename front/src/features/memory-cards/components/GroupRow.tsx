import { Button } from '@/components/ui/button';
import type { MemoryCardGroup } from '@/types/api/memory-card';
import { testAttr } from '@/utils/testAttrs';

export function GroupRow({
  description,
  group,
  meta,
  openLabel,
  deleteLabel,
  onDelete,
  onOpen,
}: {
  description: string;
  group: MemoryCardGroup;
  meta: string;
  openLabel: string;
  deleteLabel: string;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className="grid gap-3 rounded border border-stone-300 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      {...testAttr('memory-card-group-row')}
    >
      <div className="min-w-0">
        <h2 className="break-words text-lg font-semibold">{group.title}</h2>
        <p className="break-words text-sm text-stone-600">{description}</p>
        <p className="mt-1 text-xs text-stone-500">{meta}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button onClick={onOpen} type="button" {...testAttr('memory-card-group-open')}>
          {openLabel}
        </Button>
        <Button
          onClick={onDelete}
          type="button"
          variant="outline"
          {...testAttr('memory-card-group-delete')}
        >
          {deleteLabel}
        </Button>
      </div>
    </article>
  );
}
