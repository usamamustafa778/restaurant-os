import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserOrderStats,
  SubscriptionInactiveError,
  getStoredAuth,
} from "../../lib/apiClient";
import {
  UserPlus,
  Loader2,
  Users,
  Mail,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  X,
  KeyRound,
  MessageCircle,
  LayoutList,
  LayoutGrid,
  AlertTriangle,
} from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager", tab: "manager", desc: "Full access except settings" },
  { value: "cashier", label: "Cashier", tab: "cashier", desc: "Can process orders and take payments" },
  { value: "order_taker", label: "Waiter", tab: "waiter", desc: "Can take orders and manage table flow" },
  { value: "kitchen_staff", label: "Kitchen", tab: "kitchen", desc: "Can view and update kitchen order status" },
  { value: "delivery_rider", label: "Rider", tab: "rider", desc: "Access to rider app only" },
  { value: "product_manager", label: "Manager", tab: "manager", desc: "Can manage menu and products" },
  { value: "admin", label: "Manager", tab: "manager", desc: "Full operational admin access" },
];

const ROLE_LABELS = {
  restaurant_admin: "Owner",
  admin: "Admin",
  product_manager: "Product Manager",
  cashier: "Cashier",
  manager: "Manager",
  kitchen_staff: "Kitchen",
  order_taker: "Waiter",
  delivery_rider: "Rider",
};

const ROLE_TAB_MAP = {
  all: () => true,
  manager: (u) => ["manager", "product_manager", "admin", "restaurant_admin"].includes(u.role),
  cashier: (u) => u.role === "cashier",
  waiter: (u) => u.role === "order_taker",
  kitchen: (u) => u.role === "kitchen_staff",
  rider: (u) => u.role === "delivery_rider",
};

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function getRoleDescription(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.desc || "";
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function daysAgo(dt) {
  if (!dt) return null;
  const d = Math.floor((Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, d);
}

function getRelativeTime(dt) {
  if (!dt) return null;
  const ms = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
}

function getRolePillClass(role) {
  switch (role) {
    case "restaurant_admin": return "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";
    case "admin": case "manager": case "product_manager": return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
    case "cashier": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "order_taker": return "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400";
    case "kitchen_staff": return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    case "delivery_rider": return "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400";
    default: return "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-400";
  }
}

export default function UsersPage() {
  const { branches = [], currentBranch } = useBranch() || {};
  const auth = getStoredAuth();
  const currentUserRole = auth?.user?.role;
  const isManager = currentUserRole === "manager";
  const { confirm } = useConfirmDialog();

  const [users, setUsers] = useState([]);
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [roleTab, setRoleTab] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedStats, setSelectedStats] = useState({ ordersToday: 0, ordersThisWeek: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const isOwner = currentUserRole === "restaurant_admin";

  const [viewMode, setViewMode] = useState("table");
  const [showInactive, setShowInactive] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [setPasswordTarget, setSetPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [setPasswordError, setSetPasswordError] = useState("");

  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    password: "",
    role: "cashier",
    branchIds: [],
    phone: "",
  });

  const DEFAULT_PERMISSIONS = {
    canDeleteOrderItems: false,
    canViewAccounts: false,
    canViewSalesDetails: false,
    canManageInventory: false,
  };
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);

  const roleOptions = useMemo(
    () =>
      isManager
        ? ROLE_OPTIONS.filter((r) => ["product_manager", "cashier", "kitchen_staff", "order_taker", "delivery_rider"].includes(r.value))
        : ROLE_OPTIONS,
    [isManager]
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await getUsers();
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else toast.error(err.message || "Failed to load staff");
      } finally {
        setPageLoading(false);
      }
    })();
  }, []);

  function resetForm() {
    setForm({
      id: null,
      name: "",
      email: "",
      password: "",
      role: isManager ? "cashier" : "manager",
      branchIds: currentBranch?.id ? [currentBranch.id] : [],
      phone: "",
    });
    setPermissions(DEFAULT_PERMISSIONS);
    setShowPassword(false);
  }

  function openCreate() {
    resetForm();
    setModalError("");
    setIsModalOpen(true);
  }

  function openEdit(u) {
    setForm({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      password: "",
      role: u.role,
      branchIds: (u.branches || []).map((b) => b.branchId).filter(Boolean),
      phone: u.phone || "",
    });
    setPermissions(u.permissions || DEFAULT_PERMISSIONS);
    setModalError("");
    setIsModalOpen(true);
  }

  async function openDetail(u) {
    setSelectedUser(u);
    setSelectedStats({ ordersToday: 0, ordersThisWeek: 0 });
    if (["cashier", "order_taker"].includes(u.role)) {
      setStatsLoading(true);
      try {
        const s = await getUserOrderStats(u.id);
        setSelectedStats(s || { ordersToday: 0, ordersThisWeek: 0 });
      } catch {
        setSelectedStats({ ordersToday: 0, ordersThisWeek: 0 });
      } finally {
        setStatsLoading(false);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setModalError("Name is required");
    if (!form.email.trim()) return setModalError("Email is required");
    if (!form.id && !form.password.trim()) return setModalError("Password is required");
    if (form.role === "delivery_rider" && !form.phone.trim()) return setModalError("Phone is required for riders");

    setLoading(true);
    setModalError("");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
        ...(form.phone ? { phone: form.phone.trim() } : {}),
        ...(form.branchIds.length ? { branchIds: form.branchIds } : {}),
        // Only include permissions when role is cashier; backend ignores for other roles
        ...(form.role === "cashier" ? { permissions } : {}),
      };
      if (form.id) {
        const updated = await updateUser(form.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const created = await createUser(payload);
        setUsers((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      setModalError(err.message || "Failed to save member");
    } finally {
      setLoading(false);
    }
  }

  async function deactivateUser(u) {
    const ok = await confirm({ title: u.isActive === false ? "Activate user" : "Deactivate user", message: `Update status for ${u.name}?` });
    if (!ok) return;
    try {
      const updated = await updateUser(u.id, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (selectedUser?.id === u.id) setSelectedUser(updated);
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  }

  function openSetPassword(u) {
    setSetPasswordTarget(u);
    setNewPassword("");
    setShowNewPassword(false);
    setSetPasswordError("");
    setShowSetPasswordModal(true);
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setSetPasswordError("Password must be at least 6 characters.");
      return;
    }
    setSetPasswordLoading(true);
    setSetPasswordError("");
    try {
      const updated = await updateUser(setPasswordTarget.id, { password: newPassword });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      if (selectedUser?.id === updated.id) setSelectedUser(updated);
      toast.success(`Password updated for ${setPasswordTarget.name}`);
      setShowSetPasswordModal(false);
    } catch (err) {
      setSetPasswordError(err.message || "Failed to set password");
    } finally {
      setSetPasswordLoading(false);
    }
  }

  async function handleDelete(id) {
    const target = users.find((u) => u.id === id);
    if (target?.role === "restaurant_admin") return;
    const ok = await confirm({ title: "Delete user", message: "Delete this user? This cannot be undone." });
    if (!ok) return;
    await deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      if (q && !`${u.name} ${u.email} ${u.role} ${u.phone || ""}`.toLowerCase().includes(q)) return false;
      if (!showAllBranches && currentBranch && u.role !== "restaurant_admin") {
        const b = (u.branches || []).map((x) => String(x.branchId));
        if (!b.includes(String(currentBranch.id))) return false;
      }
      if (!ROLE_TAB_MAP[roleTab]?.(u)) return false;
      if (!showInactive && u.isActive === false) return false;
      return true;
    });
  }, [users, search, showAllBranches, currentBranch, roleTab, showInactive]);

  const topStats = useMemo(() => {
    const total = users.length;
    const neverLoggedIn = users.filter((u) => !u.lastLoginAt && u.isActive !== false).length;
    const riders = users.filter((u) => u.role === "delivery_rider" && u.isActive !== false).length;
    const managers = users.filter((u) => ["manager", "admin", "restaurant_admin", "product_manager"].includes(u.role) && u.isActive !== false).length;
    const inactive = users.filter((u) => u.isActive === false).length;
    return { total, neverLoggedIn, riders, managers, inactive };
  }, [users]);

  const tabCounts = useMemo(() => {
    const base = users.filter((u) => {
      if (!showAllBranches && currentBranch && u.role !== "restaurant_admin") {
        const b = (u.branches || []).map((x) => String(x.branchId));
        if (!b.includes(String(currentBranch.id))) return false;
      }
      return u.isActive !== false;
    });
    return {
      all: base.length,
      manager: base.filter(ROLE_TAB_MAP.manager).length,
      cashier: base.filter(ROLE_TAB_MAP.cashier).length,
      waiter: base.filter(ROLE_TAB_MAP.waiter).length,
      kitchen: base.filter(ROLE_TAB_MAP.kitchen).length,
      rider: base.filter(ROLE_TAB_MAP.rider).length,
    };
  }, [users, showAllBranches, currentBranch]);

  const neverLoggedInCount = useMemo(
    () => users.filter((u) => !u.lastLoginAt && u.isActive !== false).length,
    [users]
  );

  return (
    <AdminLayout title="Staff Management" suspended={suspended}>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Total Staff", value: topStats.total, color: null },
          { label: "Never Logged In", value: topStats.neverLoggedIn, color: topStats.neverLoggedIn > 0 ? "text-red-600 dark:text-red-400" : null },
          { label: "Riders", value: topStats.riders, color: null },
          { label: "Managers", value: topStats.managers, color: null },
          { label: "Inactive Staff", value: topStats.inactive, color: topStats.inactive > 0 ? "text-red-600 dark:text-red-400" : null },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
            <p className="text-[10px] uppercase text-gray-400 dark:text-neutral-500 font-semibold">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${color || "text-gray-900 dark:text-white"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Never-logged-in warning banner ─────────────────── */}
      {neverLoggedInCount > 0 && !bannerDismissed && (
        <div className="flex items-start gap-3 mb-5 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {neverLoggedInCount} team member{neverLoggedInCount > 1 ? "s have" : " has"} never logged in
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              They won't be able to use the system until they log in for the first time.
            </p>
          </div>
          <button type="button" onClick={() => setBannerDismissed(true)} className="p-1 rounded-md text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, role, phone…"
          className="flex-1 h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm focus:outline-none focus:border-primary transition-colors"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {currentBranch && (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
              <input type="checkbox" checked={showAllBranches} onChange={(e) => setShowAllBranches(e.target.checked)} className="rounded border-gray-300 text-primary" />
              All Branches
            </label>
          )}
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-gray-300 text-primary" />
            Show inactive
          </label>
          {/* View toggle — hidden on mobile (auto card) */}
          <div className="hidden md:flex items-center rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`h-9 w-9 flex items-center justify-center transition-colors ${viewMode === "table" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800"}`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              title="Card view"
              className={`h-9 w-9 flex items-center justify-center transition-colors ${viewMode === "card" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* ── Role filter tabs with active counts ────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: "all", label: "All" },
          { key: "manager", label: "Manager" },
          { key: "cashier", label: "Cashier" },
          { key: "waiter", label: "Waiter" },
          { key: "kitchen", label: "Kitchen" },
          { key: "rider", label: "Rider" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setRoleTab(key)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${
              roleTab === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600"
            }`}
          >
            {label}
            {tabCounts[key] > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${roleTab === key ? "bg-primary/20 text-primary" : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"}`}>
                {tabCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Main content ───────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {pageLoading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm text-gray-500">Loading staff…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-10 h-10 text-gray-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="font-semibold text-gray-800 dark:text-white">
              No {roleTab === "all" ? "" : roleTab + " "}staff members{showInactive ? "" : " found"}
            </p>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
              {showInactive ? "Try a different search or filter." : "Add your first team member or adjust the filters."}
            </p>
            <button type="button" onClick={openCreate} className="mt-4 inline-flex h-9 items-center gap-2 px-4 rounded-lg bg-primary text-white text-sm font-semibold">
              <UserPlus className="w-4 h-4" /> Add Team Member
            </button>
          </div>
        ) : (
          <>
            {/* TABLE — default on desktop */}
            <div className={`${viewMode === "table" ? "hidden md:block" : "hidden"}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40">
                    {["Staff Member", "Role", "Branch", "Contact", "Last Active", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/60">
                  {filtered.map((u) => {
                    const uIsOwner = u.role === "restaurant_admin";
                    const inactive = u.isActive === false;
                    const relTime = getRelativeTime(u.lastLoginAt);
                    const isOld = u.lastLoginAt && daysAgo(u.lastLoginAt) > 30;
                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors ${inactive ? "opacity-50" : ""}`}
                      >
                        {/* Staff Member */}
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => void openDetail(u)} className="flex items-center gap-3 text-left hover:underline min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate">{u.name}</p>
                              <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate">{u.email || "—"}</p>
                            </div>
                          </button>
                        </td>
                        {/* Role */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getRolePillClass(u.role)}`}>
                            {getRoleLabel(u.role)}
                          </span>
                        </td>
                        {/* Branch */}
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400 max-w-[120px] truncate">
                          {uIsOwner ? "All branches" : (u.branches || []).map((b) => b.branchName).join(", ") || "—"}
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3">
                          {u.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-600 dark:text-neutral-400">{u.phone}</span>
                              <a
                                href={`https://wa.me/${u.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open in WhatsApp"
                                className="p-1 rounded-md text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-neutral-600">—</span>
                          )}
                        </td>
                        {/* Last Active */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!u.lastLoginAt ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                              Never logged in
                            </span>
                          ) : (
                            <span className={`text-xs ${isOld ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-neutral-400"}`}>
                              {relTime}
                            </span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${inactive ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                            {inactive ? "Inactive" : "Active"}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          {!uIsOwner ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <button type="button" onClick={() => openEdit(u)} className="h-7 px-2.5 rounded-md border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap">
                                Edit
                              </button>
                              {isOwner && (
                                <button type="button" onClick={() => openSetPassword(u)} className="h-7 px-2.5 rounded-md border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center gap-1 whitespace-nowrap">
                                  <KeyRound className="w-3 h-3" /> Password
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void deactivateUser(u)}
                                className={`h-7 px-2.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${inactive ? "border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" : "border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"}`}
                              >
                                {inactive ? "Activate" : "Deactivate"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-neutral-600 italic">Owner</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* CARDS — default on mobile, optional on desktop */}
            <div className={`p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 ${viewMode === "card" ? "md:grid" : "md:hidden"}`}>
              {filtered.map((u) => {
                const uIsOwner = u.role === "restaurant_admin";
                const inactive = u.isActive === false;
                const relTime = getRelativeTime(u.lastLoginAt);
                const isOld = u.lastLoginAt && daysAgo(u.lastLoginAt) > 30;
                return (
                  <div
                    key={u.id}
                    className={`rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 transition-all hover:border-primary/30 hover:shadow-sm ${inactive ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => void openDetail(u)} className="flex items-center gap-3 min-w-0 text-left">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {getInitials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{u.name}</p>
                          <span className={`inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRolePillClass(u.role)}`}>
                            {getRoleLabel(u.role)}
                          </span>
                        </div>
                      </button>
                      <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${inactive ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                        {inactive ? "Inactive" : "Active"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1.5"><Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{u.email || "—"}</span></p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{u.phone || "—"}</span>
                        {u.phone && (
                          <a href={`https://wa.me/${u.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-green-600 dark:text-green-400">
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1.5"><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{uIsOwner ? "All branches" : (u.branches || []).map((b) => b.branchName).join(", ") || "—"}</span></p>
                    </div>
                    <div className="mt-2">
                      {!u.lastLoginAt ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">Never logged in</span>
                      ) : (
                        <p className={`text-[11px] ${isOld ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-neutral-500"}`}>
                          Last active: {relTime}
                        </p>
                      )}
                    </div>
                    {!uIsOwner && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-1.5 flex-wrap">
                        <button type="button" onClick={() => openEdit(u)} className="h-7 px-2.5 rounded-md border border-gray-200 dark:border-neutral-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">Edit</button>
                        {isOwner && (
                          <button type="button" onClick={() => openSetPassword(u)} className="h-7 px-2.5 rounded-md border border-gray-200 dark:border-neutral-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center gap-1">
                            <KeyRound className="w-3 h-3" /> Password
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void deactivateUser(u)}
                          className={`h-7 px-2.5 rounded-md border text-xs font-medium transition-colors ${inactive ? "border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" : "border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"}`}
                        >
                          {inactive ? "Activate" : "Deactivate"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Detail side panel ──────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/45" onClick={() => setSelectedUser(null)} />
          <div className="relative w-full max-w-md h-full bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Team member</h2>
              <button type="button" onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white text-lg font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-base">{selectedUser.name}</p>
                  <span className={`inline-flex mt-1 items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getRolePillClass(selectedUser.role)}`}>
                    {getRoleLabel(selectedUser.role)}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">
                {[
                  { label: "Email", value: selectedUser.email || "—" },
                  { label: "Phone", value: selectedUser.phone || "—" },
                  { label: "Branch", value: selectedUser.role === "restaurant_admin" ? "All branches" : (selectedUser.branches || []).map((b) => b.branchName).join(", ") || "—" },
                  { label: "Joined", value: fmtDate(selectedUser.createdAt) },
                  { label: "Last login", value: selectedUser.lastLoginAt ? fmtDate(selectedUser.lastLoginAt) : "Never" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-2 px-3 py-2.5">
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide w-20 flex-shrink-0 pt-px">{label}</span>
                    <span className={`text-xs text-gray-700 dark:text-neutral-300 ${label === "Last login" && !selectedUser.lastLoginAt ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}>{value}</span>
                  </div>
                ))}
              </div>
              {["cashier", "order_taker"].includes(selectedUser.role) && (
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                  <p className="text-xs font-semibold text-gray-600 dark:text-neutral-300 mb-2">Orders handled</p>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <p className="text-sm">Today: <b>{selectedStats.ordersToday || 0}</b> · This week: <b>{selectedStats.ordersThisWeek || 0}</b></p>
                  )}
                </div>
              )}
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void deactivateUser(selectedUser)}
                  className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${selectedUser.isActive === false ? "border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50" : "border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"}`}
                >
                  {selectedUser.isActive === false ? "Set Active" : "Set Inactive"}
                </button>
                {isOwner && selectedUser.role !== "restaurant_admin" && (
                  <button type="button" onClick={() => openSetPassword(selectedUser)} className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                    <KeyRound className="w-3.5 h-3.5" /> Set Password
                  </button>
                )}
                <button type="button" onClick={() => openEdit(selectedUser)} className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">Edit role</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/45" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{form.id ? "Edit Team Member" : "Add Team Member"}</h2>
                <p className="text-xs text-gray-500">{form.id ? "Update profile and role" : "Invite a new team member"}</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {modalError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{modalError}</div>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-neutral-800">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-bold flex items-center justify-center">{getInitials(form.name)}</div>
                  <p className="text-xs text-gray-500">Avatar auto-generated from name initials</p>
                </div>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm" />
                <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm" />
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone (required for riders)" className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm" />
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm">
                  {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <p className="text-xs text-gray-500">{getRoleDescription(form.role)}</p>

                {/* Cashier-only extra permissions */}
                {form.role === "cashier" && (
                  <div className="mt-1 p-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-900/50">
                    <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2.5">
                      Extra Permissions
                    </p>
                    <div className="space-y-2">
                      {[
                        { key: "canDeleteOrderItems", label: "Can delete items from orders" },
                        { key: "canViewAccounts",     label: "Can view accounts board" },
                        { key: "canViewSalesDetails", label: "Can view sales details (cash/online/card)" },
                        { key: "canManageInventory",  label: "Can manage inventory" },
                      ].map((perm) => (
                        <label key={perm.key} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!permissions[perm.key]}
                            onChange={(e) =>
                              setPermissions((prev) => ({ ...prev, [perm.key]: e.target.checked }))
                            }
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500/30"
                          />
                          <span className="text-sm text-gray-700 dark:text-neutral-300">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={form.id ? "Leave blank to keep current password" : "Password"} className="w-full h-10 px-3 pr-10 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                {!form.id && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">
                    Staff member should change this password after first login.
                  </p>
                )}
                {branches.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Branches</label>
                    <div className="flex flex-wrap gap-2">
                      {branches.map((b) => (
                        <label key={b.id} className="inline-flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={form.branchIds.includes(b.id)}
                            onChange={(e) => setForm((p) => ({ ...p, branchIds: e.target.checked ? [...p.branchIds, b.id] : p.branchIds.filter((id) => id !== b.id) }))}
                            className="rounded border-gray-300 text-primary"
                          />
                          {b.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="h-9 px-4 rounded-lg border text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={loading} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {form.id ? "Save Changes" : "Add Member"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showSetPasswordModal && setPasswordTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Set Password</h2>
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate">{setPasswordTarget.name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowSetPasswordModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSetPassword} className="px-5 py-5 space-y-4">
              {setPasswordError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs font-medium text-red-600 dark:text-red-400">
                  {setPasswordError}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoFocus
                    className="w-full h-10 px-3 pr-10 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                  <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400 dark:text-neutral-500">
                  This will immediately update the employee's login password.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowSetPasswordModal(false)} className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={setPasswordLoading || newPassword.length < 6} className="flex-1 h-9 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-colors hover:bg-primary/90">
                  {setPasswordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {setPasswordLoading ? "Saving…" : "Set Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
