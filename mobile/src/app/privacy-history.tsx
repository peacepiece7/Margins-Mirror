import { useRouter } from "expo-router";

import { PrivacyHistoryScreen } from "@/features/privacy/privacy-screen";

export default function PrivacyHistoryRoute() {
  const router = useRouter();
  return <PrivacyHistoryScreen onOpenCurrent={() => router.replace("/privacy")} />;
}
