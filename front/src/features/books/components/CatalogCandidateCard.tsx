import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import type { CatalogCandidate } from '@/types/api/catalog';
import { testAttr } from '@/utils/testAttrs';
import { useSaveCatalogMutation } from '../catalog-queries';

export function CatalogCandidateCard({
  candidate,
  onSaved,
}: {
  candidate: CatalogCandidate;
  onSaved?: (id: number) => void;
}) {
  const { t } = useI18n();
  const save = useSaveCatalogMutation();
  const currentSession = useAuthenticatedSessionGuard();
  const [brokenUrl, setBrokenUrl] = useState<string>();
  const inLibrary =
    candidate.inLibrary ||
    (save.isSuccess && currentSession()) ||
    (save.error instanceof ApiRequestError && save.error.code === 'BOOK_ALREADY_EXISTS');
  return (
    <Card
      className="web-discover-result rounded border border-stone-300 bg-stone-50/95 p-4 ring-0"
      {...testAttr('book-candidate-card')}
    >
      <CardContent className="grid gap-3 p-0">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 sm:grid-cols-[80px_minmax(0,1fr)]">
          {candidate.thumbnail && brokenUrl !== candidate.thumbnail ? (
            <img
              src={candidate.thumbnail}
              alt=""
              width={80}
              height={120}
              loading="lazy"
              decoding="async"
              className="h-24 w-16 rounded border border-stone-200 bg-white object-contain sm:h-[120px] sm:w-20"
              onError={() => setBrokenUrl(candidate.thumbnail)}
              {...testAttr('book-candidate-cover')}
            />
          ) : (
            <div
              className="flex h-24 w-16 items-center justify-center rounded bg-stone-200/60 text-stone-500 sm:h-[120px] sm:w-20"
              title={t('catalogNoCover')}
            >
              <BookOpen aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold" {...testAttr('book-candidate-title')}>
              {candidate.title}
            </h3>
            {candidate.subtitle && <p className="text-sm text-stone-500">{candidate.subtitle}</p>}
            <p className="text-sm text-stone-600">
              {candidate.author || t('catalogUnknownAuthor')}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-2 text-xs text-stone-500">
              {candidate.publisher && <span>{candidate.publisher}</span>}
              {candidate.publishedDate && <span>{candidate.publishedDate}</span>}
              {candidate.language && <span>{candidate.language.toUpperCase()}</span>}
              {candidate.format !== 'UNKNOWN' && (
                <span>
                  {t(
                    candidate.format === 'EBOOK'
                      ? 'catalogEbook'
                      : candidate.format === 'AUDIOBOOK'
                        ? 'catalogAudio'
                        : 'catalogPrint',
                  )}
                </span>
              )}
            </div>
            {candidate.isbn13 && (
              <p className="mt-1 text-xs text-stone-500">ISBN {candidate.isbn13}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              {candidate.sources.map((source) => (
                <a
                  key={source.code + source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-stone-600 underline underline-offset-4"
                >
                  {source.label}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>
        {inLibrary ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span role="status">{t(save.isSuccess ? 'catalogAdded' : 'catalogInLibrary')}</span>
            <Button asChild variant="outline">
              <Link to="/book/library">{t('catalogOpenLibrary')}</Link>
            </Button>
          </div>
        ) : (
          <Button
            className="min-h-11"
            disabled={save.isPending}
            loading={save.isPending}
            onClick={() =>
              save.mutate(candidate.catalogBookId, {
                onSuccess: (book) => {
                  if (currentSession()) onSaved?.(book.bookId);
                },
              })
            }
            {...testAttr('book-candidate-save')}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('register')}
          </Button>
        )}
        {save.isError && !inLibrary && (
          <p role="alert" className="text-sm text-destructive">
            {apiErrorMessage(save.error, t)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
