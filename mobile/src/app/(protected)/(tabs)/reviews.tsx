import { router } from "expo-router";

import { ReviewsScreen } from "@/features/reviews/reviews-screen";

export default function ReviewsRoute() {
  return (
    <ReviewsScreen
      onOpenReview={(insightId) => router.push(`/reviews/${insightId}`)}
    />
  );
}
