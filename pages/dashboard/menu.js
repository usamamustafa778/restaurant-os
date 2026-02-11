import { useEffect } from "react";
import { useRouter } from "next/router";

// Redirect /dashboard/menu to /dashboard/categories
export default function MenuRedirect() {
  const router = useRouter();
  useEffect(() => {
    // Preserve tenant slug from URL
    const path = router.asPath.replace(/\/dashboard\/menu.*/, "/dashboard/categories");
    router.replace(path);
  }, [router]);

  return null;
}
