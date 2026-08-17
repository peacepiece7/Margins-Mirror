import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

import type { DiscussionGuideVersionNavigatorProps } from '../discussion-guide-component-types';
import { discussionGuideOriginLabels } from '../discussion-guide-labels';

export function DiscussionGuideVersionNavigator({
  disabled,
  guideId,
  onSelect,
  versions,
}: DiscussionGuideVersionNavigatorProps) {
  if (!versions.length) return null;

  return (
    <section className="grid gap-2 rounded border border-stone-300 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="discussion-guide-version">Version 이력</Label>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          이전 version은 수정되지 않으며 필요할 때 언제든 다시 볼 수 있습니다.
        </p>
      </div>
      <NativeSelect
        className="min-h-11 sm:min-w-56"
        disabled={disabled}
        id="discussion-guide-version"
        onChange={(event) => onSelect(Number(event.target.value))}
        value={guideId}
      >
        {versions.map((version) => (
          <option key={version.guideId} value={version.guideId}>
            v{version.guideVersion} ·{' '}
            {discussionGuideOriginLabels[version.origin] ?? version.origin}
            {version.current ? ' · 현재' : version.hasRun ? ' · 토론 연결됨' : ' · 보관'}
          </option>
        ))}
      </NativeSelect>
    </section>
  );
}
