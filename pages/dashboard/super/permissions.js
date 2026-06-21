import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  getPermissionsForSuperAdmin,
  createPermissionForSuperAdmin,
  updatePermissionForSuperAdmin,
  deletePermissionForSuperAdmin,
} from "../../../lib/apiClient";
import { Loader2, Plus, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";

const SCOPE_TABS = [
  { id: "", label: "All" },
  { id: "tenant", label: "Tenant" },
  { id: "platform", label: "Platform" },
];

const GROUP_OPTIONS = [
  "Orders",
  "Accounts",
  "Inventory",
  "Staff",
  "Menu",
  "Reports",
  "Customers",
  "Settings",
  "Session",
  "Tables",
  "Reservations",
  "WhatsApp",
  "Branches",
  "Subscription",
  "Integrations",
  "Rider",
  "Platform Overview",
  "Restaurants",
  "Subscriptions",
  "Billing",
  "Leads",
  "Platform Users",
  "Platform RBAC",
  "Platform Settings",
];

const EMPTY_FORM = {
  key: "",
  name: "",
  description: "",
  group: "Orders",
  scope: "tenant",
};

export default function SuperPermissionsPage() {
  const { confirm } = useConfirmDialog();
  const [scopeFilter, setScopeFilter] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPermissionsForSuperAdmin({
        scope: scopeFilter || undefined,
      });
      setPermissions(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || "Failed to load permissions");
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) =>
        (p.key || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.group || "").toLowerCase().includes(q),
    );
  }, [permissions, searchQuery]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      scope: scopeFilter === "platform" ? "platform" : scopeFilter === "tenant" ? "tenant" : "tenant",
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      key: row.key,
      name: row.name,
      description: row.description || "",
      group: row.group,
      scope: row.scope,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updatePermissionForSuperAdmin(editing.id, {
          name: form.name,
          description: form.description,
          group: form.group,
          scope: form.scope,
        });
        toast.success("Permission updated");
      } else {
        await createPermissionForSuperAdmin(form);
        toast.success("Permission created");
      }
      setModalOpen(false);
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(row) {
    const ok = await confirm({
      title: "Deactivate permission?",
      message: `Deactivate "${row.key}"? Roles keeping this key will stop matching it at enforcement.`,
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    try {
      await deletePermissionForSuperAdmin(row.id);
      toast.success("Permission deactivated");
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Deactivate failed");
    }
  }

  return (
    <AdminLayout
      title="Permissions"
      subtitle="Global permission catalog — tenant and platform keys. Rarely edited."
    >
      <Card
        title="Permission catalog"
        description="Tenants consume this catalog via role editors; only platform staff maintain it here."
        headerActions={
          <Button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add permission
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 p-0.5 bg-white dark:bg-neutral-900">
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab.id || "all"}
                type="button"
                onClick={() => setScopeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  scopeFilter === tab.id
                    ? "bg-primary text-white"
                    : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search key, name, group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>
          <span className="text-xs text-neutral-500">{filtered.length} permission(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-neutral-500 py-8 text-center">
            No permissions found. Run the seed script when the database is reachable.
          </p>
        ) : (
          <DataTable
            columns={[
              { key: "key", header: "Key", render: (_, r) => <code className="text-xs">{r.key}</code> },
              { key: "name", header: "Name" },
              { key: "group", header: "Group" },
              {
                key: "scope",
                header: "Scope",
                render: (_, r) => (
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      r.scope === "platform"
                        ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
                        : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                    }`}
                  >
                    {r.scope}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                render: (_, r) => (
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeactivate(r)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Deactivate
                    </button>
                  </div>
                ),
              },
            ]}
            data={filtered}
          />
        )}
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold">{editing ? "Edit permission" : "New permission"}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium mb-1">Key</label>
                  <input
                    required
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    placeholder="orders.view"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Group</label>
                  <select
                    value={form.group}
                    onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                  >
                    {GROUP_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Scope</label>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                    disabled={!!editing}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm disabled:opacity-60"
                  >
                    <option value="tenant">tenant</option>
                    <option value="platform">platform</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
