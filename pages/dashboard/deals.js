import { useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import DataTable from "../../components/ui/DataTable";
import PageLoader from "../../components/ui/PageLoader";
import ViewToggle from "../../components/ui/ViewToggle";
import ActionDropdown from "../../components/ui/ActionDropdown";
import { useBranch } from "../../contexts/BranchContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useDropdown } from "../../hooks/useDropdown";
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
} from "lucide-react";
import toast from "react-hot-toast";

function getEmptyForm() {
  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  return {
    id: null,
    name: "",
    description: "",
    selectedItems: [],
    comboPrice: "",
    startDate: today,
    endDate: weekLater,
    showOnPOS: true,
    imageUrl: "",
  };
}

export default function DealsPage() {
  const sym = getCurrencySymbol();
  const { currentBranch } = useBranch() || {};
  const { confirm } = useConfirmDialog();
  const { viewMode, setViewMode } = useViewMode("table");
  const { toggle: toggleDropdown, close: closeDropdown, isOpen: isDropdownOpen } = useDropdown();

  const fetchDeals = () => getDeals();
  const { data: deals, loading: pageLoading, error, suspended, setData: setDeals, refetch } = usePageData(fetchDeals);

  const fetchMenu = () => getMenu(currentBranch?.id);
  const { data: menuData } = usePageData(fetchMenu, [currentBranch?.id]);
  const menuItems = menuData?.items || [];

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

  const dealsList = Array.isArray(deals) ? deals : [];

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

  function startCreate() {
    if (!currentBranch?.id) {
      toast.error("Please select a specific branch from the header before creating deals.");
      return;
    }
    setForm(getEmptyForm());
    setModalError("");
    setImageTab("link");
    setUploadError("");
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
      endDate: new Date(form.endDate || new Date(Date.now() + 7 * 86400000)).toISOString(),
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

  return (
    <AdminLayout title="Deals" suspended={suspended}>
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
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </button>
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
                    return (
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
                    );
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
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-neutral-800">

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

                {/* Name + Price */}
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
                      Price <span className="text-red-500 normal-case">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">{sym}</span>
                      <input
                        type="number"
                        min={0}
                        value={form.comboPrice}
                        onChange={(e) => setForm((f) => ({ ...f, comboPrice: e.target.value }))}
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Active period
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                        className="flex-1 w-0 px-2 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                      <span className="text-gray-400 text-xs flex-shrink-0">→</span>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                        className="flex-1 w-0 px-2 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                    </div>
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

                {/* Image */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                    Image <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
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

              </div>

              {/* Right — Item picker */}
              <div className="md:w-72 flex flex-col border-t md:border-t-0 border-gray-100 dark:border-neutral-800 flex-shrink-0">
                <div className="px-4 pt-4 pb-2 flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                    Items in deal <span className="text-red-500 normal-case">*</span>
                  </p>
                  {form.selectedItems.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      {form.selectedItems.length} selected
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0">
                  {menuItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-neutral-700 mb-2" />
                      <p className="text-xs text-gray-400 dark:text-neutral-500">No menu items found.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {menuItems.map((item) => {
                        const selected = form.selectedItems.find((s) => s.menuItemId === item.id);
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
    </AdminLayout>
  );
}
