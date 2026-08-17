import type { FormEvent } from 'react';
import type { Question, SessionInsight } from '@/types/api/session';

export type ReviewFilter = 'all' | 'reflection' | 'question_answer';

export interface ReviewPageProps {
  filter: ReviewFilter;
  insights: SessionInsight[];
  loading: boolean;
  questions: Question[];
  selectedBook: boolean;
  onDiscussAnswer: (questionId: number) => void;
  onEditAnswer: (questionId: number) => void;
  onEditReview: (insightId: number) => void;
  onFilterChange: (filter: ReviewFilter) => void;
  onWrite: () => void;
}

export interface ReviewEditorPageProps {
  authorName: string;
  content: string;
  evidence: string;
  isEditing: boolean;
  loading: boolean;
  reviewedOn: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  onAuthorNameChange: (value: string) => void;
  onCancel: () => void;
  onContentChange: (value: string) => void;
  onEvidenceChange: (value: string) => void;
  onReviewedOnChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onVisibilityChange: (value: 'PRIVATE' | 'PUBLIC') => void;
}

export interface QuestionAnswerEditorPageProps {
  answer: string;
  hasExistingAnswer: boolean;
  loading: boolean;
  questionText: string;
  onAnswerChange: (answer: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}
