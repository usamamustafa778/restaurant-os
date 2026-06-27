import { Loader2 } from "lucide-react";
import { usePlatformPermissionGate } from "../../hooks/usePlatformPermissionGate";

/** Blocks super page content until permissions load; redirects when access is denied. */
export default function SuperPageGate({ permission, children }) {
  const { permissionsLoaded, hasAccess } = usePlatformPermissionGate(permission);

  if (!permissionsLoaded || !hasAccess) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return children;
}
