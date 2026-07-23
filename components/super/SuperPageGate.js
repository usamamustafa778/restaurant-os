import { Loader2, ShieldOff } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { usePlatformPermissionGate } from "../../hooks/usePlatformPermissionGate";
import { usePermissions } from "../../contexts/PermissionContext";
import {
  getFirstSuperAdminPath,
  normalizeSuperPath,
} from "../../lib/superAdminNav";

/** Blocks super page content until permissions load; redirects when access is denied. */
export default function SuperPageGate({
  permission,
  ownerOnly = false,
  children,
}) {
  const router = useRouter();
  const { hasPermission, hasViewOrManage, permissions, permissionsLoaded } =
    usePermissions();
  usePlatformPermissionGate(ownerOnly ? null : permission);

  const isOwner = permissions.includes("*");
  const allowsAccess = ownerOnly
    ? permissionsLoaded && isOwner
    : permissionsLoaded &&
      (permission?.endsWith(".view")
        ? hasViewOrManage(permission)
        : hasPermission(permission));

  const canAccessNavItem = (perm) => {
    if (perm === "*") return isOwner;
    return perm.endsWith(".view")
      ? hasViewOrManage(perm)
      : hasPermission(perm);
  };

  useEffect(() => {
    if (!permissionsLoaded || allowsAccess) return;
    const fallback = getFirstSuperAdminPath(canAccessNavItem);
    const current = normalizeSuperPath(router.pathname);
    if (current !== fallback) {
      router.replace(fallback);
    }
  }, [permissionsLoaded, allowsAccess, router]);

  if (!permissionsLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!allowsAccess) {
    const fallback = getFirstSuperAdminPath(canAccessNavItem);
    const current = normalizeSuperPath(router.pathname);
    if (current !== fallback) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      );
    }

    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldOff className="h-10 w-10 text-gray-400" />
        <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">
          You don&apos;t have access to this page.
        </p>
        <p className="text-xs text-gray-500 dark:text-neutral-400 max-w-sm">
          {ownerOnly
            ? "This section is only available to the platform owner."
            : "Ask a platform owner to update your role permissions if you need access here."}
        </p>
      </div>
    );
  }

  return children;
}
