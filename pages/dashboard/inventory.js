import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Plus, Trash2, Edit2, Package, TrendingUp, TrendingDown, AlertTriangle, Copy, X, Loader2 } from "lucide-react";
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, getStoredAuth, getSourceBranchInventory, copyInventoryFromBranch, SubscriptionInactiveError } from "../../lib/apiClient";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";

const isAdminRole = (role) => role === "restaurant_admin" || role === "admin";

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
  const { currentBranch, branches } = useBranch() || {};
  const isAdmin = isAdminRole(getStoredAuth()?.user?.role);
  const sourceBranches = (branches || []).filter((b) => b.id !== currentBranch?.id);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceBranchId, setCopySourceBranchId] = useState("");
  const [copySourceData, setCopySourceData] = useState(null);
  const [copySourceLoading, setCopySourceLoading] = useState(false);
  const [copySelectedItemIds, setCopySelectedItemIds] = useState([]);
  const [copySubmitting, setCopySubmitting] = useState(false);

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

  useEffect(() => {
    if (!copySourceBranchId || !copyModalOpen || copySourceBranchId === "all") {
      setCopySourceData(null);
      setCopySelectedItemIds([]);
      return;
    }
    let cancelled = false;
    setCopySourceLoading(true);
    getSourceBranchInventory(copySourceBranchId)
      .then((data) => {
        if (cancelled) return;
        const list = data?.items ?? [];
        setCopySourceData({ items: list });
        setCopySelectedItemIds(list.map((i) => i.id));
      })
      .catch(() => {
        if (!cancelled) setCopySourceData({ items: [] });
      })
      .finally(() => {
        if (!cancelled) setCopySourceLoading(false);
      });
    return () => { cancelled = true; };
  }, [copySourceBranchId, copyModalOpen]);

  function toggleCopyItem(id) {
    setCopySelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCopySubmit() {
    if (!currentBranch?.id || !copySourceBranchId) {
      toast.error("Please select a target branch and source branch.");
      return;
    }
    setCopySubmitting(true);
    try {
      if (copySourceBranchId === "all") {
        for (const branch of sourceBranches) {
          const data = await getSourceBranchInventory(branch.id);
          const itemIds = (data?.items ?? []).map((i) => i.id);
          if (itemIds.length) await copyInventoryFromBranch(branch.id, { itemIds });
        }
        toast.success("Inventory copied from all branches to this branch (stock 0).");
      } else {
        await copyInventoryFromBranch(copySourceBranchId, { itemIds: copySelectedItemIds });
        toast.success("Inventory copied to this branch with stock 0.");
      }
      setCopyModalOpen(false);
      setCopySourceBranchId("");
      const data = await getInventory();
      setItems(data);
    } catch (err) {
      toast.error(err.message || "Failed to copy inventory");
    } finally {
      setCopySubmitting(false);
    }
  }

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
    if (!currentBranch) {
      toast.error("Please select a branch from the header dropdown to add inventory items.");
      return;
    }
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
    if (!form.id && !currentBranch?.id) {
      setModalError("Please select a specific branch from the header dropdown before adding inventory.");
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
          lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : 0,
          costPrice: form.costPrice ? Number(form.costPrice) : 0,
          ...(currentBranch?.id && { branchId: currentBranch.id }),
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

  // When a branch is selected, only show items that have a BranchInventory record for this branch
  const branchFilteredItems = items.filter(item => item.hasBranchRecord !== false);

  const filtered = branchFilteredItems.filter(item => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || item.unit.toLowerCase().includes(term);
  });

  const lowStockItems = branchFilteredItems.filter(item => item.currentStock <= (item.lowStockThreshold || 0));

  return (
    <AdminLayout title="Inventory Management" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-5 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Copy inventory from branch modal */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Copy inventory from branch
              </h2>
              <button
                type="button"
                onClick={() => { setCopyModalOpen(false); setCopySourceBranchId(""); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Source branch
                </label>
                <select
                  value={copySourceBranchId}
                  onChange={(e) => setCopySourceBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Select branch</option>
                  {isAdmin && (
                    <option value="all">All branches</option>
                  )}
                  {sourceBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              {copySourceLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              {copySourceBranchId === "all" && (
                <p className="text-sm text-gray-600 dark:text-neutral-400 py-2">
                  All inventory items from every other branch will be copied to this branch (stock 0).
                </p>
              )}
              {!copySourceLoading && copySourceData && copySourceBranchId !== "all" && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-2">
                    Inventory items
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800">
                    {(copySourceData.items || []).map((i) => (
                      <label
                        key={i.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={copySelectedItemIds.includes(i.id)}
                          onChange={() => toggleCopyItem(i.id)}
                          className="rounded border-gray-300 text-primary"
                        />
                        <span className="text-sm text-gray-900 dark:text-white flex-1">
                          {i.name}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400">
                          {i.unit}
                        </span>
                      </label>
                    ))}
                    {(copySourceData.items || []).length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">
                        No inventory items in this branch
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setCopyModalOpen(false); setCopySourceBranchId(""); }}
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCopySubmit}
                disabled={!copySourceBranchId || copySubmitting || (copySourceBranchId !== "all" && copySelectedItemIds.length === 0)}
                className="px-4"
              >
                {copySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                {copySubmitting ? "Copying…" : "Copy to this branch"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="mb-6 p-5 rounded-2xl border-2 border-orange-200 dark:border-orange-500/30 bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-500/10 dark:to-orange-500/5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-orange-900 dark:text-orange-300">Low Stock Alert</h3>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-0.5">
                {lowStockItems.length} item{lowStockItems.length > 1 ? 's are' : ' is'} running low: {lowStockItems.map(i => i.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inventory items..."
            className="w-full px-5 py-3.5 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
          />
        </div>
        {currentBranch?.id && (
          <button
            type="button"
            onClick={() => { setCopySourceBranchId(""); setCopyModalOpen(true); }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/10 transition-all whitespace-nowrap"
          >
            <Copy className="w-4 h-4" />
            Copy Inventory
          </button>
        )}
        <button
          type="button"
          onClick={startCreateItem}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <p className="text-base font-bold text-gray-700 dark:text-neutral-300">
              {branchFilteredItems.length === 0 ? "No inventory items yet" : "No results found"}
            </p>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
              {branchFilteredItems.length === 0 ? "Start by adding ingredients or raw materials to track" : "Try a different search term"}
            </p>
            {branchFilteredItems.length === 0 && (
              <button
                onClick={startCreateItem}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Your First Item
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-neutral-900/50 dark:to-neutral-900/30">
                <tr>
                  <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Item</th>
                  <th className="py-4 px-6 text-center font-bold text-gray-700 dark:text-neutral-300">Current Stock</th>
                  <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Cost Price</th>
                  <th className="py-4 px-6 text-center font-bold text-gray-700 dark:text-neutral-300">Low Stock Alert</th>
                  <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-100 dark:divide-neutral-800">
                {filtered.map(item => {
                  const isLowStock = item.currentStock <= (item.lowStockThreshold || 0);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${
                            isLowStock 
                              ? 'bg-gradient-to-br from-orange-500 to-orange-600' 
                              : 'bg-gradient-to-br from-primary to-secondary'
                          }`}>
                            <Package className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{item.name}</div>
                            <div className="text-xs text-gray-500 dark:text-neutral-500">
                              Unit: {item.unit}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[80px] px-3 py-1.5 rounded-lg font-bold ${
                          isLowStock
                            ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
                            : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {item.currentStock} {item.unit}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {item.costPrice > 0 ? (
                          <div>
                            <span className="text-base font-bold text-primary">Rs {item.costPrice.toLocaleString()}</span>
                            <div className="text-xs text-gray-500 dark:text-neutral-500">{costPriceLabel(item.unit)}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-neutral-500 text-sm">Not set</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm text-gray-600 dark:text-neutral-400">
                          {item.lowStockThreshold || 0} {item.unit}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustDialog(item, "add")}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                            title="Add stock"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustDialog(item, "remove")}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors flex items-center gap-1"
                            title="Remove stock"
                          >
                            <TrendingDown className="w-3.5 h-3.5" />
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {form.id ? "Edit Inventory Item" : "New Inventory Item"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {form.id ? "Update item details" : "Register ingredients or materials"}
                </p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                  Item Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e =>
                    setForm(prev => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Tomato, Burger Bun, Oil..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                    Unit
                  </label>
                  <select
                    value={form.unit}
                    onChange={e =>
                      setForm(prev => ({ ...prev, unit: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  >
                    <option value="gram">Gram (g)</option>
                    <option value="ml">Milliliter (ml)</option>
                    <option value="piece">Piece</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
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
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                    Initial Stock
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
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                    Low Stock Alert
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
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  onClick={() => {
                    resetForm();
                    setIsItemModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {form.id ? "Save Changes" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adjustDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg ${
                adjustDialog.mode === "add"
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  : 'bg-gradient-to-br from-orange-500 to-orange-600'
              }`}>
                {adjustDialog.mode === "add" ? (
                  <TrendingUp className="w-6 h-6 text-white" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {adjustDialog.mode === "add" ? "Add Stock" : "Remove Stock"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {adjustDialog.itemName}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
              {adjustDialog.mode === "add"
                ? "Enter the quantity to add to current stock"
                : "Enter the quantity to remove from current stock"}
            </p>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}

            <div className="mb-6">
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustDialog.value}
                onChange={e =>
                  setAdjustDialog(prev => ({ ...prev, value: e.target.value }))
                }
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-base font-semibold text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                placeholder="Enter quantity"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                onClick={closeAdjustDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
                  adjustDialog.mode === "add"
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30 hover:shadow-emerald-500/40'
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-500/30 hover:shadow-orange-500/40'
                }`}
                onClick={handleConfirmAdjust}
                disabled={!adjustDialog.value.trim()}
              >
                {adjustDialog.mode === "add" ? (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    Confirm Add
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4" />
                    Confirm Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
