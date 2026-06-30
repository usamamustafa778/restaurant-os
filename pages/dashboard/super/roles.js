import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  getPlatformRolesForSuperAdmin,
  getPlatformRoleForSuperAdmin,
  getPermissionsGroupedForSuperAdmin,
  createPlatformRoleForSuperAdmin,
  updatePlatformRoleForSuperAdmin,
  deletePlatformRoleForSuperAdmin,
} from "../../../lib/apiClient";
import { ChevronDown, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";

const TEMPLATE_LABELS = {
  platform_admin: "Platform admin",
  account_manager: "Account manager",
  billing_staff: "Billing staff",
  support_agent: "Support agent",
  read_only: "Read only",
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export default function SuperRolesPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.roles.manage");
  const { confirm } = useConfirmDialog();
  const [roles, setRoles] = useState([]);
  const [groupedPerms, setGroupedPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  const [drawerRole, setDrawerRole] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permSearch, setPermSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [drawerSaving, setDrawerSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesData, permGroups] = await Promise.all([
        getPlatformRolesForSuperAdmin(),
        getPermissionsGroupedForSuperAdmin({ scope: "platform" }),
      ]);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      const platformOnly = {};
      if (permGroups && typeof permGroups === "object") {
        for (const [group, items] of Object.entries(permGroups)) {
          const filtered = (items || []).filter((p) =>
            String(p.key || "").startsWith("platform."),
          );
          if (filtered.length) platformOnly[group] = filtered;
        }
      }
      setGroupedPerms(platformOnly);
    } catch (err) {
      toast.error(err.message || "Failed to load roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    loadAll();
  }, [loadAll, hasAccess]);

  const permissionGroups = useMemo(() => Object.keys(groupedPerms).sort(), [groupedPerms]);

  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.slug || "").toLowerCase().includes(q) ||
        (r.baseRole || "").toLowerCase().includes(q),
    );
  }, [roles, searchQuery]);

  const filteredGroupedPerms = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return groupedPerms;
    const next = {};
    for (const group of permissionGroups) {
      const items = (groupedPerms[group] || []).filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.key || "").toLowerCase().includes(q),
      );
      if (items.length) next[group] = items;
    }
    return next;
  }, [groupedPerms, permissionGroups, permSearch]);

  const filteredPermissionGroups = useMemo(
    () => Object.keys(filteredGroupedPerms).sort(),
    [filteredGroupedPerms],
  );

  const allGroupsExpanded = useMemo(
    () =>
      filteredPermissionGroups.length > 0 &&
      filteredPermissionGroups.every((g) => expandedGroups[g] === true),
    [filteredPermissionGroups, expandedGroups],
  );

  const filteredPermissionKeys = useMemo(() => {
    const keys = [];
    for (const group of filteredPermissionGroups) {
      for (const p of filteredGroupedPerms[group] || []) {
        keys.push(p.key);
      }
    }
    return keys;
  }, [filteredPermissionGroups, filteredGroupedPerms]);

  const allFilteredSelected = useMemo(
    () =>
      filteredPermissionKeys.length > 0 &&
      filteredPermissionKeys.every((k) => selectedPermissions.includes(k)),
    [filteredPermissionKeys, selectedPermissions],
  );

  function openCreateModal() {
    setCreateName("");
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setCreateName("");
  }

  async function openPermissionsDrawer(role, initialPermissions = undefined, { skipFetch = false } = {}) {
    setDrawerRole(role);
    setPermSearch("");
    setExpandedGroups({});
    setSelectedPermissions(
      initialPermissions !== undefined
        ? [...initialPermissions]
        : Array.isArray(role.permissions)
          ? [...role.permissions]
          : [],
    );

    if (skipFetch) {
      setDrawerLoading(false);
      return;
    }

    try {
      setDrawerLoading(true);
      const fresh = await getPlatformRoleForSuperAdmin(role.id);
      setDrawerRole(fresh);
      setSelectedPermissions(Array.isArray(fresh.permissions) ? [...fresh.permissions] : []);
    } catch (err) {
      toast.error(err.message || "Failed to load role permissions");
    } finally {
      setDrawerLoading(false);
    }
  }

  function closePermissionsDrawer() {
    setDrawerRole(null);
    setSelectedPermissions([]);
    setPermSearch("");
    setExpandedGroups({});
  }

  async function handleCreateRole(e) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) {
      toast.error("Enter a role name");
      return;
    }
    const slug = slugify(name);
    if (!slug) {
      toast.error("Role name must contain at least one letter or number");
      return;
    }

    setCreating(true);
    try {
      const created = await createPlatformRoleForSuperAdmin({
        name,
        slug,
        baseRole: "platform_admin",
        permissions: [],
      });
      const roleForList = { ...created, permissions: [] };
      setRoles((prev) => [...prev, roleForList]);
      closeCreateModal();
      toast.success("Role created");
      await openPermissionsDrawer(roleForList, [], { skipFetch: true });
    } catch (err) {
      toast.error(err.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function togglePermission(key) {
    setSelectedPermissions((prev) => {
      const set = new Set(prev);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return [...set];
    });
  }

  function setGroupPermissions(keys, enabled) {
    setSelectedPermissions((prev) => {
      const set = new Set(prev);
      for (const k of keys) {
        if (enabled) set.add(k);
        else set.delete(k);
      }
      return [...set];
    });
  }

  function toggleExpandAll() {
    if (allGroupsExpanded) {
      setExpandedGroups({});
    } else {
      const next = {};
      for (const g of filteredPermissionGroups) next[g] = true;
      setExpandedGroups(next);
    }
  }

  async function handleSavePermissions() {
    if (!drawerRole?.id) return;
    setDrawerSaving(true);
    try {
      const updated = await updatePlatformRoleForSuperAdmin(drawerRole.id, {
        permissions: selectedPermissions,
      });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success("Permissions saved");
      closePermissionsDrawer();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setDrawerSaving(false);
    }
  }

  async function handleDelete(role) {
    const ok = await confirm({
      title: "Delete role?",
      message: `Deactivate "${role.name}"? Users assigned this role will keep the slug until reassigned.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deletePlatformRoleForSuperAdmin(role.id);
      toast.success("Role deleted");
      if (drawerRole?.id === role.id) closePermissionsDrawer();
      loadAll();
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  }

  return (
    <AdminLayout
      title="Roles"
      subtitle="Platform roles for EatsDesk staff — not scoped to restaurants."
    >
      <SuperPageGate permission="platform.roles.manage">
      <Card
        title="Platform roles"
        description="Create a role, then assign platform permissions from the permissions drawer."
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>
          <span className="text-xs text-neutral-500">{filteredRoles.length} role(s)</span>
          <Button type="button" onClick={openCreateModal} className="inline-flex items-center gap-1.5 ml-auto">
            <Plus className="w-4 h-4" />
            New role
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <DataTable
            data={filteredRoles}
            emptyMessage="No platform roles yet. Create one to get started."
            columns={[
              {
                key: "name",
                header: "Name",
                render: (_, r) => (
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{r.name}</div>
                    <code className="text-[10px] text-neutral-500">{r.slug}</code>
                  </div>
                ),
              },
              {
                key: "baseRole",
                header: "Cloned from",
                render: (_, r) => TEMPLATE_LABELS[r.baseRole] || r.baseRole,
              },
              {
                key: "permissions",
                header: "Permissions",
                render: (_, r) => `${(r.permissions || []).length} keys`,
              },
              {
                key: "status",
                header: "Status",
                render: (_, r) => (
                  <span
                    className={`text-xs font-medium ${r.isActive !== false ? "text-emerald-600" : "text-neutral-400"}`}
                  >
                    {r.isActive !== false ? "Active" : "Inactive"}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (_, r) => (
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => openPermissionsDrawer(r)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit permissions
                    </button>
                    {r.isActive !== false && (
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* Create role modal — name only */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold">New platform role</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">Platform-wide — no restaurant scope</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRole}>
              <div className="p-5">
                <label className="block text-xs font-medium mb-1">Role Name</label>
                <input
                  required
                  autoFocus
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Billing coordinator"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-800">
                <Button type="button" variant="ghost" onClick={closeCreateModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create role"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions drawer */}
      {drawerRole && (
        <>
          <button
            type="button"
            aria-label="Close permissions drawer"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closePermissionsDrawer}
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col"
            role="dialog"
            aria-labelledby="permissions-drawer-title"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-neutral-800 shrink-0">
              <div className="min-w-0">
                <h3 id="permissions-drawer-title" className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {drawerRole.name}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">Edit permissions</p>
              </div>
              <button
                type="button"
                onClick={closePermissionsDrawer}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-200 dark:border-neutral-800 shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Search permissions…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                {filteredPermissionKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setGroupPermissions(
                        filteredPermissionKeys,
                        !allFilteredSelected,
                      )
                    }
                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    {allFilteredSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                >
                  {allGroupsExpanded ? "Collapse all" : "Expand all"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-16 text-neutral-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading permissions...
                </div>
              ) : filteredPermissionGroups.length === 0 ? (
                <p className="text-xs text-neutral-500 p-5">
                  {permSearch.trim()
                    ? "No permissions match your search."
                    : "Seed platform permissions to enable the editor."}
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {filteredPermissionGroups.map((group) => {
                    const items = filteredGroupedPerms[group] || [];
                    const keys = items.map((p) => p.key);
                    const expanded = expandedGroups[group] === true;
                    const selected = keys.filter((k) => selectedPermissions.includes(k)).length;
                    const allSelected = keys.length > 0 && selected === keys.length;

                    return (
                      <div key={group}>
                        <div className="flex items-center gap-2 px-5 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGroups((prev) => ({ ...prev, [group]: !expanded }))
                            }
                            className="flex items-center gap-2 flex-1 min-w-0 text-left text-xs font-semibold hover:text-primary"
                          >
                            {expanded ? (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="truncate">{group}</span>
                          </button>
                          <span className="text-[11px] text-neutral-500 shrink-0">
                            {selected}/{keys.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => setGroupPermissions(keys, !allSelected)}
                            className="text-[11px] font-medium text-primary hover:underline shrink-0"
                          >
                            {allSelected ? "None" : "All"}
                          </button>
                        </div>
                        {expanded && (
                          <div className="px-5 pb-3 space-y-2">
                            {items.map((p) => (
                              <label
                                key={p.key}
                                className="flex items-start gap-2.5 text-xs cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(p.key)}
                                  onChange={() => togglePermission(p.key)}
                                  className="mt-0.5 rounded border-gray-300"
                                />
                                <span className="min-w-0">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {p.name}
                                  </span>
                                  <code className="block text-[10px] text-neutral-500 font-mono mt-0.5">
                                    {p.key}
                                  </code>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-500">
                {selectedPermissions.length} permission{selectedPermissions.length === 1 ? "" : "s"} selected
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={closePermissionsDrawer}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSavePermissions} disabled={drawerSaving || drawerLoading}>
                  {drawerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save permissions"}
                </Button>
              </div>
            </div>
          </aside>
        </>
      )}
      </SuperPageGate>
    </AdminLayout>
  );
}
