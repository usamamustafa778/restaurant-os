import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Legacy URL: /rider-payouts → unified Riders hub.
 * Kept so bookmarks and old links keep working.
 */
export default function RiderPayoutsLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/riders");
  }, [router]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500 dark:text-neutral-400">
      Redirecting to Riders…
    </div>
  );
}
