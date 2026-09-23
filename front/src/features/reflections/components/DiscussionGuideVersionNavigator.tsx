import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useI18n } from '@/lib/i18n';

import type { DiscussionGuideVersionNavigatorProps } from '../discussion-guide-component-types';
import { discussionGuideOriginLabelKeys } from '../discussion-guide-labels';

export function DiscussionGuideVersionNavigator({
  disabled,
  guideId,
  onSelect,
  versions,
}: DiscussionGuideVersionNavigatorProps) {
  const { t } = useI18n();
  if (!versions.length) return null;

  return (
    <section className="web-guide-version-rail grid gap-2 rounded border border-stone-300 bg-white p-4">
      <div>
        <Label htmlFor="discussion-guide-version">{t('reflectionGuideVersionHistory')}</Label>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          {t('reflectionGuideVersionHistoryDescription')}
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
            {discussionGuideOriginLabelKeys[version.origin]
              ? t(discussionGuideOriginLabelKeys[version.origin])
              : version.origin}
            {version.current
              ? ` · ${t('reflectionGuideCurrent')}`
              : version.hasRun
                ? ` · ${t('reflectionGuideVersionLinked')}`
                : ` · ${t('reflectionGuideArchived')}`}
          </option>
        ))}
      </NativeSelect>
    </section>
  );
}
