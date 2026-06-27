import { useEffect } from "react";
import { useRouter } from "next/router";
import { usePermissions } from "../contexts/PermissionContext";

const SUPER_OVERVIEW_PATH = "/super/overview";

/**
 * Redirects to /super/overview when the user lacks a platform permission.
 * Returns hasAccess=false until permissions are loaded, then reflects the check.
 */
export function usePlatformPermissionGate(permissionKey) {
  const router = useRouter();
  const { hasPermission, permissionsLoaded } = usePermissions();

  const hasAccess = permissionsLoaded && hasPermission(permissionKey);

  useEffect(() => {
    if (permissionsLoaded && !hasPermission(permissionKey)) {
      router.replace(SUPER_OVERVIEW_PATH);
    }
  }, [permissionsLoaded, permissionKey, hasPermission, router]);

  return { permissionsLoaded, hasAccess };
}
