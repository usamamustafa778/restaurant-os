import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { getUsers, createUser, updateUser, deleteUser, getBranches, SubscriptionInactiveError, getStoredAuth } from "../../lib/apiClient";
import { UserPlus, Trash2, Edit3, User, Mail, Briefcase, LayoutGrid, List, MapPin, Eye, EyeOff, Loader2, Users } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import DataTable from "../../components/ui/DataTable";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "product_manager", label: "Product manager" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
  { value: "kitchen_staff", label: "Kitchen staff" },
  { value: "order_taker", label: "Order taker" },
];

const ROLE_LABELS = {
  restaurant_admin: "Owner",
  admin: "Admin",
  product_manager: "Product Manager",
  cashier: "Cashier",
  manager: "Manager",
  kitchen_staff: "Kitchen Staff",
  order_taker: "Order Taker",
};

const MANAGER_ALLOWED_ROLES = ["product_manager", "cashier", "kitchen_staff", "order_taker"];

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function UsersPage() {
  const { branches: branchList, currentBranch } = useBranch() || {};
  const auth = getStoredAuth();
  const currentUserRole = auth?.user?.role;
  const currentUserId = auth?.user?.id || auth?.user?._id;
  const isManager = currentUserRole === "manager";
  const roleOptions = isManager
    ? ROLE_OPTIONS.filter((r) => MANAGER_ALLOWED_ROLES.includes(r.value))
    : ROLE_OPTIONS;
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ id: null, name: "", email: "", password: "", role: "manager", profileImageUrl: "", branchIds: [] });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const [viewMode, setViewMode] = useState("card"); // "card" | "table"
  const [showPassword, setShowPassword] = useState(false);
  const { confirm } = useConfirmDialog();
  const router = useRouter();

  const branches = branchList?.length ? branchList : [];

  useEffect(() => {
    (async () => {
      try {
        const data = await getUsers();
        setUsers(data);
        setPageLoading(false);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else toast.error(err.message || "Failed to load users");
        setPageLoading(false);
      }
    })();
  }, []);

  function resetForm() {
    const defaultRole = isManager ? "cashier" : "manager";
    const branchIds = isManager && currentBranch ? [currentBranch.id] : [];
    setForm({ id: null, name: "", email: "", password: "", role: defaultRole, profileImageUrl: "", branchIds: branchIds });
    setShowPassword(false);
  }

  function startEdit(user) {
    const branchIds = isManager && currentBranch ? [currentBranch.id] : (user.branches || []).map(b => b.branchId).filter(Boolean);
    const role = isManager && !MANAGER_ALLOWED_ROLES.includes(user.role) ? roleOptions[0]?.value ?? "cashier" : user.role;
    setForm({ id: user.id, name: user.name, email: user.email, password: "", role, profileImageUrl: user.profileImageUrl || "", branchIds });
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setModalError("Name is required"); return; }
    if (!form.email.trim()) { setModalError("Email is required"); return; }
    if (!form.id && !form.password) { setModalError("Password is required for new users"); return; }
    setModalError("");
    setLoading(true);
    try {
      const branchIds = isManager && currentBranch ? [currentBranch.id] : (branches.length > 0 ? form.branchIds : undefined);
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        profileImageUrl: form.profileImageUrl || null,
        ...(form.password ? { password: form.password } : {}),
        ...(branchIds?.length ? { branchIds } : {})
      };
      if (form.id) {
        const updated = await updateUser(form.id, payload);
        setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      } else {
        if (form.password) payload.password = form.password;
        const created = await createUser(payload);
        setUsers(prev => [created, ...prev]);
      }
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || "Failed to save user");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const target = users.find(u => u.id === id);
    if (target?.role === "restaurant_admin") return;
    const ok = await confirm({ title: "Delete user", message: "Delete this user? This cannot be undone." });
    if (!ok) return;
    await deleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    if (form.id === id) resetForm();
  }

  const filtered = users.filter(user => {
    const term = search.trim().toLowerCase();
    if (term && !user.name.toLowerCase().includes(term) && !user.email.toLowerCase().includes(term) && !user.role.toLowerCase().includes(term)) return false;
    // When a specific branch is selected, show only users assigned to that branch. "All branches" = show all. Owner always visible.
    if (currentBranch && user.role !== "restaurant_admin") {
      const userBranchIds = (user.branches || []).map(b => String(b.branchId || b.branch));
      if (!userBranchIds.includes(String(currentBranch.id))) return false;
    }
    return true;
  });

  return (
    <AdminLayout title="Staff Management" suspended={suspended}>
      {/* Search, view toggle & add button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or role..."
          className="flex-1 h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
        />
        <div className="inline-flex h-10 rounded-xl border-2 border-gray-200 dark:border-neutral-700 overflow-hidden flex-shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("card")}
            className={`px-3.5 flex items-center transition-all ${viewMode === "card" ? "bg-gradient-to-r from-primary to-secondary text-white" : "bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"}`}
            title="Card view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`px-3.5 flex items-center transition-all ${viewMode === "table" ? "bg-gradient-to-r from-primary to-secondary text-white" : "bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"}`}
            title="Table view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setModalError("");
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {pageLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                Loading users...
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-secondary dark:bg-neutral-800 flex items-center justify-center mb-4">
              <User className="w-7 h-7 text-gray-400 dark:text-neutral-600" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-neutral-500">
              {users.length === 0 ? "No team members yet" : "No results found"}
            </p>
            <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">
              {users.length === 0 ? "Add your first team member to get started." : "Try a different search term."}
            </p>
          </div>
        ) : viewMode === "table" ? (
        /* ════════════ TABLE VIEW ════════════ */
        <DataTable
          columns={[
            {
              key: "name",
              header: "Member",
              render: (_, row) => (
                <div className="flex items-center gap-3">
                  {row.profileImageUrl ? (
                    <img src={row.profileImageUrl} alt={row.name} className="w-9 h-9 rounded-full object-cover border-2 border-secondary flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-bg-secondary dark:bg-neutral-800 border-2 border-gray-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary/40 dark:text-neutral-500" />
                    </div>
                  )}
                  <span className="font-semibold text-gray-900 dark:text-white truncate">{row.name}</span>
                </div>
              ),
            },
            { key: "email", header: "Email" },
            {
              key: "role",
              header: "Role",
              render: (val) => (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-[10px] font-semibold text-primary dark:text-secondary">
                  <Briefcase className="w-2.5 h-2.5" />
                  {getRoleLabel(val)}
                </span>
              ),
            },
            {
              key: "branches",
              header: "Branches",
              render: (_, row) => (
                <span className="text-xs text-gray-600 dark:text-neutral-400">
                  {(row.branches || []).length > 0
                    ? (row.branches || []).map(b => b.branchName).join(", ")
                    : "—"}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Joined",
              render: (val) =>
                new Date(val).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (_, row) => {
                const isOwner = row.role === "restaurant_admin";
                const isSelf = String(row.id) === String(currentUserId);
                const canEdit = !isOwner;
                const canDelete = !isOwner && (!isManager || !isSelf);
                return (
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
          rows={filtered}
          emptyMessage="No team members found."
        />
      ) : (
        /* ════════════ CARD VIEW ════════════ */
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((user) => {
            const isOwner = user.role === "restaurant_admin";
            const canEdit = !isOwner;
            const canDelete = !isOwner && (!isManager || String(user.id) !== String(currentUserId));
            const initials = getInitials(user.name);
            return (
              <div
                key={user.id}
                className="group relative flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {user.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt={user.name}
                      className="w-14 h-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-lg font-bold text-white leading-none">{initials}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{user.name}</h3>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => router.push("/profile")}
                        className="flex-shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors cursor-pointer"
                        title="View profile"
                      >
                        Owner
                      </button>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 dark:bg-primary/20 text-[10px] font-semibold text-primary dark:text-secondary">
                    <Briefcase className="w-2.5 h-2.5" />
                    {getRoleLabel(user.role)}
                  </span>
                  <p className="mt-1.5 text-[11px] text-gray-500 dark:text-neutral-400 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    {user.email}
                  </p>
                  {(user.branches || []).length > 0 && (
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-neutral-500 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {(user.branches || []).map(b => b.branchName).join(", ")}
                    </p>
                  )}
                </div>

                {/* Hover actions */}
                {(canEdit || canDelete) && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-primary dark:hover:text-secondary hover:border-primary/30 transition-colors shadow-sm"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/30 transition-colors shadow-sm"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {form.id ? "Edit Team Member" : "Add Team Member"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              {form.id ? "Update this member's information." : "Invite a new member to your restaurant team."}
            </p>

            {modalError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              {/* Profile Image URL */}
              <div className="space-y-1.5">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Profile Photo URL <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {form.profileImageUrl ? (
                      <img src={form.profileImageUrl} alt="Preview" className="w-11 h-11 rounded-full object-cover border-2 border-secondary" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-bg-secondary dark:bg-neutral-800 flex items-center justify-center border-2 border-gray-200 dark:border-neutral-700">
                        <User className="w-5 h-5 text-gray-400 dark:text-neutral-500" />
                      </div>
                    )}
                  </div>
                  <input
                    type="url"
                    autoComplete="off"
                    value={form.profileImageUrl}
                    onChange={e => setForm(prev => ({ ...prev, profileImageUrl: e.target.value }))}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Full Name</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Role</label>
                  <select
                    value={MANAGER_ALLOWED_ROLES.includes(form.role) || !isManager ? form.role : roleOptions[0]?.value}
                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                  >
                    {roleOptions.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Email</label>
                <input
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Password {form.id && <span className="text-gray-400 font-normal">(leave blank to keep)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={form.id ? "Leave blank to keep existing" : "Min 6 characters"}
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {branches.length > 0 && !isManager && (
                <div className="space-y-1.5">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    Branches
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {branches.map((b) => (
                      <label key={b.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.branchIds.includes(b.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm(prev => ({ ...prev, branchIds: [...prev.branchIds, b.id] }));
                            } else {
                              setForm(prev => ({ ...prev, branchIds: prev.branchIds.filter(id => id !== b.id) }));
                            }
                          }}
                          className="rounded border-gray-300 dark:border-neutral-600 text-primary focus:ring-primary/20"
                        />
                        <span className="text-xs text-gray-700 dark:text-neutral-300">{b.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {isManager && currentBranch && (
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  New member will be assigned to <strong>{currentBranch.name}</strong>.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  onClick={() => { resetForm(); setIsModalOpen(false); }}
                >
                  Cancel
                </button>
                <Button type="submit" className="gap-1 rounded-lg" disabled={loading}>
                  <UserPlus className="w-3.5 h-3.5" />
                  {form.id ? "Save Changes" : "Add Member"}
                </Button>
              </div>
            </form>
          </div>
          </div>
        )}
    </AdminLayout>
  );
}
