import type { BookCandidate } from '@/types/api/book';
import { testAttr } from '@/utils/testAttrs';

import { BookCandidateCard } from './BookCandidateCard';
import { BookSearchState } from './BookSearchState';

type SearchState = 'idle' | 'pending' | 'error' | 'empty';

function searchState({
  candidateCount,
  error,
  loading,
  query,
}: {
  candidateCount: number;
  error: boolean;
  loading: boolean;
  query: string;
}): SearchState | undefined {
  if (!query) return 'idle';
  if (loading) return 'pending';
  if (error) return 'error';
  if (candidateCount === 0) return 'empty';
  return undefined;
}

export function BookSearchResults({
  candidates,
  error,
  loading,
  query,
  saving,
  onRetry,
  onSave,
}: {
  candidates: BookCandidate[];
  error: boolean;
  loading: boolean;
  query: string;
  saving: boolean;
  onRetry: () => void;
  onSave: (candidate: BookCandidate) => void;
}) {
  const state = searchState({ candidateCount: candidates.length, error, loading, query });

  return (
    <div className="grid grid-cols-1 gap-3" {...testAttr('book-candidate-list')}>
      {state && <BookSearchState onRetry={onRetry} state={state} />}
      {candidates.map((candidate) => (
        <BookCandidateCard
          candidate={candidate}
          key={candidate.candidateId}
          onSave={() => onSave(candidate)}
          saving={saving}
        />
      ))}
    </div>
  );
}
