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
  Layers,
  ListOrdered,
  CreditCard,
  Globe,
  Mail,
  Bike,
  BookOpen,
  FileText,
  TrendingDown,
  Landmark,
  CalendarDays,
  LayoutGrid,
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
  List,
  BarChart2,
  BookMarked,
  Wallet,
  Scale,
  Network,
  Truck,
  Boxes,
  ShoppingCart,
  MessageCircle,
  ShieldCheck,
  PackageCheck,
  Package,
  LayoutList,
  ArrowDownToLine,
  Sparkles,
  Bot,
  KeyRound,
  ScrollText,
  QrCode,
  Share2,
  Search,
} from "lucide-react";
import AISidebar from "../ai/AISidebar";
import WhatsAppNotificationBell from "../whatsapp/WhatsAppNotificationBell";
import {
  getToken,
  getStoredAuth,
  endImpersonationAsSuperAdmin,
  getRestaurantInfo,
  getWhatsAppUnreadCount,
  getTenantSubscriptionSummary,
} from "../../lib/apiClient";
import { useTheme } from "../../contexts/ThemeContext";
import { useBranch } from "../../contexts/BranchContext";
import { usePermissions } from "../../contexts/PermissionContext";
import { getTenantRoute } from "../../lib/routes";

function humanizeRoleSlug(slug) {
  if (!slug) return "Staff";
  return slug
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getRoleLabelFromSlug(role) {
  const labels = {
    super_admin: "Super Admin",
    restaurant_admin: "Owner",
    admin: "Admin",
    product_manager: "Product Manager",
    cashier: "Cashier",
    manager: "Manager",
    kitchen_staff: "Kitchen Staff",
    order_taker: "Order Taker",
    delivery_rider: "Delivery Rider",
    staff: "Staff",
  };
  return labels[role] || humanizeRoleSlug(role);
}

function getNavPath(asPath, pathname) {
  const raw = (asPath || pathname || "").split("#")[0];
  const base = raw.split("?")[0];
  return base.replace(/^\/dashboard(?=\/|$)/, "") || "/";
}

function getNavQueryParam(asPath, key) {
  const query = (asPath || "").split("?")[1] || "";
  if (!query) return "";
  return new URLSearchParams(query).get(key) || "";
}

function isNavChildActive(
  asPath,
  basePath,
  childPath,
  childHref,
  siblingPaths = [],
) {
  const navPath = getNavPath(asPath, "");
  const base = (basePath || "").split("?")[0];
  const childBase = (childHref || childPath || "").split("?")[0];
  const currentSection = getNavQueryParam(asPath, "section");
  const currentTab = getNavQueryParam(asPath, "tab");

  if (childPath.includes("section=")) {
    const section = childPath.split("section=")[1]?.split("&")[0] || "";
    return navPath === base && currentSection === section;
  }

  if (childPath.includes("tab=")) {
    const tab = childPath.split("tab=")[1]?.split("&")[0] || "";
    return (
      navPath.includes(base.split("?")[0]) && currentTab === tab
    );
  }

  if (navPath !== childBase && !navPath.startsWith(`${childBase}/`))
    return false;

  // Default child (no section/tab in its path): inactive when a sibling
  // claims the current section or tab query.
  const claimedBySibling = siblingPaths.some((path) => {
    const p = path || "";
    if (currentSection && p.includes("section=")) {
      const section = p.split("section=")[1]?.split("&")[0] || "";
      return section === currentSection;
    }
    if (currentTab && p.includes("tab=")) {
      const tab = p.split("tab=")[1]?.split("&")[0] || "";
      return tab === currentTab;
    }
    return false;
  });
  return !claimedBySibling;
}

const HEADER_TOOLBAR_BTN =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold leading-none shadow-sm transition-all";

// Single tenant nav:
// Admin: all. Manager: all except Branches, Subscription. Product manager: Overview, Categories, Items, Inventory, Profile.
// Cashier: POS, Orders, Customers, Profile only. Kitchen: KDS, Profile.
// Order taker uses dedicated /order-taker mobile UI and does not see the dashboard sidebar.
const tenantNav = [
  {
    path: "/overview",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
  },

  { type: "section", label: "ORDERS & SERVICE" },
  {
    path: "/pos",
    label: "POS",
    icon: ClipboardList,
    roles: ["restaurant_admin", "admin", "manager", "cashier"],
    permission: "orders.view",
  },
  {
    path: "/kitchen",
    label: "Kitchen (KDS)",
    icon: ChefHat,
    roles: ["restaurant_admin", "admin", "manager", "kitchen_staff"],
    permission: "orders.start_cooking",
  },
  {
    path: "/whatsapp",
    label: "AI Receptionist",
    icon: MessageCircle,
    roles: ["restaurant_admin", "admin", "manager", "kitchen_staff"],
    permission: "whatsapp.conversations.view",
  },
  {
    path: "/tables",
    label: "Tables",
    icon: UtensilsCrossed,
    roles: ["restaurant_admin", "admin", "manager"],
    permission: "tables.view",
  },
  {
    path: "/reservations",
    label: "Reservations",
    icon: History,
    roles: ["restaurant_admin", "admin", "manager"],
    permission: "reservations.view",
  },

  { type: "section", label: "MENU" },
  {
    path: "/categories",
    label: "Categories",
    icon: FolderOpen,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    permission: "menu.manage_categories",
  },
  {
    path: "/menu-items",
    label: "Menu Items",
    icon: ShoppingBag,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    permission: "menu.manage",
  },
  {
    path: "/modifier-groups",
    label: "Modifier Groups",
    icon: Layers,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    permission: "menu.manage",
  },
  {
    path: "/deals",
    label: "Deals",
    icon: Percent,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    permission: "deals_modifiers.manage",
  },

  { type: "section", label: "PEOPLE" },
  {
    path: "/customers",
    label: "Customers",
    icon: UserCheck,
    roles: ["restaurant_admin", "admin", "manager"],
    permission: "customers.view",
  },
  {
    path: "/users",
    label: "Staff Management",
    icon: Users,
    roles: ["restaurant_admin", "admin", "manager"],
    permission: "staff.view",
  },
  {
    path: "/settings/roles",
    label: "Staff Roles",
    icon: UserCog,
    roles: ["restaurant_admin", "admin", "manager"],
  },
  {
    path: "/riders",
    label: "Riders",
    icon: Truck,
    roles: ["restaurant_admin", "admin", "manager", "cashier"],
    permission: "staff.view_riders",
  },

  { type: "section", label: "INVENTORY" },
  {
    path: "/inventory",
    label: "Stock Items",
    icon: Boxes,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    exact: true,
    permission: "inventory.view",
  },
  {
    path: "/inventory/purchase-orders",
    label: "Purchase Orders",
    icon: ShoppingCart,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    permission: "inventory.purchase_orders",
  },
  {
    path: "/inventory/receive-stock",
    label: "Receive Stock",
    icon: PackageCheck,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    permission: "inventory.receive_stock",
  },
  {
    path: "/inventory/purchase-history",
    label: "Purchase History",
    icon: ClipboardList,
    roles: ["restaurant_admin", "admin", "manager", "product_manager"],
    permission: "inventory.purchase_orders",
  },

  { type: "section", label: "ACCOUNTS" },
  {
    path: "/accounting",
    label: "Accounts Board",
    icon: LayoutGrid,
    roles: ["restaurant_admin", "admin", "manager"],
    exact: true,
    permission: "accounting.access",
  },
  {
    path: "/sales-report",
    label: "Sales",
    icon: BarChart3,
    roles: ["restaurant_admin", "admin", "manager"],
    permission: "reports.view_sales",
  },
  {
    label: "Vouchers",
    icon: Receipt,
    path: "/accounting/vouchers",
    roles: ["restaurant_admin", "admin", "manager", "cashier"],
    permission: "accounts.create_vouchers",
    children: [
      {
        path: "/accounting/vouchers/cash-payment",
        label: "Cash Payment",
        icon: ArrowUpCircle,
      },
      {
        path: "/accounting/vouchers/cash-receipt",
        label: "Cash Receipt",
        icon: ArrowDownCircle,
      },
      {
        path: "/accounting/vouchers/bank-payment",
        label: "Bank Payment",
        icon: Building2,
      },
      {
        path: "/accounting/vouchers/bank-receipt",
        label: "Bank Receipt",
        icon: Landmark,
      },
      {
        path: "/accounting/vouchers/journal",
        label: "Journal Voucher",
        icon: BookOpen,
      },
      { path: "/accounting/vouchers", label: "All Vouchers", icon: List },
    ],
  },
  {
    label: "Reports",
    icon: BarChart2,
    path: "/accounting/reports/day-book",
    roles: ["restaurant_admin", "admin", "manager"],
    children: [
      {
        path: "/accounting/reports/day-book",
        label: "Day Book",
        icon: CalendarDays,
      },
      { path: "/accounting/reports/ledger", label: "Ledger", icon: BookMarked },
      {
        path: "/accounting/reports/profit-loss",
        label: "P&L Statement",
        icon: TrendingDown,
      },
      {
        path: "/accounting/reports/trial-balance",
        label: "Trial Balance",
        icon: LayoutList,
      },
      {
        path: "/accounting/reports/cash-statement",
        label: "Cash Statement",
        icon: Wallet,
      },
      {
        path: "/accounting/reports/payables",
        label: "Payables",
        icon: FileText,
      },
      {
        path: "/accounting/reports/receivables",
        label: "Receivables",
        icon: ArrowDownToLine,
      },
      {
        path: "/accounting/reports/balance-sheet",
        label: "Balance Sheet",
        icon: Scale,
      },
    ],
  },
  {
    label: "Setup",
    icon: Settings2,
    path: "/accounting/chart-of-accounts",
    roles: ["restaurant_admin", "admin", "manager"],
    children: [
      {
        path: "/accounting/chart-of-accounts",
        label: "Chart of Accounts",
        icon: Network,
      },
      { path: "/accounting/parties", label: "Parties", icon: Users },
    ],
  },

  { type: "section", label: "SETTINGS" },
  {
    path: "/business-settings",
    label: "Business Settings",
    icon: MapPin,
    roles: ["restaurant_admin", "admin"],
    permission: "settings.view",
  },
  {
    label: "Website",
    icon: Globe,
    path: "/website-settings",
    roles: ["restaurant_admin", "admin", "manager"],
    permission: "settings.view",
    children: [
      { path: "/website-settings", label: "Content", icon: LayoutGrid },
      {
        path: "/website-settings?section=digital-menu",
        label: "Digital Menu",
        icon: QrCode,
      },
      {
        path: "/website-settings?section=social",
        label: "Social Links",
        icon: Share2,
      },
      { path: "/website-settings?section=seo", label: "SEO", icon: Search },
      {
        path: "/website-settings?section=analytics",
        label: "Analytics",
        icon: BarChart2,
      },
    ],
  },
  {
    path: "/integrations",
    label: "Integrations / API",
    icon: Plug,
    roles: ["restaurant_admin", "admin", "manager"],
    permission: "settings.view",
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
      "delivery_rider",
    ],
  },
];

// Pages that can be viewed without selecting a branch (tenant dashboard only)
const DASHBOARD_PATHS_ALLOWED_WITHOUT_BRANCH = [
  "/overview",
  "/sales-report",
  "/riders",
  "/subscription",
  "/profile",
  "/whatsapp",
];

const superNav = [
  {
    href: "/super/overview",
    label: "Platform Overview",
    icon: LayoutDashboard,
    permission: "platform.overview.view",
  },
  {
    href: "/super/team",
    label: "Team",
    icon: UserCog,
    permission: "platform.staff.view",
  },
  {
    href: "/super/restaurants",
    label: "Restaurants",
    icon: Factory,
    permission: "platform.restaurants.view",
  },
  {
    href: "/super/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
    permission: "platform.subscriptions.view",
  },
  {
    href: "/super/invoices",
    label: "Invoices",
    icon: Receipt,
    permission: "platform.invoices.view",
  },
  {
    href: "/super/users",
    label: "Tenant Users",
    icon: Users,
    permission: "platform.restaurants.view",
  },
  {
    href: "/super/roles",
    label: "Roles",
    icon: ShieldCheck,
    permission: "platform.roles.view",
  },
  {
    href: "/super/permissions",
    label: "Permissions",
    icon: KeyRound,
    permission: "platform.permissions.view",
  },
  {
    href: "/super/leads",
    label: "Leads",
    icon: Mail,
    permission: "platform.leads.view",
  },
  {
    href: "/super/whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    permission: "platform.whatsapp.view",
  },
  {
    href: "/super/settings",
    label: "System Settings",
    icon: Settings2,
    permission: "platform.settings.view",
  },
  {
    href: "/super/audit",
    label: "Audit Log",
    icon: ScrollText,
    permission: "platform.audit.view",
  },
  {
    href: "/super/profile",
    label: "Profile",
    icon: UserCircle2,
    roles: ["super_admin"],
  },
];

/**
 * Tooltip wrapper using fixed positioning (never clipped by overflow).
 * - Regular items: shows a simple tooltip on hover.
 * - Items with `dropdownItems`: shows a sub-dropdown with heading + styled child items.
 */
function SidebarNavSkeleton({ collapsed }) {
  return (
    <div
      className="space-y-1 animate-pulse"
      aria-busy="true"
      aria-label="Loading navigation"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-3 py-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="h-4 w-4 shrink-0 rounded bg-gray-200 dark:bg-neutral-800" />
          {!collapsed && (
            <div
              className="h-3.5 flex-1 rounded bg-gray-200 dark:bg-neutral-800"
              style={{ maxWidth: `${50 + (i % 4) * 12}%` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

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
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  // Always initialize with defaults to avoid hydration mismatch
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [whatsappNeedsHumanCount, setWhatsappNeedsHumanCount] = useState(0);
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0);
  const [pendingInvoiceAmount, setPendingInvoiceAmount] = useState(0);
  const [activeModuleKeys, setActiveModuleKeys] = useState(null);
  const { theme, toggleTheme } = useTheme();
  const { hasPermission, hasViewOrManage, permissionsLoaded, roleName } =
    usePermissions();

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

  const whatsappNavRoles = [
    "restaurant_admin",
    "admin",
    "manager",
    "kitchen_staff",
  ];
  useEffect(() => {
    if (!role || role === "super_admin" || !whatsappNavRoles.includes(role)) {
      setWhatsappNeedsHumanCount(0);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const data = await getWhatsAppUnreadCount();
        if (!cancelled) setWhatsappNeedsHumanCount(data?.needsHuman || 0);
      } catch {
        /* ignore — endpoint may be unavailable */
      }
    }
    poll();
    const intervalId = setInterval(poll, 60000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [role]);

  useEffect(() => {
    const canFetchSubscriptionSummary =
      role === "restaurant_admin" ||
      role === "admin" ||
      role === "manager" ||
      role === "default_manager" ||
      (role === "super_admin" && Boolean(actingAsSlug));
    if (!canFetchSubscriptionSummary) {
      setPendingInvoiceCount(0);
      setPendingInvoiceAmount(0);
      setActiveModuleKeys(null);
      return;
    }

    let cancelled = false;
    async function pollPendingInvoices() {
      try {
        const data = await getTenantSubscriptionSummary();
        const invoices = Array.isArray(data?.summary?.invoices)
          ? data.summary.invoices
          : [];
        const pending = invoices.filter((invoice) => {
          const status = String(invoice?.status || "").toUpperCase();
          return status === "SENT" || status === "OVERDUE";
        });
        const totalPendingAmount = pending.reduce(
          (sum, invoice) => sum + (Number(invoice?.amount) || 0),
          0,
        );

        if (!cancelled) {
          setPendingInvoiceCount(pending.length);
          setPendingInvoiceAmount(Math.round(totalPendingAmount));
          const modules = Array.isArray(data?.summary?.billing?.modules)
            ? data.summary.billing.modules
            : [];
          setActiveModuleKeys(
            new Set(
              modules
                .filter((module) => module.active)
                .map((module) => module.key),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setPendingInvoiceCount(0);
          setPendingInvoiceAmount(0);
          setActiveModuleKeys(new Set());
        }
      }
    }

    pollPendingInvoices();
    const intervalId = setInterval(pollPendingInvoices, 60000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [role, actingAsSlug]);

  // Restrict legacy/default cashier-like roles away from analytics overview
  useEffect(() => {
    if (role !== "cashier" && role !== "default_cashier") return;
    const path =
      (router.asPath && router.asPath.split("?")[0]) || router.pathname || "";
    if (path === "/overview") {
      router.replace("/pos");
    }
  }, [role, router]);

  // Restrict delivery_rider to Rider Portal only
  useEffect(() => {
    if (role !== "delivery_rider") return;
    const path =
      (router.asPath && router.asPath.split("?")[0]) || router.pathname || "";
    if (path === "/overview" || path === "/pos" || path === "/kitchen") {
      router.replace("/rider");
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
    // Immediate fallback: format the restaurant slug so something shows right away
    // e.g. "my-restaurant" → "My Restaurant"
    const slug = auth?.user?.restaurantSlug || auth?.tenantSlug || "";
    const slugFallback = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const storedName = auth?.user?.restaurantName || "";
    const storedLogo = auth?.user?.restaurantLogoUrl || "";
    setRestaurantName(storedName || slugFallback);
    setRestaurantLogoUrl(storedLogo);

    // Super admin "acting as" tenant: show tenant nav
    if (r === "super_admin") {
      setActingAsSlug(auth?.user?.tenantSlug || auth?.tenantSlug || null);
    } else {
      setActingAsSlug(null);
      // Always fetch the real name from the API to get the accurate display name
      getRestaurantInfo()
        .then((info) => {
          if (info?.name) setRestaurantName(info.name);
          if (info?.logoUrl) setRestaurantLogoUrl(info.logoUrl);
        })
        .catch(() => {
          // Slug fallback already displayed — no action needed
        });
    }
  }, []);

  // Auto-expand the relevant group on initial load if on a child page
  useEffect(() => {
    if (expandedGroups.length === 0) {
      const toExpand = [];
      if (
        router.asPath.includes("/menu") ||
        router.asPath.includes("/categories") ||
        router.asPath.includes("/menu-items") ||
        router.asPath.includes("/modifier-groups")
      )
        toExpand.push("/menu");
      if (router.asPath.includes("/pos")) toExpand.push("/pos");
      if (getNavPath(router.asPath, router.pathname) === "/website-settings") {
        toExpand.push("/website-settings");
      }
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

  const cleanPath =
    (router.asPath && router.asPath.split("?")[0]) || router.pathname || "";
  const normalizedPath = cleanPath.replace(/^\/dashboard/, "");
  const onSubscriptionPage = normalizedPath === "/subscription";
  const isSuperPath = !actingAsSlug && normalizedPath.startsWith("/super");
  const isSuperDashboard =
    isSuperPath || Boolean(role === "super_admin" && !actingAsSlug);

  const rawNavItems = isSuperDashboard ? superNav : tenantNav;
  // When super_admin is acting as a tenant, show full tenant nav (treat as restaurant_admin)
  const navRole =
    role === "super_admin" && actingAsSlug ? "restaurant_admin" : role;
  const canSeeNavItem = (item) => {
    if (item.type === "section") return true;
    if (item.permission) {
      return item.permission.endsWith(".view")
        ? hasViewOrManage(item.permission)
        : hasPermission(item.permission);
    }
    if (!item.roles) return true;
    return item.roles.includes(navRole);
  };
  const isNavChildVisible = (child) => {
    if (!child?.moduleKey) return true;
    if (!activeModuleKeys) return false;
    return activeModuleKeys.has(child.moduleKey);
  };
  const getVisibleNavChildren = (children) =>
    (children || []).filter(isNavChildVisible);
  const visibleNavItems = rawNavItems.filter(canSeeNavItem);
  const navItems = visibleNavItems.filter((item, i) => {
    if (item.type !== "section") return true;
    const after = visibleNavItems.slice(i + 1);
    const nextSectionIdx = after.findIndex((x) => x.type === "section");
    const until =
      nextSectionIdx === -1 ? after : after.slice(0, nextSectionIdx);
    return until.some((x) => x.path || x.href);
  });
  const roleLabel = getRoleLabelFromSlug(role);
  const profileHref = isSuperDashboard ? "/super/profile" : "/profile";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("restaurantos_auth");
    }
    // Dashboard login is always on the main domain
    window.location.href = "/login";
  }

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
                mobileSidebarOpen
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
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
                  <div className="relative flex-shrink-0">
                    {restaurantLogoUrl && !isSuperDashboard ? (
                      <div className="h-10 w-10 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-700 shadow-md bg-white dark:bg-neutral-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={restaurantLogoUrl}
                          alt="logo"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : restaurantName && !isSuperDashboard ? (
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-secondary flex items-center justify-center text-white font-bold text-base shadow-lg shadow-primary/30">
                        {restaurantName.slice(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-700 shadow-md bg-white dark:bg-neutral-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/favicon.png"
                          alt="Eats Desk"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950"></div>
                  </div>
                  {(!collapsed || mobileSidebarOpen) && (
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-lg tracking-tight text-gray-900 dark:text-white truncate">
                        {restaurantName && !isSuperDashboard
                          ? restaurantName
                          : "Eats Desk"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-neutral-400 truncate font-medium">
                        {isSuperDashboard
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

              <nav
                className="flex-1 p-3 overflow-y-auto"
                aria-label="Main navigation"
              >
                {!permissionsLoaded ? (
                  <SidebarNavSkeleton
                    collapsed={collapsed && !mobileSidebarOpen}
                  />
                ) : (
                  navItems.map((item, idx) => {
                    if (item.type !== "section" && !canSeeNavItem(item)) {
                      return null;
                    }
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
                    const href = isSuperDashboard
                      ? item.href
                      : getTenantRoute(
                          router.asPath || router.pathname,
                          basePath,
                        );

                    const Icon = item.icon;
                    const visibleChildren = getVisibleNavChildren(
                      item.children,
                    );
                    const hasChildren = visibleChildren.length > 0;
                    const isExpanded = expandedGroups.includes(basePath);
                    // For groups, check if any child path matches current route
                    const navPath = getNavPath(router.asPath, router.pathname);
                    const isActive = hasChildren
                      ? visibleChildren.some((child) => {
                          const cHref = getTenantRoute(
                            router.asPath || router.pathname,
                            child.path,
                          );
                          return isNavChildActive(
                            router.asPath,
                            basePath,
                            child.path,
                            cHref,
                            visibleChildren.map((c) => c.path),
                          );
                        })
                      : item.exact
                        ? navPath === href
                        : navPath === href ||
                          navPath.startsWith(`${href}/`) ||
                          (router.asPath || "").startsWith(`${href}?`);

                    const effectivelyCollapsed =
                      collapsed && !mobileSidebarOpen;
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

                    if (item.comingSoon) {
                      return (
                        <NavItemWrapper
                          key={`soon-${basePath || idx}`}
                          collapsed={effectivelyCollapsed}
                          label={`${item.label} (Coming soon)`}
                        >
                          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-gray-400 dark:text-neutral-500 bg-gray-50/90 dark:bg-neutral-900/50 cursor-not-allowed border border-dashed border-gray-200 dark:border-neutral-700">
                            <Icon className="w-4 h-4 shrink-0 opacity-70" />
                            {(!collapsed || mobileSidebarOpen) && (
                              <>
                                <span className="flex-1 truncate">
                                  {item.label}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-100/90 dark:bg-amber-950/60 px-2 py-0.5 rounded-md shrink-0">
                                  Soon
                                </span>
                              </>
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
                          ? visibleChildren.map((child) => {
                              const childHref = getTenantRoute(
                                router.asPath || router.pathname,
                                child.path,
                              );
                              // Generic active detection: tab-based or path-based
                              const isChildActive = isNavChildActive(
                                router.asPath,
                                basePath,
                                child.path,
                                childHref,
                                visibleChildren.map((c) => c.path),
                              );
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
                            className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                              isActive
                                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20"
                                : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white hover:shadow-sm"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "" : "group-hover:scale-110"}`}
                            />
                            {(!collapsed || mobileSidebarOpen) && (
                              <>
                                <span className="flex-1 text-left">
                                  {item.label}
                                </span>
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
                              style={{
                                gridTemplateRows: isExpanded ? "1fr" : "0fr",
                              }}
                            >
                              <div className="overflow-hidden">
                                <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 dark:border-neutral-800 pl-3 pb-1">
                                  {visibleChildren.map((child) => {
                                    const childHref = getTenantRoute(
                                      router.asPath || router.pathname,
                                      child.path,
                                    );
                                    const isChildActive = isNavChildActive(
                                      router.asPath,
                                      basePath,
                                      child.path,
                                      childHref,
                                      visibleChildren.map((c) => c.path),
                                    );
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
                            <>
                              <span className="flex-1">{item.label}</span>
                              {item.path === "/whatsapp" &&
                                whatsappNeedsHumanCount > 0 && (
                                  <span className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-orange-500" />
                                )}
                            </>
                          )}
                        </Link>
                      </NavItemWrapper>
                    );
                  })
                )}
              </nav>
              {/* Mobile: Account section at bottom of sidebar */}
              <div className="md:hidden flex-shrink-0 p-3 border-t-2 border-gray-100 dark:border-neutral-800 space-y-1">
                <p className="px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  Account
                </p>
                <Link
                  href={profileHref}
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
          <header className="sticky top-0 z-30 flex-shrink-0 md:hidden flex items-center px-3 py-2 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            {/* Left — logo + restaurant name (or back button) */}
            <div className="flex items-center gap-1.5 z-10">
              {backHref && (
                <Link
                  href={backHref}
                  className="flex items-center gap-1 text-primary dark:text-primary font-semibold text-xs hover:opacity-90"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {backLabel}
                </Link>
              )}
              {!backHref && role === "super_admin" && actingAsSlug && (
                <button
                  type="button"
                  onClick={async () => {
                    await endImpersonationAsSuperAdmin({
                      subdomain: actingAsSlug,
                    });
                    setActingAsSlug(null);
                    window.location.href = "/super/overview";
                  }}
                  className="flex items-center gap-1 text-primary dark:text-primary font-semibold text-xs hover:opacity-90"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Super
                </button>
              )}
              {!backHref && !(role === "super_admin" && actingAsSlug) && (
                <>
                  {restaurantLogoUrl && !isSuperDashboard ? (
                    <div className="h-7 w-7 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={restaurantLogoUrl}
                        alt="logo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : restaurantName && !isSuperDashboard ? (
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[10px] font-bold shadow-sm shadow-primary/20 flex-shrink-0">
                      {restaurantName.slice(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/favicon.png"
                        alt="Eats Desk"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[80px]">
                    {restaurantName && !isSuperDashboard
                      ? restaurantName
                      : "Eats Desk"}
                  </span>
                </>
              )}
            </div>

            {/* Center — page title */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <h1 className="text-[13px] font-bold text-gray-900 dark:text-white truncate max-w-[140px]">
                {title}
              </h1>
            </div>

            {/* Right — notifications + user avatar */}
            <div className="ml-auto z-10 flex items-center gap-2">
              {role &&
                whatsappNavRoles.includes(role) &&
                role !== "super_admin" && <WhatsAppNotificationBell />}
              {pendingInvoiceCount > 0 &&
                (onSubscriptionPage ? (
                  <span
                    className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 shadow-sm cursor-default"
                    title={`Invoice pending — Rs ${pendingInvoiceAmount.toLocaleString("en-PK")}`}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                      {pendingInvoiceCount > 9 ? "9+" : pendingInvoiceCount}
                    </span>
                  </span>
                ) : (
                  <Link
                    href="/subscription"
                    className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 shadow-sm"
                    title={`Invoice pending — Rs ${pendingInvoiceAmount.toLocaleString("en-PK")}`}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                      {pendingInvoiceCount > 9 ? "9+" : pendingInvoiceCount}
                    </span>
                  </Link>
                ))}
              <Link
                href={profileHref}
                className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                title={userName}
              >
                {userInitials || userName?.charAt(0)?.toUpperCase() || "U"}
              </Link>
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
                <p className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5 font-medium">
                  {subtitle != null
                    ? subtitle
                    : isSuperDashboard
                      ? "Manage restaurants, subscriptions and platform configuration"
                      : "Manage your restaurant operations"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {role === "super_admin" && actingAsSlug && (
                <button
                  type="button"
                  onClick={async () => {
                    await endImpersonationAsSuperAdmin({
                      subdomain: actingAsSlug,
                    });
                    setActingAsSlug(null);
                    window.location.href = "/super/overview";
                  }}
                  className={`${HEADER_TOOLBAR_BTN} gap-2 border-primary/30 bg-primary/5 px-3 text-primary hover:bg-primary/10 dark:border-primary/30 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Go back to Super Admin Dashboard
                  </span>
                </button>
              )}

              {(role !== "super_admin" || actingAsSlug) && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {role !== "super_admin" &&
                    whatsappNavRoles.includes(role) && (
                      <WhatsAppNotificationBell />
                    )}
                  {pendingInvoiceCount > 0 &&
                    (onSubscriptionPage ? (
                      <span
                        className={`${HEADER_TOOLBAR_BTN} relative cursor-default border-amber-200 bg-amber-50 px-3 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300`}
                        title={`Invoice pending — Rs ${pendingInvoiceAmount.toLocaleString("en-PK")}`}
                      >
                        <Receipt className="h-4 w-4 shrink-0" />
                        <span className="hidden lg:inline">
                          Invoice pending
                        </span>
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {pendingInvoiceCount > 9 ? "9+" : pendingInvoiceCount}
                        </span>
                      </span>
                    ) : (
                      <Link
                        href="/subscription"
                        className={`${HEADER_TOOLBAR_BTN} relative border-amber-200 bg-amber-50 px-3 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:border-amber-400 dark:hover:bg-amber-500/20`}
                        title={`Invoice pending — Rs ${pendingInvoiceAmount.toLocaleString("en-PK")}`}
                      >
                        <Receipt className="h-4 w-4 shrink-0" />
                        <span className="hidden lg:inline">
                          Invoice pending
                        </span>
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {pendingInvoiceCount > 9 ? "9+" : pendingInvoiceCount}
                        </span>
                      </Link>
                    ))}
                  {role !== "super_admin" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAiSidebarOpen(true)}
                        className={`${HEADER_TOOLBAR_BTN} border-transparent bg-gradient-to-r from-orange-500 to-orange-600 px-3 text-white hover:from-orange-600 hover:to-orange-700 hover:shadow-md`}
                      >
                        <Sparkles className="h-4 w-4" />
                        Ask AI
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiSidebarOpen(true)}
                        className={`${HEADER_TOOLBAR_BTN} border-gray-200 bg-white px-3 text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-orange-500/40 dark:hover:bg-orange-950/30 dark:hover:text-orange-400`}
                      >
                        <Bot className="h-4 w-4" />
                        Agents
                        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                          Soon
                        </span>
                      </button>
                    </>
                  )}

                  {!branchLoading && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setBranchDropdownOpen((prev) => !prev)}
                        className={`${HEADER_TOOLBAR_BTN} gap-2 border-gray-200 bg-white px-3 text-gray-900 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800`}
                      >
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary">
                          <MapPin className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="max-w-[160px] truncate">
                          {currentBranch
                            ? currentBranch.name
                            : role === "restaurant_admin" || role === "admin"
                              ? "All branches"
                              : (branches?.[0]?.name ?? "Select branch")}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-neutral-400 ${branchDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {branchDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            aria-hidden
                            onClick={() => setBranchDropdownOpen(false)}
                          />
                          <div className="absolute right-0 top-full z-50 mt-2 min-w-[260px] overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
                            <div className="border-b-2 border-gray-100 p-3 dark:border-neutral-800">
                              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                                Select Branch
                              </p>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-2">
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
                                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                                    !currentBranch
                                      ? "border-2 border-primary/20 bg-gradient-to-r from-primary/10 to-secondary/10 text-primary dark:text-primary"
                                      : "text-gray-700 hover:bg-gray-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                  }`}
                                >
                                  <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${!currentBranch ? "bg-gradient-to-br from-primary to-secondary" : "bg-gray-200 dark:bg-neutral-800"}`}
                                  >
                                    <MapPin
                                      className={`h-4 w-4 ${!currentBranch ? "text-white" : "text-gray-500"}`}
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
                                  className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                                    currentBranch?.id === b.id
                                      ? "border-2 border-primary/20 bg-gradient-to-r from-primary/10 to-secondary/10 text-primary dark:text-primary"
                                      : "text-gray-700 hover:bg-gray-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                  }`}
                                  disabled={b.id === "none"}
                                >
                                  <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${currentBranch?.id === b.id ? "bg-gradient-to-br from-primary to-secondary" : "bg-gray-200 dark:bg-neutral-800"}`}
                                  >
                                    <MapPin
                                      className={`h-4 w-4 ${currentBranch?.id === b.id ? "text-white" : "text-gray-500"}`}
                                    />
                                  </div>
                                  <span className="truncate">{b.name}</span>
                                </button>
                              ))}
                            </div>
                            {(role === "restaurant_admin" ||
                              role === "admin" ||
                              (role === "super_admin" && actingAsSlug)) && (
                              <div className="border-t-2 border-gray-100 p-2 dark:border-neutral-800">
                                <Link
                                  href="/business-settings"
                                  onClick={(e) => {
                                    if (cleanPath === "/business-settings") {
                                      e.preventDefault();
                                      setBranchDropdownOpen(false);
                                    }
                                  }}
                                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/10 dark:text-primary"
                                >
                                  <PlusSquare className="h-4 w-4" />
                                  Manage branches
                                </Link>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
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
                        {roleName || roleLabel}
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
                            href={profileHref}
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

          <main className="relative flex-1 px-4 md:px-6 pt-4 pb-24 md:pb-6 overflow-y-auto bg-gray-100 dark:bg-black">
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

          {/* ─── Bottom nav bar — mobile only ───────────────────────────── */}
          {[
            "restaurant_admin",
            "admin",
            "manager",
            "product_manager",
            "cashier",
          ].includes(role) && (
            <nav
              className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 flex items-stretch shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              {[
                [
                  "restaurant_admin",
                  "admin",
                  "manager",
                  "default_manager",
                  "product_manager",
                ].includes(role) && {
                  path: "/overview",
                  label: "Home",
                  icon: LayoutDashboard,
                },
                [
                  "restaurant_admin",
                  "admin",
                  "manager",
                  "default_manager",
                  "cashier",
                  "default_cashier",
                ].includes(role) && {
                  path: "/pos",
                  label: "Orders",
                  icon: ClipboardList,
                },
                [
                  "restaurant_admin",
                  "admin",
                  "manager",
                  "default_manager",
                ].includes(role) && {
                  path: "/sales-report",
                  label: "Sales",
                  icon: BarChart3,
                },
              ]
                .filter(Boolean)
                .map((tab) => {
                  const Icon = tab.icon;
                  const active =
                    router.asPath === tab.path ||
                    router.asPath.startsWith(tab.path + "/") ||
                    router.asPath.startsWith(tab.path + "?");
                  return (
                    <Link
                      key={tab.path}
                      href={tab.path}
                      className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                        active
                          ? "text-primary"
                          : "text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300"
                      }`}
                    >
                      <div className="relative">
                        <Icon
                          className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`}
                        />
                        {active && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold leading-none mt-1 ${active ? "text-primary" : ""}`}
                      >
                        {tab.label}
                      </span>
                    </Link>
                  );
                })}

              {/* More — always last, opens full sidebar */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300 transition-colors"
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] font-semibold leading-none mt-1">
                  More
                </span>
              </button>
            </nav>
          )}
        </div>
      </div>

      <AISidebar
        isOpen={aiSidebarOpen}
        onClose={() => setAiSidebarOpen(false)}
        restaurantName={restaurantName}
      />
    </>
  );
}
