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
 * Pass null/undefined permissionKey to skip permission checks (caller gates access).
 */
export function usePlatformPermissionGate(permissionKey) {
  const router = useRouter();
  const { hasPermission, hasViewOrManage, permissionsLoaded } = usePermissions();

  const allowsAccess = !permissionKey
    ? true
    : permissionKey.endsWith(".view")
      ? hasViewOrManage(permissionKey)
      : hasPermission(permissionKey);
  const hasAccess = permissionsLoaded && allowsAccess;

  const canAccessNavItem = (perm) =>
    perm === "*"
      ? hasPermission("*")
      : perm.endsWith(".view")
        ? hasViewOrManage(perm)
        : hasPermission(perm);

  useEffect(() => {
    if (!permissionKey || !permissionsLoaded || allowsAccess) return;

    const fallback = getFirstSuperAdminPath(canAccessNavItem);
    const current = normalizeSuperPath(router.pathname);

    if (current !== fallback) {
      router.replace(fallback);
    }
  }, [permissionsLoaded, permissionKey, allowsAccess, hasPermission, hasViewOrManage, router]);

  return { permissionsLoaded, hasAccess };
}
