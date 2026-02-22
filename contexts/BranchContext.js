import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { getStoredAuth, getBranches } from "../lib/apiClient";

const BRANCH_STORAGE_KEY = "restaurantos_branch_id";

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranchState] = useState(null);
  const [loading, setLoading] = useState(false);

  const setCurrentBranch = useCallback((branch) => {
    setCurrentBranchState(branch);
    if (typeof window !== "undefined") {
      if (branch) {
        window.localStorage.setItem(BRANCH_STORAGE_KEY, branch.id);
      } else {
        window.localStorage.setItem(BRANCH_STORAGE_KEY, "all");
      }
    }
  }, []);

  // Load branches when user is logged in (tenant dashboard). Super_admin loads branches when "acting as" a restaurant.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const auth = getStoredAuth();
    const token = auth?.token;
    const role = auth?.user?.role;
    const tenantSlug = auth?.user?.tenantSlug || auth?.tenantSlug;

    // No branch context when not logged in, or super_admin not acting as a tenant
    const isSuperAdminWithoutTenant = role === "super_admin" && !tenantSlug;
    if (isSuperAdminWithoutTenant || !token) {
      setBranches([]);
      setCurrentBranchState(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getBranches()
      .then((data) => {
        if (cancelled) return;
        const list = data?.branches ?? (Array.isArray(data) ? data : []);
        setBranches(list);

        const savedId = window.localStorage.getItem(BRANCH_STORAGE_KEY);
        const isAdminOrOwner = role === "restaurant_admin" || role === "admin" || role === "super_admin";
        // Only admin/owner can use "All branches"; manager and others default to first assigned branch
        const defaultBranch =
          savedId === "all" || !savedId
            ? (isAdminOrOwner ? null : list[0] ?? null)
            : (list.find((b) => b.id === savedId) ?? list[0] ?? null);
        setCurrentBranchState(defaultBranch);
        if (defaultBranch) {
          window.localStorage.setItem(BRANCH_STORAGE_KEY, defaultBranch.id);
        } else if (isAdminOrOwner) {
          window.localStorage.setItem(BRANCH_STORAGE_KEY, "all");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranches([]);
          setCurrentBranchState(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []); // Re-run on mount; auth changes handled by storage listener or full reload after login

  // Re-run branch load when auth storage might have changed (e.g. after login or super_admin acting-as)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e) => {
      if (e.key === "restaurantos_auth" && e.newValue) {
        const auth = JSON.parse(e.newValue);
        const role = auth?.user?.role;
        const tenantSlug = auth?.user?.tenantSlug || auth?.tenantSlug;
        const shouldLoad = auth?.token && (role !== "super_admin" || tenantSlug);
        if (shouldLoad) {
          getBranches()
            .then((data) => {
              const list = data?.branches ?? (Array.isArray(data) ? data : []);
              setBranches(list);
              const r = auth?.user?.role;
              const isAdminOrOwner = r === "restaurant_admin" || r === "admin" || r === "super_admin";
              const savedId = window.localStorage.getItem(BRANCH_STORAGE_KEY);
              const defaultBranch =
                savedId === "all" || !savedId
                  ? (isAdminOrOwner ? null : list[0] ?? null)
                  : (list.find((b) => b.id === savedId) ?? list[0] ?? null);
              setCurrentBranchState(defaultBranch);
            })
            .catch(() => setBranches([]));
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = {
    branches,
    currentBranch,
    setCurrentBranch,
    loading,
    hasMultipleBranches: branches.length > 1,
  };

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  return context;
}
