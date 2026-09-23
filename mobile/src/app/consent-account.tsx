import { router } from "expo-router";
import { Linking } from "react-native";

import { AccountScreen } from "@/features/account/account-screen";
import { useAuthSession } from "@/features/auth/session-provider";

export default function ConsentAccountRoute() {
  const { logout, refreshSession, session } = useAuthSession();
  return (
    <AccountScreen
      logout={logout}
      membershipTier={session?.membershipTier}
      onContactSupport={() => Linking.openURL("mailto:support@margins.cloud")}
      onOpenPrivacy={() => router.push("/privacy")}
      onOpenPrivacyHistory={() => router.push("/privacy-history")}
      onOpenTerms={() => router.push("/terms")}
      onOpenTermsHistory={() => router.push("/terms-history")}
      refreshSession={refreshSession}
    />
  );
}
