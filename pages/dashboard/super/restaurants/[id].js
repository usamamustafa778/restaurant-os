import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AdminLayout from "../../../../components/layout/AdminLayout";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/Button";
import GenerateInvoiceModal from "../../../../components/super/GenerateInvoiceModal";
import MarkPaidModal from "../../../../components/super/MarkPaidModal";
import { downloadInvoicePDF } from "../../../../components/super/InvoicePDF";
import {
  deleteRestaurantForSuperAdmin,
  deleteSuperInvoice,
  getSuperInvoice,
  getSuperInvoices,
  getSuperRestaurantDetail,
  sendSuperInvoiceEmail,
  sendSuperRestaurantWelcomeEmail,
  setActingAsRestaurant,
  updateRestaurantForSuperAdmin,
  updateRestaurantSubscription,
  verifyRestaurantOwnerEmailsForSuperAdmin,
} from "../../../../lib/apiClient";
import { useConfirmDialog } from "../../../../contexts/ConfirmDialogContext";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const STOREFRONT_DOMAIN =
  process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "eatsdesk.app";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "invoices", label: "Invoices" },
  { id: "subscription", label: "Subscription" },
  { id: "settings", label: "Settings" },
];

const ENGAGEMENT_STYLES = {
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

const SUBSCRIPTION_PILL = {
  TRIAL: "badge-warning",
  ACTIVE: "badge-success",
  EXPIRED: "badge-danger",
  SUSPENDED: "badge-danger",
};

const STATUS_CONFIRM = {
  ACTIVE: {
    title: "Activate Subscription",
    message: "Choose how long the subscription should stay active.",
    confirmLabel: "Activate",
  },
  SUSPENDED: {
    title: "Suspend Restaurant",
    message:
      "This will suspend the restaurant. All dashboard and public website access will be blocked until reactivated. Are you sure?",
    confirmLabel: "Suspend",
  },
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

function formatPkr(n) {
  return `PKR ${Math.round(Number(n) || 0).toLocaleString("en-PK")}`;
}

function InvoiceStatusPill({ status }) {
  const map = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300",
    SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] || map.DRAFT}`}
    >
      {status}
    </span>
  );
}

export default function SuperRestaurantDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { confirm } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    subdomain: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
    platformHealthOverride: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceActionId, setInvoiceActionId] = useState(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState(null);

  const [planDraft, setPlanDraft] = useState("ESSENTIAL");
  const [planSaving, setPlanSaving] = useState(false);
  const [extendDays, setExtendDays] = useState("30");
  const [extendSaving, setExtendSaving] = useState(false);
  const [activationStart, setActivationStart] = useState("");
  const [activationEnd, setActivationEnd] = useState("");
  const [activationSaving, setActivationSaving] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    name: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [welcomeSending, setWelcomeSending] = useState(false);
  const [verifySending, setVerifySending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getSuperRestaurantDetail(id);
      setDetail(data);
      setPlanDraft(data?.restaurant?.subscription?.plan || "ESSENTIAL");
      const w = data?.restaurant?.website || {};
      setSettingsForm({
        name: w.name || "",
        contactPhone: w.contactPhone || "",
        contactEmail: w.contactEmail || "",
        address: w.address || "",
      });
    } catch (err) {
      toast.error(err.message || "Failed to load restaurant");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadInvoices = useCallback(async () => {
    if (!id) return;
    try {
      setInvoicesLoading(true);
      const data = await getSuperInvoices({
        restaurantId: id,
        limit: 100,
        page: 1,
      });
      setInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
    } catch (err) {
      toast.error(err.message || "Failed to load invoices");
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (activeTab === "invoices" && id) loadInvoices();
  }, [activeTab, id, loadInvoices]);

  const restaurant = detail?.restaurant;
  const owner = detail?.owner;
  const stats = detail?.stats;
  const website = restaurant?.website || {};
  const subscription = restaurant?.subscription || {};
  const status = String(subscription.status || "TRIAL").toUpperCase();
  const subdomain = website.subdomain;
  const storefrontUrl = subdomain
    ? `https://${subdomain}.${STOREFRONT_DOMAIN}`
    : null;

  const invoiceRestaurant = useMemo(() => {
    if (!restaurant) return null;
    return {
      id: restaurant.id,
      website: restaurant.website,
      subscription: restaurant.subscription,
      ownerAccount: detail?.ownerAccount || {
        displayName: owner?.name,
        loginEmail: owner?.email,
      },
    };
  }, [restaurant, detail?.ownerAccount, owner]);

  function openEditModal() {
    setEditForm({
      name: website.name || "",
      subdomain: website.subdomain || "",
      contactPhone: website.contactPhone || "",
      contactEmail: website.contactEmail || "",
      address: website.address || "",
      platformHealthOverride: restaurant?.platformHealthOverride || "",
    });
    setEditError("");
    setEditOpen(true);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!restaurant?.id) return;
    setEditError("");
    const name = editForm.name.trim();
    const sub = editForm.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!name || !sub) {
      setEditError("Restaurant name and subdomain are required.");
      return;
    }
    try {
      setEditSaving(true);
      await updateRestaurantForSuperAdmin(restaurant.id, {
        name,
        subdomain: sub,
        contactPhone: editForm.contactPhone.trim(),
        contactEmail: editForm.contactEmail.trim(),
        address: editForm.address.trim(),
        platformHealthOverride: editForm.platformHealthOverride || null,
      });
      toast.success("Restaurant updated.");
      setEditOpen(false);
      loadDetail();
    } catch (err) {
      setEditError(err.message || "Failed to update");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSettingsSave(e) {
    e.preventDefault();
    if (!restaurant?.id) return;
    try {
      setSettingsSaving(true);
      await updateRestaurantForSuperAdmin(restaurant.id, {
        name: settingsForm.name.trim(),
        contactPhone: settingsForm.contactPhone.trim(),
        contactEmail: settingsForm.contactEmail.trim(),
        address: settingsForm.address.trim(),
      });
      toast.success("Settings saved.");
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleLoginAsAdmin() {
    if (!subdomain) return;
    setActingAsRestaurant(subdomain);
    window.open("/overview", "_blank");
  }

  async function handleSubscriptionStatus(nextStatus) {
    if (!restaurant?.id) return;
    const cfg = STATUS_CONFIRM[nextStatus] || {};
    let durationMonths = null;
    if (nextStatus === "ACTIVE") {
      durationMonths = await confirm({
        title: cfg.title,
        message: cfg.message,
        confirmLabel: cfg.confirmLabel,
        options: [
          { label: "1 month", value: 1 },
          { label: "3 months", value: 3 },
          { label: "6 months", value: 6 },
          { label: "12 months", value: 12 },
        ],
        defaultValue: 3,
      });
      if (!durationMonths) return;
    } else {
      const ok = await confirm({
        title: cfg.title || "Change status",
        message: cfg.message || `Change subscription to ${nextStatus}?`,
        confirmLabel: cfg.confirmLabel || "Confirm",
      });
      if (!ok) return;
    }
    try {
      setStatusUpdating(true);
      const payload = durationMonths
        ? { status: nextStatus, durationMonths }
        : { status: nextStatus };
      await updateRestaurantSubscription(restaurant.id, payload);
      toast.success(
        nextStatus === "SUSPENDED" ? "Restaurant suspended." : "Subscription updated.",
      );
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to update subscription");
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleSavePlan() {
    if (!restaurant?.id) return;
    try {
      setPlanSaving(true);
      await updateRestaurantSubscription(restaurant.id, { plan: planDraft });
      toast.success("Plan updated.");
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to update plan");
    } finally {
      setPlanSaving(false);
    }
  }

  async function handleExtendTrial() {
    if (!restaurant?.id) return;
    const days = Number(extendDays);
    const currentEnd =
      subscription.trialEndsAt ||
      subscription.freeTrialEndDate ||
      subscription.expiresAt;
    const base = currentEnd ? new Date(currentEnd) : new Date();
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    try {
      setExtendSaving(true);
      await updateRestaurantSubscription(restaurant.id, {
        trialEndsAt: next.toISOString(),
        expiresAt: next.toISOString(),
      });
      toast.success(`Trial extended by ${days} days.`);
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to extend trial");
    } finally {
      setExtendSaving(false);
    }
  }

  async function handleManualActivation() {
    if (!restaurant?.id || !activationEnd) {
      toast.error("End date is required.");
      return;
    }
    const end = new Date(activationEnd);
    const start = activationStart ? new Date(activationStart) : new Date();
    if (Number.isNaN(end.getTime())) {
      toast.error("Invalid end date.");
      return;
    }
    const diffMs = end.getTime() - start.getTime();
    const months = Math.max(1, Math.ceil(diffMs / (30 * 86400000)));
    const clamped = [1, 3, 6, 12].includes(months)
      ? months
      : months <= 2
        ? 1
        : months <= 4
          ? 3
          : months <= 9
            ? 6
            : 12;
    try {
      setActivationSaving(true);
      await updateRestaurantSubscription(restaurant.id, {
        status: "ACTIVE",
        durationMonths: clamped,
      });
      if (end.toISOString()) {
        await updateRestaurantSubscription(restaurant.id, {
          expiresAt: end.toISOString(),
        });
      }
      toast.success("Subscription activated.");
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to activate");
    } finally {
      setActivationSaving(false);
    }
  }

  async function handleWelcomeEmail() {
    if (!restaurant?.id) return;
    try {
      setWelcomeSending(true);
      await sendSuperRestaurantWelcomeEmail(restaurant.id);
      toast.success("Welcome email sent.");
    } catch (err) {
      toast.error(err.message || "Failed to send welcome email");
    } finally {
      setWelcomeSending(false);
    }
  }

  async function handleVerifyEmail() {
    if (!restaurant?.id) return;
    const ok = await confirm({
      title: "Verify admin emails without OTP?",
      message:
        "Mark all restaurant_admin and admin accounts as email-verified?",
      confirmLabel: "Verify emails",
    });
    if (!ok) return;
    try {
      setVerifySending(true);
      await verifyRestaurantOwnerEmailsForSuperAdmin(restaurant.id);
      toast.success("Owner emails verified.");
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to verify emails");
    } finally {
      setVerifySending(false);
    }
  }

  async function handlePermanentDelete() {
    if (!restaurant?.id) return;
    const name = website.name || "Restaurant";
    if (deleteConfirmName.trim() !== name.trim()) return;
    try {
      setDeleteSaving(true);
      await deleteRestaurantForSuperAdmin(restaurant.id);
      toast.success(`"${name}" deleted.`);
      router.push("/super/restaurants");
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleteSaving(false);
    }
  }

  async function handleDownloadInvoice(invoice) {
    try {
      setInvoiceActionId(invoice.id);
      const full =
        invoice.snapshot && invoice.bankDetails
          ? invoice
          : await getSuperInvoice(invoice.id);
      await downloadInvoicePDF(full);
    } catch (err) {
      toast.error(err.message || "PDF download failed");
    } finally {
      setInvoiceActionId(null);
    }
  }

  async function handleSendInvoiceEmail(invoice) {
    try {
      setInvoiceActionId(invoice.id);
      await sendSuperInvoiceEmail(invoice.id);
      toast.success(invoice.status === "DRAFT" ? "Invoice sent" : "Email resent");
      loadInvoices();
    } catch (err) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setInvoiceActionId(null);
    }
  }

  async function handleDeleteInvoice(invoice) {
    if (!window.confirm(`Delete draft ${invoice.invoiceNumber}?`)) return;
    try {
      setInvoiceActionId(invoice.id);
      await deleteSuperInvoice(invoice.id);
      toast.success("Draft deleted");
      loadInvoices();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setInvoiceActionId(null);
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Restaurant">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!restaurant) {
    return (
      <AdminLayout title="Restaurant">
        <div className="py-12 text-center">
          <p className="text-neutral-500 mb-4">Restaurant not found.</p>
          <Link
            href="/super/restaurants"
            className="text-primary font-semibold hover:underline"
          >
            ← Back to restaurants
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const engagement = stats?.engagement || {};
  const healthClass =
    ENGAGEMENT_STYLES[engagement.key] || ENGAGEMENT_STYLES.dormant;
  const statusClass = SUBSCRIPTION_PILL[status] || SUBSCRIPTION_PILL.TRIAL;
  const showVerifyEmail = owner && owner.allVerified === false;

  return (
    <AdminLayout title={website.name || "Restaurant"}>
      <div className="space-y-5">
        {detail?._fallback ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Using list data — deploy the latest backend to{" "}
            <code className="font-mono">api.eatsdesk.com</code> for full detail
            stats (all-time revenue, active team count, welcome email).
          </div>
        ) : null}
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/super/restaurants"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Restaurants
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {website.name || "Untitled restaurant"}
            </h1>
            {subdomain ? (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-primary hover:underline mt-1 inline-block"
              >
                {subdomain}.{STOREFRONT_DOMAIN}
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              onClick={handleLoginAsAdmin}
              disabled={!subdomain}
              className="!h-9 text-xs"
            >
              Login as Admin
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={openEditModal}
              className="!h-9 text-xs inline-flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={statusUpdating}
              onClick={() =>
                handleSubscriptionStatus(
                  status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                )
              }
              className={`!h-9 text-xs ${
                status === "SUSPENDED"
                  ? "border-emerald-300 text-emerald-700"
                  : "border-amber-300 text-amber-800"
              }`}
            >
              {statusUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : status === "SUSPENDED" ? (
                "Activate"
              ) : (
                "Suspend"
              )}
            </Button>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 text-sm">
          {owner?.name ? (
            <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-gray-800 dark:text-neutral-200">
              👤 {owner.name}
            </span>
          ) : null}
          {owner?.email ? (
            <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-gray-800 dark:text-neutral-200">
              📧 {owner.email}
            </span>
          ) : null}
          {(owner?.phone || website.contactPhone) ? (
            <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-gray-800 dark:text-neutral-200">
              📱 {owner?.phone || website.contactPhone}
            </span>
          ) : null}
          <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-gray-800 dark:text-neutral-200">
            📦 {(subscription.plan || "ESSENTIAL").toUpperCase()} Plan
          </span>
          <span
            className={`badge text-[10px] font-semibold uppercase ${statusClass}`}
          >
            🟢 {status}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400">
            📅 Member since {formatDate(restaurant.createdAt)}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            {
              label: "Total orders",
              value: stats?.totalOrders ?? 0,
              sub: `${stats?.orders30d ?? 0} in last 30 days`,
            },
            {
              label: "Revenue tracked",
              value: formatPkr(stats?.totalRevenue),
              sub: `${formatPkr(stats?.revenue30d)} in last 30 days`,
            },
            {
              label: "Team members",
              value: stats?.teamCount ?? 0,
              sub: `${stats?.activeTeamCount ?? 0} active`,
            },
            {
              label: "Health",
              value: engagement.label || "—",
              sub: stats?.lastOrderAt
                ? `Last order: ${formatRelativeTime(stats.lastOrderAt)}`
                : "Last order: Never",
              badge: true,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800"
            >
              <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                {card.label}
              </p>
              {card.badge ? (
                <span
                  className={`inline-flex mt-2 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${healthClass}`}
                >
                  {card.value}
                </span>
              ) : (
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {card.value}
                </p>
              )}
              <p className="text-xs text-neutral-500 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-neutral-800 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                Restaurant Details
              </h2>
              <dl className="space-y-3 text-sm">
                {[
                  ["Restaurant name", website.name || "—"],
                  ["Subdomain", subdomain ? `${subdomain}.${STOREFRONT_DOMAIN}` : "—"],
                  ["Address", website.address || "—"],
                  ["Contact phone", website.contactPhone || "—"],
                  ["Contact email", website.contactEmail || "—"],
                  ["Created", formatDate(restaurant.createdAt)],
                  ["Plan", (subscription.plan || "ESSENTIAL").toUpperCase()],
                  ["Subscription status", status],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-neutral-500 shrink-0">{label}</dt>
                    <dd className="text-gray-900 dark:text-neutral-100 text-right break-all">
                      {val}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h2>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(true)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 text-sm font-medium"
                >
                  📄 Generate Invoice
                </button>
                <button
                  type="button"
                  onClick={handleLoginAsAdmin}
                  disabled={!subdomain}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 text-sm font-medium disabled:opacity-50"
                >
                  🔑 Login as Admin
                </button>
                <button
                  type="button"
                  disabled={welcomeSending}
                  onClick={handleWelcomeEmail}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 text-sm font-medium disabled:opacity-50"
                >
                  {welcomeSending ? "Sending…" : "📧 Send Welcome Email"}
                </button>
                <button
                  type="button"
                  disabled={statusUpdating}
                  onClick={() => handleSubscriptionStatus("SUSPENDED")}
                  className="w-full text-left px-4 py-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 text-sm font-medium disabled:opacity-50"
                >
                  ⏸ Suspend Restaurant
                </button>
                {showVerifyEmail ? (
                  <button
                    type="button"
                    disabled={verifySending}
                    onClick={handleVerifyEmail}
                    className="w-full text-left px-4 py-3 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-medium disabled:opacity-50"
                  >
                    {verifySending ? "Verifying…" : "✓ Verify Email"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Invoices tab */}
        {activeTab === "invoices" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="!h-9 text-xs"
              >
                + Generate Invoice
              </Button>
            </div>
            {invoicesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <DataTable
                variant="card"
                data={invoices}
                emptyMessage="No invoices yet."
                columns={[
                  {
                    key: "invoiceNumber",
                    header: "Invoice #",
                    render: (v) => (
                      <span className="font-mono text-xs font-bold">{v}</span>
                    ),
                  },
                  {
                    key: "period",
                    header: "Period",
                    render: (_, row) => row.billingPeriod?.label || "—",
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (v) => (
                      <span className="font-semibold tabular-nums">
                        Rs {Math.round(Number(v) || 0).toLocaleString("en-PK")}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (v) => <InvoiceStatusPill status={v} />,
                  },
                  {
                    key: "emailSentAt",
                    header: "Sent",
                    render: (v) => formatDate(v),
                  },
                  {
                    key: "dueDate",
                    header: "Due Date",
                    render: (v) => formatDate(v),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    cellClassName: "whitespace-nowrap",
                    render: (_, row) => {
                      const busy = invoiceActionId === row.id;
                      const canMarkPaid = ["SENT", "OVERDUE"].includes(
                        row.status,
                      );
                      const canDelete = row.status === "DRAFT";
                      return (
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDownloadInvoice(row)}
                            title="PDF"
                            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold hover:bg-gray-50"
                          >
                            PDF
                          </button>
                          {canMarkPaid && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setMarkPaidInvoice(row)}
                              className="px-2 py-1 rounded-lg border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-50"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSendInvoiceEmail(row)}
                            className="px-2 py-1 rounded-lg border border-blue-200 text-blue-700 text-[11px] font-semibold hover:bg-blue-50"
                          >
                            Resend
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteInvoice(row)}
                              className="p-1 rounded-lg text-red-600 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    },
                  },
                ]}
              />
            )}
          </div>
        )}

        {/* Subscription tab */}
        {activeTab === "subscription" && (
          <div className="space-y-4 max-w-2xl">
            <div className="p-5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
              <h2 className="text-sm font-bold mb-4">Current plan</h2>
              <dl className="space-y-2 text-sm">
                {[
                  ["Plan", (subscription.plan || "ESSENTIAL").toUpperCase()],
                  ["Status", status],
                  ["Trial started", formatDate(subscription.trialStartsAt || subscription.freeTrialStartDate)],
                  ["Trial ends", formatDate(subscription.trialEndsAt || subscription.freeTrialEndDate)],
                  ["Subscription start", formatDate(subscription.subscriptionStartDate)],
                  ["Subscription end", formatDate(subscription.subscriptionEndDate || subscription.expiresAt)],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="font-medium">{val}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2">
                <span
                  className={`badge text-[10px] font-semibold uppercase ${statusClass}`}
                >
                  {status}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 space-y-3">
              <h3 className="text-sm font-bold">Change Plan</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={planDraft}
                  onChange={(e) => setPlanDraft(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                >
                  <option value="ESSENTIAL">ESSENTIAL</option>
                  <option value="PROFESSIONAL">PROFESSIONAL</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
                <Button
                  type="button"
                  disabled={planSaving}
                  onClick={handleSavePlan}
                  className="!h-9 text-xs"
                >
                  {planSaving ? "Saving…" : "Save Plan"}
                </Button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 space-y-3">
              <h3 className="text-sm font-bold">Extend Trial</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-neutral-500">Extend by:</span>
                <select
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                >
                  {["7", "14", "30", "60", "90"].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  disabled={extendSaving}
                  onClick={handleExtendTrial}
                  className="!h-9 text-xs"
                >
                  {extendSaving ? "Extending…" : "Extend Trial"}
                </Button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 space-y-3">
              <h3 className="text-sm font-bold">Manual Activation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={activationStart}
                    onChange={(e) => setActivationStart(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">
                    End date
                  </label>
                  <input
                    type="date"
                    value={activationEnd}
                    onChange={(e) => setActivationEnd(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                disabled={activationSaving}
                onClick={handleManualActivation}
                className="!h-9 text-xs"
              >
                {activationSaving ? "Activating…" : "Activate Subscription"}
              </Button>
            </div>

            <div className="p-5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20 space-y-3">
              <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
                Danger zone
              </h3>
              <Button
                type="button"
                variant="ghost"
                disabled={statusUpdating}
                onClick={() => handleSubscriptionStatus("SUSPENDED")}
                className="!h-9 text-xs border-red-300 text-red-700"
              >
                Suspend Restaurant
              </Button>
              <div className="space-y-2 pt-2 border-t border-red-200 dark:border-red-900/40">
                <p className="text-xs text-red-700 dark:text-red-400">
                  Type <strong>{website.name || "Restaurant"}</strong> to confirm
                  soft delete.
                </p>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-red-200 bg-white dark:bg-neutral-900 text-sm"
                  placeholder={website.name || "Restaurant"}
                />
                <Button
                  type="button"
                  disabled={
                    deleteSaving ||
                    deleteConfirmName.trim() !== (website.name || "Restaurant").trim()
                  }
                  onClick={handlePermanentDelete}
                  className="!h-9 text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleteSaving ? "Deleting…" : "Delete Restaurant"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {activeTab === "settings" && (
          <div className="max-w-xl p-5 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
            <form onSubmit={handleSettingsSave} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={settingsForm.contactPhone}
                  onChange={(e) =>
                    setSettingsForm((f) => ({
                      ...f,
                      contactPhone: e.target.value,
                    }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={settingsForm.contactEmail}
                  onChange={(e) =>
                    setSettingsForm((f) => ({
                      ...f,
                      contactEmail: e.target.value,
                    }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 block mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={settingsForm.address}
                  onChange={(e) =>
                    setSettingsForm((f) => ({ ...f, address: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                  Owner Details (read-only)
                </p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Name</dt>
                    <dd>{owner?.name || "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Email</dt>
                    <dd className="break-all text-right">{owner?.email || "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Phone</dt>
                    <dd>{owner?.phone || "—"}</dd>
                  </div>
                </dl>
              </div>
              <Button type="submit" disabled={settingsSaving} className="!h-9">
                {settingsSaving ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </div>
        )}
      </div>

      {showInvoiceModal && invoiceRestaurant && (
        <GenerateInvoiceModal
          restaurant={invoiceRestaurant}
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={() => {
            setShowInvoiceModal(false);
            loadInvoices();
            loadDetail();
          }}
        />
      )}

      {markPaidInvoice && (
        <MarkPaidModal
          invoice={markPaidInvoice}
          onClose={() => setMarkPaidInvoice(null)}
          onSuccess={() => {
            setMarkPaidInvoice(null);
            loadInvoices();
          }}
        />
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Edit restaurant</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {editError ? (
              <p className="text-xs text-red-600 mb-2">{editError}</p>
            ) : null}
            <form onSubmit={handleEditSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1">
                  Restaurant name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  Subdomain *
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editForm.subdomain}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        subdomain: e.target.value
                          .replace(/[^a-z0-9-]/gi, "")
                          .toLowerCase(),
                      }))
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 font-mono text-sm"
                    required
                  />
                  <span className="text-xs text-neutral-400">
                    .{STOREFRONT_DOMAIN}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Phone</label>
                  <input
                    type="text"
                    value={editForm.contactPhone}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        contactPhone: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.contactEmail}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        contactEmail: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, address: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  Platform health
                </label>
                <select
                  value={editForm.platformHealthOverride || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      platformHealthOverride: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                >
                  <option value="">Automatic</option>
                  <option value="active">Active</option>
                  <option value="quiet">Quiet</option>
                  <option value="new">New</option>
                  <option value="configured">Configured</option>
                  <option value="dormant">Dormant</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 px-3 py-2 rounded-lg border text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
