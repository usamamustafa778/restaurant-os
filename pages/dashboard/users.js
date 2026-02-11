import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getUsers, createUser, updateUser, deleteUser, SubscriptionInactiveError } from "../../lib/apiClient";
import { UserPlus, Trash2, Edit3, Shield, UserCircle2 } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "product_manager", label: "Product manager" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
  { value: "kitchen_staff", label: "Kitchen staff" }
];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    password: "",
    role: "manager"
  });
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    (async () => {
      try {
        const data = await getUsers();
        setUsers(data);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          console.error("Failed to load users:", err);
          setError(err.message || "Failed to load users");
        }
      }
    })();
  }, []);

  function resetForm() {
    setForm({
      id: null,
      name: "",
      email: "",
      password: "",
      role: "manager"
    });
  }

  function startEdit(user) {
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role
    });
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Name is required");
      return;
    }
    if (!form.email.trim()) {
      setModalError("Email is required");
      return;
    }
    if (!form.id && !form.password) {
      setModalError("Password is required for new users");
      return;
    }
    setModalError("");
    setLoading(true);
    try {
      if (form.id) {
        const updated = await updateUser(form.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          ...(form.password ? { password: form.password } : {})
        });
        setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      } else {
        const created = await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role
        });
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
    if (target?.role === "restaurant_admin") {
      // Owner / primary admin cannot be deleted from the UI
      return;
    }
    const ok = await confirm({
      title: "Delete user",
      message: "Delete this user? This cannot be undone."
    });
    if (!ok) return;
    await deleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    if (form.id === id) resetForm();
  }

  function roleBadge(role) {
    const base =
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border";
    if (role === "admin") {
      return (
        <span className={`${base} border-red-500/60 bg-red-500/10 text-red-700`}>
          <Shield className="w-3 h-3" />
          Admin
        </span>
      );
    }
    if (role === "product_manager") {
      return (
        <span
          className={`${base} border-amber-400/60 bg-amber-400/10 text-amber-700`}
        >
          <UserCircle2 className="w-3 h-3" />
          Product manager
        </span>
      );
    }
    if (role === "cashier") {
      return (
        <span
          className={`${base} border-emerald-400/60 bg-emerald-400/10 text-emerald-700`}
        >
          <UserCircle2 className="w-3 h-3" />
          Cashier
        </span>
      );
    }
    if (role === "manager") {
      return (
        <span
          className={`${base} border-sky-400/60 bg-sky-400/10 text-sky-700`}
        >
          <UserCircle2 className="w-3 h-3" />
          Manager
        </span>
      );
    }
    if (role === "kitchen_staff") {
      return (
        <span
          className={`${base} border-lime-400/60 bg-lime-400/10 text-lime-700`}
        >
          <UserCircle2 className="w-3 h-3" />
          Kitchen staff
        </span>
      );
    }
    return (
      <span
        className={`${base} border-neutral-600 bg-neutral-800/60 text-neutral-200`}
      >
        {role}
      </span>
    );
  }

  return (
    <AdminLayout title="User Management" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <Card
          title="Existing Users"
          description="View and manage all users with system access."
        >
          <div className="flex flex-row items-center justify-between gap-3 mb-4 text-xs">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or role..."
              className="flex-1 px-3 py-1.5 max-w-sm rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
            <Button
              type="button"
              className="gap-2 shrink-0"
              onClick={() => {
                resetForm();
                setModalError("");
                setIsModalOpen(true);
              }}
            >
              <UserPlus className="w-3 h-3" />
              Create user
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto text-xs">
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase text-gray-800 border-b border-gray-300 sticky top-0 z-10 bg-bg-secondary dark:bg-neutral-950">
                <tr>
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Role</th>
                  <th className="py-2 text-left">Created</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users
                  .filter(user => {
                    const term = search.trim().toLowerCase();
                    if (!term) return true;
                    return (
                      user.name.toLowerCase().includes(term) ||
                      user.email.toLowerCase().includes(term) ||
                      user.role.toLowerCase().includes(term)
                    );
                  })
                  .map(user => (
                  <tr key={user.id} className="hover:bg-bg-primary">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-900">{user.name}</div>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{user.email}</td>
                    <td className="py-2 pr-3">{roleBadge(user.role)}</td>
                    <td className="py-2 pr-3 text-neutral-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2"
                          onClick={() => startEdit(user)}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        {user.role !== "restaurant_admin" && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2 text-red-400 border-red-500/40 hover:bg-secondary/10"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {users.filter(u => {
                    const t = search.trim().toLowerCase();
                    if (!t) return true;
                    return u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || u.role.toLowerCase().includes(t);
                  }).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-xs text-neutral-500"
                    >
                      {users.length === 0 ? "No users yet. Invite your first team member." : "No users match your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 p-5 text-xs">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {form.id ? "Edit User" : "Create User"}
            </h2>
            <p className="text-[11px] text-neutral-500 mb-4">
              Invite admins and employees or register customers manually.
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                  Name
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                  {form.id ? "Password (optional, to reset)" : "Password"}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e =>
                    setForm(prev => ({ ...prev, password: e.target.value }))
                  }
                  placeholder={form.id ? "Leave blank to keep existing" : "Minimum 6 characters"}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-neutral-400"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-1" disabled={loading}>
                  <UserPlus className="w-3 h-3" />
                  {form.id ? "Save changes" : "Create user"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

