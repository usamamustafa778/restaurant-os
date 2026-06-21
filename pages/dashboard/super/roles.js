import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  getPlatformRolesForSuperAdmin,
  getPlatformRoleTemplatesForSuperAdmin,
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
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export default function SuperRolesPage() {
  const { confirm } = useConfirmDialog();
  const [roles, setRoles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [groupedPerms, setGroupedPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    baseRole: "support_agent",
    permissions: [],
  });

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesData, templateData, permGroups] = await Promise.all([
        getPlatformRolesForSuperAdmin(),
        getPlatformRoleTemplatesForSuperAdmin(),
        getPermissionsGroupedForSuperAdmin({ scope: "platform" }),
      ]);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setTemplates(templateData?.templates || []);
      setGroupedPerms(permGroups && typeof permGroups === "object" ? permGroups : {});
    } catch (err) {
      toast.error(err.message || "Failed to load roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  function applyTemplate(baseRole) {
    const tpl = templates.find((t) => t.value === baseRole);
    setForm((f) => ({
      ...f,
      baseRole,
      permissions: tpl?.permissions ? [...tpl.permissions] : f.permissions,
    }));
  }

  function openCreate() {
    const defaultBase = "support_agent";
    const tpl = templates.find((t) => t.value === defaultBase);
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      baseRole: defaultBase,
      permissions: tpl?.permissions ? [...tpl.permissions] : [],
    });
    setModalOpen(true);
  }

  function openEdit(role) {
    setEditing(role);
    setForm({
      name: role.name,
      slug: role.slug,
      description: role.description || "",
      baseRole: role.baseRole,
      permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
    });
    setModalOpen(true);
  }

  function togglePermission(key) {
    setForm((f) => {
      const set = new Set(f.permissions);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...f, permissions: [...set] };
    });
  }

  function toggleGroup(group, keys) {
    setForm((f) => {
      const set = new Set(f.permissions);
      const allOn = keys.every((k) => set.has(k));
      for (const k of keys) {
        if (allOn) set.delete(k);
        else set.add(k);
      }
      return { ...f, permissions: [...set] };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.baseRole) {
      toast.error("Select a base template to clone from");
      return;
    }
    if (!form.permissions.length) {
      toast.error("Select at least one permission");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description,
        baseRole: form.baseRole,
        permissions: form.permissions,
      };
      if (editing) {
        await updatePlatformRoleForSuperAdmin(editing.id, {
          name: payload.name,
          description: payload.description,
          baseRole: payload.baseRole,
          permissions: payload.permissions,
        });
        toast.success("Role updated");
      } else {
        await createPlatformRoleForSuperAdmin(payload);
        toast.success("Role created");
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(role) {
    const ok = await confirm({
      title: "Deactivate role?",
      message: `Deactivate "${role.name}"? Users assigned this role will keep the slug until reassigned.`,
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    try {
      await deletePlatformRoleForSuperAdmin(role.id);
      toast.success("Role deactivated");
      loadAll();
    } catch (err) {
      toast.error(err.message || "Deactivate failed");
    }
  }

  const permissionGroups = Object.keys(groupedPerms).sort();

  return (
    <AdminLayout
      title="Roles"
      subtitle="Platform roles for EatsDesk staff — not scoped to restaurants."
    >
      <Card
        title="Platform roles"
        description="Clone from a template, adjust permissions, assign to platform staff (assignment wiring comes in a later phase)."
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
          <Button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 ml-auto">
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
            emptyMessage="No platform roles yet. Create one from a template."
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
                    <button type="button" onClick={() => openEdit(r)} className="text-xs font-medium text-primary hover:underline">
                      Edit
                    </button>
                    {r.isActive !== false && (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(r)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800 shrink-0">
              <div>
                <h3 className="text-sm font-semibold">{editing ? "Edit platform role" : "New platform role"}</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">Platform-wide — no restaurant scope</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          name: e.target.value,
                          slug: editing ? f.slug : slugify(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Slug</label>
                    <input
                      required
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                      disabled={!!editing}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm disabled:opacity-60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Clone template (prefill)</label>
                  <select
                    value={form.baseRole}
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                  >
                    {templates.map((t) => (
                      <option key={t.value} value={t.value}>
                        {TEMPLATE_LABELS[t.value] || t.value}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Permissions are copied at save time — editing the template later does not change this role.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2">Permissions ({form.permissions.length})</label>
                  <div className="border border-gray-200 dark:border-neutral-800 rounded-lg divide-y divide-gray-100 dark:divide-neutral-800 max-h-64 overflow-y-auto">
                    {permissionGroups.length === 0 ? (
                      <p className="text-xs text-neutral-500 p-4">Seed platform permissions to enable the editor.</p>
                    ) : (
                      permissionGroups.map((group) => {
                        const items = groupedPerms[group] || [];
                        const keys = items.map((p) => p.key);
                        const expanded = expandedGroups[group] !== false;
                        const selected = keys.filter((k) => form.permissions.includes(k)).length;
                        return (
                          <div key={group}>
                            <div className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                              <button
                                type="button"
                                onClick={() => setExpandedGroups((prev) => ({ ...prev, [group]: !expanded }))}
                                className="flex items-center gap-2 flex-1 text-left"
                              >
                                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <span>{group}</span>
                              </button>
                              <span className="text-neutral-500 font-normal">{selected}/{keys.length}</span>
                              <button
                                type="button"
                                onClick={() => toggleGroup(group, keys)}
                                className="text-primary font-medium"
                              >
                                {selected === keys.length ? "None" : "All"}
                              </button>
                            </div>
                            {expanded && (
                              <div className="px-3 pb-2 space-y-1">
                                {items.map((p) => (
                                  <label key={p.key} className="flex items-start gap-2 text-xs cursor-pointer py-0.5">
                                    <input
                                      type="checkbox"
                                      checked={form.permissions.includes(p.key)}
                                      onChange={() => togglePermission(p.key)}
                                      className="mt-0.5 rounded border-gray-300"
                                    />
                                    <span>
                                      <span className="font-medium">{p.name}</span>
                                      <code className="block text-[10px] text-neutral-500">{p.key}</code>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-800 shrink-0">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save changes" : "Create role"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
