import { router } from "expo-router";
import { Linking } from "react-native";

import { TermsHistoryScreen } from "@/features/service-terms/terms-screen";

export default function TermsHistoryRoute() {
  return (
    <TermsHistoryScreen
      onContact={() => void Linking.openURL("mailto:support@margins.cloud")}
      onOpenCurrent={() => router.replace("/terms")}
      onOpenPrivacy={() => router.push("/privacy")}
    />
  );
}
