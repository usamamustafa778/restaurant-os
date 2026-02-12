import { useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import PageLoader from "../../components/ui/PageLoader";
import ViewToggle from "../../components/ui/ViewToggle";
import ActionDropdown from "../../components/ui/ActionDropdown";
import {
  getDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  toggleDeal,
  getDealUsageStats,
  getMenu,
  getBranches,
} from "../../lib/apiClient";
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Percent,
  Tag,
  Clock,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
  Gift,
  DollarSign,
  ShoppingBag,
  Sparkles,
  BarChart3,
  X,
} from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useDropdown } from "../../hooks/useDropdown";
import { handleAsyncAction } from "../../utils/toastActions";
import toast from "react-hot-toast";

const DEAL_TYPES = [
  { value: "PERCENTAGE_DISCOUNT", label: "Percentage Discount", icon: Percent },
  { value: "FIXED_DISCOUNT", label: "Fixed Amount Discount", icon: DollarSign },
  { value: "COMBO", label: "Combo Deal", icon: ShoppingBag },
  { value: "BUY_X_GET_Y", label: "Buy X Get Y", icon: Gift },
  { value: "MINIMUM_PURCHASE", label: "Minimum Purchase", icon: TrendingUp },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function DealsPage() {
  const {
    data: deals,
    loading: pageLoading,
    error,
    suspended,
    setData: setDeals,
  } = usePageData(getDeals);
  const { data: menuData } = usePageData(getMenu);
  const { data: branchData } = usePageData(getBranches);

  const [form, setForm] = useState(getInitialForm());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const { viewMode, setViewMode } = useViewMode("grid");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [selectedDealForStats, setSelectedDealForStats] = useState(null);
  const [dealStats, setDealStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const {
    toggle: toggleDropdown,
    close: closeDropdown,
    isOpen: isDropdownOpen,
  } = useDropdown();
  const { confirm } = useConfirmDialog();

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];
  const branches = Array.isArray(branchData) ? branchData : branchData?.branches || [];

  function getInitialForm() {
    return {
      id: null,
      name: "",
      description: "",
      dealType: "PERCENTAGE_DISCOUNT",
      discountPercentage: "",
      discountAmount: "",
      comboItems: [],
      comboPrice: "",
      buyQuantity: "",
      getQuantity: "",
      minimumPurchase: "",
      applicableCategories: [],
      applicableItems: [],
      applicableBranches: [],
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      daysOfWeek: [],
      maxUsagePerCustomer: "",
      maxTotalUsage: "",
      priority: "50",
      allowStacking: false,
      isActive: true,
      showOnWebsite: true,
      badgeText: "",
    };
  }

  function resetForm() {
    setForm(getInitialForm());
  }

  function startEdit(deal) {
    setForm({
      id: deal.id,
      name: deal.name || "",
      description: deal.description || "",
      dealType: deal.dealType || "PERCENTAGE_DISCOUNT",
      discountPercentage: deal.discountPercentage || "",
      discountAmount: deal.discountAmount || "",
      comboItems: deal.comboItems || [],
      comboPrice: deal.comboPrice || "",
      buyQuantity: deal.buyQuantity || "",
      getQuantity: deal.getQuantity || "",
      minimumPurchase: deal.minimumPurchase || "",
      applicableCategories: deal.applicableCategories || [],
      applicableItems: deal.applicableItems || [],
      applicableBranches: deal.applicableBranches || [],
      startDate: deal.startDate ? deal.startDate.split("T")[0] : "",
      endDate: deal.endDate ? deal.endDate.split("T")[0] : "",
      startTime: deal.startTime || "",
      endTime: deal.endTime || "",
      daysOfWeek: deal.daysOfWeek || [],
      maxUsagePerCustomer: deal.maxUsagePerCustomer || "",
      maxTotalUsage: deal.maxTotalUsage || "",
      priority: deal.priority || "50",
      allowStacking: deal.allowStacking || false,
      isActive: deal.isActive !== undefined ? deal.isActive : true,
      showOnWebsite: deal.showOnWebsite !== undefined ? deal.showOnWebsite : true,
      badgeText: deal.badgeText || "",
    });
    setModalError("");
    setIsModalOpen(true);
  }

  function startCreate() {
    resetForm();
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Deal name is required");
      toast.error("Deal name is required");
      return;
    }

    // Validate based on deal type
    if (form.dealType === "PERCENTAGE_DISCOUNT" && !form.discountPercentage) {
      setModalError("Discount percentage is required");
      toast.error("Discount percentage is required");
      return;
    }
    if (form.dealType === "FIXED_DISCOUNT" && !form.discountAmount) {
      setModalError("Discount amount is required");
      toast.error("Discount amount is required");
      return;
    }
    if (form.dealType === "COMBO" && (!form.comboItems.length || !form.comboPrice)) {
      setModalError("Combo items and price are required");
      toast.error("Combo items and price are required");
      return;
    }
    if (form.dealType === "BUY_X_GET_Y" && (!form.buyQuantity || !form.getQuantity)) {
      setModalError("Buy and get quantities are required");
      toast.error("Buy and get quantities are required");
      return;
    }
    if (form.dealType === "MINIMUM_PURCHASE" && !form.minimumPurchase) {
      setModalError("Minimum purchase amount is required");
      toast.error("Minimum purchase amount is required");
      return;
    }

    setModalError("");
    setIsLoading(true);

    const payload = {
      name: form.name,
      description: form.description,
      dealType: form.dealType,
      isActive: form.isActive,
      showOnWebsite: form.showOnWebsite,
      badgeText: form.badgeText,
      priority: parseInt(form.priority) || 50,
      allowStacking: form.allowStacking,
    };

    // Add type-specific fields
    if (form.dealType === "PERCENTAGE_DISCOUNT") {
      payload.discountPercentage = parseFloat(form.discountPercentage);
    }
    if (form.dealType === "FIXED_DISCOUNT") {
      payload.discountAmount = parseFloat(form.discountAmount);
    }
    if (form.dealType === "COMBO") {
      payload.comboItems = form.comboItems;
      payload.comboPrice = parseFloat(form.comboPrice);
    }
    if (form.dealType === "BUY_X_GET_Y") {
      payload.buyQuantity = parseInt(form.buyQuantity);
      payload.getQuantity = parseInt(form.getQuantity);
    }
    if (form.dealType === "MINIMUM_PURCHASE") {
      payload.minimumPurchase = parseFloat(form.minimumPurchase);
      if (form.discountPercentage) payload.discountPercentage = parseFloat(form.discountPercentage);
      if (form.discountAmount) payload.discountAmount = parseFloat(form.discountAmount);
    }

    // Add optional filters
    if (form.applicableCategories.length) payload.applicableCategories = form.applicableCategories;
    if (form.applicableItems.length) payload.applicableItems = form.applicableItems;
    if (form.applicableBranches.length) payload.applicableBranches = form.applicableBranches;
    if (form.startDate) payload.startDate = new Date(form.startDate).toISOString();
    if (form.endDate) payload.endDate = new Date(form.endDate).toISOString();
    if (form.startTime) payload.startTime = form.startTime;
    if (form.endTime) payload.endTime = form.endTime;
    if (form.daysOfWeek.length) payload.daysOfWeek = form.daysOfWeek;
    if (form.maxUsagePerCustomer) payload.maxUsagePerCustomer = parseInt(form.maxUsagePerCustomer);
    if (form.maxTotalUsage) payload.maxTotalUsage = parseInt(form.maxTotalUsage);

    const result = await handleAsyncAction(
      async () => {
        if (form.id) {
          const updated = await updateDeal(form.id, payload);
          setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          return updated;
        } else {
          const created = await createDeal(payload);
          setDeals((prev) => [...prev, created]);
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
      resetForm();
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
        setDeals((prev) => prev.filter((d) => d.id !== id));
      },
      {
        loading: "Deleting deal...",
        success: "Deal deleted successfully",
        error: "Failed to delete deal",
      }
    );

    setDeletingId(null);
  }

  async function handleToggle(id) {
    setTogglingId(id);

    const result = await handleAsyncAction(
      async () => {
        const updated = await toggleDeal(id);
        setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        return updated;
      },
      {
        loading: "Updating status...",
        success: "Deal status updated",
        error: "Failed to update status",
      }
    );

    setTogglingId(null);
  }

  async function handleViewStats(deal) {
    setSelectedDealForStats(deal);
    setLoadingStats(true);
    setDealStats(null);

    try {
      const stats = await getDealUsageStats(deal.id);
      setDealStats(stats);
    } catch (err) {
      toast.error("Failed to load deal statistics");
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  }

  const dealsList = Array.isArray(deals) ? deals : [];

  const filtered = dealsList.filter((deal) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      deal.name.toLowerCase().includes(term) ||
      (deal.description || "").toLowerCase().includes(term) ||
      (deal.dealType || "").toLowerCase().includes(term)
    );
  });

  function getDealTypeLabel(type) {
    const dealType = DEAL_TYPES.find((t) => t.value === type);
    return dealType ? dealType.label : type;
  }

  function getDealIcon(type) {
    const dealType = DEAL_TYPES.find((t) => t.value === type);
    const Icon = dealType ? dealType.icon : Tag;
    return Icon;
  }

  function getDealValue(deal) {
    switch (deal.dealType) {
      case "PERCENTAGE_DISCOUNT":
        return `${deal.discountPercentage}% OFF`;
      case "FIXED_DISCOUNT":
        return `$${deal.discountAmount} OFF`;
      case "COMBO":
        return `$${deal.comboPrice}`;
      case "BUY_X_GET_Y":
        return `Buy ${deal.buyQuantity} Get ${deal.getQuantity}`;
      case "MINIMUM_PURCHASE":
        return `Spend $${deal.minimumPurchase}`;
      default:
        return "—";
    }
  }

  return (
    <AdminLayout title="Deals & Promotions" suspended={suspended}>
      {pageLoading ? (
        <PageLoader message="Loading deals..." />
      ) : (
        <>
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search deals by name, description, or type..."
                className="w-full px-5 py-3.5 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>

            <ViewToggle viewMode={viewMode} onChange={setViewMode} />

            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Deal
            </button>
          </div>

          {/* Deals Grid View */}
          {viewMode === "grid" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((deal) => {
                const isDeleting = deletingId === deal.id;
                const isToggling = togglingId === deal.id;
                const Icon = getDealIcon(deal.dealType);
                return (
                  <div
                    key={deal.id}
                    className={`bg-white dark:bg-neutral-950 border rounded-xl p-5 hover:shadow-lg transition-all relative ${
                      deal.isActive
                        ? "border-primary/30 dark:border-primary/30"
                        : "border-gray-200 dark:border-neutral-800 opacity-60"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          deal.isActive ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-neutral-900 text-gray-400"
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">
                            {deal.name}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
                              deal.isActive
                                ? "bg-primary/10 text-primary"
                                : "bg-gray-100 dark:bg-neutral-900 text-gray-500"
                            }`}>
                              {getDealValue(deal)}
                            </span>
                            {deal.badgeText && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/10 text-secondary text-xs font-bold">
                                <Sparkles className="w-3 h-3" />
                                {deal.badgeText}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <ActionDropdown
                        isOpen={isDropdownOpen(deal.id)}
                        onToggle={() => toggleDropdown(deal.id)}
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
                            label: "View Stats",
                            icon: <BarChart3 className="w-4 h-4" />,
                            onClick: () => handleViewStats(deal),
                            disabled: isDeleting,
                          },
                          {
                            label: isDeleting ? "Deleting..." : "Delete",
                            icon: isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            ),
                            onClick: () => handleDelete(deal.id),
                            variant: "danger",
                            disabled: isDeleting,
                          },
                        ]}
                      />
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-600 dark:text-neutral-400 mb-3 line-clamp-2 min-h-[2rem]">
                      {deal.description || (
                        <span className="italic">No description provided</span>
                      )}
                    </p>

                    {/* Deal Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                        <Tag className="w-3.5 h-3.5" />
                        <span>{getDealTypeLabel(deal.dealType)}</span>
                      </div>
                      {(deal.startTime || deal.endTime) && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {deal.startTime || "00:00"} - {deal.endTime || "23:59"}
                          </span>
                        </div>
                      )}
                      {deal.daysOfWeek && deal.daysOfWeek.length > 0 && deal.daysOfWeek.length < 7 && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {deal.daysOfWeek.map(d => DAYS_OF_WEEK[d].label.substring(0, 3)).join(", ")}
                          </span>
                        </div>
                      )}
                      {deal.maxTotalUsage && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>Limited to {deal.maxTotalUsage} uses</span>
                        </div>
                      )}
                    </div>

                    {/* Toggle Status Button */}
                    <button
                      type="button"
                      onClick={() => handleToggle(deal.id)}
                      disabled={isToggling}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        deal.isActive
                          ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20"
                          : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : deal.isActive ? (
                        <>
                          <ToggleRight className="w-4 h-4" />
                          Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4" />
                          Inactive
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deals Table View */}
          {viewMode === "table" && (
            <DataTable
              variant="card"
              columns={[
                {
                  key: "name",
                  header: "Deal",
                  render: (value, row) => (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {value}
                      </p>
                      {row.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "dealType",
                  header: "Type",
                  hideOnMobile: true,
                  render: (value) => (
                    <span className="text-gray-600 dark:text-neutral-400 text-sm">
                      {getDealTypeLabel(value)}
                    </span>
                  ),
                },
                {
                  key: "value",
                  header: "Value",
                  render: (_, row) => (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {getDealValue(row)}
                    </span>
                  ),
                },
                {
                  key: "description",
                  header: "Description",
                  hideOnTablet: true,
                  render: (value) => (
                    <p className="text-gray-600 dark:text-neutral-400 line-clamp-2 text-sm">
                      {value || (
                        <span className="italic text-gray-400 dark:text-neutral-500">
                          No description
                        </span>
                      )}
                    </p>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (_, row) => {
                    const isDeleting = deletingId === row.id;
                    const isToggling = togglingId === row.id;
                    return (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggle(row.id)}
                          disabled={isToggling}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            row.isActive
                              ? "text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                              : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
                          }`}
                        >
                          {isToggling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : row.isActive ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewStats(row)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span className="hidden sm:inline">Stats</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="hidden sm:inline">Deleting...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  },
                },
              ]}
              rows={filtered}
              emptyMessage={
                dealsList.length === 0
                  ? "No deals yet. Create your first deal to boost sales."
                  : "No deals match your search"
              }
            />
          )}

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                <Percent className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-neutral-400 mb-1">
                {dealsList.length === 0 ? "No deals yet" : "No deals match your search"}
              </p>
              {dealsList.length === 0 && (
                <>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4">
                    Create promotions to attract customers and boost sales
                  </p>
                  <button
                    onClick={startCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Deal
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Deal Modal */}
      {isModalOpen && (
        <DealFormModal
          form={form}
          setForm={setForm}
          isLoading={isLoading}
          modalError={modalError}
          categories={categories}
          items={items}
          branches={branches}
          onSubmit={handleSubmit}
          onClose={() => {
            resetForm();
            setIsModalOpen(false);
          }}
        />
      )}

      {/* Deal Stats Modal */}
      {selectedDealForStats && (
        <DealStatsModal
          deal={selectedDealForStats}
          stats={dealStats}
          loading={loadingStats}
          onClose={() => {
            setSelectedDealForStats(null);
            setDealStats(null);
          }}
        />
      )}
    </AdminLayout>
  );
}

// Deal Stats Modal Component
function DealStatsModal({ deal, stats, loading, onClose }) {
  if (!deal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 overflow-y-auto py-8">
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Deal Statistics
            </h2>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
              {deal.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <div className="space-y-5">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-500/10 dark:to-blue-600/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Total Uses
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {stats.totalUsageCount || 0}
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/10 dark:to-emerald-600/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    Total Discount
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  Rs {stats.totalDiscountGiven?.toFixed(0) || 0}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-500/10 dark:to-purple-600/10 rounded-xl p-4 border border-purple-200 dark:border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                    Unique Customers
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.uniqueCustomerCount || 0}
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-500/10 dark:to-amber-600/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Avg Discount
                  </span>
                </div>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  Rs {stats.averageDiscount?.toFixed(0) || 0}
                </p>
              </div>
            </div>

            {/* Deal Information */}
            <div className="bg-gray-50 dark:bg-neutral-900 rounded-xl p-5 border border-gray-200 dark:border-neutral-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Deal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-neutral-400">Deal Type:</span>
                  <p className="font-medium text-gray-900 dark:text-white mt-1">
                    {deal.dealType?.replace(/_/g, " ")}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-neutral-400">Status:</span>
                  <p className="font-medium mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        deal.isActive
                          ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                          : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
                      }`}
                    >
                      {deal.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                {deal.maxUsagePerCustomer && (
                  <div>
                    <span className="text-gray-600 dark:text-neutral-400">
                      Max Per Customer:
                    </span>
                    <p className="font-medium text-gray-900 dark:text-white mt-1">
                      {deal.maxUsagePerCustomer}
                    </p>
                  </div>
                )}
                {deal.maxTotalUsage && (
                  <div>
                    <span className="text-gray-600 dark:text-neutral-400">
                      Total Usage Limit:
                    </span>
                    <p className="font-medium text-gray-900 dark:text-white mt-1">
                      {deal.maxTotalUsage} ({stats.totalUsageCount || 0} used)
                    </p>
                  </div>
                )}
                {(deal.startTime || deal.endTime) && (
                  <div>
                    <span className="text-gray-600 dark:text-neutral-400">Time:</span>
                    <p className="font-medium text-gray-900 dark:text-white mt-1">
                      {deal.startTime || "00:00"} - {deal.endTime || "23:59"}
                    </p>
                  </div>
                )}
                {deal.daysOfWeek && deal.daysOfWeek.length > 0 && deal.daysOfWeek.length < 7 && (
                  <div>
                    <span className="text-gray-600 dark:text-neutral-400">Days:</span>
                    <p className="font-medium text-gray-900 dark:text-white mt-1">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                        .filter((_, i) => deal.daysOfWeek.includes(i))
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Usage */}
            {stats.recentUsage && stats.recentUsage.length > 0 && (
              <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Recent Usage
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400">
                          Date
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400">
                          Customer
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-neutral-400">
                          Order
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 dark:text-neutral-400">
                          Discount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                      {stats.recentUsage.slice(0, 10).map((usage, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 dark:hover:bg-neutral-900/50"
                        >
                          <td className="px-5 py-3 text-gray-900 dark:text-white">
                            {new Date(usage.usedAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-neutral-400">
                            {usage.customerName || "Guest"}
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-neutral-400">
                            {usage.orderNumber || "—"}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            Rs {usage.discountAmount?.toFixed(0) || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <BarChart3 className="w-12 h-12 text-gray-300 dark:text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-neutral-400">
              No statistics available yet
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// Deal Form Modal Component
function DealFormModal({
  form,
  setForm,
  isLoading,
  modalError,
  categories,
  items,
  branches,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 overflow-y-auto py-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {form.id ? "Edit Deal" : "Create New Deal"}
        </h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-5">
          Set up promotions to attract customers and boost sales
        </p>

        {modalError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {modalError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5" autoComplete="off">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                Deal Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Happy Hour Special"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                Deal Type *
              </label>
              <select
                value={form.dealType}
                onChange={(e) => setForm((prev) => ({ ...prev, dealType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {DEAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the deal..."
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Type-Specific Fields */}
          {form.dealType === "PERCENTAGE_DISCOUNT" && (
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                Discount Percentage *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.discountPercentage}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, discountPercentage: e.target.value }))
                }
                placeholder="20"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {form.dealType === "FIXED_DISCOUNT" && (
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                Discount Amount ($) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discountAmount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, discountAmount: e.target.value }))
                }
                placeholder="5.00"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {form.dealType === "COMBO" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Combo Price ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.comboPrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, comboPrice: e.target.value }))}
                  placeholder="10.99"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-neutral-400 italic">
                Note: Use "Applicable Items" section below to select combo items
              </p>
            </div>
          )}

          {form.dealType === "BUY_X_GET_Y" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Buy Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.buyQuantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, buyQuantity: e.target.value }))}
                  placeholder="2"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Get Quantity Free *
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.getQuantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, getQuantity: e.target.value }))}
                  placeholder="1"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {form.dealType === "MINIMUM_PURCHASE" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Minimum Purchase ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumPurchase}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, minimumPurchase: e.target.value }))
                  }
                  placeholder="20.00"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Discount %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.discountPercentage}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, discountPercentage: e.target.value }))
                  }
                  placeholder="10"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Or Discount $
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountAmount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, discountAmount: e.target.value }))
                  }
                  placeholder="5.00"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* Time & Date Restrictions */}
          <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Time & Date Restrictions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Start Date
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  End Date
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Start Time
                </label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  End Time
                </label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium mb-2 block">
                Days of Week
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <label
                    key={day.value}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:border-primary cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={form.daysOfWeek.includes(day.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm((prev) => ({
                            ...prev,
                            daysOfWeek: [...prev.daysOfWeek, day.value],
                          }));
                        } else {
                          setForm((prev) => ({
                            ...prev,
                            daysOfWeek: prev.daysOfWeek.filter((d) => d !== day.value),
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700 dark:text-neutral-300">
                      {day.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Usage Limits & Settings */}
          <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Usage Limits & Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Max Uses Per Customer
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.maxUsagePerCustomer}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, maxUsagePerCustomer: e.target.value }))
                  }
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Total Usage Limit
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.maxTotalUsage}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, maxTotalUsage: e.target.value }))
                  }
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                  Priority (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowStacking}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, allowStacking: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-neutral-300">
                  Allow stacking with other deals
                </span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-neutral-300">
                  Activate deal immediately
                </span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnWebsite}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, showOnWebsite: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-neutral-300">
                  Show on customer website
                </span>
              </label>
            </div>

            <div className="mt-3">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-medium">
                Badge Text (optional)
              </label>
              <input
                type="text"
                value={form.badgeText}
                onChange={(e) => setForm((prev) => ({ ...prev, badgeText: e.target.value }))}
                placeholder="e.g., NEW, LIMITED, FLASH SALE"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-neutral-800">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="gap-1.5" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {form.id ? "Saving..." : "Creating..."}
                </>
              ) : (
                <>{form.id ? "Save Changes" : "Create Deal"}</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
