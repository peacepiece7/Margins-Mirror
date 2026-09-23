export type PublicReview = {
  insightId: number;
  sessionId: number;
  bookId: number;
  bookTitle: string;
  bookAuthor?: string | null;
  sessionTitle: string;
  title?: string | null;
  content: string;
  evidence?: string | null;
  authorName?: string | null;
  reviewedOn?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PublicReviewListResponse = { reviews: PublicReview[] };

export type ReviewComment = {
  commentId: number;
  insightId: number;
  parentCommentId?: number | null;
  authorName?: string | null;
  content: string;
  ownedByCurrentReader: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ReviewCommentListResponse = {
  insightId: number;
  comments: ReviewComment[];
};
