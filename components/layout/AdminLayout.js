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
  Globe
} from "lucide-react";
import { getToken } from "../../lib/apiClient";
import { useTheme } from "../../contexts/ThemeContext";
import { getTenantRoute, getTenantSlugFromPath } from "../../lib/routes";

// Base tenant dashboard routes (tenantSlug will be injected at runtime)
const tenantNav = [
  { path: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  {
    path: "/dashboard/orders",
    label: "Orders",
    icon: ClipboardList,
    children: [
      { path: "/dashboard/pos", label: "Create Order", icon: PlusSquare },
      { path: "/dashboard/orders", label: "All Orders", icon: ListOrdered }
    ]
  },
  {
    path: "/dashboard/menu",
    label: "Menu",
    icon: UtensilsCrossed,
    children: [
      { path: "/dashboard/categories", label: "Categories", icon: FolderOpen },
      { path: "/dashboard/menu-items", label: "Menu Items", icon: ShoppingBag }
    ]
  },
  { path: "/dashboard/inventory", label: "Inventory", icon: Factory },
  {
    path: "/dashboard/website",
    label: "Website",
    icon: Globe,
    children: [
      { path: "/dashboard/website", label: "Settings", icon: Settings2 },
      { path: "/dashboard/website-content", label: "Content", icon: Percent }
    ]
  },
  { path: "/dashboard/history", label: "Reports", icon: History },
  { path: "/dashboard/integrations", label: "Integrations", icon: Plug, roles: ["restaurant_admin", "admin"] },
  { path: "/dashboard/users", label: "Users", icon: Users },
  { path: "/dashboard/subscription", label: "Subscription", icon: CreditCard, roles: ["restaurant_admin", "admin"] }
];

const superNav = [
  { href: "/dashboard/super/overview", label: "Platform Overview", icon: LayoutDashboard },
  { href: "/dashboard/super/restaurants", label: "Restaurants", icon: Factory },
  { href: "/dashboard/super/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/dashboard/super/settings", label: "System Settings", icon: Settings2 }
];

// Manager-focused navigation, inspired by Nimbus-style layout
const managerNav = [
  { path: "/dashboard/overview", label: "Dashboard", icon: LayoutDashboard },
  { path: "/dashboard/orders", label: "Order Management", icon: ClipboardList },
  { path: "/dashboard/day-report", label: "Day Report", icon: BarChart3 },
  { path: "/dashboard/users", label: "User Management", icon: Users },
  { path: "/dashboard/branches", label: "Branches", icon: MapPin },
  { path: "/dashboard/profile", label: "Profile", icon: UserCircle2 }
];

/** 
 * Tooltip wrapper using fixed positioning (never clipped by overflow).
 * - Regular items: shows a simple tooltip on hover.
 * - Items with `dropdownItems`: shows a sub-dropdown with heading + styled child items.
 */
function NavItemWrapper({ collapsed, label, children, dropdownItems, className, ...rest }) {
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
          style={{ top: pos.top, left: pos.left + 10, transform: "translateY(-50%)" }}
        >
          {label}
        </div>
      )}

      {/* Sub-dropdown for items with children */}
      {hasDropdown && (
        <div
          className="fixed z-[9999]"
          style={{ top: pos.top, left: pos.left, transform: "translateY(-50%)" }}
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
              {dropdownItems.map(item => (
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
  const [role, setRole] = useState(null);
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
      } catch { return []; }
    }
    return [];
  });
  const { theme, toggleTheme } = useTheme();

  // Persist collapsed state and notify listeners
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      sessionStorage.setItem("sidebar_collapsed", String(next));
      window.dispatchEvent(new CustomEvent("sidebar-toggle", { detail: { collapsed: next } }));
      return next;
    });
  }, []);

  useEffect(() => {
    const token = getToken();
    const r = decodeRoleFromToken(token);
    setRole(r);
  }, []);

  // Auto-expand the relevant group on initial load if on a child page
  useEffect(() => {
    if (expandedGroups.length === 0) {
      const toExpand = [];
      if (router.asPath.includes("/dashboard/menu") || router.asPath.includes("/dashboard/categories") || router.asPath.includes("/dashboard/menu-items")) toExpand.push("/dashboard/menu");
      if (router.asPath.includes("/dashboard/orders") || router.asPath.includes("/dashboard/pos")) toExpand.push("/dashboard/orders");
      if (toExpand.length > 0) {
        setExpandedGroups(toExpand);
        sessionStorage.setItem("sidebar_expanded_groups", JSON.stringify(toExpand));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rawNavItems =
    role === "super_admin" ? superNav : role === "manager" ? managerNav : tenantNav;
  // Filter nav items by role if the item has a `roles` whitelist
  const navItems = rawNavItems.filter(
    item => !item.roles || item.roles.includes(role)
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
    const slug = getTenantSlugFromPath(router.asPath || router.pathname);
    const target = slug ? `/r/${encodeURIComponent(slug)}/login` : "/login";
    router.push(target);
  }

  const sidebarWidthClass = collapsed ? "w-16" : "w-56";

  return (
    <div className="h-screen overflow-hidden bg-bg-primary dark:bg-black flex text-gray-900 dark:text-white text-sm">
      <aside
        className={`hidden md:flex ${sidebarWidthClass} flex-col border-r border-gray-300 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950 relative z-40 transition-[width] duration-300 ease-in-out`}
      >
        <div className="px-4 py-5 border-b border-gray-300 dark:border-neutral-800 flex items-center gap-2 justify-between">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold">
            EO
          </span>
          {!collapsed && (
            <div className="flex-1 min-w-0 ml-2">
              <div className="font-semibold text-base tracking-tight text-gray-900  dark:text-white truncate">
                RestaurantOS
              </div>
              <div className="text-xs text-gray-800 dark:text-neutral-400 truncate">
                {role === "super_admin" ? "Platform Console" : "Restaurant Dashboard"}
              </div>
            </div>
          )}
        </div>
        {/* Collapse / expand chevron on right border */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:flex absolute top-16 -right-3 h-7 w-7 z-10 items-center justify-center rounded-full bg-bg-secondary dark:bg-neutral-900 shadow-md border border-gray-300 dark:border-neutral-800 text-gray-800 hover:bg-bg-primary dark:hover:bg-neutral-800 transition-transform duration-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
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
              ? item.children.some(child => {
                  const cHref = getTenantRoute(router.asPath || router.pathname, child.path);
                  return router.asPath === cHref || router.asPath.startsWith(cHref + "?") || router.asPath.startsWith(cHref + "/");
                })
              : router.asPath.startsWith(href);

            if (suspended && role !== "super_admin") {
              return (
                <NavItemWrapper key={href} collapsed={collapsed} label={item.label}>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 dark:text-neutral-600 bg-bg-primary/60 dark:bg-neutral-900/60 cursor-not-allowed">
                    <Icon className="w-4 h-4" />
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                </NavItemWrapper>
              );
            }

            {/* Items with children (e.g. Menu) */}
            if (hasChildren) {
              // Build structured dropdown items for collapsed hover
              const dropdownData = collapsed
                ? item.children.map(child => {
                    const childHref = getTenantRoute(
                      router.asPath || router.pathname,
                      child.path
                    );
                    // Generic active detection: tab-based or path-based
                    const childTab = child.path.includes("tab=") ? child.path.split("tab=")[1] : "";
                    const currentTab = router.asPath.includes("tab=")
                      ? router.asPath.split("tab=")[1]?.split("&")[0]
                      : "";
                    const isChildActive = childTab
                      ? router.asPath.includes(basePath.split("?")[0]) && childTab === currentTab
                      : router.asPath === childHref || router.asPath.startsWith(childHref + "?");
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
                        setExpandedGroups(prev => {
                          const next = prev.includes(basePath)
                            ? prev.filter(g => g !== basePath)
                            : [...prev, basePath];
                          sessionStorage.setItem("sidebar_expanded_groups", JSON.stringify(next));
                          return next;
                        });
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-gray-700 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
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
                        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-neutral-800 pl-3 pb-0.5">
                          {item.children.map(child => {
                            const childHref = getTenantRoute(
                              router.asPath || router.pathname,
                              child.path
                            );
                            const childTab = child.path.includes("tab=") ? child.path.split("tab=")[1] : "";
                            const currentTab = router.asPath.includes("tab=")
                              ? router.asPath.split("tab=")[1]?.split("&")[0]
                              : "";
                            const isChildActive = childTab
                              ? router.asPath.includes(basePath.split("?")[0]) && childTab === currentTab
                              : router.asPath === childHref || router.asPath.startsWith(childHref + "?");
                            const ChildIcon = child.icon;

                            return (
                              <Link
                                key={child.path}
                                href={childHref}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                  isChildActive
                                    ? "bg-primary/10 text-primary dark:text-primary"
                                    : "text-gray-600 dark:text-neutral-400 hover:bg-bg-primary dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"
                                }`}
                              >
                                {ChildIcon && <ChildIcon className="w-3.5 h-3.5" />}
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

            {/* Regular nav items */}
            return (
              <NavItemWrapper key={href} collapsed={collapsed} label={item.label}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </NavItemWrapper>
            );
          })}
        </nav>
        <NavItemWrapper collapsed={collapsed} label="Logout">
          <div className="p-4 border-t border-gray-300 dark:border-neutral-800">
            <button
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-red-600 dark:text-red-400"
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </NavItemWrapper>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-300 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold">
              EO
            </span>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">RestaurantOS</div>
              <div className="text-[11px] text-gray-800 dark:text-neutral-400">
                {role === "super_admin" ? "Platform Console" : "Restaurant Dashboard"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-bg-primary dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-bg-primary dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-red-600 dark:text-red-400"
            >
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          </div>
        </header>

        <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-gray-300 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
            <p className="text-xs text-gray-800 dark:text-neutral-400 mt-1">
              {role === "super_admin"
                ? "Manage restaurants, subscriptions and platform configuration."
                : "Manage menu, inventory, website and staff for this restaurant."}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-bg-primary dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300 font-medium transition-colors"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </>
              )}
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-800 text-gray-900 dark:text-neutral-400">
              Logged in as <span className="text-gray-900 dark:text-white font-medium">{roleLabel}</span>
            </span>
          </div>
        </header>

        <main className="relative flex-1 px-6 py-6 overflow-y-auto bg-bg-primary dark:bg-black">
          {!suspended && children}

          {suspended && role !== "super_admin" && (
            <>
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full rounded-2xl border border-amber-300 bg-amber-50 px-6 py-5 text-sm text-amber-900 shadow-xl">
                  <h2 className="text-base font-semibold mb-1">Subscription inactive or expired</h2>
                  <p className="mb-4">
                    This restaurant&apos;s subscription is currently inactive. Dashboard insights are
                    temporarily unavailable. Please contact your platform administrator to reactivate
                    your subscription.
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


