import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Receipt,
  UtensilsCrossed,
  Percent,
  History,
  Users,
  LogOut,
  Factory,
  Settings2,
  Sun,
  Moon,
  ClipboardList,
  BarChart3,
  UserCog,
  UserCheck,
  ChefHat,
  MapPin,
  UserCircle2,
  ChevronRight,
  ChevronDown,
  Plug,
  FolderOpen,
  ShoppingBag,
  PlusSquare,
  ListOrdered,
  CreditCard,
  Globe,
} from "lucide-react";
import { getToken, getStoredAuth } from "../../lib/apiClient";
import { useTheme } from "../../contexts/ThemeContext";
import { useBranch } from "../../contexts/BranchContext";
import { getTenantRoute } from "../../lib/routes";

// Base tenant dashboard routes with grouped sections (inspired by Dream POS)
const tenantNav = [
  { path: "/dashboard/overview", label: "Dashboard", icon: LayoutDashboard },
  { path: "/dashboard/pos", label: "POS", icon: Receipt },
  { path: "/dashboard/orders", label: "Orders", icon: ClipboardList },
  { path: "/dashboard/kitchen", label: "Kitchen (KDS)", icon: ChefHat },
  { path: "/dashboard/reservations", label: "Reservations", icon: History },

  // MENU MANAGEMENT Section
  { type: "section", label: "MENU MANAGEMENT" },
  { path: "/dashboard/categories", label: "Categories", icon: FolderOpen },
  { path: "/dashboard/menu-items", label: "Items", icon: ShoppingBag },

  // OPERATIONS Section
  { type: "section", label: "OPERATIONS" },
  { path: "/dashboard/customers", label: "Customers", icon: UserCheck },
  { path: "/dashboard/inventory", label: "Inventory", icon: Factory },

  // ADMINISTRATION Section
  { type: "section", label: "ADMINISTRATION" },
  { path: "/dashboard/users", label: "Users", icon: Users },
  { path: "/dashboard/branches", label: "Branches", icon: MapPin },
  { path: "/dashboard/history", label: "Reports", icon: BarChart3 },

  // SETTINGS Section
  { type: "section", label: "SETTINGS" },
  { path: "/dashboard/website", label: "Website Settings", icon: Globe },
  {
    path: "/dashboard/integrations",
    label: "Integrations / API",
    icon: Plug,
    roles: ["restaurant_admin", "admin"],
  },
  {
    path: "/dashboard/subscription",
    label: "Subscription",
    icon: CreditCard,
    roles: ["restaurant_admin", "admin"],
  },
  { path: "/dashboard/profile", label: "Profile", icon: UserCircle2 },
];

const superNav = [
  {
    href: "/dashboard/super/overview",
    label: "Platform Overview",
    icon: LayoutDashboard,
  },
  { href: "/dashboard/super/restaurants", label: "Restaurants", icon: Factory },
  {
    href: "/dashboard/super/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
  },
  {
    href: "/dashboard/super/settings",
    label: "System Settings",
    icon: Settings2,
  },
];

// Manager-focused navigation, inspired by Nimbus-style layout
const managerNav = [
  { path: "/dashboard/overview", label: "Dashboard", icon: LayoutDashboard },
  { path: "/dashboard/orders", label: "Order Management", icon: ClipboardList },
  { path: "/dashboard/day-report", label: "Day Report", icon: BarChart3 },
  { path: "/dashboard/users", label: "User Management", icon: Users },
  { path: "/dashboard/branches", label: "Branches", icon: MapPin },
  { path: "/dashboard/profile", label: "Profile", icon: UserCircle2 },
];

/**
 * Tooltip wrapper using fixed positioning (never clipped by overflow).
 * - Regular items: shows a simple tooltip on hover.
 * - Items with `dropdownItems`: shows a sub-dropdown with heading + styled child items.
 */
function NavItemWrapper({
  collapsed,
  label,
  children,
  dropdownItems,
  className,
  ...rest
}) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (hovered && collapsed && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right });
    }
  }, [hovered, collapsed]);

  // Clear timer on unmount
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const handleEnter = () => {
    clearTimeout(hideTimer.current);
    setHovered(true);
  };
  const handleLeave = () => {
    // Small delay so user can cross the gap to the dropdown
    hideTimer.current = setTimeout(() => setHovered(false), 120);
  };

  const hasDropdownItems = dropdownItems && dropdownItems.length > 0;
  const hasDropdown = collapsed && hovered && hasDropdownItems;
  const hasTooltip = collapsed && hovered && label && !hasDropdownItems;

  return (
    <div
      ref={ref}
      className={className || "relative"}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {children}

      {/* Simple tooltip for regular items */}
      {hasTooltip && (
        <div
          className="fixed z-[9999] whitespace-nowrap rounded-md bg-bg-secondary dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-gray-800 dark:text-neutral-200 shadow-lg pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left + 10,
            transform: "translateY(-50%)",
          }}
        >
          {label}
        </div>
      )}

      {/* Sub-dropdown for items with children */}
      {hasDropdown && (
        <div
          className="fixed z-[9999]"
          style={{
            top: pos.top,
            left: pos.left,
            transform: "translateY(-50%)",
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {/* Invisible bridge to connect sidebar icon to dropdown */}
          <div className="absolute inset-y-0 left-0 w-3" />

          <div className="ml-3 min-w-[190px] rounded-xl bg-bg-secondary dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-xl overflow-hidden">
            {/* Dropdown heading */}
            <div className="px-3.5 py-2 bg-bg-primary dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
              <span className="text-[11px] font-semibold text-gray-800 dark:text-neutral-200 tracking-wide">
                {label}
              </span>
            </div>

            {/* Sub-items */}
            <div className="p-1.5 space-y-0.5">
              {dropdownItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    item.isActive
                      ? "bg-primary/10 text-primary dark:text-primary"
                      : "text-gray-600 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {item.icon && <item.icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function decodeRoleFromToken(token) {
  if (!token || typeof window === "undefined") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    // Decode JWT payload in browser without Buffer
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = window.atob(base64);
    const payload = JSON.parse(json);
    return payload.role || null;
  } catch {
    return null;
  }
}

export default function AdminLayout({ title, children, suspended = false }) {
  const router = useRouter();
  const {
    branches,
    currentBranch,
    setCurrentBranch,
    hasMultipleBranches,
    loading: branchLoading,
  } = useBranch() || {};
  const [role, setRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });
  const [expandedGroups, setExpandedGroups] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("sidebar_expanded_groups");
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const { theme, toggleTheme } = useTheme();

  // Persist collapsed state and notify listeners
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem("sidebar_collapsed", String(next));
      window.dispatchEvent(
        new CustomEvent("sidebar-toggle", { detail: { collapsed: next } }),
      );
      return next;
    });
  }, []);

  useEffect(() => {
    const token = getToken();
    const r = decodeRoleFromToken(token);
    setRole(r);

    const auth = getStoredAuth();
    const name = auth?.user?.name || auth?.user?.email || "";
    setUserName(name);
    if (name) {
      const parts = name.trim().split(/\s+/).slice(0, 2);
      const initials = parts.map((p) => p[0]?.toUpperCase() || "").join("");
      setUserInitials(initials || name[0]?.toUpperCase() || "");
    }
  }, []);

  // Auto-expand the relevant group on initial load if on a child page
  useEffect(() => {
    if (expandedGroups.length === 0) {
      const toExpand = [];
      if (
        router.asPath.includes("/dashboard/menu") ||
        router.asPath.includes("/dashboard/categories") ||
        router.asPath.includes("/dashboard/menu-items")
      )
        toExpand.push("/dashboard/menu");
      if (
        router.asPath.includes("/dashboard/orders") ||
        router.asPath.includes("/dashboard/pos")
      )
        toExpand.push("/dashboard/orders");
      if (toExpand.length > 0) {
        setExpandedGroups(toExpand);
        sessionStorage.setItem(
          "sidebar_expanded_groups",
          JSON.stringify(toExpand),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rawNavItems =
    role === "super_admin"
      ? superNav
      : role === "manager"
        ? managerNav
        : tenantNav;
  // Filter nav items by role if the item has a `roles` whitelist
  const navItems = rawNavItems.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
  const roleLabel =
    role === "super_admin"
      ? "Super Admin"
      : role === "restaurant_admin"
        ? "Restaurant Admin"
        : role === "admin"
          ? "Admin"
          : role === "product_manager"
            ? "Product Manager"
            : role === "cashier"
              ? "Cashier"
              : role === "manager"
                ? "Manager"
                : role === "kitchen_staff"
                  ? "Kitchen Staff"
                  : "Staff";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("restaurantos_auth");
    }
    // Dashboard login is always on the main domain
    window.location.href = "/login";
  }

  const sidebarWidthClass = collapsed ? "w-16" : "w-56";

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-black flex text-gray-900 dark:text-white text-sm">
      <aside
        className={`hidden md:flex ${sidebarWidthClass} flex-col border-r-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 relative z-40 transition-[width] duration-300 ease-in-out shadow-sm`}
      >
        {/* Logo Section */}
        <div className="px-4 py-3 border-b-2 border-gray-100 dark:border-neutral-800 flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-secondary flex items-center justify-center text-white font-bold text-base shadow-lg shadow-primary/30">
              ED
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950"></div>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg tracking-tight text-gray-900 dark:text-white truncate">
                Eats Desk
              </div>
              <div className="text-xs text-gray-500 dark:text-neutral-400 truncate font-medium">
                {role === "super_admin" ? "Platform Console" : "Restaurant OS"}
              </div>
            </div>
          )}
        </div>

        {/* Collapse / expand chevron on right border */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:flex absolute top-14 -right-3.5 h-7 w-7 z-10 items-center justify-center rounded-full bg-white dark:bg-neutral-900 shadow-lg border-2 border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gradient-to-br hover:from-primary hover:to-secondary hover:text-white hover:border-primary transition-all duration-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
        <nav className="flex-1 p-3 overflow-y-auto">
          {navItems.map((item, idx) => {
            // Render section headers
            if (item.type === "section") {
              if (collapsed) return null; // Hide section headers when collapsed
              return (
                <div
                  key={`section-${idx}`}
                  className="pt-5 pb-2 px-3 first:pt-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent dark:from-neutral-700"></div>
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
                    {item.label}
                  </p>
                </div>
              );
            }

            const basePath = item.path || "";
            const href =
              role === "super_admin"
                ? item.href
                : getTenantRoute(router.asPath || router.pathname, basePath);

            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedGroups.includes(basePath);
            // For groups, check if any child path matches current route
            const isActive = hasChildren
              ? item.children.some((child) => {
                  const cHref = getTenantRoute(
                    router.asPath || router.pathname,
                    child.path,
                  );
                  return (
                    router.asPath === cHref ||
                    router.asPath.startsWith(cHref + "?") ||
                    router.asPath.startsWith(cHref + "/")
                  );
                })
              : router.asPath.startsWith(href);

            if (suspended && role !== "super_admin") {
              return (
                <NavItemWrapper
                  key={href}
                  collapsed={collapsed}
                  label={item.label}
                >
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 dark:text-neutral-600 bg-bg-primary/60 dark:bg-neutral-900/60 cursor-not-allowed">
                    <Icon className="w-4 h-4" />
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                </NavItemWrapper>
              );
            }

            {
              /* Items with children (e.g. Menu) */
            }
            if (hasChildren) {
              // Build structured dropdown items for collapsed hover
              const dropdownData = collapsed
                ? item.children.map((child) => {
                    const childHref = getTenantRoute(
                      router.asPath || router.pathname,
                      child.path,
                    );
                    // Generic active detection: tab-based or path-based
                    const childTab = child.path.includes("tab=")
                      ? child.path.split("tab=")[1]
                      : "";
                    const currentTab = router.asPath.includes("tab=")
                      ? router.asPath.split("tab=")[1]?.split("&")[0]
                      : "";
                    const isChildActive = childTab
                      ? router.asPath.includes(basePath.split("?")[0]) &&
                        childTab === currentTab
                      : router.asPath === childHref ||
                        router.asPath.startsWith(childHref + "?");
                    return {
                      path: child.path,
                      href: childHref,
                      label: child.label,
                      icon: child.icon,
                      isActive: isChildActive,
                    };
                  })
                : undefined;

              return (
                <NavItemWrapper
                  key={href}
                  collapsed={collapsed}
                  label={item.label}
                  dropdownItems={dropdownData}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!collapsed) {
                        setExpandedGroups((prev) => {
                          const next = prev.includes(basePath)
                            ? prev.filter((g) => g !== basePath)
                            : [...prev, basePath];
                          sessionStorage.setItem(
                            "sidebar_expanded_groups",
                            JSON.stringify(next),
                          );
                          return next;
                        });
                      }
                    }}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20"
                        : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white hover:shadow-sm"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform ${isActive ? "" : "group-hover:scale-110"}`}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </>
                    )}
                  </button>

                  {/* Inline dropdown when sidebar is expanded — animated */}
                  {!collapsed && (
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                      style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 dark:border-neutral-800 pl-3 pb-1">
                          {item.children.map((child) => {
                            const childHref = getTenantRoute(
                              router.asPath || router.pathname,
                              child.path,
                            );
                            const childTab = child.path.includes("tab=")
                              ? child.path.split("tab=")[1]
                              : "";
                            const currentTab = router.asPath.includes("tab=")
                              ? router.asPath.split("tab=")[1]?.split("&")[0]
                              : "";
                            const isChildActive = childTab
                              ? router.asPath.includes(
                                  basePath.split("?")[0],
                                ) && childTab === currentTab
                              : router.asPath === childHref ||
                                router.asPath.startsWith(childHref + "?");
                            const ChildIcon = child.icon;

                            return (
                              <Link
                                key={child.path}
                                href={childHref}
                                className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  isChildActive
                                    ? "bg-primary/10 text-primary dark:text-primary shadow-sm"
                                    : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"
                                }`}
                              >
                                {ChildIcon && (
                                  <ChildIcon
                                    className={`w-4 h-4 ${isChildActive ? "" : "group-hover:scale-110 transition-transform"}`}
                                  />
                                )}
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </NavItemWrapper>
              );
            }

            {
              /* Regular nav items */
            }
            return (
              <NavItemWrapper
                key={href}
                collapsed={collapsed}
                label={item.label}
              >
                <Link
                  href={href}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20"
                      : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white hover:shadow-sm"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "" : "group-hover:scale-110"}`}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </NavItemWrapper>
            );
          })}
        </nav>
        <NavItemWrapper collapsed={collapsed} label="Logout">
          <div className="p-4 border-t-2 border-gray-100 dark:border-neutral-800">
            <button
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-500/30 hover:border-red-300 dark:hover:border-red-500/40 transition-all shadow-sm hover:shadow-md"
            >
              <LogOut className="w-5 h-5" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </NavItemWrapper>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-4 border-b-2 border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
              ED
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                Eats Desk
              </div>
              <div className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                {role === "super_admin" ? "Platform" : "Restaurant OS"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300 border-2 border-gray-200 dark:border-neutral-700 transition-all"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-500/30 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>

        <header className="hidden md:flex items-center justify-between px-8 py-2 border-b-2 border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-white via-white to-gray-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-black shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-0.5 font-medium">
                {role === "super_admin"
                  ? "Manage restaurants, subscriptions and platform configuration"
                  : "Manage your restaurant operations"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {role !== "super_admin" && !branchLoading && (
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setBranchDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-900 dark:text-neutral-100 font-bold text-sm shadow-sm hover:shadow-md transition-all"
                >
                  <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-white" />
                  </div>
                  <span className="truncate max-w-[160px]">
                    {currentBranch ? currentBranch.name : "All branches"}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 dark:text-neutral-400 transition-transform ${branchDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {branchDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      aria-hidden
                      onClick={() => setBranchDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 min-w-[260px] rounded-2xl bg-white dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 shadow-2xl overflow-hidden">
                      <div className="p-3 border-b-2 border-gray-100 dark:border-neutral-800">
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                          Select Branch
                        </p>
                      </div>
                      <div className="p-2 max-h-[300px] overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentBranch(null);
                            setBranchDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-all ${
                            !currentBranch
                              ? "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary dark:text-primary border-2 border-primary/20"
                              : "text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center ${!currentBranch ? "bg-gradient-to-br from-primary to-secondary" : "bg-gray-200 dark:bg-neutral-800"}`}
                          >
                            <MapPin
                              className={`w-4 h-4 ${!currentBranch ? "text-white" : "text-gray-500"}`}
                            />
                          </div>
                          <span>All branches</span>
                        </button>
                        {(branches && branches.length > 0
                          ? branches
                          : [{ id: "none", name: "No branches yet" }]
                        ).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              if (b.id !== "none") {
                                setCurrentBranch(b);
                              }
                              setBranchDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-all mt-1 ${
                              currentBranch?.id === b.id
                                ? "bg-gradient-to-r from-primary/10 to-secondary/10 text-primary dark:text-primary border-2 border-primary/20"
                                : "text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                            }`}
                            disabled={b.id === "none"}
                          >
                            <div
                              className={`h-8 w-8 rounded-lg flex items-center justify-center ${currentBranch?.id === b.id ? "bg-gradient-to-br from-primary to-secondary" : "bg-gray-200 dark:bg-neutral-800"}`}
                            >
                              <MapPin
                                className={`w-4 h-4 ${currentBranch?.id === b.id ? "text-white" : "text-gray-500"}`}
                              />
                            </div>
                            <span className="truncate">{b.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="border-t-2 border-gray-100 dark:border-neutral-800 p-2">
                        <Link
                          href="/dashboard/branches"
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-primary dark:text-primary hover:bg-primary/10 transition-all"
                        >
                          <PlusSquare className="w-4 h-4" />
                          Manage branches
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-bold transition-all shadow-sm hover:shadow-md text-sm"
              title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-4 h-4" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4" />
                  <span>Light</span>
                </>
              )}
            </button>
            {userName && (
              <div className="inline-flex items-center gap-3 ">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-primary/20">
                  {userInitials || userName[0]?.toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[130px]">
                    {userName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-neutral-400 leading-tight font-medium">
                    {roleLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="relative flex-1 px-6 py-6 overflow-y-auto bg-gray-100 dark:bg-black">
          {!suspended && children}

          {suspended && role !== "super_admin" && (
            <>
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full rounded-2xl border border-amber-300 bg-amber-50 px-6 py-5 text-sm text-amber-900 shadow-xl">
                  <h2 className="text-base font-semibold mb-1">
                    Subscription inactive or expired
                  </h2>
                  <p className="mb-4">
                    This restaurant&apos;s subscription is currently inactive.
                    Dashboard insights are temporarily unavailable. Please
                    contact your platform administrator to reactivate your
                    subscription.
                  </p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
