import { router } from "expo-router";
import { Linking } from "react-native";

import { TermsScreen } from "@/features/service-terms/terms-screen";

export default function TermsRoute() {
  return (
    <TermsScreen
      onContact={() => void Linking.openURL("mailto:support@example.com")}
      onOpenHistory={() => router.push("/terms-history")}
      onOpenPrivacy={() => router.push("/privacy")}
    />
  );
}
