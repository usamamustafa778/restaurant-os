import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  createPlatformTeamMember,
  getPlatformTeamMembers,
  getStoredAuth,
  resetPlatformTeamMemberPassword,
  updatePlatformTeamMember,
} from "../../../lib/apiClient";
import { usePermissions } from "../../../contexts/PermissionContext";
import {
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";

const PLATFORM_ROLE_OPTIONS = [
  {
    value: "owner",
    label: "Owner",
    description: "Full access to all platform areas",
  },
  {
    value: "operations_manager",
    label: "Operations Manager",
    description: "Restaurants, subscriptions, invoices, WhatsApp, and leads",
  },
  {
    value: "cro",
    label: "CRO",
    description: "Subscriptions, invoices, payments, and commercial pipeline",
  },
  {
    value: "sales",
    label: "Sales",
    description: "Overview, restaurants, and leads pipeline",
  },
  {
    value: "support",
    label: "Support",
    description: "Overview, restaurants, and WhatsApp support",
  },
];

const ROLE_LABELS = Object.fromEntries(
  PLATFORM_ROLE_OPTIONS.map((o) => [o.value, o.label]),
);

function roleLabel(platformRole) {
  return ROLE_LABELS[platformRole] || platformRole || "Owner";
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

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

export default function SuperTeamPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.staff.view");
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("platform.staff.manage");

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    platformRole: "sales",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [promoteCandidate, setPromoteCandidate] = useState(null);

  const [editMember, setEditMember] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    platformRole: "sales",
    isActive: true,
  });
  const [editSaving, setEditSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    setCurrentUserId(auth?.user?.id || null);
  }, []);

  async function loadTeam() {
    try {
      setLoading(true);
      const data = await getPlatformTeamMembers();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || "Failed to load team");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasAccess) return;
    loadTeam();
  }, [hasAccess]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const name = (m.name || "").toLowerCase();
      const email = (m.email || "").toLowerCase();
      const role = roleLabel(m.platformRole).toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [members, searchQuery]);

  function openAddModal() {
    setAddForm({
      name: "",
      email: "",
      password: generateTempPassword(),
      platformRole: "sales",
    });
    setPromoteCandidate(null);
    setShowAddModal(true);
  }

  function openEditModal(member) {
    setEditMember(member);
    setEditForm({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      platformRole: member.platformRole || "owner",
      isActive: member.isActive !== false,
    });
  }

  const editingSelf =
    editMember && currentUserId && editMember.id === currentUserId;

  async function handleAdd(e, { promoteExisting = false } = {}) {
    e.preventDefault();
    if (!canManage) return;
    try {
      setAddSaving(true);
      const created = await createPlatformTeamMember({
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
        platformRole: addForm.platformRole,
        ...(promoteExisting ? { promoteExisting: true } : {}),
      });
      toast.success(
        promoteExisting ? "User converted to platform staff" : "Team member added",
      );
      setShowAddModal(false);
      setPromoteCandidate(null);
      setMembers((prev) => [created, ...prev]);
    } catch (err) {
      if (err.details?.code === "EXISTING_TENANT_USER") {
        setPromoteCandidate(err.details.existingUser || null);
        toast.error(
          "This email belongs to a restaurant user. You can convert them below.",
        );
        return;
      }
      toast.error(err.message || "Failed to add team member");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editMember || !canManage) return;
    try {
      setEditSaving(true);
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        isActive: editForm.isActive,
      };
      if (!editingSelf) {
        payload.platformRole = editForm.platformRole;
      }
      const updated = await updatePlatformTeamMember(editMember.id, payload);
      toast.success("Team member updated");
      setEditMember(null);
      setMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );
    } catch (err) {
      toast.error(err.message || "Failed to update team member");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeactivate(member) {
    if (!canManage) return;
    try {
      const updated = await updatePlatformTeamMember(member.id, {
        isActive: false,
      });
      toast.success(`${member.name || member.email} deactivated`);
      setMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );
    } catch (err) {
      toast.error(err.message || "Failed to deactivate");
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetTarget || !canManage) return;
    try {
      setResetSaving(true);
      await resetPlatformTeamMemberPassword(
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
      title="Team"
      subtitle="EatsDesk platform staff — roles and access"
    >
      <SuperPageGate permission="platform.staff.view">
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
                {filteredMembers.length} of {members.length}
              </span>
            )}
            <button
              type="button"
              onClick={loadTeam}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            {canManage && (
              <Button
                type="button"
                onClick={openAddModal}
                className="px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add team member
              </Button>
            )}
          </div>

          <DataTable
            showSno
            data={filteredMembers}
            loading={loading}
            emptyMessage="No team members found."
            columns={[
              {
                key: "member",
                header: "Member",
                render: (_, m) => (
                  <div className="flex items-center gap-3 min-w-0">
                    {m.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.profileImageUrl}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(m.name, m.email)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {m.name || "Unnamed"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-neutral-400 truncate max-w-[220px]">
                        {m.email}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "platformRole",
                header: "Platform role",
                render: (_, m) => (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    <Shield className="w-3 h-3" />
                    {roleLabel(m.platformRole)}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (_, m) => (
                  <div className="flex flex-wrap gap-1">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        m.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {m.isActive !== false ? "Active" : "Inactive"}
                    </span>
                    {!m.lastLoginAt && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        Never logged in
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "lastLoginAt",
                header: "Last login",
                render: (_, m) => formatDateTime(m.lastLoginAt),
                cellClassName:
                  "text-gray-600 dark:text-neutral-400 whitespace-nowrap text-xs",
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (_, m) =>
                  canManage ? (
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(m)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(m);
                          setResetPassword(generateTempPassword());
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                      >
                        Reset password
                      </button>
                      {m.isActive !== false && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(m)}
                          disabled={
                            currentUserId && m.id === currentUserId
                          }
                          title={
                            currentUserId && m.id === currentUserId
                              ? "You can't deactivate your own account"
                              : undefined
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  ),
              },
            ]}
          />
        </div>

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
                Add team member
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Creates a platform staff account. Share the temporary password
                securely — they can change it on their profile page.
              </p>
              <form
                onSubmit={(e) =>
                  handleAdd(e, { promoteExisting: Boolean(promoteCandidate) })
                }
                className="space-y-3"
              >
                {promoteCandidate && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="font-semibold">Restaurant account found</p>
                    <p className="mt-1 text-amber-800 dark:text-amber-300">
                      {promoteCandidate.name || promoteCandidate.email} is registered as{" "}
                      <span className="font-medium">{promoteCandidate.role}</span>
                      {promoteCandidate.restaurantName
                        ? ` at ${promoteCandidate.restaurantName}`
                        : ""}
                      . Converting will remove their restaurant access and grant platform staff
                      access instead.
                    </p>
                  </div>
                )}
                <Field label="Name" required>
                  <input
                    required
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={(e) => {
                      setAddForm((f) => ({ ...f, email: e.target.value }));
                      setPromoteCandidate(null);
                    }}
                    className={inputClass}
                    placeholder="colleague@eatsdesk.com"
                  />
                </Field>
                <Field label="Temporary password" required>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={addForm.password}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, password: e.target.value }))
                      }
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAddForm((f) => ({
                          ...f,
                          password: generateTempPassword(),
                        }))
                      }
                      className="shrink-0 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                    >
                      Generate
                    </button>
                  </div>
                </Field>
                <Field label="Platform role" required>
                  <select
                    value={addForm.platformRole}
                    onChange={(e) =>
                      setAddForm((f) => ({
                        ...f,
                        platformRole: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {PLATFORM_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {
                      PLATFORM_ROLE_OPTIONS.find(
                        (o) => o.value === addForm.platformRole,
                      )?.description
                    }
                  </p>
                </Field>
                <ModalActions
                  onCancel={() => {
                    setShowAddModal(false);
                    setPromoteCandidate(null);
                  }}
                  saving={addSaving}
                  submitLabel={
                    promoteCandidate ? "Convert to platform staff" : "Add member"
                  }
                />
              </form>
            </div>
          </div>
        )}

        {editMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
                Edit team member
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                {editMember.email}
              </p>
              <form onSubmit={handleEdit} className="space-y-3">
                <Field label="Name" required>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="Optional"
                  />
                </Field>
                <Field
                  label="Platform role"
                  hint={
                    editingSelf
                      ? "You can't change your own platform role."
                      : undefined
                  }
                >
                  <select
                    value={editForm.platformRole}
                    disabled={editingSelf}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        platformRole: e.target.value,
                      }))
                    }
                    className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {PLATFORM_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <label
                  className={`flex items-center gap-2 text-sm ${
                    editingSelf ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                  title={
                    editingSelf
                      ? "You can't deactivate your own account"
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    disabled={editingSelf}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        isActive: e.target.checked,
                      }))
                    }
                    className="rounded border-neutral-300"
                  />
                  <span className="text-neutral-700 dark:text-neutral-300">
                    Active account
                  </span>
                </label>
                <ModalActions
                  onCancel={() => setEditMember(null)}
                  saving={editSaving}
                  submitLabel="Save changes"
                />
              </form>
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
                <Field label="New password" required>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setResetPassword(generateTempPassword())}
                      className="shrink-0 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-semibold"
                    >
                      Generate
                    </button>
                  </div>
                </Field>
                <ModalActions
                  onCancel={() => {
                    setResetTarget(null);
                    setResetPassword("");
                  }}
                  saving={resetSaving}
                  submitLabel="Update password"
                />
              </form>
            </div>
          </div>
        )}
      </SuperPageGate>
    </AdminLayout>
  );
}

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent";

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">{hint}</p>
      )}
    </div>
  );
}

function ModalActions({ onCancel, saving, submitLabel }) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? (
          <span className="inline-flex items-center gap-1 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saving…
          </span>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
