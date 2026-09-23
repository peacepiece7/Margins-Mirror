import { router } from "expo-router";

import { useAuthSession } from "@/features/auth/session-provider";
import { ConsentScreen } from "@/features/privacy/consent-screen";

export default function ConsentRoute() {
  const { logout, refreshSession } = useAuthSession();
  return (
    <ConsentScreen
      logout={logout}
      onOpenAccount={() => router.push("/consent-account")}
      onOpenPrivacy={() => router.push("/privacy")}
      onOpenTerms={() => router.push("/terms")}
      refreshSession={refreshSession}
    />
  );
}
