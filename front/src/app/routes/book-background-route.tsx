import { Navigate, useParams } from 'react-router-dom';
import { BookBackgroundEditor } from '@/features/books/components/BookBackgroundEditor';
import { ReadingWorkspacePanelLayout } from './reading-workspace-panel-layout';

export function BookBackgroundRoute() {
  const bookId = Number(useParams().bookId);
  if (!Number.isSafeInteger(bookId) || bookId <= 0) return <Navigate replace to="/book/library" />;
  return (
    <ReadingWorkspacePanelLayout>
      <BookBackgroundEditor bookId={bookId} />
    </ReadingWorkspacePanelLayout>
  );
}
