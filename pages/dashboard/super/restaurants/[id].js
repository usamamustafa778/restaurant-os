import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AdminLayout from "../../../../components/layout/AdminLayout";
import SuperPageGate from "../../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../../hooks/usePlatformPermissionGate";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/Button";
import ActionDropdown from "../../../../components/ui/ActionDropdown";
import GenerateInvoiceModal from "../../../../components/super/GenerateInvoiceModal";
import MarkPaidModal from "../../../../components/super/MarkPaidModal";
import { viewInvoicePDF } from "../../../../components/super/InvoicePDF";
import {
  deleteSuperInvoice,
  getSuperInvoice,
  getSuperInvoices,
  getSuperRestaurantDetail,
  sendSuperInvoiceEmail,
  sendSuperRestaurantWelcomeEmail,
  impersonateRestaurantAsSuperAdmin,
  updateRestaurantForSuperAdmin,
  updateRestaurantSubscription,
  verifyRestaurantOwnerEmailsForSuperAdmin,
  resetRestaurantOwnerPasswordForSuperAdmin,
} from "../../../../lib/apiClient";
import { useConfirmDialog } from "../../../../contexts/ConfirmDialogContext";
import { usePermissions } from "../../../../contexts/PermissionContext";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  MailCheck,
  Pencil,
  Trash2,
  User,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const STOREFRONT_DOMAIN =
  process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "eatsdesk.app";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "subscription", label: "Subscription" },
  { id: "invoices", label: "Invoices" },
  { id: "settings", label: "Settings" },
];

const STATUS_INFO_PILL = {
  TRIAL: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  ACTIVE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  PAST_DUE: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  GRACE: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  SUSPENDED:
    "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300",
};

const HEALTH_BORDER = {
  active: "border-l-emerald-500",
  quiet: "border-l-amber-500",
  dormant: "border-l-gray-400",
  new: "border-l-gray-400",
  configured: "border-l-gray-400",
};

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
  PAST_DUE: "badge-warning",
  GRACE: "badge-info",
  EXPIRED: "badge-danger",
  SUSPENDED: "badge-danger",
};

const MODULE_DEFINITIONS = [
  { key: "pos", label: "POS Core", rate: 2500, perBranch: true, required: true },
  { key: "kds", label: "KDS", rate: 1500, perBranch: true, requires: ["pos"] },
  { key: "waiterApp", label: "Waiter App", rate: 1500, perBranch: true, requires: ["pos"] },
  { key: "website", label: "Website", rate: 2500, perBranch: true },
  {
    key: "websiteAnalytics",
    label: "Website Analytics",
    rate: 2500,
    perBranch: true,
    requires: ["website"],
  },
  { key: "rider", label: "Rider App", rate: 2500, perBranch: true },
  { key: "inventory", label: "Inventory", rate: 2500, perBranch: true, includes: "recipes" },
  {
    key: "accounting",
    label: "Accounting",
    rate: 5000,
    perBranch: true,
    includes: "Purchase Orders & GRN",
  },
  { key: "aiReceptionist", label: "AI Receptionist", rate: 5000, perBranch: true, noTrial: true },
];

const MODULE_MAP = MODULE_DEFINITIONS.reduce((acc, mod) => {
  acc[mod.key] = mod;
  return acc;
}, {});

const DISCOUNT_TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage (%)" },
  { value: "fixed_amount", label: "Fixed amount (Rs)" },
  { value: "flat_total", label: "Flat total (Rs)" },
];

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

function formatStatusLabel(status) {
  return String(status || "TRIAL").toUpperCase().replace(/_/g, " ");
}

function defaultModuleActiveMap() {
  return MODULE_DEFINITIONS.reduce((acc, mod) => {
    acc[mod.key] = mod.required ? true : false;
    return acc;
  }, {});
}

function normalizeModuleActiveMap(raw) {
  const base = defaultModuleActiveMap();
  const source = raw && typeof raw === "object" ? raw : {};
  for (const mod of MODULE_DEFINITIONS) {
    const cfg = source[mod.key];
    if (cfg && typeof cfg === "object" && typeof cfg.active === "boolean") {
      base[mod.key] = cfg.active;
    }
  }
  base.pos = true;
  if (!base.website) base.websiteAnalytics = false;
  return base;
}

function normalizeDiscountDraft(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const typeRaw = String(source.type || "fixed_amount").toLowerCase();
  const type = ["percentage", "fixed_amount", "flat_total"].includes(typeRaw)
    ? typeRaw
    : "fixed_amount";
  const valueNum = Number(source.value || 0);
  return {
    type,
    value: Number.isFinite(valueNum) && valueNum >= 0 ? valueNum : 0,
    label: String(source.label || ""),
    active: Boolean(source.active),
  };
}

function computeBillingPreview(moduleActiveMap, discountDraft, branchCount = 1) {
  const modules = normalizeModuleActiveMap(
    Object.entries(moduleActiveMap || {}).reduce((acc, [key, active]) => {
      acc[key] = { active: Boolean(active) };
      return acc;
    }, {}),
  );
  const discount = normalizeDiscountDraft(discountDraft);
  const safeBranchCount = Math.max(1, Number(branchCount) || 1);
  const gross = MODULE_DEFINITIONS.reduce((sum, mod) => {
    if (!modules[mod.key]) return sum;
    const multiplier = mod.perBranch === false ? 1 : safeBranchCount;
    return sum + Number(mod.rate || 0) * multiplier;
  }, 0);
  let net = gross;
  if (discount.active) {
    if (discount.type === "percentage") {
      net = Math.max(0, gross - (gross * discount.value) / 100);
    } else if (discount.type === "fixed_amount") {
      net = Math.max(0, gross - discount.value);
    } else if (discount.type === "flat_total") {
      net = Math.max(0, discount.value);
    }
  }
  net = Math.round(net);
  const discountAmount = Math.round(gross - net);
  return {
    branchCount: safeBranchCount,
    gross: Math.round(gross),
    discountAmount,
    net,
    discountLabel:
      normalizeDiscountDraft(discountDraft).label || "Subscription discount",
  };
}

function toDateInputValue(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatRelativeTimeShort(iso) {
  if (!iso) return "Never";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 0) return "just now";
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return "Never";
  }
}

function formatRsReadable(n) {
  const value = Number(n) || 0;
  if (value >= 10000000) return `Rs ${(value / 10000000).toFixed(1)} Cr`;
  if (value >= 100000) return `Rs ${(value / 100000).toFixed(1)} Lac`;
  if (value >= 1000) return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
  return `Rs ${Math.round(value)}`;
}

function restaurantInitials(name) {
  const cleaned = String(name || "R").replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (!cleaned) return "R";
  return cleaned.slice(0, 2).toUpperCase();
}

function isExpiringWithinDays(iso, days = 7) {
  if (!iso) return false;
  const remaining = new Date(iso).getTime() - Date.now();
  return remaining > 0 && remaining <= days * 86400000;
}

function formatTrialEndLabel(iso) {
  if (!iso) return null;
  return `Trial ends ${formatDate(iso)}`;
}

const FORM_LABEL =
  "block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1.5";
const FORM_INPUT =
  "w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500";

function SectionCard({
  title,
  description,
  children,
  variant = "default",
  className = "",
}) {
  const variants = {
    default: "border-gray-200 dark:border-neutral-800",
    success: "border-emerald-200 dark:border-emerald-800",
    danger: "border-red-200 dark:border-red-900/50",
  };
  return (
    <div
      className={`rounded-xl bg-white dark:bg-neutral-950 border overflow-hidden ${variants[variant] || variants.default} ${className}`}
    >
      <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-3 text-sm">
      <span className="text-neutral-500 shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-neutral-100 text-right break-all font-medium">
        {value}
      </span>
    </div>
  );
}

function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200/80 dark:bg-neutral-800 ${className}`}
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 py-6 bg-[#f8f9fa] dark:bg-neutral-950 min-h-[60vh] space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex gap-4">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex justify-between gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
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
  const { hasAccess, permissionsLoaded } = usePlatformPermissionGate(
    "platform.restaurants.view",
  );
  const { hasPermission } = usePermissions();
  const canImpersonate = hasPermission("platform.impersonate");
  const canManageSubscriptions = hasPermission("platform.subscriptions.manage");
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
  const [trialStartDraft, setTrialStartDraft] = useState("");
  const [trialEndDraft, setTrialEndDraft] = useState("");
  const [trialSaving, setTrialSaving] = useState(false);
  const [endTrialSaving, setEndTrialSaving] = useState(false);
  const [activationStart, setActivationStart] = useState("");
  const [activationEnd, setActivationEnd] = useState("");
  const [activationSaving, setActivationSaving] = useState(false);
  const [moduleDraft, setModuleDraft] = useState(defaultModuleActiveMap);
  const [discountDraft, setDiscountDraft] = useState(() =>
    normalizeDiscountDraft({}),
  );
  const [moduleSaving, setModuleSaving] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    name: "",
    contactPhone: "",
    contactEmail: "",
    address: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [welcomeSending, setWelcomeSending] = useState(false);
  const [verifyEmailSaving, setVerifyEmailSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [headerDangerOpen, setHeaderDangerOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getSuperRestaurantDetail(id);
      setDetail(data);
      setPlanDraft(data?.restaurant?.subscription?.plan || "ESSENTIAL");
      const sub = data?.restaurant?.subscription || {};
      setTrialStartDraft(
        toDateInputValue(sub.trialStartsAt || sub.freeTrialStartDate),
      );
      setTrialEndDraft(
        toDateInputValue(sub.trialEndsAt || sub.freeTrialEndDate || sub.expiresAt),
      );
      setModuleDraft(normalizeModuleActiveMap(data?.restaurant?.modules));
      setDiscountDraft(
        normalizeDiscountDraft(data?.restaurant?.subscriptionDiscount),
      );
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
    if (!hasAccess) return;
    loadDetail();
  }, [loadDetail, hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    if (activeTab === "invoices" && id) loadInvoices();
  }, [activeTab, id, loadInvoices, hasAccess]);

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
      modules: restaurant.modules || null,
      subscriptionDiscount: restaurant.subscriptionDiscount || null,
      billing: detail?.billing || null,
      ownerAccount: detail?.ownerAccount || {
        displayName: owner?.name,
        loginEmail: owner?.email,
      },
    };
  }, [restaurant, detail?.ownerAccount, detail?.billing, owner]);

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
    try {
      await impersonateRestaurantAsSuperAdmin({
        restaurantId: restaurant?.id || id,
        subdomain,
      });
      window.open("/overview", "_blank");
    } catch (err) {
      toast.error(err.message || "Could not start impersonation");
    }
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

  function handleModuleToggle(key, nextActive) {
    if (key === "pos" && !nextActive) {
      toast.error("POS Core is required and cannot be turned off.");
      return;
    }
    if (key === "websiteAnalytics" && nextActive && !moduleDraft.website) {
      toast.error("Website Analytics requires Website to be active.");
      return;
    }
    setModuleDraft((prev) => {
      const next = { ...prev, [key]: Boolean(nextActive) };
      next.pos = true;
      if (key === "website" && !nextActive) {
        next.websiteAnalytics = false;
      }
      if (!next.website) {
        next.websiteAnalytics = false;
      }
      return next;
    });
  }

  async function handleSaveModulesAndDiscount() {
    if (!restaurant?.id) return;
    if (!canManageSubscriptions) {
      toast.error("You don't have permission to manage subscriptions.");
      return;
    }
    const normalizedDiscount = normalizeDiscountDraft(discountDraft);
    if (!Number.isFinite(Number(normalizedDiscount.value)) || normalizedDiscount.value < 0) {
      toast.error("Discount value must be 0 or greater.");
      return;
    }

    const modulesPayload = MODULE_DEFINITIONS.reduce((acc, mod) => {
      acc[mod.key] = { active: Boolean(moduleDraft[mod.key]), rate: mod.rate };
      return acc;
    }, {});
    modulesPayload.pos.active = true;
    if (!modulesPayload.website.active) {
      modulesPayload.websiteAnalytics.active = false;
    }

    try {
      setModuleSaving(true);
      await updateRestaurantSubscription(restaurant.id, {
        modules: modulesPayload,
        subscriptionDiscount: normalizedDiscount,
      });
      toast.success("Module entitlements and discount updated.");
      await loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to save module settings");
    } finally {
      setModuleSaving(false);
    }
  }

  async function handleSaveTrialDates() {
    if (!restaurant?.id) return;
    if (hasPaidHistory) {
      toast.error(
        "This restaurant has paid subscription history and cannot be reverted to trial. Use Manual Activation to set proper dates.",
      );
      return;
    }
    if (!trialStartDraft || !trialEndDraft) {
      toast.error("Trial start and end dates are required.");
      return;
    }
    const start = new Date(trialStartDraft);
    const end = new Date(trialEndDraft);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error("Invalid trial dates.");
      return;
    }
    if (end <= start) {
      toast.error("Trial end must be after trial start.");
      return;
    }
    if (status !== "TRIAL") {
      const ok = await confirm({
        title: "Reset to trial dates?",
        message:
          "This will move the restaurant into TRIAL with the selected trial dates. Continue only if this tenant has never had a paid subscription.",
        confirmLabel: "Set Trial Dates",
      });
      if (!ok) return;
    }
    try {
      setTrialSaving(true);
      await updateRestaurantSubscription(restaurant.id, {
        setTrialDates: true,
        trialStartsAt: start.toISOString(),
        trialEndsAt: end.toISOString(),
      });
      toast.success("Trial dates updated.");
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to update trial dates");
    } finally {
      setTrialSaving(false);
    }
  }

  async function handleEndTrial() {
    if (!restaurant?.id) return;
    const durationMonths = await confirm({
      title: "End trial & activate",
      message:
        "This ends the trial immediately and starts a paid subscription. Choose how long it should stay active.",
      confirmLabel: "End trial & activate",
      options: [
        { label: "1 month", value: 1 },
        { label: "3 months", value: 3 },
        { label: "6 months", value: 6 },
        { label: "12 months", value: 12 },
      ],
      defaultValue: 3,
    });
    if (!durationMonths) return;
    try {
      setEndTrialSaving(true);
      await updateRestaurantSubscription(restaurant.id, {
        status: "ACTIVE",
        durationMonths,
      });
      toast.success("Trial ended. Subscription activated.");
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to end trial");
    } finally {
      setEndTrialSaving(false);
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

  async function handleVerifyOwnerEmail() {
    if (!restaurant?.id) return;
    const pending = detail?.owner?.pendingCount ?? 0;
    const ok = await confirm({
      title: "Verify owner email",
      message:
        `Mark ${pending || "owner/admin"} email verification as complete without OTP? ` +
        "They can log in to the dashboard immediately.",
      confirmLabel: "Verify email",
    });
    if (!ok) return;

    try {
      setVerifyEmailSaving(true);
      const res = await verifyRestaurantOwnerEmailsForSuperAdmin(restaurant.id);
      const count = res?.modifiedCount ?? res?.matchedCount ?? 0;
      toast.success(
        count > 0
          ? `Verified ${count} owner/admin account${count === 1 ? "" : "s"}.`
          : "Owner email already verified.",
      );
      loadDetail();
    } catch (err) {
      toast.error(err.message || "Failed to verify owner email");
    } finally {
      setVerifyEmailSaving(false);
    }
  }

  function openPasswordModal() {
    setPasswordForm({ password: "", confirmPassword: "" });
    setPasswordError("");
    setShowPassword(false);
    setPasswordModalOpen(true);
  }

  async function handleResetOwnerPassword(e) {
    e.preventDefault();
    if (!restaurant?.id) return;

    const password = passwordForm.password.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!password) {
      setPasswordError("Password is required.");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    const loginEmail = owner?.email || "the owner";
    const ok = await confirm({
      title: "Reset owner password",
      message:
        `Set a new dashboard password for ${loginEmail}? ` +
        "The owner will need to use this password on their next login.",
      confirmLabel: "Reset password",
    });
    if (!ok) return;

    try {
      setPasswordSaving(true);
      setPasswordError("");
      await resetRestaurantOwnerPasswordForSuperAdmin(restaurant.id, {
        password,
        userId: owner?.id || undefined,
      });
      toast.success("Owner password updated.");
      setPasswordModalOpen(false);
      setPasswordForm({ password: "", confirmPassword: "" });
      setShowPassword(false);
    } catch (err) {
      setPasswordError(err.message || "Failed to reset password");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleViewInvoicePdf(invoice) {
    try {
      setInvoiceActionId(invoice.id);
      const full =
        invoice.snapshot && invoice.bankDetails
          ? invoice
          : await getSuperInvoice(invoice.id);
      await viewInvoicePDF(full);
    } catch (err) {
      toast.error(err.message || "Could not open PDF");
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

  if (!permissionsLoaded || !hasAccess) {
    return (
      <AdminLayout title="Restaurant">
        <SuperPageGate permission="platform.restaurants.view" />
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout title="Restaurant">
        <DetailSkeleton />
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
  const statusInfoClass =
    STATUS_INFO_PILL[status] || STATUS_INFO_PILL.TRIAL;
  const statusLabel = formatStatusLabel(status);
  const healthBorder =
    HEALTH_BORDER[engagement.key] || HEALTH_BORDER.dormant;
  const trialEnd =
    subscription.trialEndsAt ||
    subscription.freeTrialEndDate ||
    subscription.expiresAt;
  const trialEndLabel = formatTrialEndLabel(trialEnd);
  const trialExpiringSoon = isExpiringWithinDays(trialEnd);
  const ownerPhone = owner?.phone || website.contactPhone;
  const lastActivityText = formatRelativeTimeShort(stats?.lastOrderAt);
  const ownerEmailPending = owner?.allVerified === false;
  const hasPaidHistory =
    Boolean(subscription.subscriptionStartDate) ||
    (Array.isArray(detail?.invoices) &&
      detail.invoices.some((inv) => String(inv?.status || "").toUpperCase() === "PAID"));
  const billingPreview = computeBillingPreview(
    moduleDraft,
    discountDraft,
    detail?.billing?.branchCount || 1,
  );

  return (
    <AdminLayout title={website.name || "Restaurant"}>
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 min-h-full">
        <Link
          href="/super/restaurants"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Restaurants
        </Link>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-neutral-800 overflow-x-auto mb-6 -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="flex gap-0 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-primary font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-normal"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ backgroundColor: "#FF5400" }}
                  >
                    {restaurantInitials(website.name)}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                      {website.name || "Untitled restaurant"}
                    </h1>
                    {subdomain ? (
                      <a
                        href={storefrontUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] font-mono text-primary hover:underline mt-0.5"
                      >
                        {subdomain}.{STOREFRONT_DOMAIN}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : null}
                    {(owner?.name || ownerPhone) && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                        {owner?.name ? `👤 ${owner.name}` : null}
                        {owner?.name && ownerPhone ? " · " : null}
                        {ownerPhone ? `📱 ${ownerPhone}` : null}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                <Button
                  type="button"
                  onClick={handleLoginAsAdmin}
                  disabled={!subdomain || !canImpersonate}
                  className="!h-9 text-xs"
                  title={
                    canImpersonate
                      ? undefined
                      : "You don't have permission to impersonate tenants"
                  }
                >
                  Login as Admin
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowInvoiceModal(true)}
                  className="!h-9 text-xs inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Generate Invoice
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={welcomeSending}
                  onClick={handleWelcomeEmail}
                  className="!h-9 text-xs"
                >
                  {welcomeSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Welcome Email"
                  )}
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
                {ownerEmailPending ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={verifyEmailSaving}
                    onClick={handleVerifyOwnerEmail}
                    className="!h-9 text-xs inline-flex items-center gap-1.5 border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200"
                  >
                    {verifyEmailSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MailCheck className="w-3.5 h-3.5" />
                    )}
                    Verify email
                  </Button>
                ) : null}
                <div className="inline-flex items-center gap-1 rounded-lg border border-red-200/70 bg-red-50/70 px-1.5 py-1 dark:border-red-900/40 dark:bg-red-950/20">
                  <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                    Risk
                  </span>
                  <ActionDropdown
                    isOpen={headerDangerOpen}
                    onToggle={() => setHeaderDangerOpen((prev) => !prev)}
                    onClose={() => setHeaderDangerOpen(false)}
                    actions={[
                      {
                        label: "Reset password",
                        icon: <KeyRound className="w-3.5 h-3.5" />,
                        disabled: !owner?.email,
                        variant: "danger",
                        onClick: openPasswordModal,
                      },
                      {
                        label:
                          status === "SUSPENDED"
                            ? "Activate restaurant"
                            : "Suspend restaurant",
                        icon: <X className="w-3.5 h-3.5" />,
                        disabled: statusUpdating,
                        variant: "danger",
                        onClick: () =>
                          handleSubscriptionStatus(
                            status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                          ),
                      },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {owner?.email ? (
                <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-900 text-sm text-gray-700 dark:text-neutral-300">
                  📧 {owner.email}
                </span>
              ) : null}
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-900 text-sm text-gray-700 dark:text-neutral-300">
                📦 {(subscription.plan || "ESSENTIAL").toUpperCase()} Plan
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfoClass}`}
              >
                {statusLabel}
              </span>
              {status === "TRIAL" && trialEndLabel ? (
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    trialExpiringSoon
                      ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 font-medium"
                      : "bg-gray-100 text-gray-600 dark:bg-neutral-900 dark:text-neutral-400"
                  }`}
                >
                  {trialEndLabel}
                </span>
              ) : null}
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-900 text-sm text-gray-600 dark:text-neutral-400">
                📅 Member since {formatDate(restaurant.createdAt)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                  Total orders
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {(stats?.totalOrders ?? 0).toLocaleString("en-PK")}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {(stats?.orders30d ?? 0).toLocaleString("en-PK")} in last 30
                  days
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                  Revenue tracked
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {formatRsReadable(stats?.totalRevenue)}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {formatRsReadable(stats?.revenue30d)} in last 30 days
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                  Team members
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                  {stats?.teamCount ?? 0}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {stats?.activeTeamCount ?? 0} active
                </p>
              </div>
              <div
                className={`p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 border-l-[3px] ${healthBorder}`}
              >
                <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                  Last activity
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {lastActivityText}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${healthClass}`}
                  >
                    {engagement.label || "—"}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Restaurant Details
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {[
                  ["Restaurant name", website.name || "—"],
                  [
                    "Subdomain",
                    subdomain ? `${subdomain}.${STOREFRONT_DOMAIN}` : "—",
                  ],
                  ["Address", website.address || "—"],
                  ["Contact phone", website.contactPhone || "—"],
                  ["Contact email", website.contactEmail || "—"],
                  ["Created", formatDate(restaurant.createdAt)],
                  ["Plan", (subscription.plan || "ESSENTIAL").toUpperCase()],
                  [
                    "Status",
                    <span
                      key="status"
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusInfoClass}`}
                    >
                      {statusLabel}
                    </span>,
                  ],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-6 px-5 py-3 text-sm"
                  >
                    <span className="text-neutral-500 shrink-0">{label}</span>
                    <span className="text-gray-900 dark:text-neutral-100 text-right break-all font-medium">
                      {val}
                    </span>
                  </div>
                ))}
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
                            onClick={() => handleViewInvoicePdf(row)}
                            title="View PDF"
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
          <div className="space-y-6 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide font-medium mb-2">
                  <CreditCard className="w-3.5 h-3.5" />
                  Current plan
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {(subscription.plan || "ESSENTIAL").toUpperCase()}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <div className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-2">
                  Status
                </div>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfoClass}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide font-medium mb-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {status === "ACTIVE" ? "Renews / ends" : "Trial ends"}
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {status === "ACTIVE"
                    ? formatDate(
                        subscription.subscriptionEndDate ||
                          subscription.expiresAt,
                      )
                    : formatDate(
                        subscription.trialEndsAt ||
                          subscription.freeTrialEndDate,
                      )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-stretch w-full">
              <div className="space-y-4 min-w-0">
                <div className="rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Subscription Details
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                    <DetailRow
                      label="Plan"
                      value={(subscription.plan || "ESSENTIAL").toUpperCase()}
                    />
                    <DetailRow
                      label="Status"
                      value={
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusInfoClass}`}
                        >
                          {statusLabel}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Trial started"
                      value={formatDate(
                        subscription.trialStartsAt ||
                          subscription.freeTrialStartDate,
                      )}
                    />
                    <DetailRow
                      label="Trial ends"
                      value={formatDate(
                        subscription.trialEndsAt ||
                          subscription.freeTrialEndDate,
                      )}
                    />
                    <DetailRow
                      label="Subscription start"
                      value={formatDate(subscription.subscriptionStartDate)}
                    />
                    <DetailRow
                      label="Subscription end"
                      value={formatDate(
                        subscription.subscriptionEndDate ||
                          subscription.expiresAt,
                      )}
                    />
                  </div>
                </div>

                <SectionCard
                  title="Set Trial Dates"
                  description="Override the trial period for this restaurant. New signups still get 30 days automatically."
                >
                  <div className="space-y-3">
                    {hasPaidHistory ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                        This tenant has paid subscription history. Trial reset is blocked. Use
                        <span className="font-semibold"> Manual Activation </span>
                        to correct dates safely.
                      </div>
                    ) : status !== "TRIAL" ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        Setting trial dates for a non-trial tenant requires confirmation and will
                        move the tenant to TRIAL.
                      </div>
                    ) : null}
                    <div>
                      <label className={FORM_LABEL} htmlFor="trial-start">
                        Trial start
                      </label>
                      <input
                        id="trial-start"
                        type="date"
                        value={trialStartDraft}
                        onChange={(e) => setTrialStartDraft(e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                    <div>
                      <label className={FORM_LABEL} htmlFor="trial-end">
                        Trial end
                      </label>
                      <input
                        id="trial-end"
                        type="date"
                        value={trialEndDraft}
                        onChange={(e) => setTrialEndDraft(e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={trialSaving || hasPaidHistory}
                      onClick={handleSaveTrialDates}
                      className="!h-9 w-full text-xs"
                    >
                      {trialSaving ? "Saving…" : "Save Trial Dates"}
                    </Button>
                  </div>
                </SectionCard>

                {status === "TRIAL" && (
                  <SectionCard
                    title="End Trial"
                    description="End trial now and start a paid subscription"
                    variant="success"
                  >
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
                      You will choose an active period of 1, 3, 6, or 12 months.
                    </p>
                    <Button
                      type="button"
                      disabled={endTrialSaving || statusUpdating}
                      onClick={handleEndTrial}
                      className="!h-9 w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {endTrialSaving ? "Activating…" : "End Trial & Activate"}
                    </Button>
                  </SectionCard>
                )}
              </div>

              <div className="space-y-4 w-full">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Manage Subscription
                </h2>
                <SectionCard
                  title="Change Plan"
                  description="Update the billing tier for this restaurant"
                >
                  <div className="space-y-3">
                    <div>
                      <label className={FORM_LABEL} htmlFor="plan-select">
                        Plan
                      </label>
                      <select
                        id="plan-select"
                        value={planDraft}
                        onChange={(e) => setPlanDraft(e.target.value)}
                        className={FORM_INPUT}
                      >
                        <option value="ESSENTIAL">ESSENTIAL</option>
                        <option value="PROFESSIONAL">PROFESSIONAL</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </div>
                    <Button
                      type="button"
                      disabled={planSaving}
                      onClick={handleSavePlan}
                      className="!h-9 w-full text-xs"
                    >
                      {planSaving ? "Saving…" : "Save Plan"}
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Module Entitlements & Discount"
                  description="Toggle add-on modules and apply transparent billing discounts"
                >
                  <div className="space-y-4">
                    {!canManageSubscriptions ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        You have view-only access. Ask an admin with
                        <span className="font-semibold"> platform.subscriptions.manage </span>
                        to edit module entitlements.
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      {MODULE_DEFINITIONS.map((mod) => {
                        const isActive = Boolean(moduleDraft[mod.key]);
                        const isRequired = Boolean(mod.required);
                        const disabled = !canManageSubscriptions || isRequired;
                        return (
                          <label
                            key={mod.key}
                            className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${
                              isActive
                                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/20"
                                : "border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">
                                {mod.label}
                              </p>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                Rs {mod.rate.toLocaleString("en-PK")}
                                {mod.perBranch === false
                                  ? "/mo (flat per restaurant)"
                                  : `/branch/mo (x${billingPreview.branchCount})`}
                                {mod.includes ? ` · includes ${mod.includes}` : ""}
                                {mod.noTrial ? " · not included in trial" : ""}
                                {mod.requires?.length
                                  ? ` · requires ${mod.requires.join(", ")}`
                                  : ""}
                                {isRequired ? " · required base module" : ""}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={isActive}
                              disabled={disabled}
                              onChange={(e) =>
                                handleModuleToggle(mod.key, e.target.checked)
                              }
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-60"
                            />
                          </label>
                        );
                      })}
                    </div>

                    <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        Discount
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-700 dark:text-neutral-300">
                          Discount active
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(discountDraft.active)}
                          disabled={!canManageSubscriptions}
                          onChange={(e) =>
                            setDiscountDraft((prev) => ({
                              ...prev,
                              active: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className={FORM_LABEL}>Type</label>
                        <select
                          value={discountDraft.type}
                          disabled={!canManageSubscriptions}
                          onChange={(e) =>
                            setDiscountDraft((prev) => ({
                              ...prev,
                              type: e.target.value,
                            }))
                          }
                          className={FORM_INPUT}
                        >
                          {DISCOUNT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={FORM_LABEL}>Value</label>
                        <input
                          type="number"
                          min="0"
                          step={discountDraft.type === "percentage" ? "0.01" : "1"}
                          value={discountDraft.value}
                          disabled={!canManageSubscriptions}
                          onChange={(e) =>
                            setDiscountDraft((prev) => ({
                              ...prev,
                              value: e.target.value === "" ? 0 : Number(e.target.value),
                            }))
                          }
                          className={FORM_INPUT}
                        />
                      </div>
                      <div>
                        <label className={FORM_LABEL}>Label</label>
                        <input
                          type="text"
                          placeholder="Founding client discount"
                          value={discountDraft.label}
                          disabled={!canManageSubscriptions}
                          onChange={(e) =>
                            setDiscountDraft((prev) => ({
                              ...prev,
                              label: e.target.value,
                            }))
                          }
                          className={FORM_INPUT}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                        <span>Billable branches</span>
                        <span className="font-medium">{billingPreview.branchCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                        <span>Gross</span>
                        <span className="font-medium">
                          Rs {billingPreview.gross.toLocaleString("en-PK")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300 mt-1">
                        <span>
                          Discount
                          {discountDraft.active
                            ? ` (${billingPreview.discountLabel})`
                            : ""}
                        </span>
                        <span
                          className={
                            billingPreview.discountAmount > 0
                              ? "font-medium text-emerald-600 dark:text-emerald-400"
                              : "font-medium"
                          }
                        >
                          Rs {billingPreview.discountAmount.toLocaleString("en-PK")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-neutral-700 text-sm">
                        <span className="font-semibold text-gray-800 dark:text-neutral-100">
                          Net monthly total
                        </span>
                        <span className="font-bold text-primary">
                          Rs {billingPreview.net.toLocaleString("en-PK")}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      disabled={!canManageSubscriptions || moduleSaving}
                      onClick={handleSaveModulesAndDiscount}
                      className="!h-9 w-full text-xs"
                    >
                      {moduleSaving ? "Saving…" : "Save Module & Discount Settings"}
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Manual Activation"
                  description="Set custom start and end dates for a paid subscription"
                >
                  <div className="space-y-3">
                    <div>
                      <label className={FORM_LABEL} htmlFor="activation-start">
                        Start date
                      </label>
                      <input
                        id="activation-start"
                        type="date"
                        value={activationStart}
                        onChange={(e) => setActivationStart(e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                    <div>
                      <label className={FORM_LABEL} htmlFor="activation-end">
                        End date
                      </label>
                      <input
                        id="activation-end"
                        type="date"
                        value={activationEnd}
                        onChange={(e) => setActivationEnd(e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={activationSaving}
                      onClick={handleManualActivation}
                      className="!h-9 w-full text-xs"
                    >
                      {activationSaving ? "Activating…" : "Activate Subscription"}
                    </Button>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {activeTab === "settings" && (
          <div className="space-y-6 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-stretch w-full">
              <form onSubmit={handleSettingsSave} className="min-w-0">
                <SectionCard
                  title="Restaurant Settings"
                  description="Contact and listing details shown on the platform"
                >
                  <div className="space-y-4">
                    <div>
                      <label className={FORM_LABEL} htmlFor="settings-name">
                        Restaurant name
                      </label>
                      <input
                        id="settings-name"
                        type="text"
                        value={settingsForm.name}
                        onChange={(e) =>
                          setSettingsForm((f) => ({
                            ...f,
                            name: e.target.value,
                          }))
                        }
                        className={FORM_INPUT}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={FORM_LABEL} htmlFor="settings-phone">
                          Contact phone
                        </label>
                        <input
                          id="settings-phone"
                          type="text"
                          value={settingsForm.contactPhone}
                          onChange={(e) =>
                            setSettingsForm((f) => ({
                              ...f,
                              contactPhone: e.target.value,
                            }))
                          }
                          className={FORM_INPUT}
                        />
                      </div>
                      <div>
                        <label className={FORM_LABEL} htmlFor="settings-email">
                          Contact email
                        </label>
                        <input
                          id="settings-email"
                          type="email"
                          value={settingsForm.contactEmail}
                          onChange={(e) =>
                            setSettingsForm((f) => ({
                              ...f,
                              contactEmail: e.target.value,
                            }))
                          }
                          className={FORM_INPUT}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={FORM_LABEL} htmlFor="settings-address">
                        Address
                      </label>
                      <textarea
                        id="settings-address"
                        rows={3}
                        value={settingsForm.address}
                        onChange={(e) =>
                          setSettingsForm((f) => ({
                            ...f,
                            address: e.target.value,
                          }))
                        }
                        className={`${FORM_INPUT} resize-y min-h-[4.5rem]`}
                      />
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
                    <Button
                      type="submit"
                      disabled={settingsSaving}
                      className="!h-10 w-full sm:w-auto min-w-[140px] bg-[#FF5400] hover:bg-[#e64d00] text-white"
                    >
                      {settingsSaving ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving…
                        </span>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </SectionCard>
              </form>

              <div className="space-y-4 w-full">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Owner Account
                </h2>
                <div className="rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-neutral-400 shrink-0" />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Dashboard login account
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                    <DetailRow label="Name" value={owner?.name || "—"} />
                    <DetailRow label="Email" value={owner?.email || "—"} />
                    <DetailRow
                      label="Email verified"
                      value={
                        owner?.allVerified == null ? (
                          "—"
                        ) : owner.allVerified ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Yes
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-300">
                            Pending
                            {owner.pendingCount > 0
                              ? ` (${owner.pendingCount})`
                              : ""}
                          </span>
                        )
                      }
                    />
                    <DetailRow label="Phone" value={owner?.phone || "—"} />
                  </div>
                  <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-800 space-y-2">
                    <Button
                      type="button"
                      disabled={!owner?.email}
                      onClick={openPasswordModal}
                      className="!h-9 w-full text-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-4 h-4" />
                      Reset owner password
                    </Button>
                    {!owner?.email ? (
                      <p className="text-[11px] text-neutral-500 text-center">
                        No owner email on file
                      </p>
                    ) : null}
                  </div>
                  {ownerEmailPending ? (
                    <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-800">
                      <Button
                        type="button"
                        disabled={verifyEmailSaving}
                        onClick={handleVerifyOwnerEmail}
                        className="!h-9 w-full text-xs inline-flex items-center justify-center gap-1.5 border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
                      >
                        {verifyEmailSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MailCheck className="w-4 h-4" />
                        )}
                        Verify email without OTP
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <SectionCard
              title="Danger Zone"
              description="Irreversible or access-blocking actions"
              variant="danger"
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      Suspend restaurant
                    </p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                      Blocks dashboard and public website access
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={statusUpdating}
                    onClick={() =>
                      handleSubscriptionStatus(
                        status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                      )
                    }
                    className={`!h-9 shrink-0 text-xs border ${
                      status === "SUSPENDED"
                        ? "border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-400"
                        : "border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400"
                    }`}
                  >
                    {statusUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : status === "SUSPENDED" ? (
                      "Activate Restaurant"
                    ) : (
                      "Suspend Restaurant"
                    )}
                  </Button>
                </div>
              </div>
            </SectionCard>
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

      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Reset owner password</h2>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {owner?.email ? (
              <p className="text-xs text-neutral-500 mb-3">
                New password for{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {owner.email}
                </span>
              </p>
            ) : null}
            {passwordError ? (
              <p className="text-xs text-red-600 mb-2">{passwordError}</p>
            ) : null}
            <form onSubmit={handleResetOwnerPassword} className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1">
                  New password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={passwordForm.password}
                    onChange={(e) =>
                      setPasswordForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">
                  Confirm password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((f) => ({
                        ...f,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="flex-1 px-3 py-2 rounded-lg border text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                >
                  {passwordSaving ? "Saving…" : "Reset password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
