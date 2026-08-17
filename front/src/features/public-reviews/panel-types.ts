import type { FormEvent } from 'react';
import type { PublicReview, ReviewComment } from '@/types/api/session';

export interface PublicReviewsPageProps {
  commentDrafts: Record<number, string>;
  comments: Record<number, ReviewComment[]>;
  commentsError: Record<number, string>;
  commentsPending: Record<number, boolean>;
  editingCommentDraft: string;
  editingCommentId?: number;
  error: string;
  loaded: boolean;
  pending: boolean;
  replyDrafts: Record<number, string>;
  reviews: PublicReview[];
  onCancelEdit: () => void;
  onCommentDraftChange: (insightId: number, value: string) => void;
  onDeleteComment: (insightId: number, commentId: number) => void;
  onEditingDraftChange: (value: string) => void;
  onLoadComments: (insightId: number) => void;
  onOpenBook: (bookId: number) => void;
  onRefresh: () => void;
  onReplyDraftChange: (commentId: number, value: string) => void;
  onStartEdit: (comment: ReviewComment) => void;
  onSubmitComment: (event: FormEvent, insightId: number, parentCommentId?: number) => void;
  onSubmitEdit: (event: FormEvent, insightId: number, commentId: number) => void;
}
