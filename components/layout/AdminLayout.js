import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import SEO from "../SEO";
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
  ChevronLeft,
  Menu,
  Plug,
  FolderOpen,
  ShoppingBag,
  PlusSquare,
  ListOrdered,
  CreditCard,
  Globe,
  Mail,
} from "lucide-react";
import { getToken, getStoredAuth, clearActingAsRestaurant } from "../../lib/apiClient";
import { useTheme } from "../../contexts/ThemeContext";
import { useBranch } from "../../contexts/BranchContext";
import { getTenantRoute } from "../../lib/routes";

// Single tenant nav: each item has `roles` – only roles that can see it. No roles = all tenant roles.
// Admin: all. Manager: all except Branches, Subscription. Product manager: Overview, Categories, Items, Inventory, Profile.
// Cashier: Overview, POS, Orders, Reservations, Customers, Profile. Kitchen: KDS, Profile. Order taker: Overview, POS, Orders, Reservations, Customers, Tables, Profile.
const tenantNav = [
  {
    path: "/overview",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [
      "restaurant_admin",
      "admin",
      "manager",
      "product_manager",
      "cashier",
      "order_taker",
    ],
  },
  {
    path: "/pos",
    label: "POS",
    icon: Receipt,
    roles: ["restaurant_admin", "admin", "manager", "cashier", "order_taker"],
  },
  {
    path: "/orders",
    label: "Orders",
    icon: ClipboardList,
    roles: ["restaurant_admin", "admin", "manager", "cashier", "order_taker"],
  },
  {
    path: "/kitchen",
    label: "Kitchen (KDS)",
    icon: ChefHat,
    roles: ["restaurant_admin", "admin", "manager", "kitchen_staff"],
  },
  {
    path: "/reservations",
    label: "Reservations",
    icon: History,
    roles: ["restaurant_admin", "admin", "manager", "cashier", "order_taker"],
  },

  { type: "section", label: "MENU MANAGEMENT" },
  {
    path: "/categories",
    label: "Categories",
    icon: FolderOpen,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
  },
  {
    path: "/menu-items",
    label: "Items",
    icon: ShoppingBag,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
  },

  { type: "section", label: "OPERATIONS" },
  {
    path: "/customers",
    label: "Customers",
    icon: UserCheck,
    roles: ["restaurant_admin", "admin", "manager", "cashier", "order_taker"],
  },
  {
    path: "/inventory",
    label: "Inventory",
    icon: Factory,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
  },

  { type: "section", label: "ADMINISTRATION" },
  {
    path: "/users",
    label: "Users",
    icon: Users,
    roles: ["restaurant_admin", "admin", "manager"],
  },
  {
    path: "/branches",
    label: "Branches",
    icon: MapPin,
    roles: ["restaurant_admin", "admin"],
  },
  {
    path: "/tables",
    label: "Tables",
    icon: UtensilsCrossed,
    roles: ["restaurant_admin", "admin", "manager", "order_taker"],
  },
  {
    path: "/history",
    label: "Reports",
    icon: BarChart3,
    roles: ["restaurant_admin", "admin", "manager"],
  },

  { type: "section", label: "SETTINGS" },
  {
    path: "/website",
    label: "Website Settings",
    icon: Globe,
    roles: ["restaurant_admin", "admin", "manager"],
  },
  {
    path: "/integrations",
    label: "Integrations / API",
    icon: Plug,
    roles: ["restaurant_admin", "admin", "manager"],
  },
  {
    path: "/subscription",
    label: "Subscription",
    icon: CreditCard,
    roles: ["restaurant_admin", "admin"],
  },
  {
    path: "/profile",
    label: "Profile",
    icon: UserCircle2,
    roles: [
      "restaurant_admin",
      "admin",
      "manager",
      "product_manager",
      "cashier",
      "kitchen_staff",
      "order_taker",
    ],
  },
];

// Pages that can be viewed without selecting a branch (tenant dashboard only)
const DASHBOARD_PATHS_ALLOWED_WITHOUT_BRANCH = [
  "/overview",
  "/history",
  "/subscription",
  "/profile",
];

const superNav = [
  {
    href: "/super/overview",
    label: "Platform Overview",
    icon: LayoutDashboard,
  },
  { href: "/super/restaurants", label: "Restaurants", icon: Factory },
  { href: "/super/branches", label: "All Branches", icon: MapPin },
  {
    href: "/super/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
  },
  { href: "/super/leads", label: "Leads", icon: Mail },
  {
    href: "/super/settings",
    label: "System Settings",
    icon: Settings2,
  },
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

export default function AdminLayout({
  title,
  subtitle,
  children,
  suspended = false,
  seoTitle,
  seoDescription,
  seoKeywords,
  backHref,
  backLabel = "Back",
}) {
  const router = useRouter();
  const {
    branches,
    currentBranch,
    setCurrentBranch,
    hasMultipleBranches,
    loading: branchLoading,
  } = useBranch() || {};
  const [role, setRole] = useState(null);
  const [actingAsSlug, setActingAsSlug] = useState(null);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Always initialize with defaults to avoid hydration mismatch
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const { theme, toggleTheme } = useTheme();

  // Load sidebar state from sessionStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCollapsed = sessionStorage.getItem("sidebar_collapsed");
      if (storedCollapsed === "true") {
        setCollapsed(true);
      }

      try {
        const storedGroups = sessionStorage.getItem("sidebar_expanded_groups");
        if (storedGroups) {
          setExpandedGroups(JSON.parse(storedGroups));
        }
      } catch (e) {
        console.error("Failed to parse expanded groups:", e);
      }
    }
  }, []);

  // Restrict kitchen_staff to Kitchen (KDS) only – redirect away from overview/dashboard
  useEffect(() => {
    if (role !== "kitchen_staff") return;
    const path =
      (router.asPath && router.asPath.split("?")[0]) || router.pathname || "";
    if (path === "/overview") {
      router.replace("/kitchen");
    }
  }, [role, router]);

  // Close mobile sidebar on route change
  useEffect(() => {
    const handleRouteChange = () => setMobileSidebarOpen(false);
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

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
    // Super admin "acting as" tenant: show tenant nav
    if (r === "super_admin") {
      setActingAsSlug(auth?.user?.tenantSlug || auth?.tenantSlug || null);
    } else {
      setActingAsSlug(null);
    }
  }, []);

  // Auto-expand the relevant group on initial load if on a child page
  useEffect(() => {
    if (expandedGroups.length === 0) {
      const toExpand = [];
      if (
        router.asPath.includes("/menu") ||
        router.asPath.includes("/categories") ||
        router.asPath.includes("/menu-items")
      )
        toExpand.push("/menu");
      if (
        router.asPath.includes("/orders") ||
        router.asPath.includes("/pos")
      )
        toExpand.push("/orders");
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

  const rawNavItems = role === "super_admin" && !actingAsSlug ? superNav : tenantNav;
  // When super_admin is acting as a tenant, show full tenant nav (treat as restaurant_admin)
  const navRole = role === "super_admin" && actingAsSlug ? "restaurant_admin" : role;
  // Filter nav items by role (sections have roles; hide section if no links below visible)
  const withRole = rawNavItems.filter(
    (item) =>
      item.type === "section" || !item.roles || item.roles.includes(navRole),
  );
  const navItems = withRole.filter((item, i) => {
    if (item.type !== "section") return true;
    const after = withRole.slice(i + 1);
    const nextSectionIdx = after.findIndex((x) => x.type === "section");
    const until =
      nextSectionIdx === -1 ? after : after.slice(0, nextSectionIdx);
    return until.some((x) => x.path || x.href);
  });
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
                  : role === "order_taker"
                    ? "Order Taker"
                    : "Staff";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("restaurantos_auth");
    }
    // Dashboard login is always on the main domain
    window.location.href = "/login";
  }

  const cleanPath = (router.asPath && router.asPath.split("?")[0]) || router.pathname || "";
  const hideSidebarForKitchenStaff =
    role === "kitchen_staff" && cleanPath === "/kitchen";
  const sidebarWidthClass = collapsed ? "w-16" : "w-56";
  const showBranchRequiredModal =
    role !== "super_admin" &&
    !branchLoading &&
    branches?.length > 0 &&
    !currentBranch &&
    !DASHBOARD_PATHS_ALLOWED_WITHOUT_BRANCH.includes(cleanPath);

  return (
    <>
      <SEO
        title={seoTitle || title}
        description={seoDescription}
        keywords={seoKeywords}
        noindex={true}
      />
      <div className="h-screen overflow-hidden bg-gray-50 dark:bg-black flex text-gray-900 dark:text-white text-sm">
        {!hideSidebarForKitchenStaff && (
          <>
            {/* Backdrop for mobile sidebar */}
            <div
              aria-hidden
              onClick={() => setMobileSidebarOpen(false)}
              className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-500 ease-in-out md:hidden ${
                mobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            />
            <aside
              className={`fixed md:relative inset-y-0 left-0 z-50 md:z-40 w-72 ${collapsed ? "md:w-16" : "md:w-56"} flex flex-col border-r-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm transform transition-transform duration-500 ease-in-out ${
                mobileSidebarOpen
                  ? "translate-x-0"
                  : "-translate-x-full md:translate-x-0"
              } md:transition-[width] md:duration-300 md:ease-in-out`}
            >
          {/* Logo Section */}
          <div className="px-4 py-3 border-b-2 border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-secondary flex items-center justify-center text-white font-bold text-base shadow-lg shadow-primary/30">
                  ED
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950"></div>
              </div>
              {(!collapsed || mobileSidebarOpen) && (
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg tracking-tight text-gray-900 dark:text-white truncate">
                    Eats Desk
                  </div>
                  <div className="text-xs text-gray-500 dark:text-neutral-400 truncate font-medium">
                    {role === "super_admin" && !actingAsSlug
                      ? "Platform Console"
                      : "Restaurant OS"}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:text-neutral-400 transition-colors"
              aria-label="Close menu"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
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
                if (collapsed && !mobileSidebarOpen) return null; // Hide section headers when collapsed (or show when mobile sidebar open)
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
                role === "super_admin" && !actingAsSlug
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

              const effectivelyCollapsed = collapsed && !mobileSidebarOpen;
              if (suspended && role !== "super_admin") {
                return (
                  <NavItemWrapper
                    key={href}
                    collapsed={effectivelyCollapsed}
                    label={item.label}
                  >
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 dark:text-neutral-600 bg-bg-primary/60 dark:bg-neutral-900/60 cursor-not-allowed">
                      <Icon className="w-4 h-4" />
                      {(!collapsed || mobileSidebarOpen) && (
                        <span>{item.label}</span>
                      )}
                    </div>
                  </NavItemWrapper>
                );
              }

              {
                /* Items with children (e.g. Menu) */
              }
              if (hasChildren) {
                // Build structured dropdown items for collapsed hover
                const dropdownData =
                  collapsed && !mobileSidebarOpen
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
                    collapsed={effectivelyCollapsed}
                    label={item.label}
                    dropdownItems={dropdownData}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!collapsed || mobileSidebarOpen) {
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
                      {(!collapsed || mobileSidebarOpen) && (
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
                    {(!collapsed || mobileSidebarOpen) && (
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
                  collapsed={effectivelyCollapsed}
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
                    {(!collapsed || mobileSidebarOpen) && (
                      <span>{item.label}</span>
                    )}
                  </Link>
                </NavItemWrapper>
              );
            })}
          </nav>
          {/* Mobile: Account section at bottom of sidebar */}
          <div className="md:hidden flex-shrink-0 p-3 border-t-2 border-gray-100 dark:border-neutral-800 space-y-1">
            <p className="px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
              Account
            </p>
            <Link
              href="/profile"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all"
            >
              <UserCircle2 className="w-4 h-4" />
              <span>Profile</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
              <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex-shrink-0 md:hidden flex items-center justify-between px-4 py-4 border-b-2 border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm">
            <div className="flex items-center gap-3">
              {backHref && (
                <Link
                  href={backHref}
                  className="flex items-center gap-1.5 text-primary dark:text-primary font-semibold text-sm hover:opacity-90"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {backLabel}
                </Link>
              )}
              {!backHref && role === "super_admin" && actingAsSlug && (
                <button
                  type="button"
                  onClick={() => {
                    clearActingAsRestaurant();
                    setActingAsSlug(null);
                    window.location.href = "/super/overview";
                  }}
                  className="flex items-center gap-1.5 text-primary dark:text-primary font-semibold text-sm hover:opacity-90"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Super Admin
                </button>
              )}
              {!backHref && !(role === "super_admin" && actingAsSlug) && (
                <>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
                    ED
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      Eats Desk
                    </div>
                    <div className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                      {role === "super_admin" && !actingAsSlug
                        ? "Platform"
                        : "Restaurant OS"}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex items-center justify-center p-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200 transition-all"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </header>

          <header className="sticky top-0 z-30 flex-shrink-0 hidden md:flex items-center justify-between px-8 py-2 border-b-2 border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-white via-white to-gray-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-black shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              {backHref && (
                <Link
                  href={backHref}
                  className="flex items-center gap-1.5 text-primary dark:text-primary font-semibold text-sm hover:opacity-90 flex-shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {backLabel}
                </Link>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent">
                  {title}
                </h1>
                <p className="text-sm text-gray-600 dark:text-neutral-400 mt-0.5 font-medium">
                  {subtitle != null
                    ? subtitle
                    : role === "super_admin" && !actingAsSlug
                      ? "Manage restaurants, subscriptions and platform configuration"
                      : "Manage your restaurant operations"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {role === "super_admin" && actingAsSlug && (
                <button
                  type="button"
                  onClick={() => {
                    clearActingAsRestaurant();
                    setActingAsSlug(null);
                    window.location.href = "/super/overview";
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary font-semibold text-sm hover:bg-primary/10 dark:hover:bg-primary/20 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Go back to Super Admin Dashboard</span>
                </button>
              )}
              {(role !== "super_admin" || actingAsSlug) && !branchLoading && (
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
                      {currentBranch
                        ? currentBranch.name
                        : role === "restaurant_admin" || role === "admin"
                          ? "All branches"
                          : (branches?.[0]?.name ?? "Select branch")}
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
                          {(role === "restaurant_admin" ||
                            role === "admin" ||
                            (role === "super_admin" && actingAsSlug)) && (
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentBranch(null);
                                setBranchDropdownOpen(false);
                                window.location.reload();
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
                          )}
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
                                  setBranchDropdownOpen(false);
                                  window.location.reload();
                                } else {
                                  setBranchDropdownOpen(false);
                                }
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
                        {(role === "restaurant_admin" ||
                          role === "admin" ||
                          (role === "super_admin" && actingAsSlug)) && (
                          <div className="border-t-2 border-gray-100 dark:border-neutral-800 p-2">
                            <Link
                              href="/branches"
                              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-primary dark:text-primary hover:bg-primary/10 transition-all"
                            >
                              <PlusSquare className="w-4 h-4" />
                              Manage branches
                            </Link>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {userName && (
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-3 dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-900 dark:text-neutral-100 font-bold text-sm transition-all"
                  >
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-primary/20">
                      {userInitials || userName[0]?.toUpperCase()}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[130px]">
                        {userName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-neutral-400 leading-tight font-medium">
                        {roleLabel}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 dark:text-neutral-400 transition-transform ${
                        userMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        aria-hidden
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-2xl bg-white dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 shadow-2xl overflow-hidden">
                        <div className="p-3 border-b-2 border-gray-100 dark:border-neutral-800">
                          <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                            Account
                          </p>
                        </div>
                        <div className="p-2 space-y-1">
                          <Link
                            href="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all"
                          >
                            <UserCircle2 className="w-4 h-4" />
                            <span>Profile</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              toggleTheme();
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all"
                          >
                            {theme === "light" ? (
                              <Moon className="w-4 h-4" />
                            ) : (
                              <Sun className="w-4 h-4" />
                            )}
                            <span>
                              {theme === "light" ? "Dark mode" : "Light mode"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setUserMenuOpen(false);
                              handleLogout();
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </header>

          <main className="relative flex-1 px-4 md:px-6 pt-4 pb-6 overflow-y-auto bg-gray-100 dark:bg-black">
            {!suspended && children}

            {showBranchRequiredModal && (
              <>
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                  <div className="max-w-md w-full rounded-2xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-neutral-800">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Select a branch
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                        Please select a branch to view this page.
                      </p>
                    </div>
                    <div className="p-3 max-h-[320px] overflow-y-auto space-y-1">
                      {branches.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setCurrentBranch(b);
                            window.location.reload();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all border-2 border-transparent hover:border-primary/20"
                        >
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          <span className="truncate">{b.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-200 dark:border-neutral-800">
                      <Link
                        href="/overview"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-primary hover:bg-primary/10 transition-all"
                      >
                        Go to Dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}

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
    </>
  );
}
