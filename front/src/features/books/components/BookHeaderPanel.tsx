import { useBookQuery, useBookSessionQuery } from '../queries';
import { BookHeader } from './BookHeader';

export function BookHeaderPanel({ bookId }: { bookId: number }) {
  const book = useBookQuery(bookId);
  const session = useBookSessionQuery(bookId);
  return book.data ? <BookHeader book={book.data} sessionTitle={session.data?.title} /> : null;
}
