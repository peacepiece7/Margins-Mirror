import { useNavigate } from 'react-router-dom';

import { useDebateTimelineForBook } from '../queries';
import { DebateRoomsPage } from './DebateRoomsPage';

export function DebateRoomsPanel({ bookId }: { bookId: number }) {
  const navigate = useNavigate();
  const { timeline } = useDebateTimelineForBook(bookId);
  const windows = (timeline.data?.windows ?? []).filter((window) => window.windowType === 'debate');
  return (
    <DebateRoomsPage
      windows={windows}
      onSelectWindow={(window) => navigate(`/book/${bookId}/debate/${window.windowId}`)}
    />
  );
}
