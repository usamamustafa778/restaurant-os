import { createContext, useContext, useState, useEffect } from "react";
import { getMyPermissions, getStoredAuth } from "../lib/apiClient";

const PermissionContext = createContext({
  permissions: [],
  hasPermission: () => true,
  permissionsLoaded: false,
});

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth?.token) {
      setPermissionsLoaded(true);
      return;
    }

    const PRIVILEGED = ["super_admin"];
    if (PRIVILEGED.includes(auth.user?.role)) {
      setPermissions(["*"]);
      setPermissionsLoaded(true);
      return;
    }

    getMyPermissions()
      .then((data) => {
        console.log("Permissions loaded:", data.permissions);
        setPermissions(data.permissions || []);
        setPermissionsLoaded(true);
      })
      .catch(() => {
        setPermissions([]);
        setPermissionsLoaded(true);
      });
  }, []);

  const hasPermission = (key) => {
    if (!permissionsLoaded) return true;
    if (permissions.includes("*")) return true;
    return permissions.includes(key);
  };

  return (
    <PermissionContext.Provider
      value={{ permissions, hasPermission, permissionsLoaded }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);
