import { useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useI18n } from '@/lib/i18n';
import { usePublicReviewsQuery } from '../queries';
import { PublicReviewsPage } from './PublicReviewsPage';

export function PublicReviewsPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const reviews = usePublicReviewsQuery();

  return (
    <PublicReviewsPage
      reviews={reviews.data?.reviews ?? []}
      pending={reviews.isFetching}
      loaded={!reviews.isLoading}
      error={reviews.error ? apiErrorMessage(reviews.error, t, 'publicReviewLoadFailed') : ''}
      onOpenBook={(bookId) => navigate(`/book/${bookId}`)}
      onRefresh={() => void reviews.refetch()}
    />
  );
}
