import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import DataTable from "../../../components/ui/DataTable";
import {
  getUsersForSuperAdmin,
  patchTenantUserForSuperAdmin,
  resetTenantUserPasswordForSuperAdmin,
  verifyTenantUserEmailForSuperAdmin,
} from "../../../lib/apiClient";
import { usePermissions } from "../../../contexts/PermissionContext";
import {
  Eye,
  FileDown,
  Loader2,
  MailCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

const ROLE_LABELS = {
  restaurant_admin: "Restaurant owner",
  staff: "Staff (legacy)",
  admin: "Admin",
  product_manager: "Product manager",
  cashier: "Cashier",
  manager: "Manager",
  kitchen_staff: "Kitchen staff",
  order_taker: "Order taker",
  delivery_rider: "Delivery rider",
};

function generateTempPassword() {
  const chars =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  let pwd = "";
  for (let i = 0; i < 12; i += 1) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function SuperUsersPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.restaurants.view");
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("platform.restaurants.edit");

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionId, setActionId] = useState(null);

  const [viewUser, setViewUser] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await getUsersForSuperAdmin();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasAccess) return;
    loadUsers();
  }, [hasAccess]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const role = (ROLE_LABELS[u.role] || u.role || "").toLowerCase();
      const restaurant = (u.restaurantName || u.restaurantSubdomain || "")
        .toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        restaurant.includes(q)
      );
    });
  }, [users, searchQuery]);

  function escapeCsvCell(value) {
    if (value == null || value === "") return "";
    const s = String(value);
    if (
      s.includes(",") ||
      s.includes('"') ||
      s.includes("\n") ||
      s.includes("\r")
    ) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function downloadUsersExcel(rows) {
    const headers = [
      "S.No",
      "Name",
      "Email",
      "Role",
      "Restaurant",
      "Status",
      "Email verified",
      "Last login",
    ];
    const csvRows = [
      headers.join(","),
      ...rows.map((u, i) =>
        [
          i + 1,
          escapeCsvCell(u.name),
          escapeCsvCell(u.email),
          escapeCsvCell(ROLE_LABELS[u.role] || u.role),
          escapeCsvCell(u.restaurantName || u.restaurantSubdomain || ""),
          u.isActive !== false ? "Active" : "Inactive",
          u.emailVerified ? "Yes" : "No",
          u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "",
        ].join(","),
      ),
    ];
    const csv = csvRows.join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tenant-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function toggleActive(user) {
    if (!canEdit) return;
    const next = user.isActive === false;
    setActionId(user.id);
    try {
      await patchTenantUserForSuperAdmin(user.id, { isActive: next });
      toast.success(next ? "User activated" : "User deactivated");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: next } : u)),
      );
      if (viewUser?.id === user.id) {
        setViewUser((v) => ({ ...v, isActive: next }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionId(null);
    }
  }

  async function handleVerifyEmail(user) {
    if (!canEdit) return;
    setActionId(user.id);
    try {
      await verifyTenantUserEmailForSuperAdmin(user.id);
      toast.success("Email verified");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, emailVerified: true } : u,
        ),
      );
      if (viewUser?.id === user.id) {
        setViewUser((v) => ({ ...v, emailVerified: true }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to verify email");
    } finally {
      setActionId(null);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetTarget || !canEdit) return;
    try {
      setResetSaving(true);
      await resetTenantUserPasswordForSuperAdmin(
        resetTarget.id,
        resetPassword,
      );
      toast.success("Password updated");
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setResetSaving(false);
    }
  }

  return (
    <AdminLayout
      title="Tenant Users"
      subtitle="Lookup and support actions for restaurant staff"
    >
      <SuperPageGate permission="platform.restaurants.view">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
              <input
                type="text"
                placeholder="Search by name, email, role or restaurant..."
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
              onClick={loadUsers}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                if (filteredUsers.length === 0) {
                  toast.error("No data to export");
                  return;
                }
                downloadUsersExcel(filteredUsers);
                toast.success(`Exported ${filteredUsers.length} user(s)`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Download Excel
            </button>
          </div>

          <DataTable
            showSno
            data={filteredUsers}
            loading={loading}
            emptyMessage="No tenant users found."
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
                  "text-gray-700 dark:text-neutral-300 truncate max-w-[200px]",
              },
              {
                key: "role",
                header: "Role",
                render: (_, u) => ROLE_LABELS[u.role] || u.role,
                cellClassName:
                  "text-gray-700 dark:text-neutral-300 whitespace-nowrap text-xs",
              },
              {
                key: "restaurant",
                header: "Restaurant",
                render: (_, u) =>
                  u.restaurantName ||
                  u.restaurantSubdomain ||
                  "—",
                cellClassName:
                  "text-gray-600 dark:text-neutral-400 truncate max-w-[160px] text-xs",
              },
              {
                key: "status",
                header: "Status",
                render: (_, u) => (
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      u.isActive !== false
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {u.isActive !== false ? "Active" : "Inactive"}
                  </span>
                ),
              },
              {
                key: "lastLoginAt",
                header: "Last login",
                render: (_, u) => formatDateTime(u.lastLoginAt),
                cellClassName:
                  "text-gray-500 dark:text-neutral-400 whitespace-nowrap text-xs",
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (_, u) => (
                  <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewUser(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          disabled={actionId === u.id}
                          onClick={() => {
                            setResetTarget(u);
                            setResetPassword(generateTempPassword());
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                        >
                          Reset password
                        </button>
                        {!u.emailVerified && (
                          <button
                            type="button"
                            disabled={actionId === u.id}
                            onClick={() => handleVerifyEmail(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
                          >
                            <MailCheck className="w-3 h-3" />
                            Verify email
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={actionId === u.id}
                          onClick={() => toggleActive(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold disabled:opacity-50 ${
                            u.isActive !== false
                              ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                              : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {u.isActive !== false ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>

        {viewUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-3">
                User details
              </h2>
              <dl className="space-y-2 text-sm">
                <DetailRow label="Name" value={viewUser.name || "—"} />
                <DetailRow label="Email" value={viewUser.email || "—"} />
                <DetailRow label="Phone" value={viewUser.phone || "—"} />
                <DetailRow
                  label="Role"
                  value={ROLE_LABELS[viewUser.role] || viewUser.role}
                />
                <DetailRow
                  label="Restaurant"
                  value={
                    viewUser.restaurantName ||
                    viewUser.restaurantSubdomain ||
                    "—"
                  }
                />
                <DetailRow
                  label="Status"
                  value={viewUser.isActive !== false ? "Active" : "Inactive"}
                />
                <DetailRow
                  label="Email verified"
                  value={viewUser.emailVerified ? "Yes" : "No"}
                />
                <DetailRow
                  label="Last login"
                  value={formatDateTime(viewUser.lastLoginAt)}
                />
                <DetailRow
                  label="Created"
                  value={formatDateTime(viewUser.createdAt)}
                />
              </dl>
              <button
                type="button"
                onClick={() => setViewUser(null)}
                className="mt-4 w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {resetTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
                Reset password
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Set a new password for {resetTarget.name || resetTarget.email}
              </p>
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setResetPassword(generateTempPassword())}
                    className="shrink-0 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold"
                  >
                    Generate
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setResetTarget(null);
                      setResetPassword("");
                    }}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetSaving}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {resetSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      "Update password"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </SuperPageGate>
    </AdminLayout>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="text-neutral-900 dark:text-neutral-100 text-right font-medium">
        {value}
      </dd>
    </div>
  );
}
