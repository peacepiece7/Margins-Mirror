import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type { BookCandidate } from '@/types/api/book';
import { testAttr } from '@/utils/testAttrs';

function candidateSourceKey(candidateId: string): TranslationKey {
  if (candidateId.startsWith('google:')) return 'bookSourceGoogleBooks';
  if (candidateId.startsWith('openlibrary:')) return 'bookSourceOpenLibrary';
  if (candidateId.startsWith('openai-')) return 'bookSourceOpenAi';
  if (candidateId.startsWith('placeholder-')) return 'bookSourcePlaceholder';
  return 'bookSourceCandidate';
}

export function BookCandidateCard({
  candidate,
  saving,
  onSave,
}: {
  candidate: BookCandidate;
  saving: boolean;
  onSave: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card
      className="rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_12px_36px_rgba(23,23,23,0.05)] ring-0"
      {...testAttr('book-candidate-card')}
    >
      <CardContent className="grid gap-3 p-0">
        <div className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)]">
          {candidate.thumbnail ? (
            <img
              alt=""
              className="h-28 w-[72px] rounded border border-stone-200 bg-white object-cover"
              src={candidate.thumbnail}
              {...testAttr('book-candidate-cover')}
            />
          ) : (
            <div aria-hidden="true" className="h-28 w-[72px] rounded bg-muted" />
          )}
          <div className="min-w-0">
            <div
              className="break-words text-lg font-semibold"
              {...testAttr('book-candidate-title')}
            >
              {candidate.title}
            </div>
            {candidate.subtitle && (
              <div className="text-sm text-stone-500">{candidate.subtitle}</div>
            )}
            <div className="text-sm text-stone-600">{candidate.author}</div>
            <div
              className="mt-2 break-all text-xs text-stone-500"
              {...testAttr('book-candidate-id')}
            >
              {t('bookId')} {candidate.candidateId} · {t(candidateSourceKey(candidate.candidateId))}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
              {candidate.publisher && <span>{candidate.publisher}</span>}
              {candidate.publishedYear && <span>{candidate.publishedYear}</span>}
              {candidate.language && <span>{candidate.language.toUpperCase()}</span>}
            </div>
            {candidate.isbn && (
              <div className="mt-1 text-xs text-stone-500">ISBN {candidate.isbn}</div>
            )}
            {candidate.reason && <p className="mt-2 text-sm leading-6">{candidate.reason}</p>}
          </div>
        </div>
        <Button
          disabled={saving}
          onClick={onSave}
          type="button"
          {...testAttr('book-candidate-save')}
        >
          {t('register')}
        </Button>
      </CardContent>
    </Card>
  );
}
