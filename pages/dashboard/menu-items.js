import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import {
  getMenu,
  getInventory,
  createItem,
  updateItem,
  deleteItem,
  uploadImage,
  SubscriptionInactiveError
} from "../../lib/apiClient";
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Upload, Link, Loader2, X } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";

export default function MenuItemsPage() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    price: "",
    categoryId: "",
    imageUrl: "",
    description: ""
  });

  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const { confirm } = useConfirmDialog();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");

  const [imageTab, setImageTab] = useState("link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [recipeDialog, setRecipeDialog] = useState({
    open: false,
    itemId: null,
    itemName: "",
    consumptions: []
  });

  useEffect(() => {
    (async () => {
      try {
        const [menuData, inv] = await Promise.all([getMenu(), getInventory()]);
        setCategories(menuData.categories || []);
        setItems(menuData.items || []);
        setInventoryItems(inv || []);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          setError(err.message || "Failed to load menu items");
        }
      }
    })();
  }, []);

  function resetForm() {
    setForm({
      id: null,
      name: "",
      price: "",
      categoryId: categories[0]?.id || "",
      imageUrl: "",
      description: ""
    });
  }

  function startCreate() {
    resetForm();
    setImageTab("link");
    setUploadError("");
    setModalError("");
    setIsModalOpen(true);
  }

  function startEdit(item) {
    setForm({
      id: item.id,
      name: item.name,
      price: String(item.price ?? ""),
      categoryId: item.categoryId,
      imageUrl: item.imageUrl || "",
      description: item.description || ""
    });
    setImageTab(item.imageUrl ? "link" : "link");
    setUploadError("");
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setModalError("Item name is required"); return; }
    if (!form.price) { setModalError("Price is required"); return; }
    if (!form.categoryId) { setModalError("Please select a category"); return; }
    setModalError("");
    try {
      if (form.id) {
        const updated = await updateItem(form.id, {
          name: form.name,
          price: parseFloat(form.price),
          categoryId: form.categoryId,
          imageUrl: form.imageUrl,
          description: form.description
        });
        setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
      } else {
        const created = await createItem({
          name: form.name,
          price: parseFloat(form.price),
          categoryId: form.categoryId,
          imageUrl: form.imageUrl,
          description: form.description
        });
        setItems(prev => [...prev, created]);
      }
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || "Failed to save menu item");
    }
  }

  async function handleToggleAvailability(item) {
    const updated = await updateItem(item.id, { available: !item.available });
    setItems(prev => prev.map(i => (i.id === item.id ? updated : i)));
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadImage(file);
      setForm(prev => ({ ...prev, imageUrl: result.url }));
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete menu item",
      message: "Delete this menu item? This cannot be undone."
    });
    if (!ok) return;
    await deleteItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  // Unit conversion helpers
  // New base units: gram, ml, piece (stored directly)
  // Legacy base units: kg, liter (with sub-unit toggle to g/ml)
  const SUB_UNITS = { kg: "g", liter: "ml" };
  const BASE_UNITS = { g: "kg", ml: "liter" };

  // Map to preferred display: gram → gram, ml → ml, kg → g, liter → ml
  const PREFERRED_DISPLAY = { kg: "g", liter: "ml", gram: "gram", ml: "ml", piece: "piece" };

  function toBaseUnit(value, displayUnit, baseUnit) {
    // Legacy: converting g/ml display back to kg/liter for storage
    if (baseUnit === "kg" && displayUnit === "g") return value / 1000;
    if (baseUnit === "liter" && displayUnit === "ml") return value / 1000;
    return value;
  }

  function fromBaseUnit(value, displayUnit, baseUnit) {
    // Legacy: converting kg/liter storage to g/ml display
    if (baseUnit === "kg" && displayUnit === "g") return value * 1000;
    if (baseUnit === "liter" && displayUnit === "ml") return value * 1000;
    return value;
  }

  // Recipe dialog
  const [recipeUnits, setRecipeUnits] = useState({});

  function openRecipeDialog(item) {
    const existing = (item.inventoryConsumptions || []).map(c => ({
      inventoryItemId: c.inventoryItem,
      quantity: String(c.quantity ?? "")
    }));

    // Auto-detect display unit
    // For new units (gram, ml): display as-is
    // For legacy units (kg, liter): always default to g/ml display
    const units = {};
    for (const c of existing) {
      const inv = inventoryItems.find(i => i.id === c.inventoryItemId);
      if (inv && SUB_UNITS[inv.unit]) {
        // Legacy kg/liter — always show as g/ml
        units[c.inventoryItemId] = SUB_UNITS[inv.unit];
      }
    }
    setRecipeUnits(units);

    // Convert existing values to display units
    const displayConsumptions = existing.map(c => {
      const inv = inventoryItems.find(i => i.id === c.inventoryItemId);
      const displayUnit = units[c.inventoryItemId];
      if (displayUnit && c.quantity && inv) {
        return { ...c, quantity: String(fromBaseUnit(Number(c.quantity), displayUnit, inv.unit)) };
      }
      return c;
    });

    setModalError("");
    setRecipeDialog({ open: true, itemId: item.id, itemName: item.name, consumptions: displayConsumptions });
  }

  function closeRecipeDialog() {
    setRecipeDialog(prev => ({ ...prev, open: false }));
    setRecipeUnits({});
  }

  function toggleRecipeUnit(inventoryItemId, baseUnit) {
    setRecipeUnits(prev => {
      const current = prev[inventoryItemId] || baseUnit;
      const isSubUnit = current === SUB_UNITS[baseUnit];
      const newUnit = isSubUnit ? baseUnit : SUB_UNITS[baseUnit];

      // Convert the current quantity value
      setRecipeDialog(rd => {
        const c = rd.consumptions.find(x => x.inventoryItemId === inventoryItemId);
        if (c && c.quantity) {
          const numVal = Number(c.quantity);
          if (!isNaN(numVal) && numVal > 0) {
            const converted = isSubUnit ? numVal / 1000 : numVal * 1000;
            return {
              ...rd,
              consumptions: rd.consumptions.map(x =>
                x.inventoryItemId === inventoryItemId
                  ? { ...x, quantity: String(parseFloat(converted.toFixed(4))) }
                  : x
              )
            };
          }
        }
        return rd;
      });

      return { ...prev, [inventoryItemId]: newUnit };
    });
  }

  function updateConsumption(inventoryItemId, quantity) {
    setRecipeDialog(prev => {
      const existing = prev.consumptions.find(c => c.inventoryItemId === inventoryItemId);
      if (!existing) {
        return { ...prev, consumptions: [...prev.consumptions, { inventoryItemId, quantity }] };
      }
      return {
        ...prev,
        consumptions: prev.consumptions.map(c =>
          c.inventoryItemId === inventoryItemId ? { ...c, quantity } : c
        )
      };
    });
  }

  async function handleSaveRecipe() {
    if (!recipeDialog.itemId) return;
    setModalError("");
    try {
      // Convert display values back to base units before saving
      const payloadConsumptions = recipeDialog.consumptions
        .map(c => {
          const inv = inventoryItems.find(i => i.id === c.inventoryItemId);
          const displayUnit = recipeUnits[c.inventoryItemId];
          const rawQty = Number(c.quantity || "0");
          const baseQty = displayUnit && inv ? toBaseUnit(rawQty, displayUnit, inv.unit) : rawQty;
          return { inventoryItemId: c.inventoryItemId, quantity: parseFloat(baseQty.toFixed(6)) };
        })
        .filter(c => !Number.isNaN(c.quantity) && c.quantity > 0);
      const updated = await updateItem(recipeDialog.itemId, { inventoryConsumptions: payloadConsumptions });
      setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
      closeRecipeDialog();
    } catch (err) {
      setModalError(err.message || "Failed to save recipe");
    }
  }

  const filtered = items.filter(item => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const category = categories.find(c => c.id === item.categoryId);
    return (
      item.name.toLowerCase().includes(term) ||
      (item.description || "").toLowerCase().includes(term) ||
      (category?.name || "").toLowerCase().includes(term) ||
      String(item.price).includes(term)
    );
  });

  return (
    <AdminLayout title="Menu Items" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <Card
          title="Menu Items"
          description="Manage availability, pricing, and link items to inventory usage."
        >
          <div className="flex flex-row items-center justify-between gap-3 mb-4 text-xs">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, category or price..."
              className="flex-1 px-3 py-1.5 max-w-sm rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
            <Button type="button" className="gap-2 shrink-0" onClick={startCreate}>
              <Plus className="w-3 h-3" />
              New item
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto text-xs">
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase text-gray-800 dark:text-neutral-400 border-b border-gray-300 dark:border-neutral-700 sticky top-0 z-10 bg-bg-secondary dark:bg-neutral-950">
                <tr>
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-left">Category</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-center">Status</th>
                  <th className="py-2 text-center">Badges</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                {filtered.map(item => {
                  const category = categories.find(c => c.id === item.categoryId);
                  return (
                    <tr key={item.id} className="hover:bg-bg-primary dark:hover:bg-neutral-900/50">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-9 w-9 rounded-lg object-cover border border-gray-200 dark:border-neutral-700 shrink-0"
                            />
                          ) : (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-bg-primary dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 shrink-0 text-[10px] font-bold">
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-neutral-100 truncate">{item.name}</div>
                            {item.description && (
                              <div className="text-[10px] text-gray-500 dark:text-neutral-500 truncate max-w-[180px]">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 dark:text-neutral-400">
                        {category ? category.name : "Uncategorized"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium text-gray-900 dark:text-neutral-100">
                        PKR {item.price?.toFixed(0)}
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item)}
                          className="inline-flex items-center gap-1 text-[11px]"
                        >
                          {item.available ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">Available</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-500">Unavailable</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {item.isFeatured && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[9px] font-semibold">
                              Featured
                            </span>
                          )}
                          {item.isBestSeller && (
                            <span className="px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[9px] font-semibold">
                              Best Seller
                            </span>
                          )}
                          {Array.isArray(item.inventoryConsumptions) && item.inventoryConsumptions.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 text-[9px] font-semibold">
                              {item.inventoryConsumptions.length} ingredient{item.inventoryConsumptions.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            type="button"
                            className="px-2 text-[11px]"
                            onClick={() => openRecipeDialog(item)}
                          >
                            Recipe
                          </Button>
                          <Button variant="ghost" type="button" className="px-2" onClick={() => startEdit(item)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="px-2 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/40 hover:bg-red-50 dark:hover:bg-secondary/10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-gray-500 dark:text-neutral-500">
                      {items.length === 0 ? "No menu items yet. Add your first dish." : "No items match your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Item Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 p-5 text-xs max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {form.id ? "Edit menu item" : "New menu item"}
            </h2>
            <p className="text-[11px] text-neutral-500 mb-4">
              Configure name, price and category for this item.
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Name</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Chicken burger, Fries..."
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Category</label>
                <select
                  value={form.categoryId}
                  onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Image (optional)</label>
                <div className="flex rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => setImageTab("link")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      imageTab === "link"
                        ? "bg-primary text-white"
                        : "bg-bg-secondary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Link className="w-3 h-3" />
                    Paste URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab("upload")}
                    className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium border-l border-gray-300 dark:border-neutral-700 transition-colors ${
                      imageTab === "upload"
                        ? "bg-primary text-white"
                        : "bg-bg-secondary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    Upload from PC
                  </button>
                </div>

                {imageTab === "link" && (
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                  />
                )}

                {imageTab === "upload" && (
                  <div className="space-y-2">
                    <label
                      className={`flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                        uploading
                          ? "border-primary/40 bg-primary/5"
                          : "border-gray-300 dark:border-neutral-700 bg-bg-primary dark:bg-neutral-900 hover:bg-bg-primary dark:hover:bg-neutral-800 hover:border-primary/60"
                      }`}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-1">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          <span className="text-[11px] text-primary font-medium">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload className="w-5 h-5 text-gray-400 dark:text-neutral-500" />
                          <span className="text-[11px] text-gray-500 dark:text-neutral-400">Click to browse or drag & drop</span>
                          <span className="text-[10px] text-gray-400 dark:text-neutral-500">JPG, PNG, WEBP up to 5 MB</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                    {uploadError && <p className="text-[11px] text-red-600">{uploadError}</p>}
                  </div>
                )}

                {form.imageUrl && (
                  <div className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imageUrl} alt="Preview" className="h-20 w-20 rounded-lg object-cover border border-gray-300 dark:border-neutral-700" />
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, imageUrl: "" }))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Description (optional)</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" className="text-neutral-400" onClick={() => { resetForm(); setIsModalOpen(false); }}>
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

      {/* Recipe / Inventory Dialog */}
      {recipeDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-300 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950 p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Inventory recipe for {recipeDialog.itemName}
            </h2>
            <p className="text-xs text-gray-900 dark:text-neutral-300 mb-4">
              For each sale of this menu item, how much of each inventory ingredient should be deducted?
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <div className="max-h-72 overflow-y-auto text-xs mb-4">
              {inventoryItems.length === 0 ? (
                <p className="text-xs text-gray-800 dark:text-neutral-500">
                  No inventory items yet. Create ingredients in the Inventory page first.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-[11px] uppercase text-gray-800 dark:text-neutral-400 border-b border-gray-300 dark:border-neutral-700">
                    <tr>
                      <th className="py-2 text-left">Ingredient</th>
                      <th className="py-2 text-center w-20">Unit</th>
                      <th className="py-2 text-right w-32">Quantity per sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                    {inventoryItems.map(inv => {
                      const existing = recipeDialog.consumptions.find(c => c.inventoryItemId === inv.id);
                      // Always show gram/ml/piece — map legacy kg→gram, liter→ml
                      const UNIT_DISPLAY = { kg: "gram", liter: "ml", gram: "gram", ml: "ml", piece: "piece" };
                      const displayUnit = UNIT_DISPLAY[inv.unit] || inv.unit;
                      return (
                        <tr key={inv.id}>
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-900 dark:text-neutral-100">{inv.name}</div>
                          </td>
                          <td className="py-2 px-1 text-center">
                            <span className="text-[11px] text-gray-500 dark:text-neutral-500">{displayUnit}</span>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={existing?.quantity ?? ""}
                              onChange={e => updateConsumption(inv.id, e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                              placeholder={`0 ${displayUnit}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <Button type="button" variant="ghost" className="px-3" onClick={closeRecipeDialog}>
                Cancel
              </Button>
              <Button type="button" className="px-3" onClick={handleSaveRecipe} disabled={inventoryItems.length === 0}>
                Save recipe
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
