import { usePermissions } from "../contexts/PermissionContext";
import { ShieldOff } from "lucide-react";

export default function PermissionGate({ permission, children }) {
  const { hasPermission, permissionsLoaded } = usePermissions();

  if (!permissionsLoaded) return null;

  if (!hasPermission(permission)) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: "16px",
          color: "#6b7280",
        }}
      >
        <ShieldOff size={48} strokeWidth={1.5} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Access Denied
        </h2>
        <p style={{ margin: 0, textAlign: "center", maxWidth: 320 }}>
          You don&apos;t have permission to view this page. Contact your manager
          to request access.
        </p>
      </div>
    );
  }

  return children;
}
