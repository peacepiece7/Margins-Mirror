import type { MemoryCardGroup } from '@/types/api/memory-card';

import { GroupRow } from './GroupRow';

export function GroupListView({
  emptyLabel,
  groups,
  rowDescription,
  rowMeta,
  openLabel,
  deleteLabel,
  onDelete,
  onOpen,
}: {
  emptyLabel: string;
  groups: MemoryCardGroup[];
  rowDescription: (group: MemoryCardGroup) => string;
  rowMeta: (group: MemoryCardGroup) => string;
  openLabel: string;
  deleteLabel: string;
  onDelete: (group: MemoryCardGroup) => void;
  onOpen: (group: MemoryCardGroup) => void;
}) {
  return (
    <div className="grid content-start gap-3">
      {groups.map((group) => (
        <GroupRow
          deleteLabel={deleteLabel}
          description={rowDescription(group)}
          group={group}
          key={group.groupId}
          meta={rowMeta(group)}
          onDelete={() => onDelete(group)}
          onOpen={() => onOpen(group)}
          openLabel={openLabel}
        />
      ))}
      {groups.length === 0 && (
        <div className="rounded border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
