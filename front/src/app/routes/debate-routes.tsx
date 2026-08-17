import { Navigate, useParams } from 'react-router-dom';

import { BookHeaderPanel } from '@/features/books/components/BookHeaderPanel';
import { DebatePanel } from '@/features/debates/components/DebatePanel';
import { DebateRoomsPanel } from '@/features/debates/components/DebateRoomsPanel';

import { ReadingWorkspacePanelLayout } from './reading-workspace-panel-layout';

function positiveParam(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function DebateRoomsRoute() {
  const bookId = positiveParam(useParams().bookId);
  if (!bookId) return <Navigate replace to="/book/library" />;
  return (
    <ReadingWorkspacePanelLayout>
      <BookHeaderPanel bookId={bookId} />
      <DebateRoomsPanel bookId={bookId} />
    </ReadingWorkspacePanelLayout>
  );
}

export function DebateRoute() {
  const { bookId: rawBookId, windowId: rawWindowId } = useParams();
  const bookId = positiveParam(rawBookId);
  const windowId = positiveParam(rawWindowId);
  if (!bookId || !windowId) {
    return <Navigate replace to={bookId ? `/book/${bookId}/debate-rooms` : '/book/library'} />;
  }
  return (
    <ReadingWorkspacePanelLayout>
      <BookHeaderPanel bookId={bookId} />
      <DebatePanel bookId={bookId} windowId={windowId} />
    </ReadingWorkspacePanelLayout>
  );
}
