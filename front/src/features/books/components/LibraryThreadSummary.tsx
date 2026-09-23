import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { bookPath } from '@/features/books/routes';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type {
  LibraryActivitySummary,
  LibraryLoopStage,
  LibraryLoopSummary,
  LibraryRevisionSummary,
} from '@/types/api/book';
import { testAttr } from '@/utils/testAttrs';

const stages: Array<{ id: LibraryLoopStage; label: TranslationKey }> = [
  { id: 'REFLECT', label: 'reflectionStepReflect' },
  { id: 'INTERVIEW', label: 'reflectionStepInterview' },
  { id: 'GUIDE', label: 'reflectionStepGuide' },
  { id: 'DISCUSS', label: 'reflectionStepDiscuss' },
  { id: 'REFINE', label: 'reflectionStepRefine' },
];

export function LibraryThreadProgress({
  compact = false,
  loop,
}: {
  compact?: boolean;
  loop: LibraryLoopSummary;
}) {
  const { t } = useI18n();
  const activeIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.id === loop.stage),
  );

  return (
    <section
      aria-label={t('readingLoopTitle')}
      className="web-library-thread"
      {...testAttr('library-thread-summary')}
    >
      <div className="web-library-thread-heading">
        <span>{t('libraryThreadCurrentStage')}</span>
        <strong>{t(stages[activeIndex].label)}</strong>
        {loop.stage === 'INTERVIEW' && (
          <small>
            {t('libraryInterviewProgress')
              .replace('{answered}', String(loop.answeredCount))
              .replace('{target}', String(loop.targetCount))}
          </small>
        )}
      </div>
      <ol aria-hidden="true" className="web-library-stage-track">
        {stages.map((stage, index) => (
          <li
            className={index === activeIndex ? 'is-active' : index < activeIndex ? 'is-done' : ''}
            key={stage.id}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
          </li>
        ))}
      </ol>
      {!compact && (
        <Button asChild className="web-library-continue" size="sm" variant="outline">
          <Link to={loop.continueLocator.href} {...testAttr('library-thread-continue')}>
            {t('libraryThreadContinue')} →
          </Link>
        </Button>
      )}
    </section>
  );
}

export function LibraryRevisionList({ revisions }: { revisions: LibraryRevisionSummary[] }) {
  const { locale, t } = useI18n();

  return (
    <section className="web-library-revisions" {...testAttr('library-recent-revisions')}>
      <h3>{t('libraryRecentRevisions')}</h3>
      {revisions.length ? (
        <ol>
          {revisions.map((revision) => (
            <li key={revision.revisionId}>
              <strong>V{revision.version}</strong>
              <span>{new Date(revision.createdAt).toLocaleDateString(locale)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p>{t('libraryRevisionEmpty')}</p>
      )}
    </section>
  );
}

export function LibraryActivityList({ activities }: { activities: LibraryActivitySummary[] }) {
  const { locale, t } = useI18n();
  const sortedActivities = useMemo(
    () =>
      [...activities].sort((left, right) => {
        const dateOrder = Date.parse(right.createdAt) - Date.parse(left.createdAt);
        return Number.isNaN(dateOrder) || dateOrder === 0
          ? right.revisionId - left.revisionId
          : dateOrder;
      }),
    [activities],
  );

  return (
    <section className="web-library-activity" {...testAttr('library-recent-activity')}>
      {sortedActivities.length ? (
        <ol>
          {sortedActivities.map((activity) => (
            <li key={`${activity.bookId}-${activity.revisionId}`}>
              <Link to={bookPath('book-detail', { bookId: activity.bookId })}>
                <span>{activity.bookTitle}</span>
                <small>{activity.bookAuthor}</small>
              </Link>
              <div>
                <strong>V{activity.version}</strong>
                <time dateTime={activity.createdAt}>
                  {new Date(activity.createdAt).toLocaleDateString(locale)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>{t('libraryRevisionEmpty')}</p>
      )}
    </section>
  );
}
