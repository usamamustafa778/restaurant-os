import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import Button from "../../components/ui/Button";
import {
  createModifierGroup,
  deleteModifierGroup,
  getMenu,
  getModifierGroups,
  updateModifierGroup,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { handleAsyncAction } from "../../utils/toastActions";
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Layers,
  X,
  GripVertical,
} from "lucide-react";
import toast from "react-hot-toast";

const emptyOption = () => ({
  id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "",
  price: "0",
  menuItemRef: "",
  isActive: true,
});

const emptyForm = () => ({
  id: null,
  name: "",
  required: false,
  minSelect: "0",
  maxSelect: "0",
  displayOrder: "0",
  isActive: true,
  options: [emptyOption(), emptyOption()],
});

function formatMaxSelect(value) {
  const n = Number(value) || 0;
  return n === 0 ? "Unlimited" : String(n);
}

export default function ModifierGroupsPage() {
  const { currentBranch } = useBranch();
  const { confirm } = useConfirmDialog();

  const [groups, setGroups] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getModifierGroups();
      setGroups(list);
    } catch (err) {
      toast.error(err.message || "Failed to load modifier groups");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMenuItems = useCallback(async () => {
    try {
      const data = await getMenu(currentBranch?.id);
      setMenuItems(data?.items || []);
    } catch {
      setMenuItems([]);
    }
  }, [currentBranch?.id]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0) ||
          String(a.name).localeCompare(String(b.name)),
      ),
    [groups],
  );

  function openCreate() {
    setForm(emptyForm());
    setModalError("");
    setModalOpen(true);
  }

  function openEdit(group) {
    setForm({
      id: group.id,
      name: group.name || "",
      required: !!group.required,
      minSelect: String(group.minSelect ?? 0),
      maxSelect: String(group.maxSelect ?? 0),
      displayOrder: String(group.displayOrder ?? 0),
      isActive: group.isActive !== false,
      options: (group.options || []).map((o) => ({
        id: o.id,
        name: o.name || "",
        price: String(o.price ?? 0),
        menuItemRef: o.menuItemRef || "",
        isActive: o.isActive !== false,
      })),
    });
    setModalError("");
    setModalOpen(true);
  }

  function updateOption(index, field, value) {
    setForm((prev) => {
      const options = [...prev.options];
      options[index] = { ...options[index], [field]: value };
      if (field === "menuItemRef" && value) {
        const item = menuItems.find((m) => m.id === value);
        if (item && !options[index].name.trim()) {
          options[index].name = item.name;
        }
      }
      return { ...prev, options };
    });
  }

  function addOption() {
    setForm((prev) => ({ ...prev, options: [...prev.options, emptyOption()] }));
  }

  function removeOption(index) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Group name is required");
      return;
    }
    if (form.options.length < 1) {
      setModalError("Add at least one option");
      return;
    }
    if (form.options.some((o) => !o.name.trim() && !o.menuItemRef)) {
      setModalError("Each option needs a name or linked menu item");
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: "addon",
      required: form.required,
      minSelect: Math.max(0, Number(form.minSelect) || 0),
      maxSelect: Math.max(0, Number(form.maxSelect) || 0),
      displayOrder: Number(form.displayOrder) || 0,
      isActive: form.isActive,
      options: form.options.map((o) => ({
        name: o.name.trim() || undefined,
        price: Math.max(0, Number(o.price) || 0),
        menuItemRef: o.menuItemRef || undefined,
        isActive: o.isActive !== false,
      })),
    };

    setSaving(true);
    setModalError("");
    const result = await handleAsyncAction(
      async () => {
        if (form.id) {
          return updateModifierGroup(form.id, payload);
        }
        return createModifierGroup(payload);
      },
      {
        loading: form.id ? "Saving modifier group…" : "Creating modifier group…",
        success: form.id ? "Modifier group updated" : "Modifier group created",
        error: "Failed to save modifier group",
      },
    );
    setSaving(false);

    if (result.success) {
      setModalOpen(false);
      setForm(emptyForm());
      loadGroups();
    } else {
      setModalError(result.error || "Failed to save");
    }
  }

  async function handleDelete(group) {
    const ok = await confirm({
      title: "Delete modifier group",
      message: `Delete "${group.name}"? It will be detached from any menu items using it.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(group.id);
    const result = await handleAsyncAction(
      () => deleteModifierGroup(group.id),
      {
        loading: "Deleting…",
        success: "Modifier group deleted",
        error: "Failed to delete modifier group",
      },
    );
    setDeletingId(null);
    if (result.success) loadGroups();
  }

  return (
    <PermissionGate permission="menu.manage">
      <AdminLayout title="Modifier Groups">
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreate} className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New group
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading modifier groups…
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-10 text-center">
              <Layers className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">No modifier groups yet</p>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 mb-4">
                Create groups like &quot;Extra cheese&quot; or &quot;Choose a side&quot; and attach them to items.
              </p>
              <Button onClick={openCreate} className="inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create first group
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedGroups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{group.name}</h2>
                        {group.required ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                            Optional
                          </span>
                        )}
                        {group.isActive === false ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                        Pick {group.minSelect || 0}–{formatMaxSelect(group.maxSelect)} · {(group.options || []).length} option{(group.options || []).length === 1 ? "" : "s"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(group.options || []).map((opt) => (
                          <span
                            key={opt.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 px-2.5 py-1 text-xs text-gray-700 dark:text-neutral-300"
                          >
                            {opt.name}
                            {Number(opt.price) > 0 ? (
                              <span className="text-primary font-semibold">+Rs {Number(opt.price).toLocaleString()}</span>
                            ) : (
                              <span className="text-gray-400">Free</span>
                            )}
                            {opt.menuItemRef ? (
                              <span className="text-[10px] text-gray-400">· linked item</span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(group)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                        aria-label="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(group)}
                        disabled={deletingId === group.id}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === group.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {modalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-neutral-800 px-5 py-4">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  {form.id ? "Edit modifier group" : "New modifier group"}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                {modalError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">
                    {modalError}
                  </div>
                ) : null}

                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-neutral-300">Group name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Extra toppings"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-medium text-gray-700 dark:text-neutral-300">Min select</label>
                    <input
                      type="number"
                      min="0"
                      value={form.minSelect}
                      onChange={(e) => setForm((p) => ({ ...p, minSelect: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium text-gray-700 dark:text-neutral-300">Max select (0 = unlimited)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.maxSelect}
                      onChange={(e) => setForm((p) => ({ ...p, maxSelect: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.required}
                      onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium text-gray-700 dark:text-neutral-300">Required group</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium text-gray-700 dark:text-neutral-300">Active</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-gray-700 dark:text-neutral-300">Options</label>
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-primary font-semibold hover:underline"
                    >
                      + Add option
                    </button>
                  </div>

                  {form.options.map((opt, index) => (
                    <div
                      key={opt.id}
                      className="rounded-xl border border-gray-200 dark:border-neutral-700 p-3 space-y-2 bg-gray-50/50 dark:bg-neutral-900/40"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Option {index + 1}</span>
                        {form.options.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="ml-auto text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) => updateOption(index, "name", e.target.value)}
                        placeholder="Option name"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={opt.price}
                          onChange={(e) => updateOption(index, "price", e.target.value)}
                          placeholder="Price"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        />
                        <select
                          value={opt.menuItemRef}
                          onChange={(e) => updateOption(index, "menuItemRef", e.target.value)}
                          className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        >
                          <option value="">Link menu item (optional)</option>
                          {menuItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        Saving…
                      </>
                    ) : form.id ? (
                      "Save changes"
                    ) : (
                      "Create group"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </AdminLayout>
    </PermissionGate>
  );
}
