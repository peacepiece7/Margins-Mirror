import type { PublicReview } from '@/types/api/session';

export interface PublicReviewsPageProps {
  reviews: PublicReview[];
  pending: boolean;
  loaded: boolean;
  error: string;
  onOpenBook: (bookId: number) => void;
  onRefresh: () => void;
}

export interface PublicReviewCardProps {
  review: PublicReview;
  onOpenBook: (bookId: number) => void;
}

export interface ReviewCommentsPanelProps {
  insightId: number;
}

export interface ReviewCommentFormProps {
  kind: 'comment' | 'reply' | 'edit';
  initialContent?: string;
  pending: boolean;
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
}
