import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import ViewToggle from "../../components/ui/ViewToggle";
import ActionDropdown from "../../components/ui/ActionDropdown";
import {
  getMenu,
  getInventory,
  createItem,
  updateItem,
  deleteItem,
  uploadImage,
  getStoredAuth,
  getSourceBranchMenu,
  copyMenuFromBranch,
  updateBranchMenuItem,
  getCurrencySymbol,
} from "../../lib/apiClient";
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Upload, Link, Loader2, X, ShoppingBag, Copy, Flame, Star, FileDown, FileText, Printer, ChevronDown, Search, Building2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useDropdown } from "../../hooks/useDropdown";
import { handleAsyncAction } from "../../utils/toastActions";
import toast from "react-hot-toast";

const isAdminRole = (role) => role === "restaurant_admin" || role === "admin";

const selectBaseCls =
  "h-9 pl-2.5 pr-7 rounded-xl border-2 border-gray-200 bg-white text-xs font-semibold text-gray-700 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300";
const filterSelectCls = `${selectBaseCls} min-w-[7.5rem]`;
const sortSelectCls = `${selectBaseCls} w-[5.75rem] min-w-0 shrink-0`;

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

export default function MenuItemsPage() {
  const sym = getCurrencySymbol();
  const { currentBranch, branches } = useBranch() || {};
  const isAdmin = isAdminRole(getStoredAuth()?.user?.role);
  const sourceBranches = (branches || []).filter((b) => b.id !== currentBranch?.id);
  
  // Fetch menu and inventory data
  const fetchData = async () => {
    const auth = getStoredAuth();
    const restaurantId = auth?.user?.restaurantId;
    
    // Always use the admin endpoint so unavailable items are included and can be re-enabled.
    // getBranchMenu uses the public /by-category endpoint which strips unavailable items.
    const menuData = await getMenu(currentBranch?.id);
    
    const inv = await getInventory();
    
    return {
      categories: menuData.categories || [],
      items: menuData.items || [],
      inventoryItems: inv || []
    };
  };
  
  const { data, loading: pageLoading, error, suspended, setData, refetch } = usePageData(fetchData, [currentBranch?.id]);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }
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
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAvailability, setFilterAvailability] = useState("all");
  const [filterDietary, setFilterDietary] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const exportMenuRef = useRef(null);
  const importMenuRef = useRef(null);
  const filtersRef = useRef(null);
  const fileInputRef = useRef(null);
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
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeAddOpen, setRecipeAddOpen] = useState(false);
  const [recipeAddSearch, setRecipeAddSearch] = useState("");

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceBranchId, setCopySourceBranchId] = useState("");
  const [copySourceData, setCopySourceData] = useState(null);
  const [copySourceLoading, setCopySourceLoading] = useState(false);
  const [copySelectedItemIds, setCopySelectedItemIds] = useState([]);
  const [copySubmitting, setCopySubmitting] = useState(false);

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleDown(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!importMenuOpen) return;
    function handleDown(e) {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) {
        setImportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [importMenuOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    function handleDown(e) {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [filtersOpen]);

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
          const newAvailable = !(item.finalAvailable ?? item.available ?? true);
          await updateItem(item.id, { available: newAvailable });
          setData(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === item.id
              ? { ...i, available: newAvailable, finalAvailable: newAvailable }
              : i
            )
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
    setRecipeSearch("");
    setRecipeAddOpen(false);
    setRecipeAddSearch("");
  }

  function removeConsumption(inventoryItemId) {
    setRecipeDialog(prev => ({
      ...prev,
      consumptions: prev.consumptions.filter(c => c.inventoryItemId !== inventoryItemId)
    }));
    setRecipeUnits(prev => {
      const next = { ...prev };
      delete next[inventoryItemId];
      return next;
    });
  }

  function addIngredient(inv) {
    const alreadyAdded = recipeDialog.consumptions.some(c => c.inventoryItemId === inv.id);
    if (!alreadyAdded) {
      const displayUnit = SUB_UNITS[inv.unit] ? SUB_UNITS[inv.unit] : null;
      if (displayUnit) setRecipeUnits(prev => ({ ...prev, [inv.id]: displayUnit }));
      setRecipeDialog(prev => ({
        ...prev,
        consumptions: [...prev.consumptions, { inventoryItemId: inv.id, quantity: "" }]
      }));
    }
    setRecipeAddOpen(false);
    setRecipeAddSearch("");
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

  const filtered = items
    .filter(item => {
      const term = search.trim().toLowerCase();
      if (term) {
        const category = categories.find(c => c.id === item.categoryId);
        const matches =
          item.name.toLowerCase().includes(term) ||
          (item.description || "").toLowerCase().includes(term) ||
          (category?.name || "").toLowerCase().includes(term) ||
          String(item.price).includes(term);
        if (!matches) return false;
      }
      if (filterCategory !== "all" && item.categoryId !== filterCategory) return false;
      if (filterAvailability === "available" && !(item.finalAvailable ?? item.available ?? true)) return false;
      if (filterAvailability === "unavailable" && (item.finalAvailable ?? item.available ?? true)) return false;
      if (filterDietary !== "all" && (item.dietaryType || "non_veg") !== filterDietary) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name_asc")   return a.name.localeCompare(b.name);
      if (sortBy === "name_desc")  return b.name.localeCompare(a.name);
      if (sortBy === "price_asc")  return (a.finalPrice ?? a.price ?? 0) - (b.finalPrice ?? b.price ?? 0);
      if (sortBy === "price_desc") return (b.finalPrice ?? b.price ?? 0) - (a.finalPrice ?? a.price ?? 0);
      return 0;
    });

  // ─── Export helpers ──────────────────────────────────────────────────────────

  function toCSVRow(cells) {
    return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
  }

  function exportCSV() {
    const date = new Date().toLocaleDateString("en-PK");
    const branchName = currentBranch?.name || "All Branches";
    const rows = [
      ["Menu Items Report"],
      ["Branch", branchName],
      ["Generated", date],
      [],
      ["Name", "Category", "Price", "Dietary", "Status", "Trending", "Must Try"],
      ...filtered.map((item) => {
        const cat = categories.find((c) => c.id === item.categoryId)?.name || "Uncategorized";
        const price = item.finalPrice ?? item.price ?? 0;
        const available = (item.finalAvailable ?? item.available ?? true) ? "Enabled" : "Disabled";
        const dietary = item.dietaryType === "veg" ? "Veg" : item.dietaryType === "vegan" ? "Vegan" : "Non-Veg";
        return [item.name, cat, price, dietary, available, item.isTrending ? "Yes" : "No", item.isMustTry ? "Yes" : "No"];
      }),
      [],
      ["SUMMARY"],
      ["Total Items", filtered.length],
      ["Enabled", filtered.filter((i) => (i.finalAvailable ?? i.available ?? true)).length],
      ["Disabled", filtered.filter((i) => !(i.finalAvailable ?? i.available ?? true)).length],
    ];
    const content = rows.map(toCSVRow).join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menu-items-${branchName.replace(/\s/g, "-")}-${date.replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported — open in Excel");
    setExportMenuOpen(false);
  }

  function buildMenuHTML(title, extraStyle = "") {
    const date = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
    const branchName = currentBranch?.name || "All Branches";
    const availableCount   = filtered.filter((i) => (i.finalAvailable ?? i.available ?? true)).length;
    const unavailableCount = filtered.length - availableCount;

    const itemRows = filtered.map((item) => {
      const cat = categories.find((c) => c.id === item.categoryId)?.name || "Uncategorized";
      const price = item.finalPrice ?? item.price ?? 0;
      const available = (item.finalAvailable ?? item.available ?? true);
      const dietary = item.dietaryType === "veg" ? "Veg" : item.dietaryType === "vegan" ? "Vegan" : "Non-Veg";
      const availStyle = available
        ? "background:#f0fdf4;color:#16a34a;"
        : "background:#fef2f2;color:#dc2626;";
      return `<tr>
        <td><strong>${item.name}</strong>${item.description ? `<br><span style="font-size:11px;color:#6b7280">${item.description}</span>` : ""}</td>
        <td>${cat}</td>
        <td style="font-weight:700">${getCurrencySymbol()} ${Number(price).toLocaleString()}</td>
        <td>${dietary}</td>
        <td><span style="font-weight:700;padding:2px 8px;border-radius:4px;font-size:11px;${availStyle}">${available ? "Enabled" : "Disabled"}</span></td>
      </tr>`;
    }).join("");

    return `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:1000px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .meta{font-size:12px;color:#6b7280;margin-bottom:20px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .stat{border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px}
  .stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px}
  .stat-value{font-size:22px;font-weight:800}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:8px 12px;border-bottom:2px solid #e5e7eb}
  td{padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;vertical-align:middle}
  tr:hover td{background:#fafafa}
  ${extraStyle}
  @media print{body{padding:0}button{display:none}}
</style></head><body>
<h1>Menu Items Report</h1>
<p class="meta">${branchName} &nbsp;·&nbsp; ${date}</p>
<div class="summary">
  <div class="stat"><div class="stat-label">Total</div><div class="stat-value" style="color:#1d4ed8">${filtered.length}</div></div>
  <div class="stat"><div class="stat-label">Enabled</div><div class="stat-value" style="color:#16a34a">${availableCount}</div></div>
  <div class="stat"><div class="stat-label">Disabled</div><div class="stat-value" style="color:#dc2626">${unavailableCount}</div></div>
</div>
<table>
  <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Dietary</th><th>Status</th></tr></thead>
  <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:32px">No items match current filter</td></tr>'}</tbody>
</table>
</body></html>`;
  }

  function exportPDF() {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups."); return; }
    win.document.write(buildMenuHTML("Menu Items – PDF", "@media print{@page{size:A4 landscape}}"));
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
    setExportMenuOpen(false);
  }

  function printMenu() {
    setExportMenuOpen(false);
    window.print();
  }

  const canImportFromBranch =
    !!currentBranch?.id &&
    (sourceBranches.length > 0 || isAdmin);

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!currentBranch?.id) {
      toast.error("Select a branch in the header before importing.");
      return;
    }
    if (!categories.length) {
      toast.error("Create at least one category before importing menu items.");
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      toast.error("Could not read file");
      return;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim());
    if (!lines.length) {
      toast.error("CSV is empty");
      return;
    }

    const normHeader = (h) =>
      String(h ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const rowLooksLikeHeader = (cells) => {
      const set = new Set(cells.map((c) => normHeader(c)));
      return set.has("name") && set.has("category") && set.has("price");
    };

    const buildColMap = (cells) => {
      const col = {};
      cells.forEach((raw, i) => {
        const k = normHeader(raw);
        if (k === "name" || k === "item") col.name = i;
        else if (k === "category") col.category = i;
        else if (k === "price") col.price = i;
        else if (k === "dietary") col.dietary = i;
        else if (k === "available") col.available = i;
        else if (k === "trending" || k === "is trending") col.trending = i;
        else if (k === "must try" || k === "musttry") col.mustTry = i;
        else if (k === "description") col.description = i;
      });
      return col;
    };

    const isStopRow = (cells) => {
      const a = normHeader(cells[0]);
      return (
        a === "summary" ||
        a === "total items" ||
        a === "available" ||
        a === "unavailable" ||
        a === "menu items report" ||
        a === "branch" ||
        a === "generated"
      );
    };

    let headerIdx = -1;
    let col = null;
    for (let i = 0; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (rowLooksLikeHeader(cells)) {
        headerIdx = i;
        col = buildColMap(cells);
        break;
      }
    }

    if (col == null) {
      col = { name: 0, category: 1, price: 2 };
      headerIdx = -1;
    }

    if (col.name == null || col.category == null || col.price == null) {
      toast.error(
        "CSV needs columns: name, category, price (or export from this page).",
      );
      return;
    }

    const dataStart = headerIdx < 0 ? 0 : headerIdx + 1;
    const rows = [];
    for (let i = dataStart; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (!cells.some((c) => String(c).trim())) continue;
      if (isStopRow(cells)) break;
      const name = String(cells[col.name] ?? "").trim();
      if (!name) continue;
      rows.push({
        name,
        categoryLabel: String(cells[col.category] ?? "").trim(),
        priceRaw: cells[col.price],
        dietaryRaw: col.dietary != null ? cells[col.dietary] : undefined,
        availableRaw: col.available != null ? cells[col.available] : undefined,
        trendingRaw: col.trending != null ? cells[col.trending] : undefined,
        mustTryRaw: col.mustTry != null ? cells[col.mustTry] : undefined,
        description:
          col.description != null
            ? String(cells[col.description] ?? "").trim()
            : "",
      });
    }

    if (!rows.length) {
      toast.error("No menu item rows found in CSV");
      return;
    }

    const parseDietaryCell = (s) => {
      const t = String(s ?? "")
        .trim()
        .toLowerCase();
      if (!t) return "non_veg";
      if (t === "veg" || t === "vegetarian") return "veg";
      if (t === "vegan") return "veg";
      if (t === "egg") return "egg";
      if (t === "non-veg" || t === "non veg" || t === "non_veg") return "non_veg";
      return "non_veg";
    };

    const parseYesNoCell = (s) => {
      const t = String(s ?? "").trim().toLowerCase();
      return t === "yes" || t === "true" || t === "1" || t === "y";
    };

    const parsePriceCell = (raw) => {
      let t = String(raw ?? "").trim().replace(/,/g, "");
      if (sym) {
        const esc = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        t = t.replace(new RegExp(esc, "g"), "").trim();
      }
      const n = parseFloat(t);
      return Number.isFinite(n) && n >= 0 ? n : NaN;
    };

    const catByLower = new Map(
      categories.map((c) => [c.name.trim().toLowerCase(), c]),
    );
    const existingNames = new Set(
      items.map((it) => (it.name || "").trim().toLowerCase()),
    );

    setImportLoading(true);
    const newItems = [];
    let created = 0;
    let skipped = 0;
    const failReasons = [];

    try {
      for (const row of rows) {
        const key = row.name.toLowerCase();
        if (existingNames.has(key)) {
          skipped++;
          continue;
        }
        const cat = catByLower.get(row.categoryLabel.toLowerCase());
        if (!cat) {
          skipped++;
          failReasons.push(`Unknown category “${row.categoryLabel}” (${row.name})`);
          continue;
        }
        const price = parsePriceCell(row.priceRaw);
        if (Number.isNaN(price)) {
          skipped++;
          failReasons.push(`Invalid price (${row.name})`);
          continue;
        }
        try {
          const createdItem = await createItem({
            name: row.name,
            price,
            categoryId: cat.id,
            dietaryType: parseDietaryCell(row.dietaryRaw),
            description: row.description || "",
            isTrending:
              row.trendingRaw !== undefined && row.trendingRaw !== ""
                ? parseYesNoCell(row.trendingRaw)
                : false,
            isMustTry:
              row.mustTryRaw !== undefined && row.mustTryRaw !== ""
                ? parseYesNoCell(row.mustTryRaw)
                : false,
            branchId: currentBranch.id,
          });
          existingNames.add(key);
          let merged = createdItem;
          if (
            row.availableRaw !== undefined &&
            row.availableRaw !== "" &&
            !parseYesNoCell(row.availableRaw)
          ) {
            await updateBranchMenuItem(createdItem.id, { available: false });
            merged = {
              ...createdItem,
              finalAvailable: false,
              branchAvailable: false,
            };
          }
          newItems.push(merged);
          created++;
        } catch (err) {
          skipped++;
          const msg = err?.message || String(err);
          if (/already exists/i.test(msg)) existingNames.add(key);
          failReasons.push(`${row.name}: ${msg}`);
        }
      }
    } finally {
      setImportLoading(false);
    }

    if (newItems.length) {
      setData((prev) => ({
        ...prev,
        items: [...prev.items, ...newItems],
      }));
    }

    if (created > 0) {
      toast.success(
        `Imported ${created} item${created === 1 ? "" : "s"}${
          skipped ? ` · ${skipped} skipped` : ""
        }`,
      );
      if (failReasons.length) {
        toast(failReasons.slice(0, 3).join(" · "), { duration: 5000 });
      }
    } else if (skipped > 0) {
      toast.error(
        failReasons.length
          ? failReasons.slice(0, 2).join(" · ") +
              (failReasons.length > 2 ? " …" : "")
          : "No rows imported (duplicates or invalid data).",
      );
    } else {
      toast.error("Nothing to import");
    }
  }

  return (
    <AdminLayout title="Menu Items" suspended={suspended}>
      <style>{`@media print { .menu-items-no-print { display: none !important; } }`}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFile}
      />
      {error && !pageLoading && (
        <div className="menu-items-no-print mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Toolbar: search grows; filters + view + export + import + add */}
      <div className="menu-items-no-print mb-6 flex w-full min-w-0 flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="menu-items-search">
          Search menu items
        </label>
        <div className="relative min-w-0 w-full flex-1 basis-full sm:basis-0 sm:min-w-[12rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="menu-items-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="h-9 w-full rounded-xl border-2 border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          />
        </div>

        {/* Filters dropdown */}
        <div className="relative" ref={filtersRef}>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold transition-all ${
              filtersOpen
                ? "border-primary bg-primary/5 text-primary dark:border-primary dark:bg-primary/10"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            Filters
            {(() => {
              const count = (filterCategory !== "all" ? 1 : 0) + (filterAvailability !== "all" ? 1 : 0) + (filterDietary !== "all" ? 1 : 0);
              return count > 0 ? (
                <span className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white leading-none">
                  {count}
                </span>
              ) : null;
            })()}
            <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </button>

          {filtersOpen && (
            <div className="absolute left-0 top-full z-[100] mt-1.5 w-72 overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Filters &amp; Sort</span>
                {(filterCategory !== "all" || filterAvailability !== "all" || filterDietary !== "all" || sortBy !== "name_asc") && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory("all");
                      setFilterAvailability("all");
                      setFilterDietary("all");
                      setSortBy("name_asc");
                    }}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400"
                  >
                    Reset all
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* Category */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="h-9 w-full rounded-xl border-2 border-gray-200 bg-white pl-2.5 pr-7 text-sm font-medium text-gray-800 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">Status</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[["all", "All"], ["available", "Enabled"], ["unavailable", "Disabled"]].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setFilterAvailability(val)}
                        className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                          filterAvailability === val
                            ? "bg-primary text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dietary */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">Dietary</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[["all", "All"], ["non_veg", "Non-veg"], ["veg", "Veg"], ["vegan", "Vegan"]].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setFilterDietary(val)}
                        className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                          filterDietary === val
                            ? "bg-primary text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">Sort by</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[["name_asc", "A → Z"], ["name_desc", "Z → A"], ["price_asc", "Price ↑"], ["price_desc", "Price ↓"]].map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSortBy(val)}
                        className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                          sortBy === val
                            ? "bg-primary text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(filterCategory !== "all" || filterAvailability !== "all" || filterDietary !== "all" || search.trim()) && (
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCategory("all");
                      setFilterAvailability("all");
                      setFilterDietary("all");
                      setSearch("");
                      setFiltersOpen(false);
                    }}
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-red-50 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    <X className="h-3.5 w-3.5" /> Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || pageLoading}
          title="Refresh"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-gray-200 bg-white text-gray-600 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>

        <span
          className="hidden h-6 w-px bg-gray-200 sm:block dark:bg-neutral-700"
          aria-hidden
        />

        <ViewToggle viewMode={viewMode} onChange={setViewMode} />

        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setExportMenuOpen((v) => !v)}
            disabled={!filtered.length}
            title="Export"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <FileDown className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${exportMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {exportMenuOpen && (
            <div
              className="absolute right-0 top-full z-[100] mt-1.5 w-56 overflow-hidden rounded-xl border-2 border-gray-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={exportCSV}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <FileDown className="h-4 w-4 shrink-0 text-gray-400" />
                Download CSV
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={exportPDF}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                Export PDF…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={printMenu}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <Printer className="h-4 w-4 shrink-0 text-gray-400" />
                Print
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={importMenuRef}>
          <button
            type="button"
            onClick={() => setImportMenuOpen((o) => !o)}
            disabled={importLoading || !currentBranch?.id}
            title={
              !currentBranch?.id
                ? "Select a branch in the header first"
                : "Import menu items"
            }
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {importLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 shrink-0" />
            )}
            <span className="hidden sm:inline">Import</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${importMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {importMenuOpen && (
            <div
              className="absolute right-0 top-full z-[100] mt-1.5 w-56 overflow-hidden rounded-xl border-2 border-gray-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!canImportFromBranch}
                title={
                  !canImportFromBranch
                    ? "No other branches available"
                    : undefined
                }
                onClick={() => {
                  setImportMenuOpen(false);
                  setCopySourceBranchId("");
                  setCopyModalOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                Import from a branch
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!currentBranch?.id || importLoading}
                onClick={() => {
                  setImportMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <Upload className="h-4 w-4 shrink-0 text-gray-400" />
                Upload from device
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-primary to-secondary px-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add item</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {pageLoading ? (
        <div className="menu-items-no-print bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <ShoppingBag className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                Loading menu items...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full min-w-0 overflow-x-hidden">

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
                    className={`bg-white dark:bg-neutral-950 border rounded-xl p-5 hover:shadow-lg transition-all relative min-w-0 ${
                      isAvailable
                        ? "border-gray-200 dark:border-neutral-800 hover:border-primary/30"
                        : "border-gray-200 dark:border-neutral-800 opacity-60"
                    }`}
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
                        <div className="font-bold text-gray-900 dark:text-white">{sym} {displayPrice?.toFixed(0)}</div>
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
                            <span className="text-emerald-600 dark:text-emerald-400">Enabled</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-500">Disabled</span>
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
                    <div className="font-bold text-gray-900 dark:text-white">{sym} {displayPrice?.toFixed(0)}</div>
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
                        <span className="text-emerald-600 dark:text-emerald-400">Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-500">Disabled</span>
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
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openRecipeDialog(item)}
                      disabled={isDeleting}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                      title="Recipe"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Recipe</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors disabled:opacity-50"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
        <div className="menu-items-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
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
      {recipeDialog.open && (() => {
        const UNIT_DISPLAY = { kg: "gram", liter: "ml", gram: "gram", ml: "ml", piece: "piece" };

        // Ingredients already added to this recipe
        const addedIngredients = recipeDialog.consumptions
          .map(c => {
            const inv = branchFilteredInventoryItems.find(i => i.id === c.inventoryItemId);
            return inv ? { inv, consumption: c } : null;
          })
          .filter(Boolean);

        // Items available to add (not yet in recipe)
        const addedIds = new Set(recipeDialog.consumptions.map(c => c.inventoryItemId));
        const addTerm = recipeAddSearch.trim().toLowerCase();
        const availableToAdd = branchFilteredInventoryItems.filter(inv =>
          !addedIds.has(inv.id) && (!addTerm || inv.name.toLowerCase().includes(addTerm))
        );

        return (
          <div className="menu-items-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col max-h-[85vh]">

              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                      Recipe — {recipeDialog.itemName}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                      Ingredients deducted from stock on each sale.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeRecipeDialog}
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {modalError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                    {modalError}
                  </div>
                )}
              </div>

              {/* Body — added ingredients list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-2">
                {branchFilteredInventoryItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                      <ShoppingBag className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">No inventory items yet</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Create ingredients in the Inventory page first.</p>
                  </div>
                ) : addedIngredients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
                      <Plus className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No ingredients added yet</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Click &ldquo;Add Ingredient&rdquo; below to get started.</p>
                  </div>
                ) : (
                  addedIngredients.map(({ inv, consumption }) => {
                    const displayUnit = recipeUnits[inv.id] || UNIT_DISPLAY[inv.unit] || inv.unit;
                    const canToggle = !!SUB_UNITS[inv.unit];
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800"
                      >
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{inv.name}</p>
                        </div>
                        {/* Quantity input + unit */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={consumption.quantity ?? ""}
                            onChange={e => updateConsumption(inv.id, e.target.value)}
                            placeholder="qty"
                            className="w-20 h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm text-right font-semibold text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                          {canToggle ? (
                            <button
                              type="button"
                              onClick={() => toggleRecipeUnit(inv.id, inv.unit)}
                              className="text-xs font-semibold text-primary hover:underline w-8 text-left"
                            >
                              {displayUnit}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 w-8">{displayUnit}</span>
                          )}
                        </div>
                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeConsumption(inv.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}

                {/* Add Ingredient inline picker */}
                {branchFilteredInventoryItems.length > 0 && (
                  <div className="pt-1">
                    {recipeAddOpen ? (
                      <div className="rounded-xl border-2 border-primary/30 bg-white dark:bg-neutral-950 overflow-hidden">
                        {/* Search input */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-neutral-800">
                          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <input
                            autoFocus
                            type="text"
                            value={recipeAddSearch}
                            onChange={e => setRecipeAddSearch(e.target.value)}
                            placeholder="Search ingredient to add..."
                            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
                          />
                          <button
                            type="button"
                            onClick={() => { setRecipeAddOpen(false); setRecipeAddSearch(""); }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Filtered list */}
                        <div className="max-h-48 overflow-y-auto">
                          {availableToAdd.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-center text-gray-400 dark:text-neutral-500">
                              {addTerm ? `No results for "${recipeAddSearch}"` : "All ingredients already added"}
                            </p>
                          ) : (
                            availableToAdd.map(inv => {
                              const displayUnit = UNIT_DISPLAY[inv.unit] || inv.unit;
                              return (
                                <button
                                  key={inv.id}
                                  type="button"
                                  onClick={() => addIngredient(inv)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors text-left"
                                >
                                  <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">{inv.name}</span>
                                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">{displayUnit}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRecipeAddOpen(true)}
                        className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-500 dark:text-neutral-400 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Ingredient
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-3 flex-shrink-0">
                <p className="text-xs text-gray-400 dark:text-neutral-500">
                  {addedIngredients.length} ingredient{addedIngredients.length !== 1 ? "s" : ""} in recipe
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="px-4" onClick={closeRecipeDialog}>
                    Cancel
                  </Button>
                  <Button type="button" className="px-4" onClick={handleSaveRecipe} disabled={branchFilteredInventoryItems.length === 0}>
                    Save recipe
                  </Button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Copy from branch modal */}
      {copyModalOpen && (
        <div className="menu-items-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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
                        <span className="text-xs text-gray-500">{sym} {Number(i.price).toFixed(0)} · {i.sourceBranchName}</span>
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
                        <span className="text-xs text-gray-500">{sym} {Number(i.price).toFixed(0)} · {i.categoryName || ""}</span>
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
