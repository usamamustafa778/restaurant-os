import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  getPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  getStoredAuth,
} from "../../../lib/apiClient";
import { ChevronDown, ChevronRight, Loader2, MoreVertical, Plus, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";

const GROUPS = [
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
];

export default function SuperPermissionsPage() {
  const { confirm } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [openGroups, setOpenGroups] = useState(() => new Set(GROUPS));
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    key: "",
    name: "",
    description: "",
    group: "Orders",
    isAssignable: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPermissions();
      setPermissions(data.permissions || []);
    } catch (e) {
      toast.error(e.message || "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.user?.role !== "super_admin") {
      if (typeof window !== "undefined") window.location.href = "/overview";
      return;
    }
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const g of GROUPS) map.set(g, []);
    for (const p of permissions) {
      const g = p.group || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    }
    return map;
  }, [permissions]);

  function openCreate() {
    setEditing(null);
    setForm({ key: "", name: "", description: "", group: "Orders", isAssignable: true });
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      key: p.key,
      name: p.name,
      description: p.description || "",
      group: p.group,
      isAssignable: p.isAssignable !== false,
    });
    setModalOpen(true);
    setMenuOpenId(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updatePermission(editing._id, {
          name: form.name,
          description: form.description,
          group: form.group,
          isAssignable: form.isAssignable,
        });
        toast.success("Permission updated");
      } else {
        const keyPrefix = form.group.toLowerCase().replace(/\s+/g, "_");
        const suffix = form.key.replace(/^[^.]+\./, "").replace(/^[^.]+/, form.key);
        const fullKey = form.key.includes(".") ? form.key : `${keyPrefix}.${suffix || form.key}`;
        await createPermission({
          key: fullKey,
          name: form.name,
          description: form.description,
          group: form.group,
          isAssignable: form.isAssignable,
        });
        toast.success("Permission created");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    try {
      await updatePermission(p._id, { isActive: !p.isActive });
      await load();
    } catch (err) {
      toast.error(err.message || "Update failed");
    }
    setMenuOpenId(null);
  }

  async function handleDelete(p) {
    setMenuOpenId(null);
    const ok = await confirm({
      title: "Delete permission?",
      message: `Remove "${p.name}" (${p.key})? This only works if no roles use it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePermission(p._id);
      toast.success("Permission deleted");
      await load();
    } catch (err) {
      toast.error(err.message || "Delete failed");
    }
  }

  return (
    <AdminLayout title="Permissions">
      <div className="px-4 py-6 md:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-orange-500" />
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Permissions</h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-neutral-400">Manage atomic permission units</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Add Permission
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {[...grouped.entries()].map(([group, items]) => {
              if (!items.length) return null;
              const open = openGroups.has(group);
              return (
                <div
                  key={group}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/80"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group)) next.delete(group);
                        else next.add(group);
                        return next;
                      })
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-bold text-gray-900 dark:text-white"
                  >
                    <span>
                      {group} ({items.length})
                    </span>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {open && (
                    <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-neutral-800 dark:border-neutral-800">
                      {items.map((p) => (
                        <div key={p._id} className="relative flex gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs text-gray-400">{p.key}</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                            <p className="text-xs text-gray-500 dark:text-neutral-500">{p.description}</p>
                            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                              {p.group}
                            </span>
                            {!p.isActive && (
                              <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setMenuOpenId(menuOpenId === p._id ? null : p._id)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuOpenId === p._id && (
                              <div className="absolute right-0 z-10 mt-1 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                                <button type="button" onClick={() => openEdit(p)} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                                  Edit
                                </button>
                                <button type="button" onClick={() => toggleActive(p)} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                                  {p.isActive ? "Deactivate" : "Activate"}
                                </button>
                                <button type="button" onClick={() => handleDelete(p)} className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSave} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
            <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
              {editing ? "Edit Permission" : "Add Permission"}
            </h3>
            {!editing && (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Permission Key</span>
                <input
                  required
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toLowerCase() }))}
                  placeholder="orders.delete_items"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </label>
            )}
            {editing && (
              <p className="mb-3 font-mono text-sm text-gray-500">{form.key}</p>
            )}
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Permission Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Group</span>
              <select
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                disabled={!!editing}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </label>
            <label className="mb-5 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isAssignable}
                onChange={(e) => setForm((f) => ({ ...f, isAssignable: e.target.checked }))}
              />
              Is assignable to custom roles
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold dark:border-neutral-700 dark:text-white">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
