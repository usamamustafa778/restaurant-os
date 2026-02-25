import { useEffect } from "react";
import { useRouter } from "next/router";

// Redirect /menu to /categories
export default function MenuRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/categories");
  }, [router]);

  return null;
}
