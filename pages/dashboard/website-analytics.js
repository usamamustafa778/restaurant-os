import { useEffect } from "react";
import { useRouter } from "next/router";

export default function WebsiteAnalyticsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/website-settings?section=analytics");
  }, [router]);

  return null;
}
