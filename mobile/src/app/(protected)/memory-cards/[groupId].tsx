import { router, useLocalSearchParams } from "expo-router";

import { useAuthSession } from "@/features/auth/session-provider";
import { MemoryCardGroupScreen } from "@/features/memory-cards/group-screen";
import { positiveRouteId } from "@/features/memory-cards/route-params";
import { goBackOrReplace } from "@/shared/navigation/go-back-or-replace";

export default function MemoryCardGroupRoute() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = positiveRouteId(params.groupId);
  const { session } = useAuthSession();
  if (session?.membershipTier !== "PREMIUM")
    return (
      <MemoryCardGroupScreen
        groupId={groupId}
        onBack={() => goBackOrReplace("/library")}
        premium={false}
      />
    );

  return (
    <MemoryCardGroupScreen
      groupId={groupId}
      onBack={() => goBackOrReplace("/library?action=study")}
      onOpenStudy={() => router.push(`/memory-cards/${groupId}/study`)}
      premium
    />
  );
}
