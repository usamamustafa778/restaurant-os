import { createContext, useContext, useState, useEffect } from "react";
import { getMyPermissions, getStoredAuth } from "../lib/apiClient";

const PermissionContext = createContext({
  permissions: [],
  hasPermission: () => true,
  permissionsLoaded: false,
  roleName: "",
});

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [roleName, setRoleName] = useState("");

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth?.token) {
      setPermissionsLoaded(true);
      return;
    }

    const PRIVILEGED = ["super_admin"];
    if (PRIVILEGED.includes(auth.user?.role)) {
      setPermissions(["*"]);
      setRoleName("Super Admin");
      setPermissionsLoaded(true);
      return;
    }

    getMyPermissions()
      .then((data) => {
        setPermissions(data.permissions || []);
        setRoleName(data.roleName || "");
        setPermissionsLoaded(true);
      })
      .catch(() => {
        setPermissions([]);
        setRoleName("");
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
      value={{ permissions, hasPermission, permissionsLoaded, roleName }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);
