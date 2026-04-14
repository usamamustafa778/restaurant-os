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
  Briefcase,
  Eye,
  EyeOff,
  X,
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
  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    password: "",
    role: "cashier",
    branchIds: [],
    phone: "",
  });

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

  async function resetPasswordPrompt(u) {
    const ok = await confirm({
      title: "Reset password",
      message: `Send ${u.name} to Forgot Password flow? This action is manual in current setup.`,
      confirmText: "Got it",
    });
    if (ok) toast.success("Use Forgot Password with the member's email.");
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
      return true;
    });
  }, [users, search, showAllBranches, currentBranch, roleTab]);

  const topStats = useMemo(() => {
    const active = filtered.filter((u) => u.isActive !== false).length;
    const riders = filtered.filter((u) => u.role === "delivery_rider").length;
    const managers = filtered.filter((u) => ["manager", "admin", "restaurant_admin", "product_manager"].includes(u.role)).length;
    return { total: filtered.length, active, riders, managers };
  }, [filtered]);

  return (
    <AdminLayout title="Staff Management" suspended={suspended}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[["Total Staff", topStats.total], ["Active Now", topStats.active], ["Riders", topStats.riders], ["Managers", topStats.managers]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
            <p className="text-[10px] uppercase text-gray-400 font-semibold">{k}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, role, phone..." className="flex-1 h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm" />
        {currentBranch && (
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300">
            <input type="checkbox" checked={showAllBranches} onChange={(e) => setShowAllBranches(e.target.checked)} className="rounded border-gray-300 text-primary" />
            All Branches
          </label>
        )}
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold">
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "manager", "cashier", "waiter", "kitchen", "rider"].map((t) => (
          <button key={t} type="button" onClick={() => setRoleTab(t)} className={`h-8 px-3 rounded-lg text-xs font-semibold border ${roleTab === t ? "border-primary bg-primary/10 text-primary" : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400"}`}>
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {pageLoading ? (
          <div className="flex items-center justify-center py-16 gap-3"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span>Loading staff...</span></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold">No team members found</p>
            <p className="text-sm text-gray-500 mt-1">Add your first team member or adjust filters.</p>
            <button type="button" onClick={openCreate} className="mt-4 inline-flex h-9 items-center gap-2 px-4 rounded-lg bg-primary text-white text-sm font-semibold"><UserPlus className="w-4 h-4" />Add Team Member</button>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((u) => {
              const isOwner = u.role === "restaurant_admin";
              return (
                <div key={u.id} onClick={() => void openDetail(u)} className="group cursor-pointer rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-primary/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-bold flex items-center justify-center">{getInitials(u.name)}</div>
                    <div className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${u.isActive === false ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{u.isActive === false ? "Inactive" : "Active"}</div>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">{u.name}</h3>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-semibold text-primary"><Briefcase className="w-2.5 h-2.5" />{getRoleLabel(u.role)}</span>
                  <p className="mt-2 text-xs text-gray-600 dark:text-neutral-400 flex items-center gap-1"><Mail className="w-3 h-3" />{u.email || "—"}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-neutral-400 flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone || "—"}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-neutral-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{(u.branches || []).map((b) => b.branchName).join(", ") || "—"}</p>
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-neutral-500">Last active: {daysAgo(u.lastLoginAt) == null ? "never" : `${daysAgo(u.lastLoginAt)} day(s) ago`}</p>
                  {!isOwner && (
                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => openEdit(u)} className="h-7 px-2 rounded-md border text-xs">Edit</button>
                      <button type="button" onClick={() => void resetPasswordPrompt(u)} className="h-7 px-2 rounded-md border text-xs">Reset Password</button>
                      <button type="button" onClick={() => void deactivateUser(u)} className="h-7 px-2 rounded-md border text-xs">{u.isActive === false ? "Activate" : "Deactivate"}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/45" onClick={() => setSelectedUser(null)} />
          <div className="relative w-full max-w-md h-full bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-bold">Team member</h2>
              <button type="button" onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-bold flex items-center justify-center">{getInitials(selectedUser.name)}</div>
              <p><span className="font-semibold">Name:</span> {selectedUser.name}</p>
              <p><span className="font-semibold">Email:</span> {selectedUser.email || "—"}</p>
              <p><span className="font-semibold">Phone:</span> {selectedUser.phone || "—"}</p>
              <p><span className="font-semibold">Role:</span> {getRoleLabel(selectedUser.role)}</p>
              <p><span className="font-semibold">Branch:</span> {(selectedUser.branches || []).map((b) => b.branchName).join(", ") || "—"}</p>
              <p><span className="font-semibold">Joined:</span> {fmtDate(selectedUser.createdAt)}</p>
              <p><span className="font-semibold">Last login:</span> {fmtDate(selectedUser.lastLoginAt)}</p>
              {["cashier", "order_taker"].includes(selectedUser.role) && (
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                  <p className="font-semibold mb-1">Orders handled</p>
                  {statsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <p>Today: <b>{selectedStats.ordersToday || 0}</b> · This week: <b>{selectedStats.ordersThisWeek || 0}</b></p>
                  )}
                </div>
              )}
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => void deactivateUser(selectedUser)} className="h-9 px-3 rounded-lg border text-xs font-semibold">
                  {selectedUser.isActive === false ? "Set Active" : "Set Inactive"}
                </button>
                <button type="button" onClick={() => void resetPasswordPrompt(selectedUser)} className="h-9 px-3 rounded-lg border text-xs font-semibold">Reset password</button>
                <button type="button" onClick={() => openEdit(selectedUser)} className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold">Edit role</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
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
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={form.id ? "Leave blank to keep current password" : "Password"} className="w-full h-10 px-3 pr-10 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
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
    </AdminLayout>
  );
}
