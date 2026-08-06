import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import Button from "../../components/ui/Button";
import AsyncCombobox from "../../components/accounting/AsyncCombobox";
import {
  createModifierGroup,
  deleteModifierGroup,
  getMenu,
  getModifierGroups,
  getInventoryIfAvailable,
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
  inventoryConsumptions: [],
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

function suggestRecipeUnit(invUnitRaw) {
  const invUnit = String(invUnitRaw || "").toLowerCase();
  if (invUnit === "gram" || invUnit === "g" || invUnit === "kg" || invUnit === "kilogram") {
    return "gram";
  }
  if (invUnit === "ml" || invUnit === "milliliter" || invUnit === "liter" || invUnit === "l") {
    return "milliliter";
  }
  return "piece";
}

function menuItemToComboboxOption(item) {
  if (!item?.id) return null;
  const price = Number(item.finalPrice ?? item.price);
  const priceLabel = Number.isFinite(price)
    ? ` · Rs ${price.toLocaleString()}`
    : "";
  return {
    id: item.id,
    name: item.name || "",
    label: `${item.name || "Item"}${priceLabel}`,
    price: Number.isFinite(price) ? price : 0,
  };
}

function inventoryToComboboxOption(item) {
  if (!item?.id) return null;
  return {
    id: item.id,
    name: item.name || "",
    label: `${item.name || "Item"}${item.unit ? ` · ${item.unit}` : ""}`,
    unit: item.unit || "piece",
  };
}

export default function ModifierGroupsPage() {
  const { currentBranch } = useBranch();
  const { confirm } = useConfirmDialog();

  const [groups, setGroups] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
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

  const loadInventory = useCallback(async () => {
    try {
      const list = await getInventoryIfAvailable();
      setInventoryItems(Array.isArray(list) ? list : []);
    } catch {
      setInventoryItems([]);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const menuItemOptions = useMemo(
    () =>
      menuItems
        .map(menuItemToComboboxOption)
        .filter(Boolean)
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [menuItems],
  );

  const inventoryOptions = useMemo(
    () =>
      inventoryItems
        .map(inventoryToComboboxOption)
        .filter(Boolean)
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [inventoryItems],
  );

  const fetchMenuItemOptions = useCallback(
    async (query) => {
      const needle = String(query || "").trim().toLowerCase();
      if (!needle) return menuItemOptions;
      return menuItemOptions.filter(
        (o) =>
          o.name.toLowerCase().includes(needle) ||
          o.label.toLowerCase().includes(needle),
      );
    },
    [menuItemOptions],
  );

  const fetchInventoryOptions = useCallback(
    async (query) => {
      const needle = String(query || "").trim().toLowerCase();
      if (!needle) return inventoryOptions;
      return inventoryOptions.filter(
        (o) =>
          o.name.toLowerCase().includes(needle) ||
          o.label.toLowerCase().includes(needle),
      );
    },
    [inventoryOptions],
  );

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
        inventoryConsumptions: (o.inventoryConsumptions || []).map((c) => ({
          inventoryItemId: c.inventoryItemId || "",
          quantity: String(c.quantity ?? 1),
          unit: c.unit || "piece",
        })),
        isActive: o.isActive !== false,
      })),
    });
    setModalError("");
    setModalOpen(true);
  }

  function updateOption(index, field, value) {
    setForm((prev) => {
      const options = [...prev.options];
      const current = { ...options[index], [field]: value };

      if (field === "menuItemRef") {
        if (value) {
          const item = menuItems.find((m) => m.id === value);
          if (item) {
            current.name = item.name || "";
            const prevPrice = Number(options[index].price);
            if (!Number.isFinite(prevPrice) || prevPrice === 0) {
              current.price = String(item.finalPrice ?? item.price ?? 0);
            }
          }
        }
      }

      options[index] = current;
      return { ...prev, options };
    });
  }

  function addOptionInventoryRow(optionIndex) {
    setForm((prev) => {
      const options = [...prev.options];
      const opt = options[optionIndex];
      options[optionIndex] = {
        ...opt,
        inventoryConsumptions: [
          ...(opt.inventoryConsumptions || []),
          { inventoryItemId: "", quantity: "1", unit: "piece" },
        ],
      };
      return { ...prev, options };
    });
  }

  function updateOptionInventory(optionIndex, rowIndex, field, value) {
    setForm((prev) => {
      const options = [...prev.options];
      const opt = options[optionIndex];
      const rows = [...(opt.inventoryConsumptions || [])];
      const row = { ...rows[rowIndex], [field]: value };
      if (field === "inventoryItemId" && value) {
        const inv = inventoryItems.find((i) => i.id === value);
        if (inv) row.unit = suggestRecipeUnit(inv.unit);
      }
      rows[rowIndex] = row;
      options[optionIndex] = { ...opt, inventoryConsumptions: rows };
      return { ...prev, options };
    });
  }

  function removeOptionInventory(optionIndex, rowIndex) {
    setForm((prev) => {
      const options = [...prev.options];
      const opt = options[optionIndex];
      options[optionIndex] = {
        ...opt,
        inventoryConsumptions: (opt.inventoryConsumptions || []).filter(
          (_, i) => i !== rowIndex,
        ),
      };
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
      options: form.options.map((o) => {
        const linked = o.menuItemRef
          ? menuItems.find((m) => m.id === o.menuItemRef)
          : null;
        return {
          name: (o.name.trim() || linked?.name || "").trim() || undefined,
          price: linked
            ? Math.max(0, Number(linked.finalPrice ?? linked.price) || 0)
            : Math.max(0, Number(o.price) || 0),
          menuItemRef: o.menuItemRef || undefined,
          inventoryConsumptions: (o.inventoryConsumptions || [])
            .filter((c) => c.inventoryItemId && Number(c.quantity) > 0)
            .map((c) => ({
              inventoryItemId: c.inventoryItemId,
              quantity: Number(c.quantity) || 0,
              unit: c.unit || "piece",
            })),
          isActive: o.isActive !== false,
        };
      }),
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
                            {Number(opt.price) > 0 || opt.menuItemRef ? (
                              <span className="text-primary font-semibold">
                                +Rs {Number(opt.price).toLocaleString()}
                                {opt.menuItemRef ? (
                                  <span className="text-[10px] font-normal text-gray-400"> · live</span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-gray-400">Free</span>
                            )}
                            {opt.menuItemRef ? (
                              <span className="text-[10px] text-gray-400">· linked item</span>
                            ) : null}
                            {(opt.inventoryConsumptions || []).length > 0 ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                · {(opt.inventoryConsumptions || []).length} stock
                              </span>
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
                    <div>
                      <label className="font-medium text-gray-700 dark:text-neutral-300">Options</label>
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">
                        Type a choice name (e.g. Puri) and optionally attach stock
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-primary font-semibold hover:underline"
                    >
                      + Add option
                    </button>
                  </div>

                  {form.options.map((opt, index) => {
                    const linkedItem = opt.menuItemRef
                      ? menuItems.find((m) => m.id === opt.menuItemRef)
                      : null;
                    return (
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
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500 dark:text-neutral-400">
                          Menu item
                        </label>
                        <AsyncCombobox
                          placeholder="Search menu item…"
                          fetchFn={fetchMenuItemOptions}
                          value={opt.menuItemRef || null}
                          valueObj={
                            opt.menuItemRef
                              ? menuItemOptions.find((o) => o.id === opt.menuItemRef) ||
                                (linkedItem
                                  ? menuItemToComboboxOption(linkedItem)
                                  : null)
                              : null
                          }
                          onChange={(id) =>
                            updateOption(index, "menuItemRef", id || "")
                          }
                          displayFn={(o) => o.label}
                          keyFn={(o) => o.id}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-gray-500 dark:text-neutral-400">
                            {linkedItem ? "Display name" : "Name"}
                            {linkedItem ? (
                              <span className="font-normal text-gray-400"> (optional)</span>
                            ) : null}
                          </label>
                          <input
                            type="text"
                            value={opt.name}
                            onChange={(e) => updateOption(index, "name", e.target.value)}
                            placeholder={
                              linkedItem
                                ? linkedItem.name
                                : "e.g. Extra cheese"
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-gray-500 dark:text-neutral-400">
                            Price (Rs)
                            {linkedItem ? (
                              <span className="font-normal text-gray-400"> · from menu item</span>
                            ) : null}
                          </label>
                          {linkedItem ? (
                            <div className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {Number(linkedItem.finalPrice ?? linkedItem.price ?? 0).toLocaleString()}
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={opt.price}
                              onChange={(e) => updateOption(index, "price", e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                            />
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-dashed border-gray-200 dark:border-neutral-700 p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-medium text-gray-500 dark:text-neutral-400">
                            Uses stock (optional)
                          </p>
                          <button
                            type="button"
                            onClick={() => addOptionInventoryRow(index)}
                            className="text-[10px] font-semibold text-primary hover:underline"
                          >
                            + Add ingredient
                          </button>
                        </div>
                        {(opt.inventoryConsumptions || []).length === 0 ? (
                          <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                            e.g. Puri Paratha → Puri × 1
                          </p>
                        ) : (
                          (opt.inventoryConsumptions || []).map((row, ri) => {
                            const invObj =
                              inventoryOptions.find((i) => i.id === row.inventoryItemId) ||
                              null;
                            return (
                              <div key={`${opt.id}-inv-${ri}`} className="flex items-center gap-1.5">
                                <div className="min-w-0 flex-1">
                                  <AsyncCombobox
                                    placeholder="Search inventory…"
                                    fetchFn={fetchInventoryOptions}
                                    value={row.inventoryItemId || null}
                                    valueObj={invObj}
                                    onChange={(id) =>
                                      updateOptionInventory(
                                        index,
                                        ri,
                                        "inventoryItemId",
                                        id || "",
                                      )
                                    }
                                    displayFn={(o) => o.label}
                                    keyFn={(o) => o.id}
                                  />
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateOptionInventory(
                                      index,
                                      ri,
                                      "quantity",
                                      e.target.value,
                                    )
                                  }
                                  className="w-16 shrink-0 px-2 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                                  placeholder="Qty"
                                />
                                <span className="w-12 shrink-0 text-[10px] text-gray-400 truncate">
                                  {row.unit || "pcs"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeOptionInventory(index, ri)}
                                  className="p-1 text-red-500 hover:text-red-600"
                                  aria-label="Remove ingredient"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    );
                  })}
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
