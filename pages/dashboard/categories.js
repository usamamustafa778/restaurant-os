import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import ViewToggle from "../../components/ui/ViewToggle";
import ActionDropdown from "../../components/ui/ActionDropdown";
import {
  getMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  getStoredAuth,
  getSourceBranchMenu,
  copyMenuFromBranch,
} from "../../lib/apiClient";
import {
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  Loader2,
  Copy,
  X,
  Download,
  Upload,
  Search,
  ChevronDown,
  Building2,
  FileText,
  Printer,
} from "lucide-react";
import { useBranch } from "../../contexts/BranchContext";
import { usePermissions } from "../../contexts/PermissionContext";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useDropdown } from "../../hooks/useDropdown";
import { handleAsyncAction } from "../../utils/toastActions";
import toast from "react-hot-toast";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function categoriesExportPDFHTML(categories, items, title) {
  const rows = categories
    .map((c) => {
      const count = items.filter((i) => i.categoryId === c.id).length;
      const desc = (c.description || "—").replace(/\s+/g, " ");
      return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(desc)}</td><td style="text-align:right">${count}</td></tr>`;
    })
    .join("");
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
<style>
body{font-family:system-ui,sans-serif;font-size:12px;padding:24px;color:#111}
h1{font-size:18px;margin:0 0 4px}
p.sub{margin:0 0 16px;color:#555;font-size:13px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:8px 10px;text-align:left}
th{background:#f5f5f5;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
</style></head><body>
<h1>${safeTitle}</h1>
<p class="sub">${categories.length} categor${categories.length === 1 ? "y" : "ies"} · ${escapeHtml(new Date().toLocaleString())}</p>
<table><thead><tr><th>Name</th><th>Description</th><th style="text-align:right">Items</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

function openPrintableCategoriesHTML(html) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Allow pop-ups to export PDF or print");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

const isAdminRole = (role) => role === "restaurant_admin" || role === "admin";

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "items_desc", label: "Most items" },
];

const ITEM_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "with_items", label: "With menu items" },
  { value: "empty", label: "Empty (no items)" },
];

const selectBaseCls =
  "h-9 px-2.5 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-xl text-xs text-gray-800 dark:text-neutral-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all";
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

function escapeCSVField(s) {
  const t = String(s ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function exportCategoriesToCSV(categories, items) {
  const header = ["name", "description", "item_count"];
  const lines = [header.join(",")];
  for (const c of categories) {
    const count = items.filter((i) => i.categoryId === c.id).length;
    lines.push(
      [
        escapeCSVField(c.name),
        escapeCSVField(c.description || ""),
        String(count),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `categories-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function countItemsForCategory(categoryId, categories, items) {
  const childIds = categories
    .filter((c) => c.parentId === categoryId)
    .map((c) => c.id);
  const ids = new Set([categoryId, ...childIds]);
  return items.filter((i) => ids.has(i.categoryId)).length;
}

function sortCategories(list, sortBy, categories, items) {
  const sorted = [...list];
  sorted.sort((a, b) => {
    const countA = countItemsForCategory(a.id, categories, items);
    const countB = countItemsForCategory(b.id, categories, items);
    switch (sortBy) {
      case "name_desc":
        return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
      case "newest": {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      }
      case "oldest": {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ta - tb;
      }
      case "items_desc":
        return countB - countA;
      case "name_asc":
      default:
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
  });
  return sorted;
}

export default function CategoriesPage() {
  const { branches, currentBranch } = useBranch() || {};
  const { hasPermission } = usePermissions();
  const isAdmin = isAdminRole(getStoredAuth()?.user?.role);
  const sourceBranches = (branches || []).filter((b) => b.id !== currentBranch?.id);
  const {
    data: menuData,
    loading: pageLoading,
    error,
    suspended,
    setData: setMenuData,
  } = usePageData(() => getMenu(currentBranch?.id), [currentBranch?.id]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    description: "",
    parentId: "",
  });
  const [parentPreset, setParentPreset] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [itemFilter, setItemFilter] = useState("all");
  const [importLoading, setImportLoading] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const importMenuRef = useRef(null);
  const exportMenuRef = useRef(null);
  const [modalError, setModalError] = useState("");
  const { viewMode, setViewMode } = useViewMode("table");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const {
    toggle: toggleDropdown,
    close: closeDropdown,
    isOpen: isDropdownOpen,
  } = useDropdown();
  const { confirm } = useConfirmDialog();

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceBranchId, setCopySourceBranchId] = useState("");
  const [copySourceData, setCopySourceData] = useState(null);
  const [copySourceLoading, setCopySourceLoading] = useState(false);
  const [copySelectedCategoryIds, setCopySelectedCategoryIds] = useState([]);
  const [copySubmitting, setCopySubmitting] = useState(false);

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
    if (!copySourceBranchId || !copyModalOpen || copySourceBranchId === "all") {
      setCopySourceData(null);
      setCopySelectedCategoryIds([]);
      return;
    }
    let cancelled = false;
    setCopySourceLoading(true);
    getSourceBranchMenu(copySourceBranchId)
      .then((data) => {
        if (cancelled) return;
        const cats = data?.categories ?? [];
        setCopySourceData({ categories: cats });
        setCopySelectedCategoryIds(cats.map((c) => c.id));
      })
      .catch(() => {
        if (!cancelled) setCopySourceData({ categories: [] });
      })
      .finally(() => {
        if (!cancelled) setCopySourceLoading(false);
      });
    return () => { cancelled = true; };
  }, [copySourceBranchId, copyModalOpen]);

  function toggleCopyCategory(id) {
    setCopySelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCopySubmit() {
    if (!currentBranch?.id || !copySourceBranchId) return;
    setCopySubmitting(true);
    try {
      if (copySourceBranchId === "all") {
        for (const branch of sourceBranches) {
          const data = await getSourceBranchMenu(branch.id);
          const categoryIds = (data?.categories ?? []).map((c) => c.id);
          if (categoryIds.length) await copyMenuFromBranch(branch.id, { categoryIds, itemIds: [] });
        }
        toast.success("Categories copied from all branches to this branch.");
      } else {
        await copyMenuFromBranch(copySourceBranchId, {
          categoryIds: copySelectedCategoryIds,
          itemIds: [],
        });
        toast.success("Categories copied to this branch.");
      }
      setCopyModalOpen(false);
      setCopySourceBranchId("");
      const refreshed = await getMenu();
      setMenuData(refreshed);
    } catch (err) {
      toast.error(err.message || "Copy failed");
    } finally {
      setCopySubmitting(false);
    }
  }

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];
  const topLevelCategories = categories.filter((c) => !c.parentId);

  function resetForm() {
    setForm({ id: null, name: "", description: "", parentId: "" });
    setParentPreset(null);
  }

  function startEdit(cat) {
    setForm({
      id: cat.id,
      name: cat.name,
      description: cat.description || "",
      parentId: cat.parentId || "",
    });
    setParentPreset(null);
    setModalError("");
    setIsModalOpen(true);
  }

  function startCreate() {
    resetForm();
    setModalError("");
    setIsModalOpen(true);
  }

  function startCreateSubcategory(parentCat) {
    setForm({
      id: null,
      name: "",
      description: "",
      parentId: parentCat.id,
    });
    setParentPreset({ id: parentCat.id, name: parentCat.name });
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Category name is required");
      toast.error("Category name is required");
      return;
    }
    if (!form.id && !currentBranch?.id) {
      setModalError("Please select a specific branch from the header dropdown before creating a category.");
      return;
    }

    setModalError("");
    setIsLoading(true);

    const result = await handleAsyncAction(
      async () => {
        const payload = {
          name: form.name,
          description: form.description,
        };
        if (form.id) {
          payload.parentId = form.parentId || null;
          const updated = await updateCategory(form.id, payload);
          setMenuData((prev) => ({
            ...prev,
            categories: prev.categories.map((c) =>
              c.id === updated.id ? updated : c,
            ),
          }));
          return updated;
        }
        const createPayload = {
          ...payload,
          ...(currentBranch?.id && { branchId: currentBranch.id }),
        };
        const parentId = parentPreset?.id || form.parentId || null;
        if (parentId) createPayload.parentId = parentId;
        const created = await createCategory(createPayload);
        setMenuData((prev) => ({
          ...prev,
          categories: [...prev.categories, created],
        }));
        return created;
      },
      {
        loading: form.id ? "Updating category..." : "Creating category...",
        success: form.id
          ? "Category updated successfully"
          : "Category created successfully",
        error: "Failed to save category",
      },
    );

    setIsLoading(false);

    if (result.success) {
      resetForm();
      setIsModalOpen(false);
    } else {
      setModalError(result.error);
    }
  }

  async function handleDelete(id) {
    const cat = categories.find((c) => c.id === id);
    const subcategories = categories.filter((c) => c.parentId === id);
    const subCount = subcategories.length;
    const ok = await confirm({
      title: "Delete category",
      message:
        subCount > 0
          ? `This category has ${subCount} subcategor${subCount === 1 ? "y" : "ies"}. Deleting it will also delete all subcategories and their items. This cannot be undone.`
          : cat?.parentId
            ? "Delete this subcategory and all its menu items? This cannot be undone."
            : "Delete this category and all its menu items? This cannot be undone.",
    });
    if (!ok) return;

    setDeletingId(id);
    const idsToRemove = new Set([id, ...subcategories.map((c) => c.id)]);

    await handleAsyncAction(
      async () => {
        await deleteCategory(id);
        setMenuData((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => !idsToRemove.has(c.id)),
          items: prev.items.filter((i) => !idsToRemove.has(i.categoryId)),
        }));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          idsToRemove.forEach((removedId) => next.delete(removedId));
          return next;
        });
      },
      {
        loading: "Deleting category...",
        success: "Category deleted successfully",
        error: "Failed to delete category",
      },
    );

    setDeletingId(null);
  }

  function toggleSelectCategory(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible(visibleRows) {
    const allSelected = visibleRows.every((row) => selectedIds.has(row.id));
    setSelectedIds(
      allSelected ? new Set() : new Set(visibleRows.map((row) => row.id)),
    );
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;

    const selectedSet = new Set(selectedIds);
    const idsToDelete = [...selectedSet].filter((id) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat?.parentId) return true;
      return !selectedSet.has(cat.parentId);
    });

    const subCount = idsToDelete.reduce(
      (acc, id) => acc + categories.filter((c) => c.parentId === id).length,
      0,
    );

    const ok = await confirm({
      title: `Delete ${selectedSet.size} categor${selectedSet.size === 1 ? "y" : "ies"}`,
      message:
        subCount > 0
          ? `This will delete ${selectedSet.size} selected categor${selectedSet.size === 1 ? "y" : "ies"}, including ${subCount} subcategor${subCount === 1 ? "y" : "ies"}, and their menu items. This cannot be undone.`
          : `Delete ${selectedSet.size} selected categor${selectedSet.size === 1 ? "y" : "ies"} and their menu items? This cannot be undone.`,
      confirmLabel: "Delete selected",
    });
    if (!ok) return;

    const allIdsToRemove = new Set(selectedSet);
    for (const id of idsToDelete) {
      categories
        .filter((c) => c.parentId === id)
        .forEach((c) => allIdsToRemove.add(c.id));
    }

    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;

    await handleAsyncAction(
      async () => {
        for (const id of idsToDelete) {
          try {
            await deleteCategory(id);
            deleted++;
          } catch {
            failed++;
          }
        }
        setMenuData((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => !allIdsToRemove.has(c.id)),
          items: prev.items.filter((i) => !allIdsToRemove.has(i.categoryId)),
        }));
        setSelectedIds(new Set());
      },
      {
        loading: "Deleting selected categories...",
        success: `Deleted ${deleted} categor${deleted === 1 ? "y" : "ies"}${failed ? `, ${failed} failed` : ""}`,
        error: "Failed to delete selected categories",
      },
    );

    setBulkDeleting(false);
  }

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = categories.filter((cat) => {
      if (!term) return true;
      return (
        cat.name.toLowerCase().includes(term) ||
        (cat.description || "").toLowerCase().includes(term) ||
        (cat.parentName || "").toLowerCase().includes(term)
      );
    });
    list = list.filter((cat) => {
      const n = items.filter((i) => i.categoryId === cat.id).length;
      if (itemFilter === "with_items") return n > 0;
      if (itemFilter === "empty") return n === 0;
      return true;
    });
    return sortCategories(list, sortBy, categories, items);
  }, [categories, items, search, itemFilter, sortBy]);

  const displayCategories = filteredCategories;

  const visibleTopLevelCategories = useMemo(() => {
    const filteredIds = new Set(filteredCategories.map((c) => c.id));
    const parentIdsWithVisibleChildren = new Set(
      filteredCategories.filter((c) => c.parentId).map((c) => c.parentId),
    );
    const topLevel = topLevelCategories.filter(
      (parent) =>
        filteredIds.has(parent.id) || parentIdsWithVisibleChildren.has(parent.id),
    );
    return sortCategories(topLevel, sortBy, categories, items);
  }, [filteredCategories, topLevelCategories, sortBy, categories, items]);

  const tableRows = useMemo(
    () =>
      visibleTopLevelCategories.flatMap((cat) => {
        const subs = filteredCategories.filter((c) => c.parentId === cat.id);
        return [
          {
            ...cat,
            itemCount: countItemsForCategory(cat.id, categories, items),
          },
          ...subs.map((sub) => ({
            ...sub,
            itemCount: items.filter((i) => i.categoryId === sub.id).length,
          })),
        ];
      }),
    [visibleTopLevelCategories, filteredCategories, categories, items],
  );

  const allVisibleSelected =
    tableRows.length > 0 && tableRows.every((row) => selectedIds.has(row.id));
  const someVisibleSelected = tableRows.some((row) => selectedIds.has(row.id));

  const editingHasSubcategories =
    !!form.id && categories.some((c) => c.parentId === form.id);
  const editingParentName =
    categories.find((c) => c.id === form.parentId)?.name ||
    categories.find((c) => c.id === form.id)?.parentName ||
    null;

  const handleExportCSV = useCallback(() => {
    exportCategoriesToCSV(displayCategories, items);
    toast.success("Categories exported");
  }, [displayCategories, items]);

  const handleExportPDF = useCallback(() => {
    const title = currentBranch?.name
      ? `Categories — ${currentBranch.name}`
      : "Categories";
    const html = categoriesExportPDFHTML(displayCategories, items, title);
    openPrintableCategoriesHTML(html);
  }, [displayCategories, items, currentBranch?.name]);

  const handlePrintPage = useCallback(() => {
    window.print();
  }, []);

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
    let text;
    try {
      text = await file.text();
    } catch {
      toast.error("Could not read file");
      return;
    }
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error("CSV is empty");
      return;
    }
    let start = 0;
    const firstCells = parseCSVLine(lines[0]).map((c) => c.toLowerCase());
    if (firstCells[0] === "name" || firstCells.includes("name")) {
      start = 1;
    }
    const existingLower = new Set(
      categories.map((c) => c.name.trim().toLowerCase()),
    );
    const rows = [];
    for (let i = start; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const name = (cols[0] || "").trim();
      if (!name) continue;
      const description = (cols[1] || "").trim();
      rows.push({ name, description });
    }
    if (!rows.length) {
      toast.error("No category rows found in CSV");
      return;
    }
    setImportLoading(true);
    let created = 0;
    let skipped = 0;
    const newCats = [];
    const seen = new Set(existingLower);
    for (const row of rows) {
      const key = row.name.toLowerCase();
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      try {
        const cat = await createCategory({
          name: row.name,
          description: row.description,
          branchId: currentBranch.id,
        });
        newCats.push(cat);
        created++;
      } catch {
        skipped++;
      }
    }
    setImportLoading(false);
    if (newCats.length) {
      setMenuData((prev) => ({
        ...prev,
        categories: [...prev.categories, ...newCats],
      }));
    }
    if (created > 0) {
      toast.success(
        `Imported ${created} categor${created === 1 ? "y" : "ies"}${
          skipped ? ` · ${skipped} skipped` : ""
        }`,
      );
    } else if (skipped > 0) {
      toast.error(
        `No new categories added (${skipped} duplicate or failed).`,
      );
    } else {
      toast.error("Nothing to import");
    }
  }

  return (
    <AdminLayout title="Categories" suspended={suspended}>
      <PermissionGate permission="menu.manage_categories">
      <style>{`@media print { .categories-no-print { display: none !important; } }`}</style>
      {error && !pageLoading && (
        <div className="categories-no-print mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Toolbar: search grows to fill space between edges and controls */}
      <div className="categories-no-print mb-2 flex w-full min-w-0 flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="categories-search">
          Search categories
        </label>
        <div className="relative min-w-0 w-full flex-1 basis-full sm:basis-0 sm:min-w-[12rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="categories-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 w-full rounded-xl border-2 border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          />
        </div>
        <label className="sr-only" htmlFor="categories-sort">
          Sort by
        </label>
        <select
          id="categories-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className={sortSelectCls}
          title="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="categories-items-filter">
          Filter by items
        </label>
        <select
          id="categories-items-filter"
          value={itemFilter}
          onChange={(e) => setItemFilter(e.target.value)}
          className={`${filterSelectCls} min-w-[10.5rem]`}
          title="Items"
        >
          {ITEM_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span
          className="hidden h-6 w-px bg-gray-200 sm:block dark:bg-neutral-700"
          aria-hidden
        />

        <ViewToggle viewMode={viewMode} onChange={setViewMode} />

        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setExportMenuOpen((o) => !o)}
            disabled={!displayCategories.length}
            title="Export categories"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Download className="h-4 w-4 shrink-0" />
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
                onClick={() => {
                  setExportMenuOpen(false);
                  handleExportCSV();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <Download className="h-4 w-4 shrink-0 text-gray-400" />
                Download CSV
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  handleExportPDF();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                Export PDF…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  handlePrintPage();
                }}
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
                : "Import categories"
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
                  !currentBranch?.id
                    ? "Select a branch first"
                    : !canImportFromBranch
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
                disabled={!currentBranch?.id}
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
          <span className="hidden sm:inline">Add category</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className="categories-no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10">
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-[10px] text-red-500 underline hover:text-red-700 dark:text-red-400"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {bulkDeleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Delete selected
          </button>
        </div>
      )}

      {/* Loading state – inside content area */}
      {pageLoading ? (
        <div className="categories-no-print bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <FolderOpen className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                Loading categories...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {visibleTopLevelCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-neutral-700 bg-white/50 dark:bg-neutral-950/50">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                <FolderOpen className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-neutral-400 mb-1">
                {categories.length === 0
                  ? "No categories yet"
                  : "No categories match your filters"}
              </p>
              {categories.length === 0 ? (
                <>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4 text-center max-w-sm px-4">
                    Create your first category or import a CSV (name,
                    description columns).
                  </p>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create category
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-400 dark:text-neutral-500 text-center max-w-sm px-4">
                  Clear search, set Items to &quot;All categories&quot;, or widen
                  your sort to see more.
                </p>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTopLevelCategories.map((cat) => {
                const subcategories = filteredCategories.filter(
                  (c) => c.parentId === cat.id,
                );
                const itemCount = countItemsForCategory(
                  cat.id,
                  categories,
                  items,
                );
                const isDeleting = deletingId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={`flex flex-col bg-white dark:bg-neutral-950 border rounded-xl p-4 hover:shadow-lg transition-all ${
                      selectedIds.has(cat.id)
                        ? "border-primary/50 ring-2 ring-primary/20"
                        : "border-gray-200 dark:border-neutral-800 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(cat.id)}
                          onChange={() => toggleSelectCategory(cat.id)}
                          className="mt-0.5 rounded border-gray-300 text-primary cursor-pointer dark:border-neutral-600"
                          aria-label={`Select ${cat.name}`}
                        />
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                          {cat.name}
                        </h3>
                      </div>
                      <ActionDropdown
                        isOpen={isDropdownOpen(cat.id)}
                        onToggle={() => toggleDropdown(cat.id)}
                        onClose={closeDropdown}
                        disabled={isDeleting}
                        actions={[
                          {
                            label: "Edit",
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => startEdit(cat),
                            disabled: isDeleting,
                          },
                          {
                            label: isDeleting ? "Deleting..." : "Delete",
                            icon: isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            ),
                            onClick: () => handleDelete(cat.id),
                            variant: "danger",
                            disabled: isDeleting,
                          },
                        ]}
                      />
                    </div>

                    <span
                      className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold mb-2 ${
                        itemCount === 0
                          ? "bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {itemCount} items
                    </span>

                    {cat.description ? (
                      <p className="text-xs text-gray-600 dark:text-neutral-400 line-clamp-2 mb-2">
                        {cat.description}
                      </p>
                    ) : null}

                    {subcategories.length > 0 && (
                      <div className="mb-2 space-y-1 border-l-2 border-orange-200 pl-2 dark:border-orange-500/40">
                        {subcategories.map((sub) => {
                          const subItemCount = items.filter(
                            (i) => i.categoryId === sub.id,
                          ).length;
                          const subDeleting = deletingId === sub.id;
                          return (
                            <div
                              key={sub.id}
                              className={`flex items-center justify-between gap-1 rounded-md px-2 py-1 ${
                                selectedIds.has(sub.id)
                                  ? "bg-primary/10 dark:bg-primary/10"
                                  : "bg-gray-50/80 dark:bg-neutral-900/60"
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(sub.id)}
                                  onChange={() => toggleSelectCategory(sub.id)}
                                  className="rounded border-gray-300 text-primary cursor-pointer dark:border-neutral-600"
                                  aria-label={`Select ${sub.name}`}
                                />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-gray-900 dark:text-white truncate">
                                    {sub.name}
                                  </p>
                                  <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                                    {subItemCount} items
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => startEdit(sub)}
                                  disabled={subDeleting}
                                  className="p-0.5 rounded text-gray-400 hover:text-primary disabled:opacity-50"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(sub.id)}
                                  disabled={subDeleting}
                                  className="p-0.5 rounded text-gray-400 hover:text-red-500 disabled:opacity-50"
                                  title="Delete"
                                >
                                  {subDeleting ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => startCreateSubcategory(cat)}
                        className="flex items-center gap-1 text-[11px] font-medium text-orange-500 hover:text-orange-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add subcategory
                      </button>
                      {cat.createdAt ? (
                        <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                          {new Date(cat.createdAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DataTable
              variant="card"
              columns={[
                {
                  key: "_select",
                  header: (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            someVisibleSelected && !allVisibleSelected;
                        }
                      }}
                      onChange={() => toggleSelectAllVisible(tableRows)}
                      className="rounded border-gray-300 text-primary cursor-pointer dark:border-neutral-600"
                      aria-label="Select all visible categories"
                    />
                  ),
                  align: "center",
                  render: (_, row) => (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelectCategory(row.id)}
                      className="rounded border-gray-300 text-primary cursor-pointer dark:border-neutral-600"
                      aria-label={`Select ${row.name}`}
                    />
                  ),
                },
                {
                  key: "name",
                  header: "Category",
                  render: (value, row) => (
                    <p
                      className={`font-semibold text-gray-900 dark:text-white ${
                        row.parentId
                          ? "ml-6 border-l-2 border-orange-200 pl-3 text-sm dark:border-orange-500/40"
                          : ""
                      }`}
                    >
                      {value}
                    </p>
                  ),
                },
                {
                  key: "description",
                  header: "Description",
                  hideOnMobile: true,
                  render: (value) => (
                    <p className="text-gray-600 dark:text-neutral-400 line-clamp-2">
                      {value || ""}
                    </p>
                  ),
                },
                {
                  key: "itemCount",
                  header: "Items",
                  align: "center",
                  render: (value) => (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${value === 0 ? "bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500" : "bg-primary/10 text-primary"}`}>
                      {value}
                    </span>
                  ),
                },
                {
                  key: "createdAt",
                  header: "Created",
                  hideOnTablet: true,
                  render: (value) => (
                    <span className="text-gray-600 dark:text-neutral-400">
                      {value ? new Date(value).toLocaleDateString() : "—"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (_, row) => {
                    const isDeleting = deletingId === row.id;
                    return (
                      <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                        {!row.parentId && (
                          <button
                            type="button"
                            onClick={() => startCreateSubcategory(row)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-orange-500 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-500/10 transition-colors"
                            title="Add subcategory"
                          >
                            <Plus className="w-3 h-3" />
                            Add subcategory
                          </button>
                        )}
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
                          onClick={() => handleDelete(row.id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  },
                },
              ]}
              rows={tableRows.map((row) => ({
                ...row,
                actions: row.id,
              }))}
              emptyMessage="No rows"
            />
          )}
        </>
      )}

      {/* Category Modal */}
      {isModalOpen && (
        <div className="categories-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-5 shadow-xl text-xs">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {form.id
                ? "Edit category"
                : parentPreset
                  ? "New subcategory"
                  : "New category"}
            </h2>
            <p
              className={`text-xs text-gray-500 dark:text-neutral-400 ${
                parentPreset ? "mb-1" : "mb-4"
              }`}
            >
              {parentPreset
                ? `Adding subcategory under: ${parentPreset.name}`
                : "Group related menu items together to keep your POS simple."}
            </p>
            {parentPreset ? (
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 mb-4">
                Parent category is pre-selected below.
              </p>
            ) : null}
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className="space-y-3"
              autoComplete="off"
            >
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Name
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Burgers, Drinks, Sides..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
                <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                  Name will appear exactly as entered on POS and customer receipts.
                </p>
              </div>
              {!form.id && !editingHasSubcategories && (
                <div className="space-y-1">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                    Parent category (optional)
                  </label>
                  <select
                    value={form.parentId || parentPreset?.id || ""}
                    disabled={!!parentPreset}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        parentId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <option value="">None — top level</option>
                    {topLevelCategories
                      .filter((c) => c.id !== form.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                  {(form.parentId || parentPreset?.id) ? (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400">
                      This will be a subcategory under{" "}
                      {parentPreset?.name ||
                        topLevelCategories.find(
                          (c) => c.id === (form.parentId || parentPreset?.id),
                        )?.name ||
                        "the selected category"}
                      . It will appear nested in the menu.
                    </p>
                  ) : null}
                </div>
              )}
              {form.id && form.parentId && editingParentName && (
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 -mt-1">
                  Subcategory of:{" "}
                  <span className="font-medium text-gray-700 dark:text-neutral-300">
                    {editingParentName}
                  </span>
                </p>
              )}
              {editingHasSubcategories && (
                <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                  This category has subcategories and must stay top-level.
                </p>
              )}
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-1.5" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {form.id ? "Saving..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      {form.id
                        ? "Save changes"
                        : parentPreset
                          ? "Create subcategory"
                          : "Create category"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy categories from branch modal */}
      {copyModalOpen && (
        <div className="categories-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Copy categories from branch
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
                  All categories from every other branch will be copied to this branch.
                </p>
              )}
              {!copySourceLoading && copySourceData && copySourceBranchId !== "all" && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-2">
                    Categories
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800">
                    {(copySourceData.categories || []).map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={copySelectedCategoryIds.includes(c.id)}
                          onChange={() => toggleCopyCategory(c.id)}
                          className="rounded border-gray-300 text-primary"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {c.name}
                        </span>
                      </label>
                    ))}
                    {(copySourceData.categories || []).length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">
                        No categories in this branch
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
                disabled={!copySourceBranchId || copySubmitting || (copySourceBranchId !== "all" && copySelectedCategoryIds.length === 0)}
                className="px-4"
              >
                {copySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                {copySubmitting ? "Copying…" : "Copy to this branch"}
              </Button>
            </div>
          </div>
        </div>
      )}
      </PermissionGate>
    </AdminLayout>
  );
}
