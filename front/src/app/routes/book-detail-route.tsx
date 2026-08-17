import { Navigate, useParams } from 'react-router-dom';

import { BookDetailsPanel } from '@/features/books/components/BookDetailsPanel';
import { DebateEntryPanel } from '@/features/debates/components/DebateEntryPanel';
import { QuestionPanel } from '@/features/reflections/components/QuestionPanel';

import { ReadingWorkspacePanelLayout } from './reading-workspace-panel-layout';

export function BookDetailRoute() {
  const bookId = Number(useParams().bookId);
  if (!Number.isSafeInteger(bookId) || bookId <= 0) {
    return <Navigate replace to="/book/library" />;
  }

  return (
    <ReadingWorkspacePanelLayout>
      <div className="grid gap-5">
        <BookDetailsPanel bookId={bookId} />
        <QuestionPanel bookId={bookId} />
        <DebateEntryPanel bookId={bookId} />
      </div>
    </ReadingWorkspacePanelLayout>
  );
}
