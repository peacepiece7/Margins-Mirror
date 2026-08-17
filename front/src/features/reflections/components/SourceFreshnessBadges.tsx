import { Badge } from '@/components/ui/badge';
import { translationCatalog } from '@/lib/i18n';

export function SourceFreshnessBadges({
  fallback,
  stale,
  version,
}: {
  fallback?: boolean;
  stale?: boolean;
  version?: string | null;
}) {
  const locale =
    typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'ko';
  const t = (key: keyof typeof translationCatalog.en) => translationCatalog[locale][key];
  if (!version && !stale && !fallback) return null;

  return (
    <span aria-label={t('reflectionGuideEvidenceStatus')} className="inline-flex flex-wrap gap-1">
      {version ? <Badge variant="outline">{version}</Badge> : null}
      {stale ? <Badge variant="outline">{t('reflectionGuideSourceStale')}</Badge> : null}
      {fallback ? <Badge variant="outline">{t('reflectionGuideSourceFallback')}</Badge> : null}
    </span>
  );
}
