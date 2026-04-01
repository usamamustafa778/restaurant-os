import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import {
  Plus, Trash2, Edit2, Package, TrendingUp, TrendingDown,
  AlertTriangle, Copy, X, Loader2, CheckCircle2, XCircle,
  ArrowUp, ArrowDown, ArrowUpDown, Printer, Minus, FileDown, FileText, ChevronDown,
} from "lucide-react";
import DataTable from "../../components/ui/DataTable";
import {
  getInventory, createInventoryItem, updateInventoryItem,
  deleteInventoryItem, getStoredAuth, getSourceBranchInventory,
  copyInventoryFromBranch, SubscriptionInactiveError,
} from "../../lib/apiClient";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";

const isAdminRole = (role) => role === "restaurant_admin" || role === "admin";

// ─── Units ────────────────────────────────────────────────────────────────────

const UNIT_GROUPS = [
  {
    group: "Weight",
    options: [
      { value: "gram",     label: "Gram (g)",      abbr: "g"  },
      { value: "kilogram", label: "Kilogram (kg)",  abbr: "kg" },
    ],
  },
  {
    group: "Volume",
    options: [
      { value: "milliliter", label: "Milliliter (ml)", abbr: "ml" },
      { value: "liter",      label: "Liter (L)",       abbr: "L"  },
    ],
  },
  {
    group: "Count",
    options: [
      { value: "piece",  label: "Piece (pcs)", abbr: "pcs" },
      { value: "dozen",  label: "Dozen",       abbr: "doz" },
      { value: "box",    label: "Box",         abbr: "box" },
      { value: "pack",   label: "Pack",        abbr: "pack"},
      { value: "bag",    label: "Bag",         abbr: "bag" },
      { value: "bottle", label: "Bottle",      abbr: "btl" },
      { value: "can",    label: "Can",         abbr: "can" },
    ],
  },
];

const ALL_UNITS = UNIT_GROUPS.flatMap((g) => g.options);

function unitAbbr(unit) {
  return ALL_UNITS.find((u) => u.value === unit)?.abbr ?? unit ?? "unit";
}

function costPriceLabel(unit) {
  if (["gram", "kilogram", "kg"].includes(unit))       return "Price per kg";
  if (["milliliter", "ml", "liter"].includes(unit))    return "Price per liter";
  if (unit === "piece")                                 return "Price per piece";
  if (unit === "dozen")                                 return "Price per dozen";
  return "Price per unit";
}

function quickAmounts(unit) {
  if (["gram", "kilogram"].includes(unit))     return [100, 500, 1000, 5000];
  if (["milliliter", "liter"].includes(unit))  return [100, 500, 1000, 5000];
  return [1, 5, 10, 50];
}

// Inline step: sensible ±amount for the quick +/- buttons in the table
function inlineStep(unit) {
  return ["gram", "milliliter"].includes(unit) ? 100 : 1;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, onClick, active }) {
  const colors = {
    blue:    { bg: "bg-blue-50 dark:bg-blue-500/10",       icon: "text-blue-500",    val: "text-blue-700 dark:text-blue-400",       border: "border-blue-100 dark:border-blue-500/20"    },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: "text-emerald-500", val: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-100 dark:border-emerald-500/20" },
    orange:  { bg: "bg-orange-50 dark:bg-orange-500/10",   icon: "text-orange-500",  val: "text-orange-700 dark:text-orange-400",   border: "border-orange-100 dark:border-orange-500/20"  },
    red:     { bg: "bg-red-50 dark:bg-red-500/10",         icon: "text-red-500",     val: "text-red-700 dark:text-red-400",         border: "border-red-100 dark:border-red-500/20"        },
  };
  const c = colors[color] || colors.blue;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-2xl border-2 w-full text-left transition-all ${c.bg} ${c.border} ${
        active ? "ring-2 ring-offset-1 ring-current shadow-md scale-[1.02]" : "hover:shadow-md hover:scale-[1.01]"
      }`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white dark:bg-neutral-900 shadow-sm">
        <Icon className={`w-5 h-5 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-black tabular-nums leading-tight ${c.val}`}>{value}</p>
      </div>
    </button>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────────────────

function SortHeader({ label, colKey, sortKey, sortDir, onSort }) {
  const active = sortKey === colKey;
  return (
    <button
      type="button"
      onClick={() => onSort(colKey)}
      className="inline-flex items-center gap-1 hover:text-primary transition-colors group -ml-1 px-1 whitespace-nowrap"
    >
      {label}
      {active
        ? sortDir === "asc"
          ? <ArrowUp className="w-3 h-3 text-primary" />
          : <ArrowDown className="w-3 h-3 text-primary" />
        : <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-70 transition-opacity" />
      }
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    id: null, name: "", unit: "gram",
    initialStock: "", lowStockThreshold: "", costPrice: "",
  });
  const [adjustDialog, setAdjustDialog] = useState({
    open: false, mode: "add", itemId: null,
    itemName: "", currentStock: 0, unit: "gram", value: "",
  });

  const [suspended, setSuspended]               = useState(false);
  const [pageLoading, setPageLoading]           = useState(true);
  const [search, setSearch]                     = useState("");
  const [statusFilter, setStatusFilter]         = useState("all");
  const [filterUnit, setFilterUnit]             = useState("all");
  const [sortBy, setSortBy]                     = useState("name_asc");
  const [sortKey, setSortKey]                   = useState(null);
  const [sortDir, setSortDir]                   = useState("asc");
  const [modalError, setModalError]             = useState("");
  const [submitting, setSubmitting]             = useState(false);
  const [adjusting, setAdjusting]               = useState(false);
  const [inlineAdjusting, setInlineAdjusting]   = useState(new Set());
  const [selectedIds, setSelectedIds]           = useState(new Set());
  const [bulkDeleting, setBulkDeleting]         = useState(false);
  const [isItemModalOpen, setIsItemModalOpen]   = useState(false);
  const [copyModalOpen, setCopyModalOpen]       = useState(false);
  const [copySourceBranchId, setCopySourceBranchId]   = useState("");
  const [copySourceData, setCopySourceData]           = useState(null);
  const [copySourceLoading, setCopySourceLoading]     = useState(false);
  const [copySelectedItemIds, setCopySelectedItemIds] = useState([]);
  const [copySubmitting, setCopySubmitting]           = useState(false);
  const [showExportMenu, setShowExportMenu]           = useState(false);

  const { confirm } = useConfirmDialog();
  const { currentBranch, branches } = useBranch() || {};
  const isAdmin = isAdminRole(getStoredAuth()?.user?.role);
  const sourceBranches = (branches || []).filter((b) => b.id !== currentBranch?.id);

  useEffect(() => {
    (async () => {
      try {
        const data = await getInventory();
        setItems(data);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else toast.error(err.message || "Failed to load inventory");
      } finally {
        setPageLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!copySourceBranchId || !copyModalOpen || copySourceBranchId === "all") {
      setCopySourceData(null); setCopySelectedItemIds([]); return;
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
      .catch(() => { if (!cancelled) setCopySourceData({ items: [] }); })
      .finally(() => { if (!cancelled) setCopySourceLoading(false); });
    return () => { cancelled = true; };
  }, [copySourceBranchId, copyModalOpen]);

  function toggleCopyItem(id) {
    setCopySelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCopySubmit() {
    if (!currentBranch?.id || !copySourceBranchId) {
      toast.error("Please select a target branch and source branch."); return;
    }
    setCopySubmitting(true);
    const toastId = toast.loading("Copying inventory...");
    try {
      if (copySourceBranchId === "all") {
        for (const branch of sourceBranches) {
          const data = await getSourceBranchInventory(branch.id);
          const itemIds = (data?.items ?? []).map((i) => i.id);
          if (itemIds.length) await copyInventoryFromBranch(branch.id, { itemIds });
        }
        toast.success("Inventory copied from all branches!", { id: toastId });
      } else {
        await copyInventoryFromBranch(copySourceBranchId, { itemIds: copySelectedItemIds });
        toast.success("Inventory copied successfully!", { id: toastId });
      }
      setCopyModalOpen(false); setCopySourceBranchId("");
      const data = await getInventory(); setItems(data);
    } catch (err) {
      toast.error(err.message || "Failed to copy inventory", { id: toastId });
    } finally {
      setCopySubmitting(false);
    }
  }

  function resetForm() {
    setForm({ id: null, name: "", unit: "gram", initialStock: "", lowStockThreshold: "", costPrice: "" });
  }

  function startCreateItem() {
    if (!currentBranch) {
      toast.error("Please select a branch from the header dropdown to add inventory items."); return;
    }
    resetForm(); setModalError(""); setIsItemModalOpen(true);
  }

  const UNIT_MIGRATIONS = { kg: "kilogram", ml: "milliliter", liter: "liter" };

  function startEditItem(item) {
    setForm({
      id: item.id, name: item.name,
      unit: UNIT_MIGRATIONS[item.unit] ?? item.unit,
      initialStock: "",
      lowStockThreshold: String(item.lowStockThreshold ?? ""),
      costPrice: String(item.costPrice ?? ""),
    });
    setModalError(""); setIsItemModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim())  { setModalError("Item name is required"); return; }
    if (!form.unit)         { setModalError("Unit is required"); return; }
    if (!form.id && !currentBranch?.id) {
      setModalError("Please select a specific branch from the header dropdown before adding inventory."); return;
    }
    setModalError(""); setSubmitting(true);
    const toastId = toast.loading(form.id ? "Updating item..." : "Creating item...");
    try {
      if (form.id) {
        const updated = await updateInventoryItem(form.id, {
          name: form.name, unit: form.unit,
          lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : 0,
          costPrice: form.costPrice ? Number(form.costPrice) : 0,
        });
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        toast.success("Inventory item updated!", { id: toastId });
      } else {
        const created = await createInventoryItem({
          name: form.name, unit: form.unit,
          initialStock: form.initialStock ? Number(form.initialStock) : 0,
          lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : 0,
          costPrice: form.costPrice ? Number(form.costPrice) : 0,
          ...(currentBranch?.id && { branchId: currentBranch.id }),
        });
        setItems((prev) => [...prev, created]);
        toast.success("Inventory item created!", { id: toastId });
      }
      resetForm(); setIsItemModalOpen(false);
    } catch (err) {
      setModalError(err.message || "Failed to save inventory item");
      toast.error(err.message || "Failed to save inventory item", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjustStock(id, delta) {
    const toastId = toast.loading(delta > 0 ? "Adding stock..." : "Removing stock...");
    try {
      const updated = await updateInventoryItem(id, { stockAdjustment: delta });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      toast.success(delta > 0 ? "Stock added!" : "Stock removed!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to adjust stock", { id: toastId }); throw err;
    }
  }

  async function handleInlineAdjust(item, delta) {
    setInlineAdjusting((prev) => new Set([...prev, item.id]));
    try { await handleAdjustStock(item.id, delta); }
    catch { /* error already toasted */ }
    finally {
      setInlineAdjusting((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }

  function openAdjustDialog(item, mode) {
    setModalError("");
    setAdjustDialog({
      open: true, mode, itemId: item.id, itemName: item.name,
      currentStock: item.currentStock ?? 0, unit: item.unit, value: "",
    });
  }

  function closeAdjustDialog() {
    setAdjustDialog((prev) => ({ ...prev, open: false, value: "" }));
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: "Delete inventory item",
      message: `Delete "${item.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const toastId = toast.loading("Deleting item...");
    try {
      await deleteInventoryItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(item.id); return s; });
      toast.success(`"${item.name}" deleted`, { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to delete inventory item", { id: toastId });
    }
  }

  async function handleConfirmAdjust() {
    const amount = Number(adjustDialog.value.trim() || "0");
    if (Number.isNaN(amount) || amount <= 0 || !adjustDialog.itemId) {
      setModalError("Please enter a valid quantity greater than 0"); return;
    }
    setModalError(""); setAdjusting(true);
    try {
      const delta = adjustDialog.mode === "add" ? amount : -amount;
      await handleAdjustStock(adjustDialog.itemId, delta);
      closeAdjustDialog();
    } catch (err) {
      setModalError(err.message || "Failed to adjust stock");
    } finally {
      setAdjusting(false);
    }
  }

  // ─── Sort ─────────────────────────────────────────────────────────────────

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ─── Bulk select & delete ─────────────────────────────────────────────────

  function toggleSelectItem(id) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function toggleSelectAll(visibleItems) {
    const allSelected = visibleItems.every((i) => selectedIds.has(i.id));
    setSelectedIds(allSelected ? new Set() : new Set(visibleItems.map((i) => i.id)));
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    const ok = await confirm({
      title: `Delete ${ids.length} item${ids.length > 1 ? "s" : ""}`,
      message: `Permanently delete ${ids.length} inventory item${ids.length > 1 ? "s" : ""}? This cannot be undone.`,
      confirmLabel: "Delete All",
    });
    if (!ok) return;
    setBulkDeleting(true);
    const toastId = toast.loading(`Deleting ${ids.length} items...`);
    try {
      await Promise.all(ids.map((id) => deleteInventoryItem(id)));
      setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      toast.success(`${ids.length} items deleted`, { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to delete items", { id: toastId });
    } finally {
      setBulkDeleting(false);
    }
  }

  // ─── Print restock list ───────────────────────────────────────────────────

  function printRestockList() {
    const restockItems = [...outOfStock, ...lowStock].sort((a, b) => a.name.localeCompare(b.name));
    if (!restockItems.length) return;
    const date = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
    const branchName = currentBranch?.name || "All Branches";
    const rows = restockItems.map((item) => {
      const isOut = (item.currentStock ?? 0) <= 0;
      return `<tr>
        <td><strong>${item.name}</strong></td>
        <td>${unitAbbr(item.unit)}</td>
        <td style="font-weight:700">${item.currentStock ?? 0} ${unitAbbr(item.unit)}</td>
        <td>${item.lowStockThreshold ? `${item.lowStockThreshold} ${unitAbbr(item.unit)}` : "—"}</td>
        <td><span style="background:${isOut ? "#fef2f2" : "#fff7ed"};color:${isOut ? "#dc2626" : "#ea580c"};font-weight:700;padding:3px 10px;border-radius:4px;font-size:11px">${isOut ? "OUT OF STOCK" : "LOW STOCK"}</span></td>
        <td style="color:#d1d5db">_____________________</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Restock List – ${branchName}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:900px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .meta{font-size:12px;color:#6b7280;margin-bottom:28px}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:8px 12px;border-bottom:2px solid #e5e7eb}
  td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;vertical-align:middle}
  @media print{body{padding:16px}}
</style></head><body>
<h1>Restock List</h1>
<p class="meta">${branchName} &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; ${restockItems.length} item${restockItems.length !== 1 ? "s" : ""} need attention</p>
<table>
  <thead><tr><th>Item</th><th>Unit</th><th>Current Stock</th><th>Alert Threshold</th><th>Status</th><th>Order Qty</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups to print."); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const branchFilteredItems = items.filter((item) => item.hasBranchRecord !== false);

  const outOfStock = branchFilteredItems.filter((i) => (i.currentStock ?? 0) <= 0);
  const lowStock   = branchFilteredItems.filter((i) => {
    const s = i.currentStock ?? 0; const t = i.lowStockThreshold ?? 0;
    return s > 0 && t > 0 && s <= t;
  });
  const healthy    = branchFilteredItems.filter((i) => {
    const s = i.currentStock ?? 0; const t = i.lowStockThreshold ?? 0;
    return s > 0 && (t === 0 || s > t);
  });

  const STATUS_FILTERS = [
    { value: "all",     label: "All",         count: branchFilteredItems.length, filter: "all"     },
    { value: "healthy", label: "Healthy",      count: healthy.length,            filter: "healthy" },
    { value: "low",     label: "Low Stock",    count: lowStock.length,           filter: "low"     },
    { value: "out",     label: "Out of Stock", count: outOfStock.length,         filter: "out"     },
  ];

  const UNIT_GROUP_MAP = {
    weight:  ["gram", "kilogram"],
    volume:  ["milliliter", "liter"],
    count:   ["piece", "dozen", "box", "pack", "bag", "bottle", "can"],
  };

  const statusFiltered =
    statusFilter === "healthy" ? healthy
    : statusFilter === "low"   ? lowStock
    : statusFilter === "out"   ? outOfStock
    : branchFilteredItems;

  const searchFiltered = statusFiltered.filter((item) => {
    const term = search.trim().toLowerCase();
    if (term && !item.name.toLowerCase().includes(term) && !item.unit.toLowerCase().includes(term)) return false;
    if (filterUnit !== "all") {
      const allowed = UNIT_GROUP_MAP[filterUnit] || [];
      if (!allowed.includes(item.unit)) return false;
    }
    return true;
  });

  const sortedFiltered = [...searchFiltered].sort((a, b) => {
    // Column-header sort takes priority if set
    if (sortKey) {
      const va = a[sortKey] ?? (sortKey === "name" ? "" : 0);
      const vb = b[sortKey] ?? (sortKey === "name" ? "" : 0);
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    }
    if (sortBy === "name_asc")    return a.name.localeCompare(b.name);
    if (sortBy === "name_desc")   return b.name.localeCompare(a.name);
    if (sortBy === "stock_asc")   return (a.currentStock ?? 0) - (b.currentStock ?? 0);
    if (sortBy === "stock_desc")  return (b.currentStock ?? 0) - (a.currentStock ?? 0);
    if (sortBy === "cost_asc")    return (a.costPrice ?? 0) - (b.costPrice ?? 0);
    if (sortBy === "cost_desc")   return (b.costPrice ?? 0) - (a.costPrice ?? 0);
    return 0;
  });

  const adjustAmt    = Number(adjustDialog.value) || 0;
  const previewStock = adjustDialog.mode === "add"
    ? adjustDialog.currentStock + adjustAmt
    : Math.max(0, adjustDialog.currentStock - adjustAmt);

  const allVisibleSelected = sortedFiltered.length > 0 && sortedFiltered.every((i) => selectedIds.has(i.id));
  const someVisibleSelected = sortedFiltered.some((i) => selectedIds.has(i.id));
  const needsRestock = outOfStock.length + lowStock.length > 0;

  // ─── Export helpers ───────────────────────────────────────────────────────────

  function toCSVRow(cells) {
    return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
  }

  function stockStatus(item) {
    const s = item.currentStock ?? 0, t = item.lowStockThreshold ?? 0;
    if (s <= 0) return "Out of Stock";
    if (t > 0 && s <= t) return "Low Stock";
    return "Healthy";
  }

  function exportCSV() {
    const date = new Date().toLocaleDateString("en-PK");
    const branchName = currentBranch?.name || "All Branches";
    const filterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "All";
    const rows = [
      ["Inventory Report"],
      ["Branch", branchName],
      ["Filter", filterLabel],
      ["Generated", date],
      [],
      ["Item Name", "Unit", "Current Stock", "Alert Threshold", "Cost Price (Rs)", "Status"],
      ...sortedFiltered.map((item) => [
        item.name,
        ALL_UNITS.find((u) => u.value === item.unit)?.label ?? item.unit,
        item.currentStock ?? 0,
        item.lowStockThreshold ?? 0,
        item.costPrice ?? 0,
        stockStatus(item),
      ]),
      [],
      ["SUMMARY"],
      ["Total Items", sortedFiltered.length],
      ["Healthy", sortedFiltered.filter((i) => stockStatus(i) === "Healthy").length],
      ["Low Stock", sortedFiltered.filter((i) => stockStatus(i) === "Low Stock").length],
      ["Out of Stock", sortedFiltered.filter((i) => stockStatus(i) === "Out of Stock").length],
    ];
    const content = rows.map(toCSVRow).join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${branchName.replace(/\s/g, "-")}-${date.replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported — open in Excel");
    setShowExportMenu(false);
  }

  function buildInventoryHTML(title, extraStyle = "") {
    const date = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
    const branchName = currentBranch?.name || "All Branches";
    const filterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "All";
    const healthyCount  = sortedFiltered.filter((i) => stockStatus(i) === "Healthy").length;
    const lowCount      = sortedFiltered.filter((i) => stockStatus(i) === "Low Stock").length;
    const outCount      = sortedFiltered.filter((i) => stockStatus(i) === "Out of Stock").length;

    const itemRows = sortedFiltered.map((item) => {
      const status = stockStatus(item);
      const statusStyle =
        status === "Out of Stock" ? "background:#fef2f2;color:#dc2626;"
        : status === "Low Stock"  ? "background:#fff7ed;color:#ea580c;"
        : "background:#f0fdf4;color:#16a34a;";
      return `<tr>
        <td><strong>${item.name}</strong></td>
        <td>${ALL_UNITS.find((u) => u.value === item.unit)?.label ?? item.unit}</td>
        <td style="font-weight:700">${item.currentStock ?? 0} ${unitAbbr(item.unit)}</td>
        <td>${item.lowStockThreshold ? `${item.lowStockThreshold} ${unitAbbr(item.unit)}` : "—"}</td>
        <td>${item.costPrice > 0 ? `Rs ${item.costPrice.toLocaleString()}` : "—"}</td>
        <td><span style="font-weight:700;padding:2px 8px;border-radius:4px;font-size:11px;${statusStyle}">${status}</span></td>
      </tr>`;
    }).join("");

    return `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:1000px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .meta{font-size:12px;color:#6b7280;margin-bottom:20px}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
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
<h1>Inventory Report</h1>
<p class="meta">${branchName} &nbsp;·&nbsp; Filter: ${filterLabel} &nbsp;·&nbsp; ${date}</p>
<div class="summary">
  <div class="stat"><div class="stat-label">Total</div><div class="stat-value" style="color:#1d4ed8">${sortedFiltered.length}</div></div>
  <div class="stat"><div class="stat-label">Healthy</div><div class="stat-value" style="color:#16a34a">${healthyCount}</div></div>
  <div class="stat"><div class="stat-label">Low Stock</div><div class="stat-value" style="color:#ea580c">${lowCount}</div></div>
  <div class="stat"><div class="stat-label">Out of Stock</div><div class="stat-value" style="color:#dc2626">${outCount}</div></div>
</div>
<table>
  <thead><tr><th>Item</th><th>Unit</th><th>Current Stock</th><th>Alert Threshold</th><th>Cost Price</th><th>Status</th></tr></thead>
  <tbody>${itemRows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:32px">No items match current filter</td></tr>'}</tbody>
</table>
</body></html>`;
  }

  function exportPDF() {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups."); return; }
    win.document.write(buildInventoryHTML("Inventory Report – PDF", "@media print{@page{size:A4 landscape}}"));
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
    setShowExportMenu(false);
  }

  function printInventory() {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups."); return; }
    win.document.write(buildInventoryHTML("Inventory Report – Print"));
    win.document.close();
    setTimeout(() => win.print(), 300);
    setShowExportMenu(false);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <AdminLayout title="Inventory Management" suspended={suspended}>

      {/* ── Copy inventory modal ──────────────────────────────────────────── */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Copy inventory from branch</h2>
              <button type="button" onClick={() => { setCopyModalOpen(false); setCopySourceBranchId(""); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Source branch</label>
                <select value={copySourceBranchId} onChange={(e) => setCopySourceBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white">
                  <option value="">Select branch</option>
                  {isAdmin && <option value="all">All branches</option>}
                  {sourceBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
                  <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-2">Inventory items</p>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800">
                    {(copySourceData.items || []).map((i) => (
                      <label key={i.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer">
                        <input type="checkbox" checked={copySelectedItemIds.includes(i.id)}
                          onChange={() => toggleCopyItem(i.id)} className="rounded border-gray-300 text-primary" />
                        <span className="text-sm text-gray-900 dark:text-white flex-1">{i.name}</span>
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400">{unitAbbr(i.unit)}</span>
                      </label>
                    ))}
                    {(copySourceData.items || []).length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">No inventory items in this branch</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-800">
              <Button type="button" variant="ghost" onClick={() => { setCopyModalOpen(false); setCopySourceBranchId(""); }} className="px-4">Cancel</Button>
              <Button type="button" onClick={handleCopySubmit}
                disabled={!copySourceBranchId || copySubmitting || (copySourceBranchId !== "all" && copySelectedItemIds.length === 0)}
                className="px-4">
                {copySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                {copySubmitting ? "Copying…" : "Copy to this branch"}
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Search */}
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-48 h-9 px-3 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />

        {/* Status */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 pl-2.5 pr-7 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-700 dark:text-neutral-300 focus:outline-none focus:border-primary cursor-pointer transition-all w-fit">
          <option value="all">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>

        {/* Unit type */}
        <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
          className="h-9 pl-2.5 pr-7 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-700 dark:text-neutral-300 focus:outline-none focus:border-primary cursor-pointer transition-all w-fit">
          <option value="all">All Units</option>
          <option value="weight">Weight (g / kg)</option>
          <option value="volume">Volume (ml / L)</option>
          <option value="count">Count (pcs, box…)</option>
        </select>

        {/* Sort */}
        <select value={sortBy} onChange={e => { setSortBy(e.target.value); setSortKey(null); }}
          className="h-9 pl-2.5 pr-7 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-700 dark:text-neutral-300 focus:outline-none focus:border-primary cursor-pointer transition-all w-fit">
          <option value="name_asc">A → Z</option>
          <option value="name_desc">Z → A</option>
          <option value="stock_asc">Stock Low → High</option>
          <option value="stock_desc">Stock High → Low</option>
          <option value="cost_asc">Cost Low → High</option>
          <option value="cost_desc">Cost High → Low</option>
        </select>

        {/* Clear */}
        {(statusFilter !== "all" || filterUnit !== "all" || search.trim()) && (
          <button type="button"
            onClick={() => { setStatusFilter("all"); setFilterUnit("all"); setSearch(""); }}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-xs font-semibold text-gray-600 dark:text-neutral-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {needsRestock && (
            <button type="button" onClick={printRestockList}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-orange-300 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all whitespace-nowrap">
              <Printer className="w-4 h-4" /> Restock List
              <span className="px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-[10px] font-bold">
                {outOfStock.length + lowStock.length}
              </span>
            </button>
          )}
          {currentBranch?.id && (
            <button type="button" onClick={() => { setCopySourceBranchId(""); setCopyModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-primary text-primary text-sm font-semibold hover:bg-primary/10 transition-all whitespace-nowrap">
              <Copy className="w-4 h-4" /> Copy Inventory
            </button>
          )}
          {/* Export dropdown */}
          <div className="relative">
            <button type="button" onClick={() => setShowExportMenu((v) => !v)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all whitespace-nowrap">
              <FileDown className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-xl overflow-hidden">
                  <button type="button" onClick={exportCSV}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                    <FileDown className="w-4 h-4 text-green-600" /> Export Excel (CSV)
                  </button>
                  <button type="button" onClick={exportPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                    <FileText className="w-4 h-4 text-red-500" /> Export PDF
                  </button>
                  <button type="button" onClick={printInventory}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors border-t border-gray-100 dark:border-neutral-800">
                    <Printer className="w-4 h-4 text-gray-500" /> Print
                  </button>
                </div>
              </>
            )}
          </div>
          <button type="button" onClick={startCreateItem}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* ── Bulk action bar ───────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 mb-4">
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">
            {selectedIds.size} selected
          </span>
          <button type="button" onClick={() => setSelectedIds(new Set())}
            className="text-[10px] text-red-500 hover:text-red-700 dark:text-red-400 underline">
            Clear
          </button>
          <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-50">
            {bulkDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete {selectedIds.size}
          </button>
        </div>
      )}

      {/* ── Inventory table ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all">
        {pageLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">Loading inventory...</p>
            </div>
          </div>
        ) : branchFilteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <p className="text-base font-bold text-gray-700 dark:text-neutral-300">No inventory items yet</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">Start by adding ingredients or raw materials to track</p>
            <button onClick={startCreateItem}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4" /> Add Your First Item
            </button>
          </div>
        ) : sortedFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <p className="text-base font-bold text-gray-700 dark:text-neutral-300">No results found</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2">Try a different search term or filter</p>
          </div>
        ) : (
          <DataTable
            rows={sortedFiltered}
            emptyMessage="No inventory items found."
            columns={[
              {
                key: "_select",
                header: (
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                    onChange={() => toggleSelectAll(sortedFiltered)}
                    className="rounded border-gray-300 dark:border-neutral-600 text-primary cursor-pointer"
                  />
                ),
                align: "center",
                render: (_, item) => (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                    className="rounded border-gray-300 dark:border-neutral-600 text-primary cursor-pointer"
                  />
                ),
              },
              {
                key: "name",
                header: (
                  <SortHeader label="Item" colKey="name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                ),
                render: (_, item) => {
                  const stock = item.currentStock ?? 0;
                  const threshold = item.lowStockThreshold ?? 0;
                  const isOut = stock <= 0;
                  const isLow = !isOut && threshold > 0 && stock <= threshold;
                  return (
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {item.name}
                        {isOut && <span className="px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold">OUT</span>}
                        {isLow && !isOut && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                        {ALL_UNITS.find((u) => u.value === item.unit)?.label ?? item.unit}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: "currentStock",
                header: (
                  <SortHeader label="Stock Level" colKey="currentStock" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                ),
                align: "center",
                render: (_, item) => {
                  const stock = item.currentStock ?? 0;
                  const threshold = item.lowStockThreshold ?? 0;
                  const isOut = stock <= 0;
                  const isLow = !isOut && threshold > 0 && stock <= threshold;
                  const pct = isOut ? 0
                    : threshold > 0 ? Math.min((stock / (threshold * 3)) * 100, 100)
                    : 100;
                  const barColor    = isOut ? "bg-red-400"     : isLow ? "bg-orange-400"     : "bg-emerald-400";
                  const badgeColor  = isOut
                    ? "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                    : isLow
                    ? "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400"
                    : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                  const step = inlineStep(item.unit);
                  const isAdjusting = inlineAdjusting.has(item.id);
                  return (
                    <div className="flex flex-col items-center gap-1.5 min-w-[130px]">
                      {/* Inline +/- stepper */}
                      <div className="flex items-center gap-1">
                        <button type="button"
                          disabled={isAdjusting || stock <= 0}
                          onClick={() => handleInlineAdjust(item, -step)}
                          className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 hover:text-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={`Remove ${step} ${unitAbbr(item.unit)}`}>
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-xs font-bold min-w-[70px] ${badgeColor}`}>
                          {isAdjusting ? <Loader2 className="w-3 h-3 animate-spin" /> : <>{stock} {unitAbbr(item.unit)}</>}
                        </span>
                        <button type="button"
                          disabled={isAdjusting}
                          onClick={() => handleInlineAdjust(item, step)}
                          className="w-6 h-6 rounded-md flex items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title={`Add ${step} ${unitAbbr(item.unit)}`}>
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                },
              },
              {
                key: "costPrice",
                header: (
                  <SortHeader label="Cost Price" colKey="costPrice" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                ),
                align: "right",
                render: (val, item) => val > 0 ? (
                  <div className="text-right">
                    <div className="font-semibold text-primary">Rs {val.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 dark:text-neutral-500">{costPriceLabel(item.unit)}</div>
                  </div>
                ) : (
                  <span className="text-gray-400 dark:text-neutral-500">—</span>
                ),
              },
              {
                key: "lowStockThreshold",
                header: "Alert At",
                align: "center",
                hideOnMobile: true,
                render: (val, item) => val > 0 ? (
                  <span className="text-xs text-gray-500 dark:text-neutral-400 tabular-nums">
                    {val} {unitAbbr(item.unit)}
                  </span>
                ) : (
                  <span className="text-gray-300 dark:text-neutral-600 text-xs">—</span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (_, item) => (
                  <div className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => startEditItem(item)}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => openAdjustDialog(item, "add")}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-center gap-1" title="Add stock">
                      <TrendingUp className="w-3.5 h-3.5" /> Add
                    </button>
                    <button type="button" onClick={() => openAdjustDialog(item, "remove")}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors flex items-center gap-1" title="Remove stock">
                      <TrendingDown className="w-3.5 h-3.5" /> Remove
                    </button>
                    <button type="button" onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>

      {/* ── Item modal ────────────────────────────────────────────────────── */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
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
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Item Name</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Tomato, Burger Bun, Cooking Oil"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Unit of Measure</label>
                  <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all">
                    {UNIT_GROUPS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.options.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                    {costPriceLabel(form.unit)} <span className="text-gray-400 font-normal">(Rs)</span>
                  </label>
                  <input type="number" min="0" step="any" value={form.costPrice}
                    onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
                    placeholder="e.g. 250"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                    Initial Stock <span className="text-gray-400 font-normal">({unitAbbr(form.unit)})</span>
                  </label>
                  <input type="number" min="0" step="any" value={form.initialStock}
                    onChange={(e) => setForm((p) => ({ ...p, initialStock: e.target.value }))}
                    disabled={!!form.id}
                    placeholder="e.g. 0, 5, 1000"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                    Low Stock Alert <span className="text-gray-400 font-normal">({unitAbbr(form.unit)})</span>
                  </label>
                  <input type="number" min="0" step="any" value={form.lowStockThreshold}
                    onChange={(e) => setForm((p) => ({ ...p, lowStockThreshold: e.target.value }))}
                    placeholder="e.g. 500, 1, 10"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button"
                  className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  onClick={() => { resetForm(); setIsItemModalOpen(false); }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{form.id ? "Saving..." : "Creating..."}</>
                  ) : (
                    <><Plus className="w-4 h-4" />{form.id ? "Save Changes" : "Create Item"}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Adjust stock dialog ───────────────────────────────────────────── */}
      {adjustDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg ${
                adjustDialog.mode === "add"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                  : "bg-gradient-to-br from-orange-500 to-orange-600"
              }`}>
                {adjustDialog.mode === "add"
                  ? <TrendingUp className="w-6 h-6 text-white" />
                  : <TrendingDown className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {adjustDialog.mode === "add" ? "Add Stock" : "Remove Stock"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 truncate max-w-[200px]">{adjustDialog.itemName}</p>
              </div>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-neutral-400">Current Stock</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                  {adjustDialog.currentStock} {unitAbbr(adjustDialog.unit)}
                </span>
              </div>
              {adjustAmt > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-neutral-400">After adjustment</span>
                  <span className={`text-sm font-bold tabular-nums ${
                    adjustDialog.mode === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"
                  }`}>
                    {previewStock} {unitAbbr(adjustDialog.unit)}
                  </span>
                </div>
              )}
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}

            <div className="mb-3">
              <p className="text-[11px] text-gray-400 dark:text-neutral-500 mb-2 font-medium">Quick amounts</p>
              <div className="flex gap-2 flex-wrap">
                {quickAmounts(adjustDialog.unit).map((amt) => (
                  <button key={amt} type="button"
                    onClick={() => setAdjustDialog((p) => ({ ...p, value: String(amt) }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      Number(adjustDialog.value) === amt
                        ? adjustDialog.mode === "add"
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-orange-500 text-white border-orange-500"
                        : "bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-primary hover:text-primary"
                    }`}>
                    {amt} {unitAbbr(adjustDialog.unit)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <input type="number" min="0" step="0.01" value={adjustDialog.value}
                onChange={(e) => setAdjustDialog((p) => ({ ...p, value: e.target.value }))}
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-base font-semibold text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                placeholder={`Enter quantity (${unitAbbr(adjustDialog.unit)})`}
                autoFocus />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button"
                className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                onClick={closeAdjustDialog}>
                Cancel
              </button>
              <button type="button"
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
                  adjustDialog.mode === "add"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30"
                    : "bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-500/30"
                }`}
                onClick={handleConfirmAdjust}
                disabled={!adjustDialog.value.trim() || adjusting}>
                {adjusting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{adjustDialog.mode === "add" ? "Adding..." : "Removing..."}</>
                ) : adjustDialog.mode === "add" ? (
                  <><TrendingUp className="w-4 h-4" />Confirm Add</>
                ) : (
                  <><TrendingDown className="w-4 h-4" />Confirm Remove</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
