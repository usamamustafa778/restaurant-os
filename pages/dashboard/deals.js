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
} from "../../lib/apiClient";
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Percent,
  ShoppingBag,
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
  };
}

export default function DealsPage() {
  const sym = getCurrencySymbol();
  const { currentBranch } = useBranch() || {};
  const { confirm } = useConfirmDialog();
  const { viewMode, setViewMode } = useViewMode("table");
  const { toggle: toggleDropdown, close: closeDropdown, isOpen: isDropdownOpen } = useDropdown();

  const fetchDeals = () => getDeals();
  const { data: deals, loading: pageLoading, error, suspended, setData: setDeals } = usePageData(fetchDeals);

  const fetchMenu = () => getMenu(currentBranch?.id);
  const { data: menuData } = usePageData(fetchMenu, [currentBranch?.id]);
  const menuItems = menuData?.items || [];

  const [form, setForm] = useState(getEmptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const dealsList = Array.isArray(deals) ? deals : [];

  const filtered = dealsList.filter((deal) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      deal.name.toLowerCase().includes(term) ||
      (deal.description || "").toLowerCase().includes(term)
    );
  });

  function startCreate() {
    if (!currentBranch?.id) {
      toast.error("Please select a specific branch from the header before creating deals.");
      return;
    }
    setForm(getEmptyForm());
    setModalError("");
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
    });
    setModalError("");
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

      {/* Search, View Toggle and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deals by name or description..."
          className="flex-1 h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
        />
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
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
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((deal) => {
                const id = deal._id || deal.id;
                const isActive = getDealStatus(deal);
                const isDeleting = deletingId === id;
                const itemsSummary =
                  (deal.comboItems || [])
                    .map((ci) => `${ci.menuItem?.name || "Item"} ×${ci.quantity}`)
                    .join(", ") || "—";

                return (
                  <div
                    key={id}
                    className={`bg-white dark:bg-neutral-950 border rounded-xl p-5 hover:shadow-lg transition-all relative ${
                      isActive
                        ? "border-gray-200 dark:border-neutral-800 hover:border-primary/30"
                        : "border-gray-200 dark:border-neutral-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                        <Percent className="w-7 h-7 text-primary" />
                      </div>
                      <ActionDropdown
                        isOpen={isDropdownOpen(id)}
                        onToggle={() => toggleDropdown(id)}
                        onClose={closeDropdown}
                        disabled={isDeleting}
                        actions={[
                          {
                            label: "Edit",
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => startEdit(deal),
                            disabled: isDeleting,
                          },
                          {
                            label: isDeleting ? "Deleting..." : "Delete",
                            icon: isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />,
                            onClick: () => handleDelete(id),
                            variant: "danger",
                            disabled: isDeleting,
                          },
                        ]}
                      />
                    </div>

                    <p className="font-bold text-gray-900 dark:text-white text-sm mb-1 truncate">
                      {deal.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2 line-clamp-2">
                      {deal.description || itemsSummary}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{sym} {deal.comboPrice}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
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
                    {dealsList.length === 0 ? "No deals yet" : "No deals match your search"}
                  </p>
                  {dealsList.length === 0 && (
                    <button
                      onClick={startCreate}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
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
                  render: (value, row) => {
                    const isActive = getDealStatus(row);
                    return (
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{value}</p>
                        {row.description && (
                          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                            {row.description}
                          </p>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: "comboItems",
                  header: "Items",
                  hideOnMobile: true,
                  render: (value) => (
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      {(value || []).map((ci) => `${ci.menuItem?.name || "Item"} ×${ci.quantity}`).join(", ") || "—"}
                    </span>
                  ),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {form.id ? "Edit Deal" : "New Deal"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5">
                    Deal name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Family Combo"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5">
                    Deal price (Rs) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.comboPrice}
                    onChange={(e) => setForm((f) => ({ ...f, comboPrice: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5">
                    End date
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the deal..."
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5">
                  Items in this deal <span className="text-red-500">*</span>
                </label>
                <div className="max-h-64 overflow-y-auto rounded-xl border-2 border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800 bg-white dark:bg-neutral-950">
                  {menuItems.map((item) => {
                    const selected = form.selectedItems.find((s) => s.menuItemId === item.id);
                    return (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                        <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-gray-800 dark:text-neutral-200 truncate">
                            {item.name}{" "}
                            <span className="text-xs text-gray-400 dark:text-neutral-500">
                              ({sym} {item.price})
                            </span>
                          </span>
                        </label>
                        {selected && (
                          <input
                            type="number"
                            min={1}
                            value={selected.quantity}
                            onChange={(e) => setItemQuantity(item.id, e.target.value)}
                            className="w-16 px-2 py-1 border-2 border-gray-200 dark:border-neutral-700 rounded-lg text-xs text-right bg-white dark:bg-neutral-900 text-gray-900 dark:text-white outline-none focus:border-primary transition-all ml-3 flex-shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                  {menuItems.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-gray-500 dark:text-neutral-400">
                      No menu items found. Add items first.
                    </div>
                  )}
                </div>
                {form.selectedItems.length > 0 && (
                  <p className="text-xs text-primary mt-1.5 font-medium">
                    {form.selectedItems.length} item{form.selectedItems.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showOnPOS"
                  checked={form.showOnPOS}
                  onChange={(e) => setForm((f) => ({ ...f, showOnPOS: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="showOnPOS" className="text-sm text-gray-700 dark:text-neutral-300 cursor-pointer">
                  Show on POS menu
                </label>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-3">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
