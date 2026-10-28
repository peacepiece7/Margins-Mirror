import type { FormEvent, ReactNode } from 'react';
import type { Question, SessionInsight } from '@/types/api/session';
import type { Persona } from '@/types/api/persona';
import type { InterviewAnswer } from '@/types/api/reflection-loop';

export type InterviewAnswerDraft = Pick<InterviewAnswer, 'questionId' | 'content'>;

export interface GuidedDiscussionPanelProps {
  bookId: number;
  runId: number;
  personas: Persona[];
}

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
  developerDraftControl?: ReactNode;
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
  developerDraftControl?: ReactNode;
  onAnswerChange: (answer: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}
