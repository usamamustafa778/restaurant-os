import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  getUsersForSuperAdmin,
  createUserForSuperAdmin,
  deleteUserForSuperAdmin,
} from "../../../lib/apiClient";
import { Search, FileDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";

const ROLE_LABELS = {
  super_admin: "Super admin",
  restaurant_admin: "Restaurant admin",
  staff: "Staff (legacy)",
  admin: "Admin",
  product_manager: "Product manager",
  cashier: "Cashier",
  manager: "Manager",
  kitchen_staff: "Kitchen staff",
  order_taker: "Order taker",
};

const ROLE_OPTIONS = Object.keys(ROLE_LABELS);

export default function SuperUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "super_admin",
  });
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { confirm } = useConfirmDialog();

  function escapeCsvCell(value) {
    if (value == null || value === "") return "";
    const s = String(value);
    if (
      s.includes(",") ||
      s.includes('"') ||
      s.includes("\n") ||
      s.includes("\r")
    )
      return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadUsersExcel(rows) {
    const headers = ["S.No", "Name", "Email", "Role", "Created"];
    const csvRows = [
      headers.join(","),
      ...rows.map((u, i) =>
        [
          i + 1,
          escapeCsvCell(u.name),
          escapeCsvCell(u.email),
          escapeCsvCell(ROLE_LABELS[u.role] || u.role),
          u.createdAt
            ? new Date(u.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "",
        ].join(","),
      ),
    ];
    const csv = csvRows.join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const filteredUsers = searchQuery.trim()
    ? users.filter((u) => {
        const q = searchQuery.trim().toLowerCase();
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const role = (ROLE_LABELS[u.role] || u.role || "").toLowerCase();
        return name.includes(q) || email.includes(q) || role.includes(q);
      })
    : users;

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await getUsersForSuperAdmin();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setForm({
      name: "",
      email: "",
      password: "",
      role: "super_admin",
    });
    setError("");
    setShowCreateForm(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Name, email and password are required.");
      return;
    }
    try {
      setCreating(true);
      const created = await createUserForSuperAdmin({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success("User created");
      setShowCreateForm(false);
      setUsers((prev) => [created, ...prev]);
    } catch (err) {
      setError(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AdminLayout title="Users">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name, email or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          {searchQuery && (
            <span className="text-xs text-neutral-500">
              {filteredUsers.length} of {users.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (filteredUsers.length === 0) {
                toast.error("No data to export");
                return;
              }
              downloadUsersExcel(filteredUsers);
              toast.success(
                `Exported ${filteredUsers.length} user(s) to Excel`,
              );
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
            title="Download table as Excel (CSV)"
          >
            <FileDown className="w-4 h-4" />
            Download Excel
          </button>
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="px-3 py-1.5 text-xs font-semibold"
          >
            + Create user
          </Button>
        </div>

        <DataTable
          showSno
          data={filteredUsers}
          loading={loading}
          emptyMessage="No users found."
          columns={[
            {
              key: "name",
              header: "Name",
              render: (_, u) => (
                <div className="font-medium text-gray-900 dark:text-white">
                  {u.name || "Unnamed user"}
                </div>
              ),
            },
            {
              key: "email",
              header: "Email",
              render: (_, u) => u.email || "—",
              cellClassName:
                "text-gray-700 dark:text-neutral-300 truncate max-w-[220px]",
            },
            {
              key: "role",
              header: "Role",
              render: (_, u) => ROLE_LABELS[u.role] || u.role,
              cellClassName:
                "text-gray-700 dark:text-neutral-300 whitespace-nowrap",
            },
            {
              key: "created",
              header: "Created",
              render: (_, u) =>
                u.createdAt
                  ? new Date(u.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—",
              cellClassName: "text-neutral-400 whitespace-nowrap",
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (_, u) => (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/40"
                  onClick={async () => {
                    const name = u.name || u.email || "this user";
                    const ok = await confirm({
                      title: "Delete user",
                      message: `This will permanently delete ${name}. They will lose access to all dashboards.`,
                      confirmLabel: "Delete user",
                    });
                    if (!ok) return;
                    const toastId = toast.loading(`Deleting ${name}...`);
                    try {
                      await deleteUserForSuperAdmin(u.id);
                      setUsers((prev) => prev.filter((x) => x.id !== u.id));
                      toast.success("User deleted.", { id: toastId });
                    } catch (err) {
                      toast.error(err.message || "Failed to delete user", {
                        id: toastId,
                      });
                    }
                  }}
                >
                  Delete
                </button>
              ),
            },
          ]}
        />
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
              Create user
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              Create a new platform user. Use the{" "}
              <span className="font-semibold">Super admin</span> role to add
              more platform owners.
            </p>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                {error}
              </p>
            )}
            <form
              onSubmit={handleCreate}
              className="space-y-3"
              autoComplete="off"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Name
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                  placeholder="Set initial password"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (creating) return;
                    setShowCreateForm(false);
                  }}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating…
                    </span>
                  ) : (
                    "Create user"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
