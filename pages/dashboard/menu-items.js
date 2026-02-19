import { useState, useEffect } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import PageLoader from "../../components/ui/PageLoader";
import ViewToggle from "../../components/ui/ViewToggle";
import ActionDropdown from "../../components/ui/ActionDropdown";
import {
  getMenu,
  getBranchMenu,
  getInventory,
  createItem,
  updateItem,
  deleteItem,
  uploadImage,
  getStoredAuth,
  getSourceBranchMenu,
  copyMenuFromBranch
} from "../../lib/apiClient";
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Upload, Link, Loader2, X, ShoppingBag, Copy, Flame, Star } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useDropdown } from "../../hooks/useDropdown";
import { handleAsyncAction } from "../../utils/toastActions";
import toast from "react-hot-toast";

const isAdminRole = (role) => role === "restaurant_admin" || role === "admin";

export default function MenuItemsPage() {
  const { currentBranch, branches } = useBranch() || {};
  const isAdmin = isAdminRole(getStoredAuth()?.user?.role);
  const sourceBranches = (branches || []).filter((b) => b.id !== currentBranch?.id);
  
  // Fetch menu and inventory data
  const fetchData = async () => {
    const auth = getStoredAuth();
    const restaurantId = auth?.user?.restaurantId;
    
    // Use branch-aware menu if branch is selected, otherwise use base menu
    let menuData;
    if (currentBranch?.id && restaurantId) {
      menuData = await getBranchMenu(currentBranch.id, restaurantId);
    } else {
      menuData = await getMenu();
    }
    
    const inv = await getInventory();
    
    return {
      categories: menuData.categories || [],
      items: menuData.items || [],
      inventoryItems: inv || []
    };
  };
  
  const { data, loading: pageLoading, error, suspended, setData } = usePageData(fetchData, [currentBranch?.id]);
  const categories = data?.categories || [];
  const items = data?.items || [];
  const inventoryItems = data?.inventoryItems || [];
  // When a branch is selected, only show ingredients that have a BranchInventory record
  const branchFilteredInventoryItems = inventoryItems.filter(item => item.hasBranchRecord !== false);

  const { viewMode, setViewMode } = useViewMode("table");
  const { toggle: toggleDropdown, close: closeDropdown, isOpen: isDropdownOpen } = useDropdown();
  const { confirm } = useConfirmDialog();

  const [form, setForm] = useState({
    id: null,
    name: "",
    price: "",
    categoryId: "",
    dietaryType: "non_veg",
    imageUrl: "",
    description: "",
    availableAtAllBranches: true,
    isTrending: false,
    isMustTry: false
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [imageTab, setImageTab] = useState("link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [recipeDialog, setRecipeDialog] = useState({
    open: false,
    itemId: null,
    itemName: "",
    consumptions: []
  });

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceBranchId, setCopySourceBranchId] = useState("");
  const [copySourceData, setCopySourceData] = useState(null);
  const [copySourceLoading, setCopySourceLoading] = useState(false);
  const [copySelectedItemIds, setCopySelectedItemIds] = useState([]);
  const [copySubmitting, setCopySubmitting] = useState(false);

  // Single branch: fetch that branch's menu
  useEffect(() => {
    if (!copySourceBranchId || !copyModalOpen) {
      setCopySourceData(null);
      setCopySelectedItemIds([]);
      return;
    }
    if (copySourceBranchId === "all") {
      // "All branches" is handled by the separate effect below
      return;
    }
    let cancelled = false;
    setCopySourceLoading(true);
    getSourceBranchMenu(copySourceBranchId)
      .then((data) => {
        if (!cancelled) {
          setCopySourceData(data);
          setCopySelectedItemIds([]);
        }
      })
      .catch(() => {
        if (!cancelled) setCopySourceData({ categories: [], items: [] });
      })
      .finally(() => {
        if (!cancelled) setCopySourceLoading(false);
      });
    return () => { cancelled = true; };
  }, [copySourceBranchId, copyModalOpen]);

  // "All branches": fetch every source branch's menu and merge into one list (with branch label per item)
  const [copyAllBranchesData, setCopyAllBranchesData] = useState(null);
  const [copyAllBranchesError, setCopyAllBranchesError] = useState(null);
  useEffect(() => {
    if (!copySourceBranchId || copySourceBranchId !== "all" || !copyModalOpen) {
      setCopyAllBranchesData(null);
      setCopyAllBranchesError(null);
      setCopySelectedItemIds([]);
      return;
    }
    if (sourceBranches.length === 0) {
      setCopyAllBranchesData({ items: [] });
      setCopyAllBranchesError("No other branches to copy from. Select a single source branch above or add more branches.");
      setCopySourceLoading(false);
      return;
    }
    let cancelled = false;
    setCopySourceLoading(true);
    setCopyAllBranchesError(null);
    Promise.allSettled(sourceBranches.map((b) => getSourceBranchMenu(b.id).then((data) => ({ branch: b, data }))))
      .then((results) => {
        if (cancelled) return;
        const items = [];
        const failed = [];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const branch = sourceBranches[i];
          if (r.status === "fulfilled" && r.value) {
            const { branch: b, data } = r.value;
            (data?.items || []).forEach((item) => {
              items.push({
                ...item,
                sourceBranchId: b.id,
                sourceBranchName: b.name
              });
            });
          } else if (r.status === "rejected") {
            failed.push(branch?.name || "branch");
          }
        }
        setCopyAllBranchesData({ items });
        setCopySelectedItemIds([]);
        if (failed.length > 0 && items.length === 0) {
          setCopyAllBranchesError(`Could not load items from ${failed.join(", ")}. You may not have permission to view those branches.`);
        } else if (failed.length > 0) {
          setCopyAllBranchesError(`Some branches could not be loaded: ${failed.join(", ")}. Showing items from the rest.`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCopyAllBranchesData({ items: [] });
          setCopyAllBranchesError("Failed to load items from branches. Try selecting a single source branch.");
        }
      })
      .finally(() => {
        if (!cancelled) setCopySourceLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch when "All branches" selected; sourceBranches from closure
  }, [copySourceBranchId, copyModalOpen]);
  function toggleCopyItem(id) {
    setCopySelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  async function handleCopySubmit() {
    if (!currentBranch?.id || !copySourceBranchId) return;
    setCopySubmitting(true);
    try {
      if (copySourceBranchId === "all" && copyAllBranchesData?.items) {
        const selectedSet = new Set(copySelectedItemIds);
        const byBranch = {};
        copyAllBranchesData.items.forEach((i) => {
          if (selectedSet.has(i.id)) {
            const bid = i.sourceBranchId;
            if (!byBranch[bid]) byBranch[bid] = [];
            byBranch[bid].push(i.id);
          }
        });
        for (const [branchId, itemIds] of Object.entries(byBranch)) {
          if (itemIds.length) await copyMenuFromBranch(branchId, { categoryIds: [], itemIds });
        }
        toast.success("Selected items copied to this branch.");
      } else if (copySourceBranchId !== "all") {
        await copyMenuFromBranch(copySourceBranchId, {
          categoryIds: [],
          itemIds: copySelectedItemIds
        });
        toast.success("Items copied to this branch.");
      }
      setCopyModalOpen(false);
      setCopyAllBranchesData(null);
      setCopySourceBranchId("");
      fetchData().then((d) => setData(d));
    } catch (err) {
      toast.error(err.message || "Copy failed");
    } finally {
      setCopySubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      id: null,
      name: "",
      price: "",
      categoryId: categories[0]?.id || "",
      dietaryType: "non_veg",
      imageUrl: "",
      description: "",
      availableAtAllBranches: true,
      isTrending: false,
      isMustTry: false
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
      dietaryType: item.dietaryType || "non_veg",
      imageUrl: item.imageUrl || "",
      description: item.description || "",
      availableAtAllBranches: item.availableAtAllBranches ?? true,
      isTrending: item.isTrending ?? false,
      isMustTry: item.isMustTry ?? false
    });
    setImageTab(item.imageUrl ? "link" : "link");
    setUploadError("");
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { 
      setModalError("Item name is required"); 
      toast.error("Item name is required");
      return; 
    }
    if (!form.price) { 
      setModalError("Price is required"); 
      toast.error("Price is required");
      return; 
    }
    if (!form.categoryId) { 
      setModalError("Please select a category"); 
      toast.error("Please select a category");
      return; 
    }
    if (!form.id && !currentBranch?.id) {
      setModalError("Please select a specific branch from the header dropdown before adding a menu item.");
      return;
    }
    
    setModalError("");
    setIsLoading(true);
    
    const result = await handleAsyncAction(
      async () => {
        if (form.id) {
          const updated = await updateItem(form.id, {
            name: form.name,
            price: parseFloat(form.price),
            categoryId: form.categoryId,
            dietaryType: form.dietaryType,
            imageUrl: form.imageUrl,
            description: form.description,
            availableAtAllBranches: form.availableAtAllBranches,
            isTrending: form.isTrending,
            isMustTry: form.isMustTry
          });
          setData(prev => ({
            ...prev,
            items: prev.items.map(i => (i.id === updated.id ? updated : i))
          }));
          return updated;
        } else {
          const created = await createItem({
            name: form.name,
            price: parseFloat(form.price),
            categoryId: form.categoryId,
            dietaryType: form.dietaryType,
            imageUrl: form.imageUrl,
            description: form.description,
            availableAtAllBranches: form.availableAtAllBranches,
            isTrending: form.isTrending,
            isMustTry: form.isMustTry,
            ...(currentBranch?.id && { branchId: currentBranch.id }),
          });
          setData(prev => ({
            ...prev,
            items: [...prev.items, created]
          }));
          return created;
        }
      },
      {
        loading: form.id ? "Updating menu item..." : "Creating menu item...",
        success: form.id ? "Menu item updated successfully" : "Menu item created successfully",
        error: "Failed to save menu item"
      }
    );
    
    setIsLoading(false);
    
    if (result.success) {
      resetForm();
      setIsModalOpen(false);
    } else {
      setModalError(result.error);
    }
  }

  async function handleToggleAvailability(item) {
    await handleAsyncAction(
      async () => {
        if (currentBranch) {
          // Use finalAvailable (branch-aware availability)
          const currentAvailable = item.finalAvailable ?? item.available ?? true;
          await updateBranchMenuItem(item.id, { available: !currentAvailable });
          setData(prev => ({
            ...prev,
            items: prev.items.map(i => (i.id === item.id ? { 
              ...i, 
              finalAvailable: !currentAvailable,
              branchAvailable: !currentAvailable 
            } : i))
          }));
        } else {
          const updated = await updateItem(item.id, { available: !item.available });
          setData(prev => ({
            ...prev,
            items: prev.items.map(i => (i.id === item.id ? updated : i))
          }));
        }
      },
      {
        loading: "Updating availability...",
        success: "Availability updated",
        error: "Failed to update availability"
      }
    );
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
    
    setDeletingId(id);
    
    await handleAsyncAction(
      async () => {
        await deleteItem(id);
        setData(prev => ({
          ...prev,
          items: prev.items.filter(i => i.id !== id)
        }));
      },
      {
        loading: "Deleting menu item...",
        success: "Menu item deleted successfully",
        error: "Failed to delete menu item"
      }
    );
    
    setDeletingId(null);
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
    
    const result = await handleAsyncAction(
      async () => {
        // Convert display values back to base units before saving
        const payloadConsumptions = recipeDialog.consumptions
          .map(c => {
            const inv = inventoryItems.find(i => i.id === c.inventoryItemId);
            const displayUnit = recipeUnits[c.inventoryItemId];
            const rawQty = Number(c.quantity || "0");
            const baseQty = displayUnit && inv ? toBaseUnit(rawQty, displayUnit, inv.unit) : rawQty;
            const id = c.inventoryItemId != null ? String(c.inventoryItemId).trim() : "";
            return { inventoryItemId: id || undefined, quantity: parseFloat(baseQty.toFixed(6)) };
          })
          .filter(c => c.inventoryItemId && !Number.isNaN(c.quantity) && c.quantity > 0);
        const updated = await updateItem(recipeDialog.itemId, { inventoryConsumptions: payloadConsumptions });
        setData(prev => ({
          ...prev,
          items: prev.items.map(i => (i.id === updated.id ? updated : i))
        }));
      },
      {
        loading: "Saving recipe...",
        success: "Recipe saved successfully",
        error: "Failed to save recipe"
      }
    );
    
    if (result.success) {
      closeRecipeDialog();
    } else {
      setModalError(result.error);
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
      {pageLoading ? (
        <PageLoader message="Loading menu items..." icon={ShoppingBag} />
      ) : (
        <div className="w-full min-w-0 overflow-x-hidden">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          
          {/* Search, View Toggle and Add Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, category or price..."
                className="w-full px-5 py-3.5 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            {currentBranch?.id && (
              <button
                type="button"
                onClick={() => { setCopySourceBranchId(""); setCopyModalOpen(true); }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-2 border-primary text-primary dark:text-primary font-semibold hover:bg-primary/10 transition-all whitespace-nowrap"
              >
                <Copy className="w-4 h-4" />
                Copy Item
              </button>
            )}
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add New Item
            </button>
          </div>

          {/* Grid View - 2 cards on mobile, no horizontal scroll */}
          {viewMode === "grid" && (
            <div className="w-full min-w-0 overflow-x-hidden grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(item => {
                const category = categories.find(c => c.id === item.categoryId);
                const isDeleting = deletingId === item.id;
                const displayPrice = item.finalPrice ?? item.price;
                const isAvailable = item.finalAvailable ?? item.available;
                const hasPriceOverride = false;
                
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 hover:shadow-lg hover:border-primary/30 transition-all relative min-w-0"
                  >
                    <div className="flex items-start justify-between mb-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-16 w-16 rounded-xl object-cover border-2 border-gray-200 dark:border-neutral-700"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          <span className="text-2xl font-bold text-primary">
                            {item.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <ActionDropdown
                        isOpen={isDropdownOpen(item.id)}
                        onToggle={() => toggleDropdown(item.id)}
                        onClose={closeDropdown}
                        disabled={isDeleting}
                        actions={[
                          {
                            label: "Recipe",
                            icon: <ShoppingBag className="w-4 h-4" />,
                            onClick: () => openRecipeDialog(item),
                            disabled: isDeleting
                          },
                          {
                            label: "Edit",
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => startEdit(item),
                            disabled: isDeleting
                          },
                          {
                            label: isDeleting ? "Deleting..." : "Delete",
                            icon: isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />,
                            onClick: () => handleDelete(item.id),
                            variant: "danger",
                            disabled: isDeleting
                          }
                        ]}
                      />
                    </div>
                    
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-gray-500 dark:text-neutral-500 mb-2 line-clamp-2 min-h-[2rem]">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-neutral-800 text-xs font-medium">
                        {category ? category.name : "Uncategorized"}
                      </span>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white">Rs {displayPrice?.toFixed(0)}</div>
                        {/* Branch-specific special price UI removed */}
                      </div>
                    </div>
                    
                    {/* Availability and Badges */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(item)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold"
                      >
                        {isAvailable ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Available</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-500">Unavailable</span>
                          </>
                        )}
                      </button>
                      
                      {item.inventorySufficient === false && (
                        <span className="px-2 py-1 rounded-lg bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-bold">
                          ⚠️ Low Stock
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

      {/* Table View */}
      {viewMode === "table" && (
        <DataTable
          variant="card"
          columns={[
            {
              key: "item",
              header: "Item",
              render: (_, item) => (
                <div className="flex items-center gap-3">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-12 w-12 rounded-xl object-cover border-2 border-gray-200 dark:border-neutral-700 shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {item.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 dark:text-neutral-500 truncate max-w-[200px] mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              )
            },
            {
              key: "category",
              header: "Category",
              render: (_, item) => {
                const category = categories.find(c => c.id === item.categoryId);
                return (
                  <span className="inline-flex px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-neutral-800 text-xs font-medium">
                    {category ? category.name : "Uncategorized"}
                  </span>
                );
              }
            },
            {
              key: "price",
              header: "Price",
              align: "right",
              render: (_, item) => {
                const displayPrice = item.finalPrice ?? item.price;
                return (
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">Rs {displayPrice?.toFixed(0)}</div>
                  </div>
                );
              }
            },
            // Branch override column has been removed to simplify branch-specific menus
            {
              key: "status",
              header: "Status",
              align: "center",
              render: (_, item) => {
                const isAvailable = item.finalAvailable ?? item.available;
                return (
                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(item)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  >
                    {isAvailable ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Available</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-500">Unavailable</span>
                      </>
                    )}
                  </button>
                );
              }
            },
            {
              key: "tags",
              header: "Tags",
              align: "center",
              render: (_, item) => (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {item.inventorySufficient === false && (
                    <span className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-bold" title={item.insufficientIngredients?.join(", ")}>
                      ⚠️ Low Stock
                    </span>
                  )}
                  {item.isFeatured && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                      ⭐ Featured
                    </span>
                  )}
                  {item.isBestSeller && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                      🔥 Best Seller
                    </span>
                  )}
                  {Array.isArray(item.inventoryConsumptions) && item.inventoryConsumptions.length > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold">
                      📦 {item.inventoryConsumptions.length} ingredient{item.inventoryConsumptions.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (_, item) => {
                const isDeleting = deletingId === item.id;
                return (
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openRecipeDialog(item)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      Recipe
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={isDeleting}
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={isDeleting}
                      className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                );
              }
            }
          ]}
          rows={filtered}
          emptyMessage={
            items.length === 0 
              ? "No menu items yet. Create your first item to get started." 
              : "No items match your search"
          }
        />
          )}

          {/* Grid View Empty State */}
          {viewMode === "grid" && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                <ShoppingBag className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-neutral-400 mb-1">
                {items.length === 0 ? "No menu items yet" : "No items match your search"}
              </p>
              {items.length === 0 && (
                <>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4">
                    Create your first menu item to get started
                  </p>
                  <button
                    onClick={startCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Your First Item
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Item Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-5 text-xs max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {form.id ? "Edit menu item" : "New menu item"}
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400 mb-4">
              Configure name, price and category for this item.
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Name</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Chicken burger, Fries..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Category</label>
                <select
                  value={form.categoryId}
                  onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Dietary type</label>
                <div className="flex gap-4">
                  {[
                    { value: "veg", label: "Veg" },
                    { value: "non_veg", label: "Non-veg" },
                    { value: "egg", label: "Egg" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dietaryType"
                        value={opt.value}
                        checked={form.dietaryType === opt.value}
                        onChange={() => setForm(prev => ({ ...prev, dietaryType: opt.value }))}
                        className="w-3.5 h-3.5 rounded-full border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs text-gray-700 dark:text-neutral-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isTrending}
                    onChange={e => setForm(prev => ({ ...prev, isTrending: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Flame className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs text-gray-700 dark:text-neutral-300">Trending</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isMustTry}
                    onChange={e => setForm(prev => ({ ...prev, isMustTry: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Star className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-gray-700 dark:text-neutral-300">Must Try</span>
                </label>
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Image (optional)</label>
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
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
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
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Description (optional)</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              
              {/* Available at All Branches Toggle */}
              {/* Branch-wide vs location-specific toggle removed to keep each branch managing its own menu */}              
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => { resetForm(); setIsModalOpen(false); }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="gap-1.5"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {form.id ? "Saving..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      {form.id ? "Save changes" : "Create item"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe / Inventory Dialog */}
      {recipeDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Inventory recipe for {recipeDialog.itemName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              For each sale of this menu item, how much of each inventory ingredient should be deducted?
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <div className="max-h-72 overflow-y-auto text-xs mb-4">
              {branchFilteredInventoryItems.length === 0 ? (
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
                    {branchFilteredInventoryItems.map(inv => {
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
                              className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
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
              <Button type="button" className="px-3" onClick={handleSaveRecipe} disabled={branchFilteredInventoryItems.length === 0}>
                Save recipe
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Copy from branch modal */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Copy items from branch</h2>
              <button type="button" onClick={() => setCopyModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Source branch</label>
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
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              {copySourceBranchId && copySourceBranchId !== "all" && currentBranch?.name && (
                <p className="text-xs text-gray-600 dark:text-neutral-400">
                  Copying from <strong>{sourceBranches.find((b) => b.id === copySourceBranchId)?.name ?? "source"}</strong> → to <strong>{currentBranch.name}</strong> (this branch). Select the items you want to copy below.
                </p>
              )}
              {copySourceLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              {!currentBranch?.id && (
                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
                  Select a branch in the header (e.g. H13) as the copy destination, then choose a source branch and items.
                </p>
              )}
              {copySourceBranchId === "all" && currentBranch?.id && !copySourceLoading && copyAllBranchesData && (
                <div>
                  {copyAllBranchesError && (
                    <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 mb-3">
                      {copyAllBranchesError}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 dark:text-neutral-400 mb-2">
                    Select items from any branch to copy to <strong>{currentBranch.name}</strong>. Each item shows its source branch.
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400">Items from all branches</p>
                    {copyAllBranchesData.items.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCopySelectedItemIds(copyAllBranchesData.items.map((i) => i.id))}
                          className="text-xs text-primary hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setCopySelectedItemIds([])}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Deselect all
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800">
                    {copyAllBranchesData.items.map((i) => (
                      <label key={`${i.sourceBranchId}-${i.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={copySelectedItemIds.includes(i.id)}
                          onChange={() => toggleCopyItem(i.id)}
                          className="rounded border-gray-300 text-primary"
                        />
                        <span className="text-sm text-gray-900 dark:text-white flex-1">{i.name}</span>
                        <span className="text-xs text-gray-500">Rs {Number(i.price).toFixed(0)} · {i.sourceBranchName}</span>
                      </label>
                    ))}
                    {copyAllBranchesData.items.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">No items in other branches</p>
                    )}
                  </div>
                </div>
              )}
              {!copySourceLoading && copySourceData && copySourceBranchId !== "all" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400">Items from source branch</p>
                    {(copySourceData.items || []).length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCopySelectedItemIds((copySourceData.items || []).map((i) => i.id))}
                          className="text-xs text-primary hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setCopySelectedItemIds([])}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Deselect all
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800">
                    {(copySourceData.items || []).map((i) => (
                      <label key={i.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={copySelectedItemIds.includes(i.id)}
                          onChange={() => toggleCopyItem(i.id)}
                          className="rounded border-gray-300 text-primary"
                        />
                        <span className="text-sm text-gray-900 dark:text-white flex-1">{i.name}</span>
                        <span className="text-xs text-gray-500">Rs {Number(i.price).toFixed(0)} · {i.categoryName || ""}</span>
                      </label>
                    ))}
                    {(copySourceData.items || []).length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">No items in this branch</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-neutral-800">
              <Button type="button" variant="ghost" onClick={() => setCopyModalOpen(false)}>Cancel</Button>
              <Button
                type="button"
                onClick={handleCopySubmit}
                disabled={!currentBranch?.id || !copySourceBranchId || copySubmitting || copySelectedItemIds.length === 0}
              >
                {copySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                {copySubmitting ? "Copying…" : `Copy to ${currentBranch?.name || "this branch"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
