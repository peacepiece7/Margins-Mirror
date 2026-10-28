import { useRouter } from "expo-router";

import { PrivacyScreen } from "@/features/privacy/privacy-screen";

export default function PrivacyRoute() {
  const router = useRouter();
  return <PrivacyScreen onOpenHistory={() => router.push("/privacy-history")} />;
}
