import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  getCustomRoles,
  getCustomRole,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  getRoleUsers,
  getPermissionsGrouped,
  getRestaurantsForSuperAdmin,
  getStoredAuth,
} from "../../../lib/apiClient";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Users,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";

const BASE_ROLES = [
  { value: "cashier", label: "Cashier" },
  { value: "waiter", label: "Waiter" },
  { value: "rider", label: "Rider" },
  { value: "kitchen_staff", label: "Kitchen Staff" },
  { value: "manager", label: "Manager" },
  { value: "none", label: "None (start from scratch)" },
];

function baseRoleLabel(v) {
  return BASE_ROLES.find((r) => r.value === v)?.label || v;
}

function slugFromName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export default function SuperRolesPage() {
  const { confirm } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantFilter, setRestaurantFilter] = useState("");
  const [groupedPermissions, setGroupedPermissions] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openPermGroups, setOpenPermGroups] = useState(() => new Set());

  const [roleName, setRoleName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("global");
  const [restaurantId, setRestaurantId] = useState("");
  const [baseRole, setBaseRole] = useState("cashier");
  const [selectedPermissions, setSelectedPermissions] = useState(() => new Set());
  const [isActive, setIsActive] = useState(true);

  const [usersDrawer, setUsersDrawer] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (restaurantFilter) params.restaurant = restaurantFilter;
      const data = await getCustomRoles(params);
      setRoles(data.roles || []);
    } catch (e) {
      toast.error(e.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, [restaurantFilter]);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.user?.role !== "super_admin") {
      if (typeof window !== "undefined") window.location.href = "/overview";
      return;
    }
    (async () => {
      try {
        const [perms, rests] = await Promise.all([
          getPermissionsGrouped(),
          getRestaurantsForSuperAdmin(),
        ]);
        setGroupedPermissions(perms.grouped || {});
        setRestaurants(Array.isArray(rests) ? rests : rests?.restaurants || []);
      } catch (e) {
        toast.error(e.message || "Failed to load data");
      }
    })();
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(slugFromName(roleName));
    }
  }, [roleName, slugManuallyEdited]);

  const permGroupEntries = useMemo(
    () => Object.entries(groupedPermissions).sort(([a], [b]) => a.localeCompare(b)),
    [groupedPermissions]
  );

  function resetForm() {
    setRoleName("");
    setSlug("");
    setSlugManuallyEdited(false);
    setDescription("");
    setScope("global");
    setRestaurantId("");
    setBaseRole("cashier");
    setSelectedPermissions(new Set());
    setIsActive(true);
    setEditingId(null);
    setOpenPermGroups(new Set(Object.keys(groupedPermissions)));
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  async function openEdit(role) {
    try {
      const full = await getCustomRole(role._id);
      setEditingId(full._id);
      setRoleName(full.name);
      setSlug(full.slug);
      setSlugManuallyEdited(true);
      setDescription(full.description || "");
      setScope(full.restaurant ? "tenant" : "global");
      setRestaurantId(full.restaurant || "");
      setBaseRole(full.baseRole || "cashier");
      setSelectedPermissions(new Set(full.permissions || []));
      setIsActive(full.isActive !== false);
      setOpenPermGroups(new Set(Object.keys(groupedPermissions)));
      setModalOpen(true);
    } catch (e) {
      toast.error(e.message || "Failed to load role");
    }
  }

  function togglePermission(key) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllInGroup(groupName, items) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      for (const p of items) next.add(p.key);
      return next;
    });
  }

  function clearGroup(groupName, items) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      for (const p of items) next.delete(p.key);
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (scope === "tenant" && !restaurantId) {
      toast.error("Select a restaurant");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: roleName.trim(),
        description,
        baseRole,
        permissions: [...selectedPermissions],
        ...(editingId ? { isActive } : {}),
      };
      if (!editingId) {
        body.slug = slug;
        body.restaurant = scope === "tenant" ? restaurantId : null;
      }
      if (editingId) {
        await updateCustomRole(editingId, body);
        toast.success("Role updated");
      } else {
        await createCustomRole(body);
        toast.success("Role created");
      }
      setModalOpen(false);
      resetForm();
      await loadRoles();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role) {
    const ok = await confirm({
      title: "Delete role?",
      message: `Remove "${role.name}"? This only works if no users have this role.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCustomRole(role._id);
      toast.success("Role deleted");
      await loadRoles();
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  }

  async function openUsers(role) {
    setUsersDrawer(role);
    setUsersLoading(true);
    try {
      const data = await getRoleUsers(role._id);
      setRoleUsers(data.users || []);
    } catch (e) {
      toast.error(e.message || "Failed to load users");
      setRoleUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  return (
    <AdminLayout title="Custom Roles">
      <div className="px-4 py-6 md:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-6 w-6 text-orange-500" />
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Custom Roles</h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-neutral-400">Create roles for tenants</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            >
              <option value="">All restaurants</option>
              {restaurants.map((r) => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {r.website?.name || r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : roles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-neutral-700">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-semibold text-gray-700 dark:text-neutral-300">No custom roles yet</p>
            <p className="mt-1 text-sm text-gray-500">Create your first role to assign to tenant staff.</p>
            <button type="button" onClick={openCreate} className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">
              Create Role
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-neutral-800">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Role Name</th>
                  <th className="px-4 py-3">Base Role</th>
                  <th className="px-4 py-3">Permissions</th>
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {roles.map((role) => (
                  <tr key={role._id} className="bg-white dark:bg-neutral-950/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{role.name}</p>
                      <p className="font-mono text-xs text-gray-400">{role.slug}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{baseRoleLabel(role.baseRole)}</td>
                    <td className="px-4 py-3">{role.permissionCount ?? role.permissions?.length ?? 0} permissions</td>
                    <td className="px-4 py-3">{role.restaurantName || "All restaurants"}</td>
                    <td className="px-4 py-3">{role.userCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${role.isActive !== false ? "text-emerald-600" : "text-gray-400"}`}>
                        <span className={`h-2 w-2 rounded-full ${role.isActive !== false ? "bg-emerald-500" : "bg-gray-300"}`} />
                        {role.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEdit(role)} className="rounded-lg px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30">
                          Edit
                        </button>
                        <button type="button" onClick={() => openUsers(role)} className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                          Users
                        </button>
                        <button type="button" onClick={() => handleDelete(role)} className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSave} className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? "Edit Custom Role" : "Create Custom Role"}
              </h3>
              <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-neutral-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Role Name</span>
                <input required value={roleName} onChange={(e) => setRoleName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white" />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">
                  Slug {editingId && <span className="font-normal text-gray-400">(locked after save)</span>}
                </span>
                <input
                  required
                  value={slug}
                  disabled={!!editingId}
                  onChange={(e) => { setSlugManuallyEdited(true); setSlug(e.target.value.toLowerCase()); }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white" />
              </label>

              {!editingId && (
                <div>
                  <span className="mb-2 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Available to</span>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="scope" checked={scope === "global"} onChange={() => setScope("global")} />
                      All restaurants (global)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="scope" checked={scope === "tenant"} onChange={() => setScope("tenant")} />
                      Specific restaurant
                    </label>
                    {scope === "tenant" && (
                      <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className="ml-6 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                        <option value="">Select restaurant…</option>
                        {restaurants.map((r) => (
                          <option key={r._id || r.id} value={r._id || r.id}>{r.website?.name || r.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Base Role</span>
                <select value={baseRole} onChange={(e) => setBaseRole(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                  {BASE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Inherits all {baseRoleLabel(baseRole).toLowerCase()} access plus permissions selected below.</p>
              </label>

              {editingId && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Active
                </label>
              )}

              <div className="border-t border-gray-200 pt-4 dark:border-neutral-800">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-neutral-300">Extra Permissions</h4>
                  <span className="text-xs text-gray-500">{selectedPermissions.size} selected</span>
                </div>
                <div className="space-y-2">
                  {permGroupEntries.map(([group, items]) => {
                    const open = openPermGroups.has(group);
                    const selectedInGroup = items.filter((p) => selectedPermissions.has(p.key)).length;
                    return (
                      <div key={group} className="rounded-xl border border-gray-200 dark:border-neutral-800">
                        <div className="flex items-center justify-between px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenPermGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(group)) next.delete(group);
                                else next.add(group);
                                return next;
                              })
                            }
                            className="flex flex-1 items-center gap-2 text-left text-sm font-semibold"
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {group} ({selectedInGroup}/{items.length} selected)
                          </button>
                          <div className="flex gap-2 text-[10px] font-bold uppercase">
                            <button type="button" onClick={() => selectAllInGroup(group, items)} className="text-orange-600">All</button>
                            <button type="button" onClick={() => clearGroup(group, items)} className="text-gray-400">Clear</button>
                          </div>
                        </div>
                        {open && (
                          <div className="space-y-2 border-t border-gray-100 px-3 py-2 dark:border-neutral-800">
                            {items.map((p) => (
                              <label key={p.key} className="flex cursor-pointer gap-2.5">
                                <input type="checkbox" checked={selectedPermissions.has(p.key)} onChange={() => togglePermission(p.key)} className="mt-0.5" />
                                <span>
                                  <span className="block text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                                  <span className="block text-xs text-gray-500">{p.description}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-200 px-6 py-4 dark:border-neutral-800">
              <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold dark:border-neutral-700 dark:text-white">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? "Saving..." : "Save Role"}
              </button>
            </div>
          </form>
        </div>
      )}

      {usersDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/45" onClick={() => setUsersDrawer(null)} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-neutral-950">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Users with role</h3>
                <p className="text-sm text-gray-500">{usersDrawer.name}</p>
              </div>
              <button type="button" onClick={() => setUsersDrawer(null)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-neutral-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {usersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
              ) : roleUsers.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No users assigned this role.</p>
              ) : (
                <div className="space-y-3">
                  {roleUsers.map((u) => (
                    <div key={u._id} className="rounded-xl border border-gray-200 p-3 dark:border-neutral-800">
                      <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      <p className="mt-1 text-xs text-gray-500">Restaurant: {u.restaurant || "—"}</p>
                      <p className="text-xs text-gray-500">Branch: {(u.branches || []).join(", ") || "—"}</p>
                      <p className="text-xs text-gray-400">Last login: {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
