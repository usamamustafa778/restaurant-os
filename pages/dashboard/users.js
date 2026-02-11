import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { getUsers, createUser, updateUser, deleteUser, SubscriptionInactiveError } from "../../lib/apiClient";
import { UserPlus, Trash2, Edit3, User, Mail, Calendar, Briefcase, Hash, LayoutGrid, List } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import DataTable from "../../components/ui/DataTable";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "product_manager", label: "Product manager" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
  { value: "kitchen_staff", label: "Kitchen staff" }
];

const ROLE_LABELS = {
  restaurant_admin: "Owner",
  admin: "Admin",
  product_manager: "Product Manager",
  cashier: "Cashier",
  manager: "Manager",
  kitchen_staff: "Kitchen Staff",
};

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
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ id: null, name: "", email: "", password: "", role: "manager", profileImageUrl: "" });
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const [viewMode, setViewMode] = useState("card"); // "card" | "table"
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    (async () => {
      try {
        const data = await getUsers();
        setUsers(data);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else setError(err.message || "Failed to load users");
      }
    })();
  }, []);

  function resetForm() {
    setForm({ id: null, name: "", email: "", password: "", role: "manager", profileImageUrl: "" });
  }

  function startEdit(user) {
    setForm({ id: user.id, name: user.name, email: user.email, password: "", role: user.role, profileImageUrl: user.profileImageUrl || "" });
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
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        profileImageUrl: form.profileImageUrl || null,
        ...(form.password ? { password: form.password } : {})
      };
      if (form.id) {
        const updated = await updateUser(form.id, payload);
        setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      } else {
        payload.password = form.password;
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
    if (!term) return true;
    return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term) || user.role.toLowerCase().includes(term);
  });

  return (
    <AdminLayout title="User Management" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-2 text-xs text-red-700 dark:text-red-400">{error}</div>
      )}

      <Card title="Team Members" description="Manage your restaurant team and staff members.">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or role..."
            className="flex-1 w-full sm:max-w-xs px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
          />
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`p-2 transition-colors ${viewMode === "card" ? "bg-primary text-white" : "bg-bg-secondary dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"}`}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-2 transition-colors ${viewMode === "table" ? "bg-primary text-white" : "bg-bg-secondary dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"}`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button
              type="button"
              className="gap-2 shrink-0"
              onClick={() => { resetForm(); setModalError(""); setIsModalOpen(true); }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Team Member
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
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
                return (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {!isOwner && (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {filtered.map((user, idx) => {
            const isOwner = user.role === "restaurant_admin";
            return (
              <div
                key={user.id}
                className="relative group w-full rounded-2xl overflow-hidden bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Top section */}
                <div className="relative bg-primary h-28 overflow-hidden">
                  <svg className="absolute -top-6 -right-6 w-24 h-24 text-secondary opacity-60" viewBox="0 0 100 100" fill="currentColor"><circle cx="50" cy="50" r="50" /></svg>
                  <svg className="absolute -bottom-8 -left-4 w-20 h-20 text-secondary opacity-40" viewBox="0 0 100 100" fill="currentColor"><circle cx="50" cy="50" r="50" /></svg>
                  <svg className="absolute top-4 left-1/2 w-10 h-10 text-white opacity-5" viewBox="0 0 100 100" fill="currentColor"><circle cx="50" cy="50" r="50" /></svg>
                  <div className="relative z-10 px-4 pt-3">
                    <p className="text-[11px] font-bold text-white/90 tracking-wide uppercase">ID Card</p>
                    <p className="text-[10px] text-white/60 mt-0.5">Team Member</p>
                  </div>
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => startEdit(user)} className="p-1.5 rounded-lg bg-white/15 backdrop-blur-sm text-white hover:bg-white/25 transition-colors" title="Edit"><Edit3 className="w-3 h-3" /></button>
                    {!isOwner && (<button type="button" onClick={() => handleDelete(user.id)} className="p-1.5 rounded-lg bg-white/15 backdrop-blur-sm text-white hover:bg-red-500/80 transition-colors" title="Delete"><Trash2 className="w-3 h-3" /></button>)}
                  </div>
                </div>

                {/* Avatar */}
                <div className="flex justify-center -mt-12 relative z-10">
                  <div className="rounded-full p-1 bg-white dark:bg-neutral-950 shadow-lg">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt={user.name} className="w-20 h-20 rounded-full object-cover border-[3px] border-secondary" />
                    ) : (
                      <div className="w-20 h-20 rounded-full border-[3px] border-secondary bg-bg-secondary dark:bg-neutral-900 flex items-center justify-center">
                        <User className="w-9 h-9 text-primary/40 dark:text-neutral-600" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 pt-2 pb-5 text-center">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">{user.name}</h3>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/20">
                    <Briefcase className="w-3 h-3 text-primary dark:text-secondary" />
                    <span className="text-[11px] font-semibold text-primary dark:text-secondary">{getRoleLabel(user.role)}</span>
                  </div>
                  <div className="mt-4 space-y-2.5 text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-12 flex-shrink-0">Email</span>
                      <span className="text-xs text-gray-800 dark:text-neutral-300 truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-12 flex-shrink-0">Role</span>
                      <span className="text-xs text-gray-800 dark:text-neutral-300">{getRoleLabel(user.role)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-12 flex-shrink-0">ID No</span>
                      <span className="text-xs text-gray-800 dark:text-neutral-300 font-mono">{String(idx + 1).padStart(5, "0")}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-12 flex-shrink-0">Joined</span>
                      <span className="text-xs text-gray-800 dark:text-neutral-300">{new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-primary px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-white/60" />
                    <span className="text-[10px] text-white/80 truncate max-w-[140px]">{user.email}</span>
                  </div>
                  {isOwner && (
                    <span className="text-[9px] font-bold text-white/90 uppercase tracking-widest bg-white/15 px-2 py-0.5 rounded-full">Owner</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </Card>

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
                    value={form.role}
                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                  >
                    {ROLE_OPTIONS.map(r => (
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
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={form.id ? "Leave blank to keep existing" : "Min 6 characters"}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>

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
