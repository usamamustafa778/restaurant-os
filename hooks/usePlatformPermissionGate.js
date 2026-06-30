import { useEffect } from "react";
import { useRouter } from "next/router";
import { usePermissions } from "../contexts/PermissionContext";
import {
  getFirstSuperAdminPath,
  normalizeSuperPath,
} from "../lib/superAdminNav";

/**
 * Blocks page content until permissions load; redirects to the first allowed
 * super page when access is denied (never loops through /super/overview).
 */
export function usePlatformPermissionGate(permissionKey) {
  const router = useRouter();
  const { hasPermission, permissionsLoaded } = usePermissions();

  const hasAccess = permissionsLoaded && hasPermission(permissionKey);

  useEffect(() => {
    if (!permissionsLoaded || hasPermission(permissionKey)) return;

    const fallback = getFirstSuperAdminPath(hasPermission);
    const current = normalizeSuperPath(router.pathname);

    if (current !== fallback) {
      router.replace(fallback);
    }
  }, [permissionsLoaded, permissionKey, hasPermission, router]);

  return { permissionsLoaded, hasAccess };
}
