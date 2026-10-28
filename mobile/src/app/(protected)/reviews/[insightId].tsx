import { router, useLocalSearchParams } from "expo-router";

import { ReviewDetailScreen } from "@/features/reviews/reviews-screen";

export default function ReviewDetailRoute() {
  const params = useLocalSearchParams<{ insightId?: string }>();
  const insightId = Number(params.insightId);
  return (
    <ReviewDetailScreen
      insightId={Number.isSafeInteger(insightId) && insightId > 0 ? insightId : -1}
      onBack={() => router.back()}
    />
  );
}
