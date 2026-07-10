import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import Button from "../../components/ui/Button";
import AsyncCombobox from "../../components/accounting/AsyncCombobox";
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
  getModifierGroups,
} from "../../lib/apiClient";
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Upload, Link, Loader2, X, ShoppingBag, Copy, Flame, Star, FileDown, FileText, Printer, ChevronDown, ChevronUp, Search, Building2, RefreshCw, SlidersHorizontal, AlertTriangle, Check, Layers } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import { usePermissions } from "../../contexts/PermissionContext";
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

/** Coarse volume label from a product name — used only to warn when recipe SKU size ≠ menu name. */
function normalizeVolumeHint(name) {
  if (!name) return null;
  const s = String(name).toLowerCase().replace(/\s+/g, "");
  if (/1\.5|1,5/.test(s) && /(l|ltr|liter|ml)/.test(s)) return "1.5L";
  if (/1500/.test(s) && /(ml|l)/.test(s)) return "1.5L";
  if (/500ml|0\.5l|0\.5ltr/.test(s)) return "500ml";
  if (/345ml|330ml|375ml|250ml|200ml/.test(s)) return "small";
  if ((/1l(tr)?|1000ml/.test(s) || /\b1l\b/.test(s)) && !/1\.5|1,5/.test(s)) return "1L";
  return null;
}

/**
 * When menu title and inventory row describe different bottle sizes, POS availability follows the
 * linked inventory row — not the menu name. Surfaces hints so mis-linked recipes (e.g. 1L item → 1.5L SKU) are obvious.
 */
function getRecipeVolumeMismatchHints(menuName, ingredientNames) {
  const menuHint = normalizeVolumeHint(menuName);
  if (!menuHint || !ingredientNames?.length) return [];
  const seen = new Set();
  const hints = [];
  for (const ing of ingredientNames) {
    const ih = normalizeVolumeHint(ing);
    if (!ih || ih === menuHint) continue;
    const key = `${ih}:${ing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hints.push(
      `Ingredient "${ing}" looks like ${ih}, but this menu item is named like ${menuHint}. POS stock checks use the ingredient row — pick the inventory SKU that matches where you count bottles.`
    );
  }
  return hints;
}

const VARIATION_SUGGESTIONS = {
  size: [
    "Small",
    "Regular",
    "Medium",
    "Large",
    "Extra Large",
    "Party Size",
    "Half",
    "Full",
    "Mini",
  ],
  drink: [
    "Regular",
    "500ml",
    "1 Liter",
    "1.5 Liter",
    "2 Liter",
    "Pepsi",
    "7Up",
    "Mirinda",
    "Mountain Dew",
    "Cola Next",
    "Fizup",
    "Rango",
  ],
  topping: [
    "Chicken",
    "Beef",
    "Cheese",
    "Extra Cheese",
    "Mushroom",
    "Olives",
    "Jalapeño",
    "Onion",
    "Capsicum",
  ],
  crust: ["Thin Crust", "Thick Crust", "Stuffed Crust", "Cheese Crust"],
  sauce: [
    "Ketchup",
    "Mayo",
    "Garlic Sauce",
    "White Sauce",
    "BBQ Sauce",
    "Hot Sauce",
    "Chilli Garlic",
    "Tahini",
  ],
  spice: ["Mild", "Medium", "Spicy", "Extra Spicy"],
  default: [
    "Small",
    "Regular",
    "Medium",
    "Large",
    "Extra Large",
    "Half",
    "Full",
    "With Salad",
    "Without Salad",
    "Extra",
    "Special",
  ],
};

const GROUP_NAME_SUGGESTIONS = [
  "Choose Your Size",
  "Choose Your Variation",
  "Choose Your Drink",
  "Extra Toppings",
  "Choose Your Crust",
  "Choose Your Sauce",
  "Choose Your Spice Level",
  "Add-ons",
];

function getSuggestionsForGroup(groupName) {
  const name = (groupName || "").toLowerCase();
  if (
    name.includes("drink") ||
    name.includes("beverage") ||
    name.includes("flavour") ||
    name.includes("flavor")
  ) {
    return VARIATION_SUGGESTIONS.drink;
  }
  if (name.includes("topping") || name.includes("extra")) {
    return VARIATION_SUGGESTIONS.topping;
  }
  if (name.includes("crust")) {
    return VARIATION_SUGGESTIONS.crust;
  }
  if (name.includes("sauce") || name.includes("dip")) {
    return VARIATION_SUGGESTIONS.sauce;
  }
  if (name.includes("spice") || name.includes("spicy")) {
    return VARIATION_SUGGESTIONS.spice;
  }
  if (
    name.includes("size") ||
    name.includes("variation") ||
    name.includes("portion")
  ) {
    return VARIATION_SUGGESTIONS.size;
  }
  return VARIATION_SUGGESTIONS.default;
}

function hasCategorySubcategories(categories) {
  return (categories || []).some((c) => c.parentId);
}

function buildCategoryComboboxOptions(categories) {
  const list = categories || [];
  const topLevel = list.filter((c) => !c.parentId);
  if (!hasCategorySubcategories(list)) {
    return topLevel.map((cat) => ({
      id: cat.id,
      name: cat.name,
      label: cat.name,
    }));
  }
  const options = [];
  for (const cat of topLevel) {
    const children = list.filter((c) => c.parentId === cat.id);
    if (children.length > 0) {
      for (const sub of children) {
        options.push({
          id: sub.id,
          name: sub.name,
          label: `${cat.name} › ${sub.name}`,
        });
      }
    } else {
      options.push({ id: cat.id, name: cat.name, label: cat.name });
    }
  }
  return options;
}

function SuggestionPopover({ anchorEl, open, children }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorEl]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[200]">
      <div
        className="pointer-events-auto absolute max-h-[120px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function MenuItemsPage() {
  const sym = getCurrencySymbol();
  const { currentBranch, branches } = useBranch() || {};
  const { hasPermission } = usePermissions();
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
    isMustTry: false,
    hasModifiers: false,
    modifierGroups: [],
    attachedModifierGroupIds: [],
  });

  const fetchCategoryOptions = useCallback(
    async (query) => {
      const opts = buildCategoryComboboxOptions(categories);
      const needle = String(query || "").trim().toLowerCase();
      if (!needle) return opts;
      return opts.filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          o.name.toLowerCase().includes(needle),
      );
    },
    [categories],
  );

  const selectedCategoryObj = useMemo(() => {
    if (!form.categoryId) return null;
    return (
      buildCategoryComboboxOptions(categories).find((o) => o.id === form.categoryId) ||
      null
    );
  }, [form.categoryId, categories]);

  const [availableModifierGroups, setAvailableModifierGroups] = useState([]);

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
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [focusedOptionKey, setFocusedOptionKey] = useState(null);
  const [focusedGroupIndex, setFocusedGroupIndex] = useState(null);
  const [groupNameAnchor, setGroupNameAnchor] = useState(null);
  const [optionNameAnchor, setOptionNameAnchor] = useState(null);

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

  useEffect(() => {
    if (!isModalOpen) return;
    getModifierGroups()
      .then((list) => setAvailableModifierGroups(list.filter((g) => g.isActive !== false)))
      .catch(() => setAvailableModifierGroups([]));
  }, [isModalOpen]);


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
      isMustTry: false,
      hasModifiers: false,
      modifierGroups: [],
      attachedModifierGroupIds: [],
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
      isMustTry: item.isMustTry ?? false,
      hasModifiers: item.hasModifiers || false,
      modifierGroups: item.modifierGroups || [],
      attachedModifierGroupIds: (item.attachedModifierGroups || []).map((g) =>
        typeof g === "object" ? g.id : g,
      ),
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
    if (!form.hasModifiers && !form.price) { 
      setModalError("Price is required"); 
      toast.error("Price is required");
      return; 
    }
    if (form.hasModifiers) {
      if (form.modifierGroups.length === 0) {
        const msg = 'Add at least one modifier group (e.g. Choose Your Size)';
        setModalError(msg); toast.error(msg); return;
      }
      if (form.modifierGroups.some(g => !g.groupName.trim())) {
        const msg = 'All modifier groups need a name';
        setModalError(msg); toast.error(msg); return;
      }
      if (form.modifierGroups.some(g => (g.options || []).length < 2)) {
        const msg = 'Each modifier group needs at least 2 options';
        setModalError(msg); toast.error(msg); return;
      }
      if (form.modifierGroups.some(g => (g.options || []).some(o => !o.name.trim()))) {
        const msg = 'All modifier options need a name';
        setModalError(msg); toast.error(msg); return;
      }
      if (form.modifierGroups.some(g => (g.options || []).some(o => Number(o.price) < 0))) {
        const msg = 'Option prices cannot be negative';
        setModalError(msg); toast.error(msg); return;
      }
      if (!form.modifierGroups.some(g => g.required)) {
        const msg = 'At least one group must be marked as Required';
        setModalError(msg); toast.error(msg); return;
      }
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
        const modifierPayload = {
          hasModifiers: form.hasModifiers,
          modifierGroups: form.hasModifiers
            ? form.modifierGroups.map((g, gi) => ({
                groupName: g.groupName,
                required: g.required,
                maxSelections: g.maxSelections || 1,
                sortOrder: gi,
                options: (g.options || []).map((o, oi) => ({
                  name: o.name,
                  price: Number(o.price) || 0,
                  isAvailable: o.isAvailable !== false,
                  sortOrder: oi,
                })),
              }))
            : [],
          attachedModifierGroupIds: form.attachedModifierGroupIds || [],
        };
        if (form.id) {
          const updated = await updateItem(form.id, {
            name: form.name,
            ...(form.hasModifiers ? {} : { price: parseFloat(form.price) }),
            categoryId: form.categoryId,
            dietaryType: form.dietaryType,
            imageUrl: form.imageUrl,
            description: form.description,
            availableAtAllBranches: form.availableAtAllBranches,
            isTrending: form.isTrending,
            isMustTry: form.isMustTry,
            ...modifierPayload,
          });
          setData(prev => ({
            ...prev,
            items: prev.items.map(i => (i.id === updated.id ? updated : i))
          }));
          return updated;
        } else {
          const created = await createItem({
            name: form.name,
            ...(form.hasModifiers ? {} : { price: parseFloat(form.price) }),
            categoryId: form.categoryId,
            dietaryType: form.dietaryType,
            imageUrl: form.imageUrl,
            description: form.description,
            availableAtAllBranches: form.availableAtAllBranches,
            isTrending: form.isTrending,
            isMustTry: form.isMustTry,
            ...(currentBranch?.id && { branchId: currentBranch.id }),
            ...modifierPayload,
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

    if (deleted > 0) {
      toast.success(`Deleted ${deleted} selected item${deleted === 1 ? "" : "s"}`);
    }
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
        setSelectedItemIds((prev) => prev.filter((x) => x !== id));
      },
      {
        loading: "Deleting menu item...",
        success: "Menu item deleted successfully",
        error: "Failed to delete menu item"
      }
    );
    
    setDeletingId(null);
  }

  const RECIPE_UNIT_OPTIONS = [
    { value: "gram", label: "gram" },
    { value: "kilogram", label: "kilogram" },
    { value: "milliliter", label: "milliliter" },
    { value: "liter", label: "liter" },
    { value: "piece", label: "piece" },
    { value: "dozen", label: "dozen" },
  ];

  function normalizeUnit(unit) {
    const u = String(unit || "").trim().toLowerCase();
    if (u === "g" || u === "gram") return "gram";
    if (u === "kg" || u === "kilogram") return "kilogram";
    if (u === "ml" || u === "milliliter") return "milliliter";
    if (u === "l" || u === "liter") return "liter";
    if (u === "pc" || u === "pcs" || u === "piece") return "piece";
    if (u === "dozen") return "dozen";
    return u;
  }

  function suggestRecipeUnit(invUnitRaw) {
    const invUnit = normalizeUnit(invUnitRaw);
    if (invUnit === "gram" || invUnit === "kilogram") return "gram";
    if (invUnit === "milliliter" || invUnit === "liter") return "milliliter";
    return "piece";
  }

  function openRecipeDialog(item) {
    const existing = (item.inventoryConsumptions || []).map(c => ({
      inventoryItemId: c.inventoryItem,
      quantity: String(c.quantity ?? ""),
      unit: normalizeUnit(c.unit || "")
    }));
    const displayConsumptions = existing.map(c => {
      const inv = inventoryItems.find(i => i.id === c.inventoryItemId);
      return {
        ...c,
        unit: c.unit || suggestRecipeUnit(inv?.unit),
      };
    });

    setModalError("");
    setRecipeDialog({ open: true, itemId: item.id, itemName: item.name, consumptions: displayConsumptions });
  }

  function closeRecipeDialog() {
    setRecipeDialog(prev => ({ ...prev, open: false }));
    setRecipeSearch("");
    setRecipeAddOpen(false);
    setRecipeAddSearch("");
  }

  function removeConsumption(inventoryItemId) {
    setRecipeDialog(prev => ({
      ...prev,
      consumptions: prev.consumptions.filter(c => c.inventoryItemId !== inventoryItemId)
    }));
  }

  function addIngredient(inv) {
    const alreadyAdded = recipeDialog.consumptions.some(c => c.inventoryItemId === inv.id);
    if (!alreadyAdded) {
      setRecipeDialog(prev => ({
        ...prev,
        consumptions: [...prev.consumptions, { inventoryItemId: inv.id, quantity: "", unit: suggestRecipeUnit(inv.unit) }]
      }));
    }
    setRecipeAddOpen(false);
    setRecipeAddSearch("");
  }

  function updateConsumption(inventoryItemId, patch) {
    setRecipeDialog(prev => {
      const existing = prev.consumptions.find(c => c.inventoryItemId === inventoryItemId);
      if (!existing) {
        return { ...prev, consumptions: [...prev.consumptions, { inventoryItemId, quantity: "", unit: "gram", ...patch }] };
      }
      return {
        ...prev,
        consumptions: prev.consumptions.map(c =>
          c.inventoryItemId === inventoryItemId ? { ...c, ...patch } : c
        )
      };
    });
  }

  // ─── Modifier group helpers ───────────────────────────────────────────────────

  function addGroup() {
    setForm(prev => ({
      ...prev,
      modifierGroups: [
        ...prev.modifierGroups,
        {
          id: Date.now().toString(),
          groupName: '',
          required: true,
          maxSelections: 1,
          sortOrder: prev.modifierGroups.length,
          options: [],
        },
      ],
    }));
  }

  function removeGroup(groupIndex) {
    setForm(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.filter((_, i) => i !== groupIndex),
    }));
  }

  function updateGroup(groupIndex, field, value) {
    setForm(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map((g, i) =>
        i === groupIndex ? { ...g, [field]: value } : g
      ),
    }));
  }

  function moveGroup(groupIndex, direction) {
    setForm(prev => {
      const groups = [...prev.modifierGroups];
      const target = groupIndex + direction;
      if (target < 0 || target >= groups.length) return prev;
      [groups[groupIndex], groups[target]] = [groups[target], groups[groupIndex]];
      return { ...prev, modifierGroups: groups };
    });
  }

  function addOption(groupIndex) {
    setForm(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map((g, i) => {
        if (i !== groupIndex) return g;
        return {
          ...g,
          options: [
            ...(g.options || []),
            {
              id: Date.now().toString(),
              name: '',
              price: 0,
              isAvailable: true,
              sortOrder: (g.options || []).length,
            },
          ],
        };
      }),
    }));
  }

  function removeOption(groupIndex, optionIndex) {
    setForm(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map((g, i) => {
        if (i !== groupIndex) return g;
        return { ...g, options: (g.options || []).filter((_, oi) => oi !== optionIndex) };
      }),
    }));
  }

  function updateOption(groupIndex, optionIndex, field, value) {
    setForm(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map((g, i) => {
        if (i !== groupIndex) return g;
        return {
          ...g,
          options: (g.options || []).map((o, oi) =>
            oi === optionIndex ? { ...o, [field]: value } : o
          ),
        };
      }),
    }));
  }

  function moveOption(groupIndex, optionIndex, direction) {
    setForm(prev => ({
      ...prev,
      modifierGroups: prev.modifierGroups.map((g, i) => {
        if (i !== groupIndex) return g;
        const opts = [...(g.options || [])];
        const target = optionIndex + direction;
        if (target < 0 || target >= opts.length) return g;
        [opts[optionIndex], opts[target]] = [opts[target], opts[optionIndex]];
        return { ...g, options: opts };
      }),
    }));
  }

  async function handleSaveRecipe() {
    if (!recipeDialog.itemId) return;
    setModalError("");
    
    const result = await handleAsyncAction(
      async () => {
        const payloadConsumptions = recipeDialog.consumptions
          .map(c => {
            const rawQty = Number(c.quantity || "0");
            const id = c.inventoryItemId != null ? String(c.inventoryItemId).trim() : "";
            const unit = normalizeUnit(c.unit) || "gram";
            return { inventoryItemId: id || undefined, quantity: parseFloat(rawQty.toFixed(6)), unit };
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

  const selectedItems = filtered.filter((item) => selectedItemIds.includes(item.id));
  const allVisibleSelected = filtered.length > 0 && selectedItemIds.length === filtered.length;

  useEffect(() => {
    const visibleIds = new Set(filtered.map((item) => item.id));
    setSelectedItemIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [filtered]);

  function toggleItemSelection(id) {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllVisible() {
    setSelectedItemIds((prev) => {
      if (allVisibleSelected) return [];
      const visible = filtered.map((item) => item.id);
      return visible;
    });
  }

  // ─── Export helpers ──────────────────────────────────────────────────────────

  function toCSVRow(cells) {
    return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
  }

  function exportCSV(targetItems = filtered) {
    const date = new Date().toLocaleDateString("en-PK");
    const branchName = currentBranch?.name || "All Branches";
    const rows = [
      ["Menu Items Report"],
      ["Branch", branchName],
      ["Generated", date],
      [],
      ["Name", "Category", "Price", "Dietary", "Status", "Trending", "Must Try"],
      ...targetItems.map((item) => {
        const cat = categories.find((c) => c.id === item.categoryId)?.name || "Uncategorized";
        const price = item.finalPrice ?? item.price ?? 0;
        const available = (item.finalAvailable ?? item.available ?? true) ? "Enabled" : "Disabled";
        const dietary = item.dietaryType === "veg" ? "Veg" : item.dietaryType === "vegan" ? "Vegan" : "Non-Veg";
        return [item.name, cat, price, dietary, available, item.isTrending ? "Yes" : "No", item.isMustTry ? "Yes" : "No"];
      }),
      [],
      ["SUMMARY"],
      ["Total Items", targetItems.length],
      ["Enabled", targetItems.filter((i) => (i.finalAvailable ?? i.available ?? true)).length],
      ["Disabled", targetItems.filter((i) => !(i.finalAvailable ?? i.available ?? true)).length],
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

  async function handleBulkDelete() {
    if (!selectedItemIds.length) return;
    const ok = await confirm({
      title: "Delete selected menu items",
      message: `Delete ${selectedItemIds.length} selected item(s)? This cannot be undone.`,
    });
    if (!ok) return;

    const selectedSet = new Set(selectedItemIds);
    const targets = items.filter((item) => selectedSet.has(item.id));
    let deleted = 0;
    let failed = 0;

    await handleAsyncAction(
      async () => {
        for (const item of targets) {
          try {
            await deleteItem(item.id);
            deleted++;
          } catch {
            failed++;
          }
        }
        setData((prev) => ({
          ...prev,
          items: prev.items.filter((i) => !selectedSet.has(i.id)),
        }));
        setSelectedItemIds([]);
      },
      {
        loading: "Deleting selected menu items...",
        success: `Deleted ${deleted} item(s)${failed ? `, ${failed} failed` : ""}`,
        error: "Failed to delete selected items",
      }
    );
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
      <PermissionGate permission="menu.manage">
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

        <button
          type="button"
          onClick={toggleSelectAllVisible}
          disabled={!filtered.length}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          title="Select all visible items"
        >
          {allVisibleSelected ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
          <span className="hidden sm:inline">{allVisibleSelected ? "Clear selection" : "Select all"}</span>
        </button>

        {selectedItemIds.length > 0 && (
          <>
            <span className="inline-flex h-9 items-center rounded-xl bg-primary/10 px-3 text-xs font-semibold text-primary">
              {selectedItemIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => exportCSV(selectedItems)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <FileDown className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Export selected</span>
            </button>
            {hasPermission("menu.manage") && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 px-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Delete selected</span>
            </button>
            )}
          </>
        )}

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
                onClick={() => exportCSV()}
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

        {hasPermission("menu.manage") && (
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-primary to-secondary px-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add item</span>
          <span className="sm:hidden">Add</span>
        </button>
        )}
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
                const isSelected = selectedItemIds.includes(item.id);
                
                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-neutral-950 border rounded-xl p-5 hover:shadow-lg transition-all relative min-w-0 ${
                      isAvailable
                        ? "border-gray-200 dark:border-neutral-800 hover:border-primary/30"
                        : "border-gray-200 dark:border-neutral-800 opacity-60"
                    }`}
                  >
                    <label className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 dark:bg-neutral-900/90">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
                      />
                    </label>
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
                          ...(hasPermission("menu.manage")
                            ? [
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
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                    
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                      {item.hasModifiers && (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-[10px] font-medium text-gray-500 dark:text-neutral-400">Variations</span>
                      )}
                    </div>
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
                        <div className="font-bold text-gray-900 dark:text-white">
                          {sym} {displayPrice?.toFixed(0)}{item.hasModifiers ? '+' : ''}
                        </div>
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
        <>
        <DataTable
          variant="card"
          columns={[
            {
              key: "select",
              header: (
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
                />
              ),
              render: (_, item) => (
                <input
                  type="checkbox"
                  checked={selectedItemIds.includes(item.id)}
                  onChange={() => toggleItemSelection(item.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
                />
              ),
            },
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</span>
                      {item.hasModifiers && (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-[10px] font-medium text-gray-500 dark:text-neutral-400">Variations</span>
                      )}
                    </div>
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
                    <div className="font-bold text-gray-900 dark:text-white">
                      {sym} {displayPrice?.toFixed(0)}{item.hasModifiers ? '+' : ''}
                    </div>
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
              key: "recipe",
              header: "Recipe",
              align: "center",
              render: (_, item) => {
                const hasRecipe = Array.isArray(item.inventoryConsumptions) && item.inventoryConsumptions.length > 0;
                if (!hasRecipe) return null;
                return (
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    title="Recipe configured"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                );
              }
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
                    {hasPermission("menu.manage") && (
                    <>
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
                    </>
                    )}
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
        <p className="mt-3 text-xs text-gray-500 dark:text-neutral-400">
          Showing {filtered.length} items
        </p>
        </>
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
        <>
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
              {/* Price — hidden when hasModifiers is true */}
              {!form.hasModifiers ? (
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
              ) : (
                <div className="space-y-1">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Starting price</label>
                  <div className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-xs text-gray-500 dark:text-neutral-400">
                    {(() => {
                      const rg = form.modifierGroups.filter(g => g.required);
                      const prices = rg.flatMap(g => (g.options || []).map(o => Number(o.price) || 0));
                      return prices.length > 0 ? `Starting from Rs ${Math.min(...prices)}` : 'Starting from Rs \u2014';
                    })()}
                  </div>
                </div>
              )}

              {/* Modifier toggle + builder */}
              <div className="border-t border-gray-100 dark:border-neutral-800 pt-3 mt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-gray-700 dark:text-neutral-300">This item has variations or add-ons</span>
                    {!form.hasModifiers && (
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">e.g. sizes (Small/Large) or optional toppings</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      hasModifiers: !prev.hasModifiers,
                      modifierGroups: prev.hasModifiers ? [] : prev.modifierGroups,
                    }))}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      form.hasModifiers ? 'bg-primary' : 'bg-gray-200 dark:bg-neutral-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ${
                        form.hasModifiers ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Choice groups builder */}
              {form.hasModifiers && (
                <div className="space-y-2 overflow-visible">
                  {form.modifierGroups.map((group, gi) => (
                    <div
                      key={group.id || gi}
                      className="overflow-visible rounded-xl border border-gray-200 dark:border-neutral-700"
                    >
                      {/* Group header */}
                      <div className="flex items-center gap-2 rounded-t-xl px-3 py-2 bg-gray-50 dark:bg-neutral-800/60">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wide w-4 flex-shrink-0">
                          {gi + 1}
                        </span>
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="text"
                            value={group.groupName}
                            onChange={e =>
                              updateGroup(gi, "groupName", e.target.value)
                            }
                            onFocus={(e) => {
                              setFocusedGroupIndex(gi);
                              setGroupNameAnchor(e.currentTarget);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setFocusedGroupIndex(null);
                                setGroupNameAnchor(null);
                              }, 150);
                            }}
                            placeholder="Group name, e.g. Size"
                            className="w-full bg-transparent text-xs font-medium text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => updateGroup(gi, 'required', !group.required)}
                          className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                            group.required
                              ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                              : 'bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'
                          }`}
                        >
                          {group.required ? 'Required' : 'Optional'}
                        </button>
                        <button type="button" onClick={() => removeGroup(gi)} className="flex-shrink-0 text-gray-300 dark:text-neutral-600 hover:text-red-400 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Max picks — only for optional groups */}
                      {!group.required && (
                        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 dark:border-neutral-700/50 bg-white dark:bg-neutral-900">
                          <span className="text-[10px] text-gray-400 dark:text-neutral-500">Customer can pick up to</span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={group.maxSelections || 1}
                            onChange={e => updateGroup(gi, 'maxSelections', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-10 px-1.5 py-0.5 rounded-md border border-gray-200 dark:border-neutral-700 text-[10px] text-center bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white outline-none focus:border-primary"
                          />
                          <span className="text-[10px] text-gray-400 dark:text-neutral-500">choices</span>
                        </div>
                      )}

                      {/* Choices */}
                      <div className="overflow-visible rounded-b-xl px-3 pt-2 pb-2 space-y-1.5 bg-white dark:bg-neutral-900">
                        {(group.options || []).map((opt, oi) => (
                          <div
                            key={opt.id || oi}
                            className="flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-neutral-600 flex-shrink-0 mt-px" />
                            <div className="relative min-w-0 flex-1">
                              <input
                                type="text"
                                value={opt.name}
                                onChange={e =>
                                  updateOption(gi, oi, "name", e.target.value)
                                }
                                onFocus={(e) => {
                                  setFocusedOptionKey(`${gi}-${oi}`);
                                  setOptionNameAnchor(e.currentTarget);
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setFocusedOptionKey(null);
                                    setOptionNameAnchor(null);
                                  }, 150);
                                }}
                                placeholder="Name, e.g. Large"
                                className="w-full min-w-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                              />
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-[10px] text-gray-400 dark:text-neutral-500">Rs</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={opt.price}
                                onChange={e => updateOption(gi, oi, 'price', e.target.value)}
                                placeholder="0"
                                className="w-14 px-1.5 py-1 rounded-md bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-xs text-right text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeOption(gi, oi)}
                              className="flex-shrink-0 text-gray-300 dark:text-neutral-600 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(gi)}
                          className="w-full py-1.5 rounded-md border border-dashed border-gray-200 dark:border-neutral-700 text-[11px] text-gray-400 dark:text-neutral-500 hover:border-primary/40 hover:text-primary transition-colors"
                        >
                          + Add choice
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addGroup}
                    className="w-full py-2 rounded-xl border border-dashed border-orange-300 dark:border-orange-500/40 text-orange-500 dark:text-orange-400 text-xs font-medium hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                  >
                    + Add group
                  </button>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-neutral-800 pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800 dark:text-neutral-200">
                      Add-ons &amp; Modifiers
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                      Attach reusable modifier groups from{" "}
                      <a href="/modifier-groups" className="text-primary hover:underline">
                        Modifier Groups
                      </a>
                    </p>
                  </div>
                </div>
                {availableModifierGroups.length === 0 ? (
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 italic">
                    No modifier groups yet. Create groups first, then attach them here.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableModifierGroups.map((group) => {
                      const attached = (form.attachedModifierGroupIds || []).includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => {
                              const ids = prev.attachedModifierGroupIds || [];
                              return {
                                ...prev,
                                attachedModifierGroupIds: attached
                                  ? ids.filter((id) => id !== group.id)
                                  : [...ids, group.id],
                              };
                            })
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                            attached
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-primary/40"
                          }`}
                        >
                          {attached ? <Check className="w-3 h-3" /> : null}
                          {group.name}
                          {group.required ? (
                            <span className="text-[9px] uppercase opacity-70">req</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
                {(form.attachedModifierGroupIds || []).length > 0 ? (
                  <p className="text-[10px] text-gray-500 dark:text-neutral-400">
                    {form.attachedModifierGroupIds.length} group
                    {form.attachedModifierGroupIds.length === 1 ? "" : "s"} attached
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Category</label>
                <AsyncCombobox
                  placeholder="Search category…"
                  fetchFn={fetchCategoryOptions}
                  value={form.categoryId || null}
                  valueObj={selectedCategoryObj}
                  onChange={(id) =>
                    setForm((prev) => ({ ...prev, categoryId: id || "" }))
                  }
                  displayFn={(opt) => opt.label}
                  keyFn={(opt) => opt.id}
                  hasError={Boolean(modalError && !form.categoryId)}
                />
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
        {focusedGroupIndex !== null && (
          <SuggestionPopover
            anchorEl={groupNameAnchor}
            open={focusedGroupIndex !== null}
          >
            <p className="mb-1.5 px-1 text-xs text-gray-400">Quick select:</p>
            <div className="flex flex-wrap gap-1.5">
              {GROUP_NAME_SUGGESTIONS.filter(
                (suggestion) =>
                  suggestion.toLowerCase() !==
                  (
                    form.modifierGroups[focusedGroupIndex]?.groupName || ""
                  ).toLowerCase(),
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    updateGroup(focusedGroupIndex, "groupName", suggestion);
                    setFocusedGroupIndex(null);
                    setGroupNameAnchor(null);
                  }}
                  className="cursor-pointer rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-gray-600 transition-colors duration-150 hover:border-orange-300 hover:bg-orange-100 hover:text-orange-700 active:bg-orange-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </SuggestionPopover>
        )}
        {focusedOptionKey !== null &&
          (() => {
            const [focusedGi, focusedOi] = focusedOptionKey
              .split("-")
              .map(Number);
            const focusedGroup = form.modifierGroups[focusedGi];
            if (!focusedGroup) return null;
            return (
              <SuggestionPopover
                anchorEl={optionNameAnchor}
                open={focusedOptionKey !== null}
              >
                <p className="mb-1.5 px-1 text-xs text-gray-400">
                  Quick select:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {getSuggestionsForGroup(focusedGroup.groupName)
                    .filter(
                      (suggestion) =>
                        !(focusedGroup.options || []).some(
                          (o, idx) =>
                            idx !== focusedOi &&
                            (o.name || "").toLowerCase() ===
                              suggestion.toLowerCase(),
                        ),
                    )
                    .map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          updateOption(
                            focusedGi,
                            focusedOi,
                            "name",
                            suggestion,
                          );
                          setFocusedOptionKey(null);
                          setOptionNameAnchor(null);
                        }}
                        className="cursor-pointer rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-gray-600 transition-colors duration-150 hover:border-orange-300 hover:bg-orange-100 hover:text-orange-700 active:bg-orange-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                </div>
              </SuggestionPopover>
            );
          })()}
      </>
      )}

      {/* Recipe / Inventory Dialog */}
      {recipeDialog.open && (() => {
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

        const recipeMismatchHints = getRecipeVolumeMismatchHints(
          recipeDialog.itemName,
          addedIngredients.map(({ inv }) => inv.name)
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
                {recipeMismatchHints.length > 0 && (
                  <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <ul className="list-disc list-inside space-y-1.5 leading-snug">
                      {recipeMismatchHints.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
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
                    const displayUnit = consumption.unit || suggestRecipeUnit(inv.unit);
                    const menuVol = normalizeVolumeHint(recipeDialog.itemName);
                    const invVol = normalizeVolumeHint(inv.name);
                    const rowVolMismatch = menuVol && invVol && menuVol !== invVol;
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800"
                      >
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{inv.name}</p>
                          {rowVolMismatch && (
                            <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400/90 mt-0.5 truncate">
                              Size label ≠ menu ({menuVol} vs {invVol})
                            </p>
                          )}
                        </div>
                        {/* Quantity input + unit */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={consumption.quantity ?? ""}
                            onChange={e => updateConsumption(inv.id, { quantity: e.target.value })}
                            placeholder="qty"
                            className="w-20 h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm text-right font-semibold text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                          <select
                            value={displayUnit}
                            onChange={(e) => updateConsumption(inv.id, { unit: e.target.value })}
                            className="h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 text-xs font-semibold text-gray-700 dark:text-neutral-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          >
                            {RECIPE_UNIT_OPTIONS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
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
                              const displayUnit = suggestRecipeUnit(inv.unit);
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
      </PermissionGate>
    </AdminLayout>
  );
}
