import { createContext, useContext, useState, useEffect } from "react";
import { getMyPermissions, getStoredAuth } from "../lib/apiClient";

const PermissionContext = createContext({
  permissions: [],
  hasPermission: () => true,
  hasViewOrManage: () => true,
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

  /** True when user has the view key and/or the paired *.manage key (e.g. platform.roles.view | .manage). */
  const hasViewOrManage = (viewKey) => {
    if (!permissionsLoaded) return true;
    if (permissions.includes("*")) return true;
    if (permissions.includes(viewKey)) return true;
    if (!String(viewKey || "").endsWith(".view")) return false;
    const manageKey = `${viewKey.slice(0, -5)}.manage`;
    return permissions.includes(manageKey);
  };

  return (
    <PermissionContext.Provider
      value={{ permissions, hasPermission, hasViewOrManage, permissionsLoaded, roleName }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);
