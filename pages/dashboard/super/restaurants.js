import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  getSuperRestaurantActivitySummary,
  getRestaurantsForSuperAdmin,
  getDeletedRestaurantsForSuperAdmin,
  getSuperBranches,
  createRestaurantForSuperAdmin,
  updateRestaurantSubscription,
  setActingAsRestaurant,
  deleteRestaurantForSuperAdmin,
  restoreRestaurantForSuperAdmin,
  permanentlyDeleteRestaurantForSuperAdmin,
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import {
  Search,
  ChevronDown,
  Trash2,
  X,
  Loader2,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const ENGAGEMENT_STYLES = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  quiet: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  new: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  configured: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  dormant: "bg-neutral-500/20 text-neutral-300 border-neutral-600",
};

function slugifyForSubdomain(name) {
  if (!name || !name.trim()) return "";
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''"`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

const STATUS_CONFIRM = {
  TRIAL: {
    title: "Reset to Trial",
    message:
      "This will reset the restaurant's subscription status to a 3‑month trial. Are you sure?",
    confirmLabel: "Set Trial",
  },
  ACTIVE: {
    title: "Activate Subscription",
    message:
      "This will activate the restaurant's subscription. Choose how long it should stay active.",
    confirmLabel: "Activate",
  },
  SUSPENDED: {
    title: "Suspend Restaurant",
    message:
      "This will suspend the restaurant. All dashboard and public website access will be blocked until reactivated. Are you sure?",
    confirmLabel: "Suspend",
  },
};

export default function SuperRestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [deletedRestaurants, setDeletedRestaurants] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);
  const [branchesModalRestaurant, setBranchesModalRestaurant] = useState(null);
  const [allBranches, setAllBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    subdomain: "",
    name: "",
    contactPhone: "",
    contactEmail: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef(null);
  const { confirm } = useConfirmDialog();

  async function loadBranchesIfNeeded() {
    if (allBranches.length > 0) return;
    setBranchesLoading(true);
    try {
      const res = await getSuperBranches();
      setAllBranches(res?.branches ?? []);
    } catch {
      setAllBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  }

  async function openBranchesModal(r) {
    await loadBranchesIfNeeded();
    setBranchesModalRestaurant(r);
  }

  function handleOpenCreate() {
    setCreateForm({
      subdomain: "",
      name: "",
      contactPhone: "",
      contactEmail: "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
    });
    setCreateError("");
    setShowCreateForm(true);
  }

  async function handleCreateRestaurant(e) {
    e.preventDefault();
    setCreateError("");
    const { subdomain, name, adminName, adminEmail, adminPassword } =
      createForm;
    if (
      !subdomain.trim() ||
      !name.trim() ||
      !adminName.trim() ||
      !adminEmail.trim() ||
      !adminPassword
    ) {
      setCreateError(
        "Restaurant name, subdomain, admin name, email and password are required."
      );
      return;
    }
    try {
      setCreating(true);
      await createRestaurantForSuperAdmin({
        subdomain: subdomain.trim().toLowerCase(),
        name: name.trim(),
        contactPhone: createForm.contactPhone.trim() || undefined,
        contactEmail: createForm.contactEmail.trim() || undefined,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPassword,
      });
      toast.success("Restaurant created. Owner can log in and set up branches.");
      setShowCreateForm(false);
      loadRestaurants();
      loadDeleted();
    } catch (err) {
      setCreateError(err.message || "Failed to create restaurant");
    } finally {
      setCreating(false);
    }
  }

  async function loadRestaurants() {
    try {
      const res = await getSuperRestaurantActivitySummary();
      setRestaurants(res?.restaurants ?? []);
    } catch {
      const list = await getRestaurantsForSuperAdmin();
      setRestaurants(list ?? []);
    }
  }
  function loadDeleted() {
    getDeletedRestaurantsForSuperAdmin()
      .then(setDeletedRestaurants)
      .catch(() => setDeletedRestaurants([]));
  }

  useEffect(() => {
    loadRestaurants();
    loadDeleted();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setStatusDropdownId(null);
      }
    };
    if (statusDropdownId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [statusDropdownId]);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterHealth, setFilterHealth] = useState("all");
  const [sortSales, setSortSales] = useState("desc"); // "desc" = high to low, "asc" = low to high

  const filtered = restaurants.filter((r) => {
    const subStatus = r.subscription?.status || "";
    const egKey = r.engagement?.key || "";

    if (filterStatus !== "all" && subStatus !== filterStatus) return false;
    if (filterHealth !== "all" && egKey !== filterHealth) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const name = (r.website?.name || "").toLowerCase();
    const sub = (r.website?.subdomain || "").toLowerCase();
    const phone = (r.website?.contactPhone || "").toLowerCase();
    const email = (r.website?.contactEmail || "").toLowerCase();
    const plan = (r.subscription?.plan || "").toLowerCase();
    const status = (r.subscription?.status || "").toLowerCase();
    return (
      name.includes(q) ||
      sub.includes(q) ||
      phone.includes(q) ||
      email.includes(q) ||
      plan.includes(q) ||
      status.includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const revA = a.activity?.revenueLast30Days ?? 0;
    const revB = b.activity?.revenueLast30Days ?? 0;
    const mult = sortSales === "asc" ? 1 : -1;
    return (revA - revB) * mult;
  });

  async function handleStatusChange(id, status) {
    const cfg = STATUS_CONFIRM[status] || {};
    // Trial: simple confirm, backend enforces 3-month trial window
    if (status === "TRIAL") {
      const ok = await confirm({
        title: cfg.title || "Change Status",
        message: cfg.message || `Change subscription status to ${status}?`,
        confirmLabel: cfg.confirmLabel || "Confirm",
      });
      if (!ok) return;
      setStatusDropdownId(null);
      setUpdatingId(id);
      try {
        const updated = await updateRestaurantSubscription(id, { status });
        setRestaurants((prev) =>
          prev.map((r) =>
            r.id === updated.id
              ? { ...r, subscription: updated.subscription }
              : r,
          ),
        );
      } finally {
        setUpdatingId(null);
      }
      return;
    }

    // Active: ask for duration (in months)
    let durationMonths = null;
    if (status === "ACTIVE") {
      durationMonths = await confirm({
        title: cfg.title || "Activate Subscription",
        message:
          cfg.message || "Choose how long the subscription should stay active.",
        confirmLabel: cfg.confirmLabel || "Activate",
        options: [
          { label: "1 month", value: 1 },
          { label: "3 months", value: 3 },
          { label: "6 months", value: 6 },
          { label: "12 months", value: 12 },
        ],
        defaultValue: 1,
      });
      if (!durationMonths) return;
    } else {
      const ok = await confirm({
        title: cfg.title || "Change Status",
        message: cfg.message || `Change subscription status to ${status}?`,
        confirmLabel: cfg.confirmLabel || "Confirm",
      });
      if (!ok) return;
    }
    setStatusDropdownId(null);
    setUpdatingId(id);
    try {
      const payload = durationMonths ? { status, durationMonths } : { status };
      const updated = await updateRestaurantSubscription(id, payload);
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === updated.id
            ? { ...r, subscription: updated.subscription }
            : r,
        ),
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AdminLayout title="Restaurants & Subscriptions">
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name, subdomain, phone, email, plan or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All statuses</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All health</option>
            <option value="active">Active</option>
            <option value="quiet">Quiet</option>
            <option value="new">New</option>
            <option value="configured">Configured</option>
            <option value="dormant">Dormant</option>
          </select>
          <select
            value={sortSales}
            onChange={(e) => setSortSales(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary"
            title="Sort by 30-day revenue"
          >
            <option value="desc">Sales: High → Low</option>
            <option value="asc">Sales: Low → High</option>
          </select>
          {(searchQuery ||
            filterStatus !== "all" ||
            filterHealth !== "all") && (
            <span className="text-xs text-neutral-500">
              {filtered.length} of {restaurants.length}
            </span>
          )}
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Create restaurant
          </Button>
          {deletedRestaurants.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDeletedDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/60 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
              >
                Recently deleted
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-700 text-[10px] text-white">
                  {deletedRestaurants.length}
                </span>
              </button>
              {deletedDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-neutral-950 border border-amber-200 dark:border-amber-700 shadow-lg z-20">
                  <div className="px-3 py-2 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                      Restore restaurants (48h)
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {deletedRestaurants.map((r) => (
                      <div
                        key={r.id}
                        className="px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-amber-900 dark:text-amber-100 truncate">
                            {r.website?.name || "Untitled"}
                          </p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-mono truncate">
                            {r.website?.subdomain || "—"}
                          </p>
                          {r.deletedAt && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-300/80 mt-0.5">
                              {(() => {
                                const deletedAt = new Date(r.deletedAt);
                                const totalMs = 48 * 60 * 60 * 1000;
                                const elapsed =
                                  Date.now() - deletedAt.getTime();
                                const remaining = Math.max(
                                  0,
                                  totalMs - elapsed,
                                );
                                const hrs = Math.floor(
                                  remaining / (60 * 60 * 1000),
                                );
                                const mins = Math.floor(
                                  (remaining % (60 * 60 * 1000)) / (60 * 1000),
                                );
                                if (remaining <= 0)
                                  return "Restore window expired";
                                if (hrs === 0) return `${mins} min remaining`;
                                return `${hrs}h ${mins}m remaining`;
                              })()}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <button
                            type="button"
                            className="px-2 py-1 rounded-md bg-emerald-600 text-[10px] text-white font-semibold hover:bg-emerald-700"
                            onClick={async () => {
                              const name = r.website?.name || "Restaurant";
                              const toastId = toast.loading(
                                `Restoring "${name}"...`,
                              );
                              try {
                                await restoreRestaurantForSuperAdmin(r.id);
                                loadRestaurants();
                                loadDeleted();
                                setDeletedDropdownOpen(false);
                                toast.success(`"${name}" restored.`, {
                                  id: toastId,
                                });
                              } catch (err) {
                                toast.error(
                                  err.message || "Failed to restore",
                                  { id: toastId },
                                );
                              }
                            }}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-md border border-red-300 bg-red-50 text-[10px] text-red-700 font-semibold hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
                            onClick={async () => {
                              const name = r.website?.name || "Restaurant";
                              const ok = await confirm({
                                title: "Permanently delete restaurant",
                                message:
                                  `This will permanently delete "${name}" and cannot be undone. ` +
                                  "This action will remove the restaurant from the platform.",
                                confirmLabel: "Delete permanently",
                              });
                              if (!ok) return;
                              const toastId = toast.loading(
                                `Deleting "${name}" permanently...`,
                              );
                              try {
                                await permanentlyDeleteRestaurantForSuperAdmin(
                                  r.id,
                                );
                                loadRestaurants();
                                loadDeleted();
                                toast.success(
                                  `"${name}" deleted permanently.`,
                                  {
                                    id: toastId,
                                  },
                                );
                              } catch (err) {
                                toast.error(
                                  err.message || "Failed to delete permanently",
                                  {
                                    id: toastId,
                                  },
                                );
                              }
                            }}
                          >
                            Delete forever
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DataTable
          showSno
          data={sorted}
          emptyMessage={
            restaurants.length === 0
              ? "No restaurants yet. Onboard tenants via the API."
              : "No restaurants match your search or filters."
          }
          columns={[
            {
              key: "restaurant",
              header: "Restaurant",
              render: (_, r) => (
                <div className="font-medium text-gray-900 dark:text-white">
                  {r.website?.name || "Untitled restaurant"}
                </div>
              ),
            },
            {
              key: "subdomain",
              header: "Subdomain",
              render: (_, r) => r.website?.subdomain || "—",
              cellClassName: "text-gray-700 dark:text-neutral-300",
            },
            {
              key: "phone",
              header: "Owner phone",
              render: (_, r) => r.website?.contactPhone || "—",
              cellClassName:
                "text-gray-700 dark:text-neutral-300 whitespace-nowrap",
            },
            {
              key: "email",
              header: "Owner email",
              render: (_, r) => r.website?.contactEmail || "—",
              cellClassName:
                "text-gray-700 dark:text-neutral-300 truncate max-w-[180px]",
            },
            {
              key: "plan",
              header: "Plan",
              render: (_, r) => r.subscription?.plan || "ESSENTIAL",
              cellClassName: "text-gray-700 dark:text-neutral-300",
            },
            {
              key: "status",
              header: "Status",
              render: (_, r) => {
                const sub = r.subscription || {};
                return (
                  <span
                    className={`badge text-[10px] ${
                      sub.status === "ACTIVE"
                        ? "badge-success"
                        : sub.status === "TRIAL"
                          ? "badge-warning"
                          : "badge-danger"
                    }`}
                  >
                    {sub.status || "TRIAL"}
                  </span>
                );
              },
            },
            {
              key: "orders7d",
              header: "7d",
              align: "right",
              render: (_, r) => (
                <span className="tabular-nums text-gray-700 dark:text-neutral-300">
                  {r.activity?.ordersLast7Days ?? 0}
                </span>
              ),
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "orders30d",
              header: "30d",
              align: "right",
              render: (_, r) => (
                <span className="tabular-nums font-semibold text-gray-900 dark:text-white">
                  {r.activity?.ordersLast30Days ?? 0}
                </span>
              ),
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "revenue30d",
              header: "Revenue",
              align: "right",
              render: (_, r) => {
                const a = r.activity?.revenueLast30Days;
                return (
                  <span className="tabular-nums text-gray-600 dark:text-neutral-400 text-[11px]">
                    {a != null && a > 0
                      ? `PKR ${Number(a).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </span>
                );
              },
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "ordersLifetime",
              header: "All-time",
              align: "right",
              render: (_, r) => (
                <span className="tabular-nums text-gray-700 dark:text-neutral-300">
                  {r.activity?.ordersLifetime ?? 0}
                </span>
              ),
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "lastOrderAt",
              header: "Last order",
              align: "left",
              render: (_, r) => (
                <span className="text-[11px] text-neutral-500 whitespace-nowrap">
                  {formatDateTime(r.activity?.lastOrderAt) || "—"}
                </span>
              ),
              cellClassName: "max-w-[120px] truncate",
            },
            {
              key: "menuItemsCount",
              header: "Menu",
              align: "right",
              render: (_, r) => (
                <span className="tabular-nums text-neutral-500">
                  {r.activity?.menuItemsCount ?? 0}
                </span>
              ),
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "branchesCount",
              header: "Branches",
              align: "right",
              render: (_, r) => {
                const count = r.activity?.branchesCount ?? 0;
                if (count === 0) {
                  return <span className="tabular-nums text-neutral-500">0</span>;
                }
                return (
                  <button
                    type="button"
                    onClick={() => openBranchesModal(r)}
                    disabled={branchesLoading}
                    className="tabular-nums text-primary hover:text-primary/80 font-medium underline underline-offset-1"
                  >
                    {count}
                  </button>
                );
              },
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "teamMembersCount",
              header: "Team",
              align: "right",
              render: (_, r) => (
                <span className="tabular-nums text-neutral-500">
                  {r.activity?.teamMembersCount ?? 0}
                </span>
              ),
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "health",
              header: "Health",
              render: (_, r) => {
                const eg = r.engagement || {};
                const badgeClass =
                  ENGAGEMENT_STYLES[eg.key] || ENGAGEMENT_STYLES.dormant;
                return (
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                    title={eg.description}
                  >
                    {eg.label || "—"}
                  </span>
                );
              },
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "trialEnds",
              header: "Trial ends",
              render: (_, r) =>
                r.subscription?.trialEndsAt
                  ? new Date(r.subscription.trialEndsAt).toLocaleDateString()
                  : "—",
              cellClassName: "text-neutral-400",
            },
            {
              key: "expires",
              header: "Expires",
              render: (_, r) =>
                r.subscription?.expiresAt
                  ? new Date(r.subscription.expiresAt).toLocaleDateString()
                  : "—",
              cellClassName: "text-neutral-400",
            },
            {
              key: "created",
              header: "Created",
              render: (_, r) =>
                r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—",
              cellClassName: "text-neutral-400 whitespace-nowrap",
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (_, r) => {
                const website = r.website || {};
                const isDropdownOpen = statusDropdownId === r.id;
                return (
                  <div className="inline-flex items-center gap-1.5 justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        const slug = website.subdomain || null;
                        if (slug) {
                          setActingAsRestaurant(slug);
                          window.open("/overview", "_blank");
                        }
                      }}
                      className="px-3 text-[11px] font-semibold"
                      title="Open this restaurant's dashboard in a new tab"
                    >
                      Login
                    </Button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/40"
                      title="Soft-delete (recoverable 48h)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                    <div
                      className="relative"
                      ref={isDropdownOpen ? dropdownRef : null}
                    >
                      <button
                        type="button"
                        disabled={updatingId === r.id}
                        onClick={() =>
                          setStatusDropdownId(isDropdownOpen ? null : r.id)
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 text-[11px] font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Status
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 z-20">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(r.id, "TRIAL")}
                            className="w-full text-left px-4 py-2 text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                          >
                            Trial
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(r.id, "ACTIVE")}
                            className="w-full text-left px-4 py-2 text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(r.id, "SUSPENDED")
                            }
                            className="w-full text-left px-4 py-2 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            Suspend
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              },
            },
          ]}
        />

        {/* Branches modal */}
        {branchesModalRestaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border-2 border-gray-200 dark:border-neutral-700 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-700 flex-shrink-0">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Branches — {branchesModalRestaurant.website?.name || "Untitled"}
                </h3>
                <button
                  type="button"
                  onClick={() => setBranchesModalRestaurant(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-4">
                {branchesLoading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-neutral-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading branches…
                  </div>
                ) : (() => {
                  const sub = branchesModalRestaurant.website?.subdomain;
                  const restId = branchesModalRestaurant.id;
                  const restaurantBranches = allBranches.filter(
                    (b) =>
                      b.subdomain === sub || b.restaurantId === restId
                  );
                  if (restaurantBranches.length === 0) {
                    return (
                      <p className="text-sm text-neutral-500 py-6">
                        No branches found.
                      </p>
                    );
                  }
                  return (
                    <ul className="space-y-4">
                      {restaurantBranches.map((b) => (
                        <li
                          key={b.id}
                          className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4"
                        >
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {b.name}
                            {b.code && (
                              <span className="ml-2 text-xs font-normal text-neutral-500">
                                ({b.code})
                              </span>
                            )}
                          </div>
                          {b.address && (
                            <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                              {b.address}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 mt-2 text-sm">
                            {b.contactPhone && (
                              <span className="text-gray-700 dark:text-neutral-300">
                                📞 {b.contactPhone}
                              </span>
                            )}
                            {b.contactEmail && (
                              <span className="text-gray-700 dark:text-neutral-300">
                                ✉️ {b.contactEmail}
                              </span>
                            )}
                            {!b.contactPhone && !b.contactEmail && (
                              <span className="text-neutral-400">—</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Create restaurant modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
                Create restaurant
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Manually onboard a new restaurant and create its admin user. They
                will get a 3‑month free trial.
              </p>
              {createError && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                  {createError}
                </p>
              )}
              <form
                onSubmit={handleCreateRestaurant}
                className="space-y-3"
                autoComplete="off"
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Restaurant name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={createForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const sugg = slugifyForSubdomain(name);
                      setCreateForm((f) => ({
                        ...f,
                        name,
                        subdomain: sugg,
                      }));
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                    placeholder="My Restaurant"
                    required
                  />
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 flex items-baseline gap-0.5">
                    <span className="text-neutral-400 dark:text-neutral-500">URL:</span>
                    <input
                      type="text"
                      autoComplete="off"
                      value={createForm.subdomain}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          subdomain: e.target.value
                            .replace(/[^a-z0-9-]/gi, "")
                            .toLowerCase(),
                        }))
                      }
                      placeholder="myrestaurant"
                      className="min-w-[8ch] max-w-[24ch] px-0.5 py-0 text-[11px] font-mono text-neutral-600 dark:text-neutral-300 bg-transparent border-none border-b border-neutral-400/50 hover:border-neutral-500 focus:border-neutral-500 focus:outline-none focus:ring-0"
                    />
                    <span className="text-neutral-400 dark:text-neutral-500 font-mono">.eatsdesk.app</span>
                  </p>
                  {(() => {
                    const existing = [
                      ...restaurants.map((r) => r.website?.subdomain),
                      ...deletedRestaurants.map((r) => r.website?.subdomain),
                    ].filter(Boolean);
                    const taken = createForm.subdomain && existing.includes(createForm.subdomain);
                    return taken ? (
                      <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                        This subdomain is already in use
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Contact phone
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={createForm.contactPhone}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          contactPhone: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                      placeholder="03XX-XXXXXXX"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Contact email
                    </label>
                    <input
                      type="email"
                      autoComplete="off"
                      value={createForm.contactEmail}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          contactEmail: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                      placeholder="contact@example.com"
                    />
                  </div>
                </div>
                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3 mt-3">
                  <p className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    Admin user (restaurant owner)
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      autoComplete="off"
                      value={createForm.adminName}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          adminName: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                      placeholder="Admin name"
                      required
                    />
                    <input
                      type="email"
                      autoComplete="off"
                      value={createForm.adminEmail}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          adminEmail: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                      placeholder="admin@example.com"
                      required
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={createForm.adminPassword}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          adminPassword: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                      placeholder="Password"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (creating) return;
                      setShowCreateForm(false);
                    }}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Creating…
                      </span>
                    ) : (
                      "Create restaurant"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete restaurant confirmation modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border-2 border-gray-200 dark:border-neutral-700 shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-700">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Delete restaurant
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteConfirmName("");
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-gray-600 dark:text-neutral-400">
                  This will <span className="font-semibold">soft delete</span>{" "}
                  the restaurant{" "}
                  <span className="font-semibold">
                    &quot;{deleteTarget.website?.name || "Untitled"}&quot;
                  </span>
                  . It can be recovered within{" "}
                  <span className="font-semibold">48 hours</span> from
                  &quot;Recently deleted&quot;. To confirm, type the restaurant
                  name exactly.
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Type{" "}
                    <span className="font-mono">
                      {deleteTarget.website?.name || "Untitled"}
                    </span>{" "}
                    to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    placeholder={deleteTarget.website?.name || "Untitled"}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-700">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteConfirmName("");
                  }}
                  className="px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="px-4 bg-red-600 hover:bg-red-700 text-white"
                  disabled={
                    deleteLoading ||
                    deleteConfirmName.trim() !==
                      (deleteTarget.website?.name || "Untitled").trim()
                  }
                  onClick={async () => {
                    setDeleteLoading(true);
                    const name = deleteTarget.website?.name || "Restaurant";
                    const toastId = toast.loading(`Deleting "${name}"...`);
                    try {
                      await deleteRestaurantForSuperAdmin(deleteTarget.id);
                      loadRestaurants();
                      loadDeleted();
                      setDeleteTarget(null);
                      setDeleteConfirmName("");
                      toast.success(
                        `"${name}" deleted. Recover within 48h from Recently deleted.`,
                        { id: toastId },
                      );
                    } catch (err) {
                      toast.error(
                        err.message || "Failed to delete restaurant",
                        { id: toastId },
                      );
                    } finally {
                      setDeleteLoading(false);
                    }
                  }}
                >
                  {deleteLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Delete restaurant"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
