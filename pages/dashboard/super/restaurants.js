import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  getSuperRestaurantActivitySummary,
  getRestaurantsForSuperAdmin,
  createRestaurantForSuperAdmin,
  setActingAsRestaurant,
  verifyRestaurantOwnerEmailsForSuperAdmin,
  approveRestaurantForSuperAdmin,
  updateRestaurantSubscription,
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import {
  Search,
  X,
  Loader2,
  Plus,
  RefreshCw,
  Eye,
  MailCheck,
  CheckCircle2,
  Ban,
} from "lucide-react";
import toast from "react-hot-toast";

const STOREFRONT_DOMAIN =
  process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "eatsdesk.app";

function formatRelativeTime(iso) {
  if (!iso) return null;
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return "just now";
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  } catch {
    return null;
  }
}

function formatTrialEndLabel(iso) {
  if (!iso) return null;
  try {
    return `Ends ${new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  } catch {
    return null;
  }
}

function isExpiringWithinDays(iso, days = 7) {
  if (!iso) return false;
  const end = new Date(iso).getTime();
  const remaining = end - Date.now();
  return remaining > 0 && remaining <= days * 86400000;
}

const SUBSCRIPTION_PILL = {
  TRIAL: "badge-warning",
  ACTIVE: "badge-success",
  EXPIRED: "badge-danger",
  SUSPENDED: "badge-danger",
};

const APPROVE_PLANS = [
  { key: "starter", label: "Starter", price: "Rs 150/day" },
  { key: "growth", label: "Growth", price: "Rs 350/day (incl. accounting)" },
  { key: "pro", label: "Pro", price: "Rs 550/day (enterprise)" },
];

const ENGAGEMENT_STYLES = {
  /** Soft pills on white table — matches platform health column reference */
  active:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60",
  quiet:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/50",
  new: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/45 dark:text-sky-300 dark:border-sky-700/55",
  configured:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-700/50",
  dormant:
    "bg-gray-100 text-gray-600 border-gray-400 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-500",
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

export default function SuperRestaurantsPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
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
  const [listRefreshing, setListRefreshing] = useState(false);
  const [verifyingEmailId, setVerifyingEmailId] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approvePlan, setApprovePlan] = useState("starter");
  const [approveTrialDays, setApproveTrialDays] = useState(30);
  const [approveLoading, setApproveLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const { confirm } = useConfirmDialog();

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
  async function handleRefreshList() {
    if (listRefreshing) return;
    setListRefreshing(true);
    try {
      await loadRestaurants();
    } finally {
      setListRefreshing(false);
    }
  }

  async function handleVerifyOwnerEmail(restaurant) {
    const name = restaurant.website?.name || "Restaurant";
    const pending = restaurant.ownerAccount?.pendingCount ?? 0;
    const ok = await confirm({
      title: "Verify owner email",
      message:
        `Mark ${pending || "owner/admin"} email verification as complete for "${name}" without OTP? ` +
        "They can log in to the dashboard immediately.",
      confirmLabel: "Verify email",
    });
    if (!ok) return;

    try {
      setVerifyingEmailId(restaurant.id);
      const res = await verifyRestaurantOwnerEmailsForSuperAdmin(restaurant.id);
      const count = res?.modifiedCount ?? res?.matchedCount ?? 0;
      toast.success(
        count > 0
          ? `Verified ${count} owner/admin account${count === 1 ? "" : "s"}.`
          : "Owner email already verified.",
      );
      loadRestaurants();
    } catch (err) {
      toast.error(err.message || "Failed to verify owner email");
    } finally {
      setVerifyingEmailId(null);
    }
  }

  async function handleApproveRestaurant(e) {
    e.preventDefault();
    if (!approveTarget) return;
    const days = Number(approveTrialDays);
    if (!Number.isFinite(days) || days < 1) {
      toast.error("Trial duration must be at least 1 day");
      return;
    }
    try {
      setApproveLoading(true);
      await approveRestaurantForSuperAdmin(approveTarget.id, {
        plan: approvePlan,
        trialDays: days,
      });
      toast.success(
        `"${approveTarget.website?.name || "Restaurant"}" approved and activated.`,
      );
      setApproveTarget(null);
      setApprovePlan("starter");
      setApproveTrialDays(30);
      loadRestaurants();
    } catch (err) {
      toast.error(err.message || "Failed to approve restaurant");
    } finally {
      setApproveLoading(false);
    }
  }

  function openApproveModal(restaurant) {
    setApproveTarget(restaurant);
    setApprovePlan("starter");
    setApproveTrialDays(30);
  }

  async function handleSuspendToggle(restaurant) {
    const status = String(restaurant.subscription?.status || "TRIAL").toUpperCase();
    const nextStatus = status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const name = restaurant.website?.name || "Restaurant";

    let payload;
    if (nextStatus === "ACTIVE") {
      const durationMonths = await confirm({
        title: "Activate subscription",
        message: "Choose how long the subscription should stay active.",
        confirmLabel: "Activate",
        options: [
          { label: "1 month", value: 1 },
          { label: "3 months", value: 3 },
          { label: "6 months", value: 6 },
          { label: "12 months", value: 12 },
        ],
        defaultValue: 3,
      });
      if (!durationMonths) return;
      payload = { status: nextStatus, durationMonths };
    } else {
      const ok = await confirm({
        title: "Suspend restaurant",
        message:
          `Suspend "${name}"? All dashboard and public website access will be blocked until reactivated.`,
        confirmLabel: "Suspend",
      });
      if (!ok) return;
      payload = { status: nextStatus };
    }

    try {
      setStatusUpdatingId(restaurant.id);
      await updateRestaurantSubscription(restaurant.id, payload);
      toast.success(
        nextStatus === "SUSPENDED"
          ? `"${name}" suspended.`
          : `"${name}" reactivated.`,
      );
      loadRestaurants();
    } catch (err) {
      toast.error(err.message || "Failed to update subscription");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  useEffect(() => {
    loadRestaurants();
  }, []);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterHealth, setFilterHealth] = useState("all");
  const [sortSales, setSortSales] = useState("desc"); // "desc" = high to low, "asc" = low to high

  const filtered = restaurants.filter((r) => {
    const subStatus = r.subscription?.status || "";
    const egKey = r.engagement?.key || "";
    const isPending = r.approvalStatus === "pending";

    if (filterStatus === "pending_approval") {
      if (!isPending) return false;
    } else if (filterStatus !== "all" && subStatus !== filterStatus) {
      return false;
    }
    if (filterHealth !== "all" && egKey !== filterHealth) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const name = (r.website?.name || "").toLowerCase();
    const sub = (r.website?.subdomain || "").toLowerCase();
    const phone = (r.website?.contactPhone || "").toLowerCase();
    const email = (r.website?.contactEmail || "").toLowerCase();
    const ownerDisplay = (r.ownerAccount?.displayName || "").toLowerCase();
    const ownerLogin = (r.ownerAccount?.loginEmail || "").toLowerCase();
    const plan = (r.subscription?.plan || "").toLowerCase();
    const status = (r.subscription?.status || "").toLowerCase();
    const loginEmailState = r.ownerAccount
      ? r.ownerAccount.allVerified
        ? "verified"
        : "pending"
      : "";
    return (
      name.includes(q) ||
      sub.includes(q) ||
      phone.includes(q) ||
      email.includes(q) ||
      ownerDisplay.includes(q) ||
      ownerLogin.includes(q) ||
      plan.includes(q) ||
      status.includes(q) ||
      loginEmailState.includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const aPending = a.approvalStatus === "pending" ? 1 : 0;
    const bPending = b.approvalStatus === "pending" ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;

    const lastA = a.activity?.lastOrderAt
      ? new Date(a.activity.lastOrderAt).getTime()
      : 0;
    const lastB = b.activity?.lastOrderAt
      ? new Date(b.activity.lastOrderAt).getTime()
      : 0;
    if (lastA !== lastB) return lastB - lastA;

    const revA = a.activity?.revenueLast30Days ?? 0;
    const revB = b.activity?.revenueLast30Days ?? 0;
    const mult = sortSales === "asc" ? 1 : -1;
    return (revA - revB) * mult;
  });

  return (
    <AdminLayout title="Restaurants & Subscriptions">
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex flex-1 min-w-[200px] max-w-sm items-center">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name, subdomain, phone, email, plan or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="box-border h-9 w-full rounded-lg border border-gray-200 bg-white py-0 pl-9 pr-4 text-sm leading-normal text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="box-border h-9 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium leading-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <option value="all">All statuses</option>
            <option value="pending_approval">Pending approval</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            className="box-border h-9 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium leading-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
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
            className="box-border h-9 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium leading-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            title="Sort by 30-day revenue"
          >
            <option value="desc">Sales: High → Low</option>
            <option value="asc">Sales: Low → High</option>
          </select>
          {(searchQuery ||
            filterStatus !== "all" ||
            filterHealth !== "all") && (
            <span className="inline-flex h-9 shrink-0 items-center text-xs text-neutral-500">
              {filtered.length} of {restaurants.length}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefreshList}
            disabled={listRefreshing}
            className="box-border inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Refresh list"
            aria-label="Refresh restaurants list"
          >
            <RefreshCw
              className={`w-4 h-4 ${listRefreshing ? "animate-spin" : ""}`}
            />
          </button>
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="box-border !h-9 !min-h-0 shrink-0 !py-0 inline-flex items-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Create restaurant
          </Button>
        </div>
        <DataTable
          variant="card"
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
              render: (_, r) => {
                const sub = r.website?.subdomain;
                return (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold leading-snug text-gray-900 dark:text-white">
                      {r.website?.name || "Untitled restaurant"}
                    </div>
                    {sub ? (
                      <div className="truncate font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                        {sub}.{STOREFRONT_DOMAIN}
                      </div>
                    ) : null}
                  </div>
                );
              },
            },
            {
              key: "owner",
              header: "Owner",
              render: (_, r) => {
                const oa = r.ownerAccount;
                const name = (oa?.displayName || "").trim();
                const email = (oa?.loginEmail || "").trim();
                if (!name && !email) {
                  return (
                    <span className="text-[11px] text-neutral-500">—</span>
                  );
                }
                return (
                  <div className="min-w-0 max-w-[220px]">
                    {name ? (
                      <div className="truncate text-sm leading-snug text-gray-900 dark:text-white">
                        {name}
                      </div>
                    ) : null}
                    {email ? (
                      <div className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                        {email}
                      </div>
                    ) : null}
                    {oa && oa.allVerified === false ? (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        Email pending
                        {oa.pendingCount > 0 ? ` (${oa.pendingCount})` : ""}
                      </div>
                    ) : null}
                  </div>
                );
              },
            },
            {
              key: "status",
              header: "Status",
              cellClassName: "whitespace-normal",
              render: (_, r) => {
                const isPending = r.approvalStatus === "pending";
                const sub = r.subscription || {};
                const statusLabel = String(sub.status || "TRIAL").toUpperCase();
                const badgeClass =
                  SUBSCRIPTION_PILL[statusLabel] || SUBSCRIPTION_PILL.TRIAL;
                const trialEnd =
                  sub.trialEndsAt ||
                  sub.freeTrialEndDate ||
                  sub.expiresAt;
                const endLabel = formatTrialEndLabel(trialEnd);
                const warn = isExpiringWithinDays(trialEnd);
                return (
                  <div className="flex flex-col gap-1 min-w-0">
                    {isPending ? (
                      <span className="badge w-fit text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/50">
                        Pending approval
                      </span>
                    ) : (
                      <span
                        className={`badge w-fit text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
                      >
                        {statusLabel}
                      </span>
                    )}
                    {!isPending && endLabel ? (
                      <span
                        className={`text-[11px] ${
                          warn
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "text-neutral-500 dark:text-neutral-400"
                        }`}
                      >
                        {endLabel}
                      </span>
                    ) : null}
                  </div>
                );
              },
            },
            {
              key: "health",
              header: "Health",
              align: "center",
              render: (_, r) => {
                const eg = r.engagement || {};
                const badgeClass =
                  ENGAGEMENT_STYLES[eg.key] || ENGAGEMENT_STYLES.dormant;
                return (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                    title={eg.description}
                  >
                    {eg.label || "—"}
                  </span>
                );
              },
              cellClassName: "whitespace-nowrap text-center",
            },
            {
              key: "lastOrderAt",
              header: "Last order",
              render: (_, r) => {
                const rel = formatRelativeTime(r.activity?.lastOrderAt);
                if (!rel) {
                  return (
                    <span className="text-[11px] text-neutral-500">Never</span>
                  );
                }
                return (
                  <span className="text-[11px] text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                    {rel}
                  </span>
                );
              },
              cellClassName: "whitespace-nowrap",
            },
            {
              key: "actions",
              header: "Actions",
              align: "left",
              cellClassName: "whitespace-nowrap",
              render: (_, r) => {
                const website = r.website || {};
                const isPending = r.approvalStatus === "pending";
                const status = String(r.subscription?.status || "TRIAL").toUpperCase();
                const isSuspended = status === "SUSPENDED";
                return (
                  <div className="inline-flex min-h-[1.25rem] flex-nowrap items-center gap-2 justify-start shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/super/restaurants/${r.id}`)
                      }
                      className="px-2 py-0.5 rounded-md border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-200"
                      title="View restaurant details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => openApproveModal(r)}
                        className="px-2 py-0.5 rounded-md border border-emerald-300 bg-emerald-50 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 inline-flex items-center gap-1"
                        title="Approve and activate restaurant"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={!website.subdomain}
                          onClick={() => {
                            const slug = website.subdomain || null;
                            if (slug) {
                              setActingAsRestaurant(slug);
                              window.open("/overview", "_blank");
                            }
                          }}
                          className="px-2 py-0.5 rounded-md border border-primary/30 text-[11px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Open this restaurant's dashboard in a new tab"
                        >
                          Login
                        </button>
                        {r.ownerAccount && r.ownerAccount.allVerified === false ? (
                          <button
                            type="button"
                            disabled={verifyingEmailId === r.id}
                            onClick={() => handleVerifyOwnerEmail(r)}
                            className="px-2 py-0.5 rounded-md border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                            title="Verify owner email without OTP"
                          >
                            {verifyingEmailId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <MailCheck className="w-3.5 h-3.5 inline-block mr-0.5" />
                                Verify
                              </>
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={statusUpdatingId === r.id}
                          onClick={() => handleSuspendToggle(r)}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-50 ${
                            isSuspended
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
                              : "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200"
                          }`}
                          title={
                            isSuspended
                              ? "Reactivate restaurant"
                              : "Suspend restaurant"
                          }
                        >
                          {statusUpdatingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              {isSuspended ? "Activate" : "Suspend"}
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                );
              },
            },
          ]}
        />

        {/* Create restaurant modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
                Create restaurant
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Manually onboard a new restaurant and create its admin user. They
                will get a 30-day free trial.
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
                    const existing = restaurants
                      .map((r) => r.website?.subdomain)
                      .filter(Boolean);
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

        {/* Approve restaurant modal */}
        {approveTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border-2 border-gray-200 dark:border-neutral-700 shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-700">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Approve Restaurant
                </h3>
                <button
                  type="button"
                  disabled={approveLoading}
                  onClick={() => {
                    if (approveLoading) return;
                    setApproveTarget(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleApproveRestaurant}>
                <div className="px-5 py-4 space-y-4">
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-3 py-2.5 text-xs space-y-1">
                    <p>
                      <span className="text-neutral-500">Restaurant:</span>{" "}
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {approveTarget.website?.name || "Untitled"}
                      </span>
                    </p>
                    <p>
                      <span className="text-neutral-500">Owner:</span>{" "}
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {approveTarget.ownerAccount?.displayName || "—"}
                      </span>
                    </p>
                    <p>
                      <span className="text-neutral-500">Signed up:</span>{" "}
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {approveTarget.createdAt
                          ? new Date(approveTarget.createdAt).toLocaleString()
                          : "—"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                      Select Plan
                    </p>
                    <div className="space-y-2">
                      {APPROVE_PLANS.map((p) => (
                        <label
                          key={p.key}
                          className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer text-xs ${
                            approvePlan === p.key
                              ? "border-primary bg-primary/5"
                              : "border-neutral-200 dark:border-neutral-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name="approvePlan"
                            value={p.key}
                            checked={approvePlan === p.key}
                            onChange={() => setApprovePlan(p.key)}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {p.label}
                            </span>{" "}
                            <span className="text-neutral-500">{p.price}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Trial Duration (days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={approveTrialDays}
                      onChange={(e) => setApproveTrialDays(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-700">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={approveLoading}
                    onClick={() => setApproveTarget(null)}
                    className="px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={approveLoading}
                    className="px-4"
                  >
                    {approveLoading ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Approving…
                      </span>
                    ) : (
                      "Approve & Activate"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
