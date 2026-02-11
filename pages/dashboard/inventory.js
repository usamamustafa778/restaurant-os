import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Plus, Trash2 } from "lucide-react";
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, SubscriptionInactiveError } from "../../lib/apiClient";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";

// Helper: return the cost price label based on unit
function costPriceLabel(unit) {
  if (unit === "gram" || unit === "kg") return "Price per 1000g";
  if (unit === "ml" || unit === "liter") return "Price per 1000ml";
  if (unit === "piece") return "Price per 12 pcs";
  return "Cost price";
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    unit: "gram",
    initialStock: "",
    lowStockThreshold: "",
    costPrice: ""
  });

  const [adjustDialog, setAdjustDialog] = useState({
    open: false,
    mode: "add", // "add" | "remove"
    itemId: null,
    itemName: "",
    value: ""
  });

  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const { confirm } = useConfirmDialog();

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getInventory();
        setItems(data);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          console.error("Failed to load inventory:", err);
          setError(err.message || "Failed to load inventory");
        }
      }
    })();
  }, []);

  function resetForm() {
    setForm({
      id: null,
      name: "",
      unit: "gram",
      initialStock: "",
      lowStockThreshold: "",
      costPrice: ""
    });
  }

  function startCreateItem() {
    resetForm();
    setModalError("");
    setIsItemModalOpen(true);
  }

  function startEditItem(item) {
    setForm({
      id: item.id,
      name: item.name,
      unit: item.unit,
      initialStock: "",
      lowStockThreshold: String(item.lowStockThreshold ?? ""),
      costPrice: String(item.costPrice ?? "")
    });
    setModalError("");
    setIsItemModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Item name is required");
      return;
    }
    if (!form.unit) {
      setModalError("Unit is required");
      return;
    }
    setModalError("");
    try {
      if (form.id) {
        const updated = await updateInventoryItem(form.id, {
          name: form.name,
          unit: form.unit,
          lowStockThreshold: form.lowStockThreshold
            ? Number(form.lowStockThreshold)
            : 0,
          costPrice: form.costPrice
            ? Number(form.costPrice)
            : 0
        });
        setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
      } else {
        const created = await createInventoryItem({
          name: form.name,
          unit: form.unit,
          initialStock: form.initialStock ? Number(form.initialStock) : 0,
          lowStockThreshold: form.lowStockThreshold
            ? Number(form.lowStockThreshold)
            : 0,
          costPrice: form.costPrice
            ? Number(form.costPrice)
            : 0
        });
        setItems(prev => [...prev, created]);
      }
      resetForm();
      setIsItemModalOpen(false);
    } catch (err) {
      setModalError(err.message || "Failed to save inventory item");
    }
  }

  async function handleAdjustStock(id, delta) {
    const updated = await updateInventoryItem(id, { stockAdjustment: delta });
    setItems(prev => prev.map(i => (i.id === id ? updated : i)));
  }

  function openAdjustDialog(item, mode) {
    setModalError("");
    setAdjustDialog({
      open: true,
      mode,
      itemId: item.id,
      itemName: item.name,
      value: ""
    });
  }

  function closeAdjustDialog() {
    setAdjustDialog(prev => ({ ...prev, open: false, value: "" }));
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: "Delete inventory item",
      message: `Delete "${item.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteInventoryItem(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      setError(err.message || "Failed to delete inventory item");
    }
  }

  async function handleConfirmAdjust() {
    const raw = adjustDialog.value.trim();
    const amount = Number(raw || "0");
    if (Number.isNaN(amount) || amount <= 0 || !adjustDialog.itemId) {
      setModalError("Please enter a valid quantity greater than 0");
      return;
    }
    setModalError("");
    try {
      const delta = adjustDialog.mode === "add" ? amount : -amount;
      await handleAdjustStock(adjustDialog.itemId, delta);
      closeAdjustDialog();
    } catch (err) {
      setModalError(err.message || "Failed to adjust stock");
    }
  }

  return (
    <AdminLayout title="Inventory Management" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="w-full">
        <Card
          title="Current stock levels"
          description="Monitor what&apos;s in store and quickly adjust when you restock."
        >
          <div className="flex flex-row items-center justify-between gap-3 mb-4 text-xs">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inventory items..."
              className="flex-1 px-3 py-1.5 max-w-sm rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
            <Button type="button" className="text-xs gap-1 shrink-0" onClick={startCreateItem}>
              <Plus className="w-3 h-3" />
              New inventory item
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto text-xs">
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase text-gray-800 border-b border-gray-300 sticky top-0 z-10 bg-bg-secondary dark:bg-neutral-950">
                <tr>
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-right">Stock</th>
                  <th className="py-2 text-right">Cost Price</th>
                  <th className="py-2 text-right">Low stock at</th>
                  <th className="py-2 text-right">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items
                  .filter(item => {
                    const term = search.trim().toLowerCase();
                    if (!term) return true;
                    return (
                      item.name.toLowerCase().includes(term) ||
                      item.unit.toLowerCase().includes(term)
                    );
                  })
                  .map(item => (
                  <tr key={item.id} className="hover:bg-bg-primary">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-900">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-gray-800">
                        Unit: {item.unit}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {item.costPrice > 0 ? (
                        <div>
                          <span className="font-medium">Rs {item.costPrice.toLocaleString()}</span>
                          <div className="text-[10px] text-gray-500">{costPriceLabel(item.unit)}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {item.lowStockThreshold || 0} {item.unit}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 text-[11px]"
                          onClick={() => startEditItem(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 text-[11px]"
                          onClick={() => openAdjustDialog(item, "add")}
                        >
                          + Add
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 text-[11px] text-amber-300"
                          onClick={() => openAdjustDialog(item, "remove")}
                        >
                          − Remove
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/40 hover:bg-red-50 dark:hover:bg-secondary/10"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {items.filter(item => {
                    const term = search.trim().toLowerCase();
                    if (!term) return true;
                    return item.name.toLowerCase().includes(term) || item.unit.toLowerCase().includes(term);
                  }).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-xs text-neutral-500"
                    >
                      {items.length === 0 ? "No inventory items yet." : "No items match your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-300 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950 p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {form.id ? "Edit inventory item" : "New inventory item"}
            </h2>
            <p className="text-xs text-gray-600 dark:text-neutral-300 mb-4">
              Register ingredients or packaged items and optional starting stock.
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e =>
                    setForm(prev => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Tomato, Burger Bun, Oil..."
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                    Unit
                  </label>
                  <select
                    value={form.unit}
                    onChange={e =>
                      setForm(prev => ({ ...prev, unit: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                  >
                    <option value="gram">gram</option>
                    <option value="ml">ml</option>
                    <option value="piece">piece</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                    {costPriceLabel(form.unit)} (Rs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.costPrice}
                    onChange={e =>
                      setForm(prev => ({ ...prev, costPrice: e.target.value }))
                    }
                    placeholder="e.g. 250, 500, 1200"
                    className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                  />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                    Initial stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.initialStock}
                    onChange={e =>
                      setForm(prev => ({ ...prev, initialStock: e.target.value }))
                    }
                    disabled={!!form.id}
                    placeholder="e.g. 0.5, 5, 10"
                    className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
                    Low stock threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.lowStockThreshold}
                    onChange={e =>
                      setForm(prev => ({
                        ...prev,
                        lowStockThreshold: e.target.value
                      }))
                    }
                    placeholder="e.g. 0.5, 1, 2"
                    className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-neutral-400"
                  onClick={() => {
                    resetForm();
                    setIsItemModalOpen(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-1">
                  <Plus className="w-3 h-3" />
                  {form.id ? "Save changes" : "Create item"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adjustDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-300 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950 p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {adjustDialog.mode === "add" ? "Add stock" : "Remove stock"}
            </h2>
            <p className="text-xs text-gray-900 dark:text-neutral-300 mb-4">
              {adjustDialog.mode === "add"
                ? `How much stock do you want to add for "${adjustDialog.itemName}"?`
                : `How much stock do you want to remove for "${adjustDialog.itemName}"?`}
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <div className="mb-4">
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustDialog.value}
                onChange={e =>
                  setAdjustDialog(prev => ({ ...prev, value: e.target.value }))
                }
                className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                placeholder="Enter quantity"
              />
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <Button
                type="button"
                variant="ghost"
                className="px-3"
                onClick={closeAdjustDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="px-3"
                onClick={handleConfirmAdjust}
                disabled={!adjustDialog.value.trim()}
              >
                {adjustDialog.mode === "add" ? "Confirm add" : "Confirm remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
