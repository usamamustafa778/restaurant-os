import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import DataTable from "../../components/ui/DataTable";
import PageLoader from "../../components/ui/PageLoader";
import ViewToggle from "../../components/ui/ViewToggle";
import { useBranch } from "../../contexts/BranchContext";
import { usePermissions } from "../../contexts/PermissionContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { handleAsyncAction } from "../../utils/toastActions";
import {
  getMenu,
  getDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  getCurrencySymbol,
  uploadImage,
} from "../../lib/apiClient";
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Percent,
  ShoppingBag,
  Upload,
  Link,
  X,
  Calendar,
  Tag,
  ArrowUpDown,
  RefreshCw,
  ChevronDown,
  FileDown,
  FileText,
  Printer,
  Building2,
} from "lucide-react";
import toast from "react-hot-toast";

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

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function ensureEndDateISO(startDateLike, endDateLike) {
  const start = new Date(startDateLike || new Date());
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  if (endDateLike) {
    const end = new Date(endDateLike);
    if (!Number.isNaN(end.getTime())) return end.toISOString();
  }
  return new Date(safeStart.getTime() + 86400000).toISOString();
}

function getEmptyForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: null,
    name: "",
    description: "",
    selectedItems: [],
    comboPrice: "",
    startDate: today,
    endDate: "",
    showOnPOS: true,
    imageUrl: "",
  };
}

export default function DealsPage() {
  const sym = getCurrencySymbol();
  const { currentBranch, branches } = useBranch() || {};
  const { hasPermission } = usePermissions();
  const { confirm } = useConfirmDialog();
  const { viewMode, setViewMode } = useViewMode("table");

  const fetchDeals = () => getDeals();
  const { data: deals, loading: pageLoading, error, suspended, setData: setDeals, refetch } = usePageData(fetchDeals);

  const fetchMenu = () => getMenu(currentBranch?.id);
  const { data: menuData } = usePageData(fetchMenu, [currentBranch?.id]);
  const menuItems = menuData?.items || [];
  const menuCategories = menuData?.categories || [];

  const [form, setForm] = useState(getEmptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [imageTab, setImageTab] = useState("link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [itemSearch, setItemSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showImageFields, setShowImageFields] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [branchImportModalOpen, setBranchImportModalOpen] = useState(false);
  const [branchImportSourceId, setBranchImportSourceId] = useState("");
  const [branchImportSourceDeals, setBranchImportSourceDeals] = useState([]);
  const [branchImportSourceLoading, setBranchImportSourceLoading] = useState(false);
  const [branchImportSelectedIds, setBranchImportSelectedIds] = useState([]);
  const [branchImportSubmitting, setBranchImportSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const exportMenuRef = useRef(null);
  const importMenuRef = useRef(null);

  const dealsList = Array.isArray(deals) ? deals : [];
  const sourceBranches = (branches || []).filter((b) => b.id !== currentBranch?.id);
  const canImportFromBranch = !!currentBranch?.id && sourceBranches.length > 0;

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
    if (!branchImportModalOpen || !branchImportSourceId) {
      setBranchImportSourceDeals([]);
      setBranchImportSelectedIds([]);
      return;
    }
    let cancelled = false;
    setBranchImportSourceLoading(true);
    getDeals(true)
      .then((allDeals) => {
        if (cancelled) return;
        const sourceDeals = (Array.isArray(allDeals) ? allDeals : []).filter((deal) =>
          (deal.branches || []).some((branchRef) => {
            const id = typeof branchRef === "string" ? branchRef : branchRef?.id || branchRef?._id;
            return String(id || "") === String(branchImportSourceId);
          })
        );
        setBranchImportSourceDeals(sourceDeals);
        setBranchImportSelectedIds([]);
      })
      .catch(() => {
        if (!cancelled) setBranchImportSourceDeals([]);
      })
      .finally(() => {
        if (!cancelled) setBranchImportSourceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchImportModalOpen, branchImportSourceId]);

  const filtered = dealsList
    .filter((deal) => {
      const term = search.trim().toLowerCase();
      if (term && !deal.name.toLowerCase().includes(term) && !(deal.description || "").toLowerCase().includes(term)) return false;
      if (filterStatus === "active" && !getDealStatus(deal)) return false;
      if (filterStatus === "inactive" && getDealStatus(deal)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sortBy === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sortBy === "price_asc") return (a.comboPrice || 0) - (b.comboPrice || 0);
      if (sortBy === "price_desc") return (b.comboPrice || 0) - (a.comboPrice || 0);
      return 0;
    });

  const menuItemById = new Map(menuItems.map((m) => [String(m.id), m]));
  const selectedItemsMap = new Map(form.selectedItems.map((s) => [String(s.menuItemId), s]));
  const selectedItemPills = form.selectedItems
    .map((s) => {
      const item = menuItemById.get(String(s.menuItemId));
      if (!item) return null;
      return { id: String(s.menuItemId), name: item.name };
    })
    .filter(Boolean);
  const selectedItemsTotal = form.selectedItems.reduce((sum, selected) => {
    const item = menuItemById.get(String(selected.menuItemId));
    const price = Number(item?.price) || 0;
    return sum + price * (Number(selected.quantity) || 1);
  }, 0);
  const comboPriceNum = Number(form.comboPrice) || 0;
  const savingsAmount = Math.max(0, selectedItemsTotal - comboPriceNum);

  const normalizedItemSearch = itemSearch.trim().toLowerCase();
  const categoryNameById = new Map(
    menuCategories.map((c) => [String(c.id || c._id), c.name]).filter(([, name]) => Boolean(name))
  );
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    const categoryName =
      (item.categoryName && String(item.categoryName).trim()) ||
      (item.category?.name && String(item.category.name).trim()) ||
      categoryNameById.get(String(item.categoryId || "")) ||
      "Uncategorized";
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(item);
    return acc;
  }, {});
  const categoryEntries = Object.entries(groupedMenuItems)
    .map(([categoryName, items]) => {
      const visibleItems = items
        .filter((item) => !normalizedItemSearch || item.name.toLowerCase().includes(normalizedItemSearch))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { categoryName, items: visibleItems };
    })
    .filter((group) => group.items.length > 0)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  function startCreate() {
    if (!currentBranch?.id) {
      toast.error("Please select a specific branch from the header before creating deals.");
      return;
    }
    setForm(getEmptyForm());
    setModalError("");
    setImageTab("link");
    setUploadError("");
    setItemSearch("");
    setCollapsedCategories(
      Object.fromEntries(
        Object.keys(
          menuItems.reduce((acc, item) => {
            const categoryName =
              (item.categoryName && String(item.categoryName).trim()) ||
              (item.category?.name && String(item.category.name).trim()) ||
              categoryNameById.get(String(item.categoryId || "")) ||
              "Uncategorized";
            acc[categoryName] = true;
            return acc;
          }, {})
        ).map((name) => [name, true])
      )
    );
    setShowImageFields(false);
    setIsModalOpen(true);
  }

  function startEdit(deal) {
    const id = deal._id || deal.id;
    setForm({
      id,
      name: deal.name || "",
      description: deal.description || "",
      selectedItems: (deal.comboItems || []).map((ci) => ({
        menuItemId: ci.menuItem?._id || ci.menuItem,
        quantity: ci.quantity || 1,
      })),
      comboPrice: deal.comboPrice != null ? String(deal.comboPrice) : "",
      startDate: deal.startDate ? deal.startDate.slice(0, 10) : "",
      endDate: deal.endDate ? deal.endDate.slice(0, 10) : "",
      showOnPOS: deal.showOnPOS ?? true,
      imageUrl: deal.imageUrl || "",
    });
    setModalError("");
    setImageTab("link");
    setUploadError("");
    setItemSearch("");
    setCollapsedCategories(
      Object.fromEntries(
        Object.keys(
          menuItems.reduce((acc, item) => {
            const categoryName =
              (item.categoryName && String(item.categoryName).trim()) ||
              (item.category?.name && String(item.category.name).trim()) ||
              categoryNameById.get(String(item.categoryId || "")) ||
              "Uncategorized";
            acc[categoryName] = true;
            return acc;
          }, {})
        ).map((name) => [name, true])
      )
    );
    setShowImageFields(Boolean(deal.imageUrl));
    setIsModalOpen(true);
  }

  function toggleItemSelection(menuItemId) {
    setForm((prev) => {
      const existing = prev.selectedItems.find((i) => i.menuItemId === menuItemId);
      if (existing) {
        return { ...prev, selectedItems: prev.selectedItems.filter((i) => i.menuItemId !== menuItemId) };
      }
      return { ...prev, selectedItems: [...prev.selectedItems, { menuItemId, quantity: 1 }] };
    });
  }

  function setItemQuantity(menuItemId, qty) {
    const q = Math.max(1, Number(qty) || 1);
    setForm((prev) => ({
      ...prev,
      selectedItems: prev.selectedItems.map((i) =>
        i.menuItemId === menuItemId ? { ...i, quantity: q } : i,
      ),
    }));
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: result.url }));
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Deal name is required");
      toast.error("Deal name is required");
      return;
    }
    if (!form.comboPrice) {
      setModalError("Deal price is required");
      toast.error("Deal price is required");
      return;
    }
    if (form.selectedItems.length === 0) {
      setModalError("Please select at least one item");
      toast.error("Please select at least one item");
      return;
    }

    setModalError("");
    setIsLoading(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      dealType: "COMBO",
      comboItems: form.selectedItems.map((s) => ({
        menuItem: s.menuItemId,
        quantity: s.quantity,
      })),
      comboPrice: Number(form.comboPrice),
      startDate: new Date(form.startDate || new Date()).toISOString(),
      endDate: ensureEndDateISO(form.startDate || new Date(), form.endDate),
      showOnPOS: form.showOnPOS,
      branches: currentBranch?.id ? [currentBranch.id] : [],
      imageUrl: form.imageUrl.trim() || undefined,
    };

    const result = await handleAsyncAction(
      async () => {
        if (form.id) {
          const updated = await updateDeal(form.id, payload);
          setDeals((prev) => (Array.isArray(prev) ? prev.map((d) => ((d._id || d.id) === form.id ? updated : d)) : prev));
          return updated;
        } else {
          const created = await createDeal(payload);
          setDeals((prev) => (Array.isArray(prev) ? [...prev, created] : [created]));
          return created;
        }
      },
      {
        loading: form.id ? "Updating deal..." : "Creating deal...",
        success: form.id ? "Deal updated successfully" : "Deal created successfully",
        error: "Failed to save deal",
      }
    );

    setIsLoading(false);

    if (result.success) {
      setForm(getEmptyForm());
      setIsModalOpen(false);
    } else {
      setModalError(result.error);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete deal",
      message: "Delete this deal? This cannot be undone.",
    });
    if (!ok) return;

    setDeletingId(id);

    await handleAsyncAction(
      async () => {
        await deleteDeal(id);
        setDeals((prev) => (Array.isArray(prev) ? prev.filter((d) => (d._id || d.id) !== id) : prev));
      },
      {
        loading: "Deleting deal...",
        success: "Deal deleted successfully",
        error: "Failed to delete deal",
      }
    );

    setDeletingId(null);
  }

  function getDealStatus(deal) {
    return deal.isActive && deal.endDate && new Date(deal.endDate) >= new Date();
  }

  function exportCSV() {
    const date = new Date().toLocaleDateString("en-PK");
    const branchName = currentBranch?.name || "All Branches";
    const rows = [
      ["Deals Report"],
      ["Branch", branchName],
      ["Generated", date],
      [],
      ["Name", "Description", "Items", "Deal Price", "Start Date", "End Date", "Show On POS", "Status"],
      ...filtered.map((deal) => {
        const comboItems = (deal.comboItems || [])
          .map((ci) => `${ci.menuItem?.name || "Item"} x${Number(ci.quantity) || 1}`)
          .join(" | ");
        const startDate = deal.startDate ? String(deal.startDate).slice(0, 10) : "";
        const endDate = deal.endDate ? String(deal.endDate).slice(0, 10) : "";
        return [
          deal.name || "",
          deal.description || "",
          comboItems,
          deal.comboPrice ?? "",
          startDate,
          endDate,
          deal.showOnPOS ?? true ? "Yes" : "No",
          getDealStatus(deal) ? "Active" : "Inactive",
        ];
      }),
      [],
      ["SUMMARY"],
      ["Total Deals", filtered.length],
      ["Active", filtered.filter((d) => getDealStatus(d)).length],
      ["Inactive", filtered.filter((d) => !getDealStatus(d)).length],
    ];
    const content = rows.map(toCSVRow).join("\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals-${branchName.replace(/\s/g, "-")}-${date.replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported — open in Excel");
    setExportMenuOpen(false);
  }

  function buildDealsHTML(title, extraStyle = "") {
    const date = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
    const branchName = currentBranch?.name || "All Branches";
    const activeCount = filtered.filter((d) => getDealStatus(d)).length;
    const inactiveCount = filtered.length - activeCount;
    const rows = filtered
      .map((deal) => {
        const comboItems = (deal.comboItems || [])
          .map((ci) => `${ci.menuItem?.name || "Item"} x${Number(ci.quantity) || 1}`)
          .join(", ");
        const status = getDealStatus(deal);
        const statusStyle = status ? "background:#f0fdf4;color:#16a34a;" : "background:#f3f4f6;color:#4b5563;";
        return `<tr>
          <td><strong>${deal.name || ""}</strong>${deal.description ? `<br><span style="font-size:11px;color:#6b7280">${deal.description}</span>` : ""}</td>
          <td>${comboItems || "-"}</td>
          <td style="font-weight:700">${sym} ${Number(deal.comboPrice || 0).toLocaleString()}</td>
          <td>${deal.startDate ? String(deal.startDate).slice(0, 10) : "-"}</td>
          <td>${deal.endDate ? String(deal.endDate).slice(0, 10) : "-"}</td>
          <td><span style="font-weight:700;padding:2px 8px;border-radius:4px;font-size:11px;${statusStyle}">${status ? "Active" : "Inactive"}</span></td>
        </tr>`;
      })
      .join("");

    return `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:1100px;margin:0 auto}
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
<h1>Deals Report</h1>
<p class="meta">${branchName} &nbsp;·&nbsp; ${date}</p>
<div class="summary">
  <div class="stat"><div class="stat-label">Total Deals</div><div class="stat-value" style="color:#1d4ed8">${filtered.length}</div></div>
  <div class="stat"><div class="stat-label">Active</div><div class="stat-value" style="color:#16a34a">${activeCount}</div></div>
  <div class="stat"><div class="stat-label">Inactive</div><div class="stat-value" style="color:#6b7280">${inactiveCount}</div></div>
</div>
<table>
  <thead><tr><th>Name</th><th>Items</th><th>Deal Price</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:32px">No deals match current filter</td></tr>'}</tbody>
</table>
</body></html>`;
  }

  function exportPDF() {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked — please allow pop-ups.");
      return;
    }
    win.document.write(buildDealsHTML("Deals - PDF", "@media print{@page{size:A4 landscape}}"));
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 300);
    setExportMenuOpen(false);
  }

  function printDeals() {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked — please allow pop-ups.");
      return;
    }
    win.document.write(buildDealsHTML("Deals - Print"));
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 300);
    setExportMenuOpen(false);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!currentBranch?.id) {
      toast.error("Select a branch in the header before importing.");
      return;
    }
    if (!menuItems.length) {
      toast.error("Add menu items before importing deals.");
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
      return set.has("name") && (set.has("deal price") || set.has("price") || set.has("combo price"));
    };

    const buildColMap = (cells) => {
      const col = {};
      cells.forEach((raw, i) => {
        const k = normHeader(raw);
        if (k === "name" || k === "deal name") col.name = i;
        else if (k === "description") col.description = i;
        else if (k === "items" || k === "combo items") col.items = i;
        else if (k === "deal price" || k === "price" || k === "combo price") col.price = i;
        else if (k === "start date" || k === "start") col.startDate = i;
        else if (k === "end date" || k === "end" || k === "expiry date") col.endDate = i;
        else if (k === "show on pos" || k === "showonpos") col.showOnPos = i;
      });
      return col;
    };

    const isStopRow = (cells) => {
      const a = normHeader(cells[0]);
      return (
        a === "summary" ||
        a === "total deals" ||
        a === "active" ||
        a === "inactive" ||
        a === "deals report" ||
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
      col = { name: 0, price: 1 };
      headerIdx = -1;
    }
    if (col.name == null || col.price == null) {
      toast.error("CSV needs columns: name and deal price (or export from this page).");
      return;
    }

    const parseYesNoCell = (s) => {
      const t = String(s ?? "").trim().toLowerCase();
      if (!t) return true;
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

    const parseItemsCell = (raw) => {
      const itemMap = new Map(menuItems.map((m) => [String(m.name || "").trim().toLowerCase(), m]));
      const value = String(raw ?? "").trim();
      if (!value) return { comboItems: [], unknown: [] };
      const parts = value
        .split(/\s*\|\s*|\s*;\s*/g)
        .map((p) => p.trim())
        .filter(Boolean);
      const comboItems = [];
      const unknown = [];
      for (const part of parts) {
        const match = part.match(/^(.+?)(?:\s*[xX]\s*(\d+))?$/);
        const name = String(match?.[1] || "").trim();
        const qty = Math.max(1, Number(match?.[2]) || 1);
        const menuItem = itemMap.get(name.toLowerCase());
        if (!menuItem) {
          unknown.push(name);
          continue;
        }
        comboItems.push({ menuItem: menuItem.id, quantity: qty });
      }
      return { comboItems, unknown };
    };

    const existingNames = new Set(dealsList.map((d) => String(d.name || "").trim().toLowerCase()));
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
        description: col.description != null ? String(cells[col.description] ?? "").trim() : "",
        itemsRaw: col.items != null ? String(cells[col.items] ?? "").trim() : "",
        priceRaw: cells[col.price],
        startDate: col.startDate != null ? String(cells[col.startDate] ?? "").trim() : "",
        endDate: col.endDate != null ? String(cells[col.endDate] ?? "").trim() : "",
        showOnPosRaw: col.showOnPos != null ? cells[col.showOnPos] : undefined,
      });
    }

    if (!rows.length) {
      toast.error("No deal rows found in CSV");
      return;
    }

    setImportLoading(true);
    const newDeals = [];
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

        const price = parsePriceCell(row.priceRaw);
        if (Number.isNaN(price)) {
          skipped++;
          failReasons.push(`Invalid deal price (${row.name})`);
          continue;
        }

        const { comboItems, unknown } = parseItemsCell(row.itemsRaw);
        if (!comboItems.length) {
          skipped++;
          failReasons.push(
            unknown.length
              ? `Unknown items (${row.name}): ${unknown.slice(0, 2).join(", ")}`
              : `No items found (${row.name})`,
          );
          continue;
        }

        const startDate = row.startDate ? new Date(row.startDate) : new Date();
        if (Number.isNaN(startDate.getTime())) {
          skipped++;
          failReasons.push(`Invalid start date (${row.name})`);
          continue;
        }
        const endDate = row.endDate ? new Date(row.endDate) : null;
        if (endDate && Number.isNaN(endDate.getTime())) {
          skipped++;
          failReasons.push(`Invalid end date (${row.name})`);
          continue;
        }

        const payload = {
          name: row.name,
          description: row.description || "",
          dealType: "COMBO",
          comboItems,
          comboPrice: price,
          startDate: startDate.toISOString(),
          endDate: ensureEndDateISO(startDate, endDate),
          showOnPOS:
            row.showOnPosRaw !== undefined && row.showOnPosRaw !== ""
              ? parseYesNoCell(row.showOnPosRaw)
              : true,
          branches: [currentBranch.id],
        };

        try {
          const createdDeal = await createDeal(payload);
          existingNames.add(key);
          newDeals.push(createdDeal);
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

    if (newDeals.length) {
      setDeals((prev) => (Array.isArray(prev) ? [...prev, ...newDeals] : newDeals));
    }

    if (created > 0) {
      toast.success(
        `Imported ${created} deal${created === 1 ? "" : "s"}${
          skipped ? ` · ${skipped} skipped` : ""
        }`,
      );
      if (failReasons.length) {
        toast(failReasons.slice(0, 2).join(" · "), { duration: 5000 });
      }
    } else if (skipped > 0) {
      toast.error(
        failReasons.length
          ? failReasons.slice(0, 2).join(" · ") + (failReasons.length > 2 ? " …" : "")
          : "No rows imported (duplicates or invalid data).",
      );
    } else {
      toast.error("Nothing to import");
    }
  }

  async function handleImportFromBranch() {
    if (!currentBranch?.id) {
      toast.error("Select a destination branch in the header before importing.");
      return;
    }
    if (!branchImportSourceId || branchImportSelectedIds.length === 0) {
      toast.error("Select at least one deal to import.");
      return;
    }

    setBranchImportSubmitting(true);
    const existingNames = new Set(dealsList.map((d) => String(d.name || "").trim().toLowerCase()));
    const menuItemIds = new Set(menuItems.map((m) => String(m.id)));
    let created = 0;
    let skipped = 0;
    const failReasons = [];

    try {
      const selectedSet = new Set(branchImportSelectedIds);
      const sourceDeals = branchImportSourceDeals.filter((deal) =>
        selectedSet.has(String(deal._id || deal.id))
      );
      if (!sourceDeals.length) {
        toast("No deals found in selected branch.");
        return;
      }

      const createdDeals = [];
      for (const deal of sourceDeals) {
        const key = String(deal.name || "").trim().toLowerCase();
        if (!key || existingNames.has(key)) {
          skipped++;
          continue;
        }

        const comboItems = (deal.comboItems || [])
          .map((ci) => {
            const rawId = ci.menuItem?._id || ci.menuItem?.id || ci.menuItem;
            const menuItemId = String(rawId || "");
            if (!menuItemIds.has(menuItemId)) return null;
            return { menuItem: menuItemId, quantity: Math.max(1, Number(ci.quantity) || 1) };
          })
          .filter(Boolean);

        if (!comboItems.length) {
          skipped++;
          failReasons.push(`Missing menu items for ${deal.name}`);
          continue;
        }

        const payload = {
          name: deal.name || "",
          description: deal.description || "",
          dealType: "COMBO",
          comboItems,
          comboPrice: Number(deal.comboPrice) || 0,
          startDate: deal.startDate ? new Date(deal.startDate).toISOString() : new Date().toISOString(),
          endDate: ensureEndDateISO(deal.startDate || new Date(), deal.endDate),
          showOnPOS: deal.showOnPOS ?? true,
          imageUrl: deal.imageUrl || undefined,
          branches: [currentBranch.id],
        };

        try {
          const createdDeal = await createDeal(payload);
          createdDeals.push(createdDeal);
          existingNames.add(key);
          created++;
        } catch (err) {
          skipped++;
          failReasons.push(`${deal.name}: ${err?.message || "Failed to create"}`);
        }
      }

      if (createdDeals.length) {
        setDeals((prev) => (Array.isArray(prev) ? [...prev, ...createdDeals] : createdDeals));
      }

      if (created > 0) {
        toast.success(`Imported ${created} deal${created === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`);
        if (failReasons.length) toast(failReasons.slice(0, 2).join(" · "), { duration: 5000 });
        setBranchImportModalOpen(false);
        setBranchImportSourceId("");
        setBranchImportSourceDeals([]);
        setBranchImportSelectedIds([]);
      } else {
        toast.error(failReasons[0] || "No deals imported from selected branch.");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to import from branch");
    } finally {
      setBranchImportSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Deals" suspended={suspended}>
      <PermissionGate permission="menu.manage_deals">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFile}
      />
      {error && !pageLoading && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals..."
            className="flex-1 h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
          />
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }}
            disabled={refreshing || pageLoading}
            title="Refresh"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-gray-200 bg-white text-gray-600 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={filtered.length === 0}
              title="Export deals"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <FileDown className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full z-[100] mt-1.5 w-56 overflow-hidden rounded-xl border-2 border-gray-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="menu">
                <button type="button" role="menuitem" onClick={exportCSV} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800">
                  <FileDown className="h-4 w-4 shrink-0 text-gray-400" />
                  Download CSV
                </button>
                <button type="button" role="menuitem" onClick={exportPDF} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  Export PDF...
                </button>
                <button type="button" role="menuitem" onClick={printDeals} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800">
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
              title={!currentBranch?.id ? "Select a branch in the header first" : "Import deals"}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {importLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Upload className="h-4 w-4 shrink-0" />}
              <span className="hidden sm:inline">Import</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${importMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {importMenuOpen && (
              <div className="absolute right-0 top-full z-[100] mt-1.5 w-56 overflow-hidden rounded-xl border-2 border-gray-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canImportFromBranch}
                  title={!canImportFromBranch ? "No other branches available" : undefined}
                  onClick={() => {
                    setImportMenuOpen(false);
                    setBranchImportSourceId("");
                    setBranchImportModalOpen(true);
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
          {hasPermission("menu.manage_deals") && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </button>
          )}
        </div>

        {/* Filter + Sort pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mr-1">Status:</span>
          {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilterStatus(val)}
              className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === val
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-primary/40 hover:text-primary"
              }`}
            >
              {label}
              {val !== "all" && (
                <span className="ml-1.5 opacity-70">
                  {dealsList.filter(d => val === "active" ? getDealStatus(d) : !getDealStatus(d)).length}
                </span>
              )}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 dark:bg-neutral-700 mx-1" />
          <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mr-1">Sort:</span>
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-7 pl-7 pr-3 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 outline-none focus:border-primary transition-all appearance-none cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
            </select>
          </div>
          {(filterStatus !== "all" || sortBy !== "newest" || search) && (
            <button
              type="button"
              onClick={() => { setFilterStatus("all"); setSortBy("newest"); setSearch(""); }}
              className="h-7 px-3 rounded-lg text-xs font-semibold text-gray-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-gray-200 dark:border-neutral-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 dark:text-neutral-500">
            {filtered.length} deal{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {pageLoading ? (
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Percent className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                Loading deals...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === "grid" && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((deal) => {
                const id = deal._id || deal.id;
                const isActive = getDealStatus(deal);
                const isDeleting = deletingId === id;
                const comboItems = deal.comboItems || [];
                const endDate = deal.endDate ? new Date(deal.endDate) : null;
                const daysLeft = endDate ? Math.ceil((endDate - new Date()) / 86400000) : null;

                return (
                  <div
                    key={id}
                    className={`group bg-white dark:bg-neutral-950 rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all ${
                      isActive
                        ? "border-gray-200 dark:border-neutral-800 hover:border-primary/20"
                        : "border-gray-200 dark:border-neutral-800 opacity-55"
                    }`}
                  >
                    {/* Banner / Image */}
                    <div className="relative h-32 bg-gradient-to-br from-primary/15 via-secondary/10 to-primary/5 dark:from-primary/20 dark:via-secondary/15 dark:to-primary/10 overflow-hidden">
                      {deal.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={deal.imageUrl} alt={deal.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Percent className="w-12 h-12 text-primary/30" />
                        </div>
                      )}
                      {/* Status badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm ${
                          isActive
                            ? "bg-emerald-500/90 text-white"
                            : "bg-gray-500/80 text-white"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : "bg-white/70"}`} />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {/* Action buttons */}
                      {hasPermission("menu.manage_deals") && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEdit(deal)}
                          disabled={isDeleting}
                          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-600 hover:text-primary hover:bg-white shadow-sm transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(id)}
                          disabled={isDeleting}
                          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-white shadow-sm transition-colors"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate mb-0.5">
                        {deal.name}
                      </p>
                      {deal.description && (
                        <p className="text-xs text-gray-500 dark:text-neutral-400 line-clamp-1 mb-2">
                          {deal.description}
                        </p>
                      )}

                      {/* Items chips */}
                      {comboItems.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {comboItems.slice(0, 2).map((ci, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-[10px] font-medium text-gray-600 dark:text-neutral-400">
                              <Tag className="w-2.5 h-2.5" />
                              {ci.menuItem?.name || "Item"}{ci.quantity > 1 ? ` ×${ci.quantity}` : ""}
                            </span>
                          ))}
                          {comboItems.length > 2 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-[10px] font-medium text-gray-500 dark:text-neutral-500">
                              +{comboItems.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer row */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-neutral-800">
                        <span className="text-sm font-extrabold text-primary">{sym} {deal.comboPrice?.toLocaleString()}</span>
                        {daysLeft !== null && isActive && (
                          <span className={`flex items-center gap-1 text-[10px] font-semibold ${daysLeft <= 3 ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}>
                            <Calendar className="w-3 h-3" />
                            {daysLeft <= 0 ? "Expired" : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                    <Percent className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-neutral-400 mb-1">
                    {dealsList.length === 0 ? "No deals yet" : "No deals match your filters"}
                  </p>
                  {dealsList.length === 0 && (
                    <button
                      onClick={startCreate}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Deal
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Table View */}
          {viewMode === "table" && (
            <DataTable
              variant="card"
              columns={[
                {
                  key: "name",
                  header: "Name",
                  render: (value, row) => (
                    <div className="max-w-xs">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{value}</p>
                      {row.description && (
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                          {row.description}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: "comboItems",
                  header: "Items",
                  hideOnMobile: true,
                  render: (value) => {
                    const items = (value || []).map((ci) => `${ci.menuItem?.name || "Item"} ×${ci.quantity}`);
                    const preview = items.slice(0, 2).join(", ");
                    const extra = items.length > 2 ? ` +${items.length - 2} more` : "";
                    return (
                      <span className="text-sm text-gray-600 dark:text-neutral-400 max-w-xs block truncate">
                        {items.length ? preview + extra : "—"}
                      </span>
                    );
                  },
                },
                {
                  key: "comboPrice",
                  header: "Price",
                  render: (value) => (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {sym} {value}
                    </span>
                  ),
                },
                {
                  key: "isActive",
                  header: "Status",
                  hideOnTablet: true,
                  render: (_, row) => {
                    const isActive = getDealStatus(row);
                    return (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    );
                  },
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (_, row) => {
                    const id = row._id || row.id;
                    const isDeleting = deletingId === id;
                    return hasPermission("menu.manage_deals") ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors disabled:opacity-50"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : null;
                  },
                },
              ]}
              rows={filtered}
              emptyMessage={
                dealsList.length === 0
                  ? "No deals yet. Click 'New Deal' to create one."
                  : "No deals match your search"
              }
            />
          )}
        </>
      )}

      {/* Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-neutral-800">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {form.id ? "Edit Deal" : "New Deal"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                  {form.id ? "Update deal details below" : "Fill in details and pick items for this combo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Two-column body */}
            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">

              {/* Left — Deal Details */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 md:border-r border-gray-100 dark:border-neutral-800">

                {modalError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                    {modalError}
                  </div>
                )}

                {/* Deal name + pricing + validity */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Deal name <span className="text-red-500 normal-case">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Family Combo"
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Deal price <span className="text-red-500 normal-case">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400">{sym}</span>
                      <input
                        type="number"
                        min={0}
                        value={form.comboPrice}
                        onChange={(e) => setForm((f) => ({ ...f, comboPrice: e.target.value }))}
                        placeholder="Deal price"
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-neutral-400">
                      Items total: {sym} {Math.round(selectedItemsTotal).toLocaleString()}{" "}
                      <span className="mx-1 text-gray-300 dark:text-neutral-600">|</span>
                      You save: {sym} {Math.round(savingsAmount).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Deal valid from
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                        className="flex-1 w-0 px-2 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                      <span className="text-gray-400 text-xs flex-shrink-0">to</span>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                        className="flex-1 w-0 px-2 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-400 dark:text-neutral-500">
                      Leave empty for no expiry
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                    Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the deal..."
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                  />
                </div>

                {/* Show on POS */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setForm((f) => ({ ...f, showOnPOS: !f.showOnPOS }))}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${form.showOnPOS ? "bg-primary" : "bg-gray-300 dark:bg-neutral-700"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.showOnPOS ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-neutral-300 font-medium">Show on POS</span>
                </label>

                {/* Image (collapsed by default) */}
                <div>
                  {!showImageFields ? (
                    <button
                      type="button"
                      onClick={() => setShowImageFields(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Image
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
                          Image <span className="text-gray-400 font-normal normal-case">(optional)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowImageFields(false)}
                          className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                        >
                          Hide
                        </button>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 space-y-2">
                          <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden w-fit">
                            <button type="button" onClick={() => setImageTab("link")}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${imageTab === "link" ? "bg-primary text-white" : "bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"}`}>
                              <Link className="w-3 h-3" />Paste URL
                            </button>
                            <button type="button" onClick={() => setImageTab("upload")}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium border-l border-gray-200 dark:border-neutral-700 transition-colors ${imageTab === "upload" ? "bg-primary text-white" : "bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"}`}>
                              <Upload className="w-3 h-3" />Upload
                            </button>
                          </div>
                          {imageTab === "link" && (
                            <input type="text" value={form.imageUrl}
                              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                              placeholder="https://example.com/image.jpg"
                              className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                            />
                          )}
                          {imageTab === "upload" && (
                            <label className={`flex items-center justify-center gap-2 w-full h-10 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploading ? "border-primary/40 bg-primary/5" : "border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:border-primary/60 hover:bg-primary/5"}`}>
                              {uploading ? <><Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /><span className="text-xs text-primary font-medium">Uploading…</span></> : <><Upload className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-500">Browse file</span></>}
                              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                            </label>
                          )}
                          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                        </div>
                        {form.imageUrl && (
                          <div className="relative flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={form.imageUrl} alt="Preview" className="h-16 w-16 rounded-xl object-cover border border-gray-200 dark:border-neutral-700" />
                            <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* Right — Item picker */}
              <div className="md:w-80 flex flex-col border-t md:border-t-0 border-gray-100 dark:border-neutral-800 flex-shrink-0">
                <div className="px-4 pt-4 pb-2 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                    Items in deal <span className="text-red-500 normal-case">*</span>
                  </p>
                  {form.selectedItems.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      {form.selectedItems.length} selected
                    </span>
                  )}
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search items..."
                    className="mt-2 w-full px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                  {selectedItemPills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedItemPills.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItemSelection(item.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/15"
                          title={`Remove ${item.name}`}
                        >
                          <X className="w-3 h-3" />
                          <span className="max-w-[120px] truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
                  {menuItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-neutral-700 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-neutral-500">No menu items found.</p>
                    </div>
                  ) : categoryEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-neutral-700 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-neutral-500">No matching items.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categoryEntries.map(({ categoryName, items }) => {
                        const isCollapsed = !!collapsedCategories[categoryName];
                        const selectedInCategory = items.filter((item) => selectedItemsMap.has(String(item.id))).length;
                        return (
                          <div key={categoryName} className="rounded-xl border border-gray-100 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedCategories((prev) => ({
                                  ...prev,
                                  [categoryName]: !prev[categoryName],
                                }))
                              }
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
                            >
                              <span className="text-[11px] font-semibold text-gray-600 dark:text-neutral-300 truncate">
                                {categoryName} ({items.length})
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-medium text-primary/80 dark:text-primary/90">
                                  {selectedInCategory} selected
                                </span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                                />
                              </div>
                            </button>
                            {!isCollapsed && (
                              <div className="space-y-1 px-2 pb-2">
                                {items.map((item) => {
                                  const selected = form.selectedItems.find((s) => String(s.menuItemId) === String(item.id));
                                  return (
                                    <div
                                      key={item.id}
                                      onClick={() => toggleItemSelection(item.id)}
                                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${selected ? "bg-primary/8 dark:bg-primary/10 border border-primary/20" : "hover:bg-gray-50 dark:hover:bg-neutral-900 border border-transparent"}`}
                                    >
                                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${selected ? "bg-primary border-primary" : "border-gray-300 dark:border-neutral-600"}`}>
                                          {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <div className="min-w-0">
                                          <p className={`text-xs font-semibold truncate ${selected ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-neutral-300"}`}>{item.name}</p>
                                          <p className="text-[10px] text-gray-400 dark:text-neutral-500">{sym} {item.price}</p>
                                        </div>
                                      </div>
                                      {selected && (
                                        <input
                                          type="number"
                                          min={1}
                                          value={selected.quantity}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => setItemQuantity(item.id, e.target.value)}
                                          className="w-12 px-1.5 py-1 border-2 border-primary/30 rounded-lg text-xs text-center bg-white dark:bg-neutral-900 text-gray-900 dark:text-white outline-none focus:border-primary transition-all ml-2 flex-shrink-0"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800 flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                ) : (
                  form.id ? "Update Deal" : "Create Deal"
                )}
              </button>
            </div>

          </div>
        </div>
      )}
      {branchImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Import deals from branch</h3>
              <button
                type="button"
                onClick={() => {
                  if (branchImportSubmitting) return;
                  setBranchImportModalOpen(false);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Source branch</label>
                <select
                  value={branchImportSourceId}
                  onChange={(e) => setBranchImportSourceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">Select branch</option>
                  {sourceBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              {branchImportSourceId && currentBranch?.name && (
                <p className="text-xs text-gray-600 dark:text-neutral-400">
                  Copying from <strong>{sourceBranches.find((b) => b.id === branchImportSourceId)?.name ?? "source"}</strong> to <strong>{currentBranch.name}</strong> (this branch). Select deals to import.
                </p>
              )}
              {branchImportSourceLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              {!branchImportSourceLoading && branchImportSourceId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400">Deals from source branch</p>
                    {branchImportSourceDeals.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setBranchImportSelectedIds(branchImportSourceDeals.map((d) => String(d._id || d.id)))}
                          className="text-xs text-primary hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setBranchImportSelectedIds([])}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Deselect all
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800">
                    {branchImportSourceDeals.map((deal) => {
                      const id = String(deal._id || deal.id);
                      const checked = branchImportSelectedIds.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setBranchImportSelectedIds((prev) =>
                                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                              )
                            }
                            className="rounded border-gray-300 text-primary"
                          />
                          <span className="text-sm text-gray-900 dark:text-white flex-1">{deal.name}</span>
                          <span className="text-xs text-gray-500">{sym} {Number(deal.comboPrice || 0).toFixed(0)}</span>
                        </label>
                      );
                    })}
                    {branchImportSourceDeals.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">No deals in selected branch</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (branchImportSubmitting) return;
                  setBranchImportModalOpen(false);
                }}
                className="rounded-xl border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportFromBranch}
                disabled={!branchImportSourceId || branchImportSelectedIds.length === 0 || branchImportSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {branchImportSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {branchImportSubmitting ? "Importing..." : "Import selected"}
              </button>
            </div>
          </div>
        </div>
      )}
      </PermissionGate>
    </AdminLayout>
  );
}
