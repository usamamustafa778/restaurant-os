import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMyPermissions, getStoredAuth } from "../lib/apiClient";
import {
  permissionMatches,
  roleAllows,
} from "../lib/tenantPermissionGates";

const PermissionContext = createContext({
  permissions: [],
  hasPermission: () => true,
  hasViewOrManage: () => true,
  hasPermissionOrRole: () => true,
  permissionsLoaded: false,
  roleName: "",
  userRole: "",
});

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [userRole, setUserRole] = useState(() => getStoredAuth()?.user?.role || "");

  useEffect(() => {
    const auth = getStoredAuth();
    setUserRole(auth?.user?.role || "");
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

  const hasPermission = useCallback(
    (key) => {
      if (!permissionsLoaded) return true;
      return permissionMatches(permissions, key);
    },
    [permissions, permissionsLoaded],
  );

  /** Phase 2 transition: permission key OR fixed-role fallback. */
  const hasPermissionOrRole = useCallback(
    (key, allowRoles = []) => {
      if (!permissionsLoaded) return true;
      if (roleAllows(userRole, allowRoles)) return true;
      return permissionMatches(permissions, key);
    },
    [permissions, permissionsLoaded, userRole],
  );

  /** True when user has the view key and/or the paired *.manage key (e.g. platform.roles.view | .manage). */
  const hasViewOrManage = useCallback(
    (viewKey) => {
      if (!permissionsLoaded) return true;
      if (permissions.includes("*")) return true;
      if (permissionMatches(permissions, viewKey)) return true;
      if (!String(viewKey || "").endsWith(".view")) return false;
      const manageKey = `${viewKey.slice(0, -5)}.manage`;
      return permissionMatches(permissions, manageKey);
    },
    [permissions, permissionsLoaded],
  );

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        hasPermission,
        hasViewOrManage,
        hasPermissionOrRole,
        permissionsLoaded,
        roleName,
        userRole,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);
