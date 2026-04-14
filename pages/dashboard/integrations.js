import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getIntegrations,
  saveIntegration,
  toggleIntegration,
  deleteIntegration,
  notifyIntegration,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Loader2,
  RefreshCw,
  Link2,
  Settings,
  Zap,
  Bell,
  CheckCircle2,
  Copy,
  RotateCcw,
  Code2,
  ExternalLink,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import toast from "react-hot-toast";

// ─── Integration catalog ──────────────────────────────────────────────────────
// status: "available" | "coming_soon"
// platformKey: matches backend platform enum (or null for coming-soon)
const CATALOG = [
  {
    section: "Delivery Platforms",
    items: [
      {
        key: "FOODPANDA",
        platformKey: "FOODPANDA",
        label: "Foodpanda",
        description: "Sync delivery orders directly into your order board.",
        status: "coming_soon",
        color: "#D70F64",
        initial: "F",
        emoji: "🐼",
      },
      {
        key: "DELIVEROO",
        platformKey: null,
        label: "Deliveroo",
        description:
          "Get Deliveroo orders routed to your kitchen in real-time.",
        status: "coming_soon",
        color: "#00CCBC",
        initial: "D",
        emoji: "🟦",
      },
      {
        key: "UBER_EATS",
        platformKey: null,
        label: "Uber Eats",
        description: "Accept Uber Eats orders without leaving EatsDesk.",
        status: "coming_soon",
        color: "#06C167",
        initial: "U",
        emoji: "🟢",
      },
      {
        key: "DOORDASH",
        platformKey: null,
        label: "DoorDash",
        description: "Manage DoorDash delivery orders in one place.",
        status: "coming_soon",
        color: "#FF3008",
        initial: "D",
        emoji: "🔴",
      },
      {
        key: "CAREEM_FOOD",
        platformKey: null,
        label: "Careem Food",
        description: "Connect your Careem Food outlet to EatsDesk.",
        status: "coming_soon",
        color: "#1DBF73",
        initial: "C",
        emoji: "🚖",
      },
      {
        key: "TALABAT",
        platformKey: null,
        label: "Talabat",
        description: "Receive Talabat orders and keep your menu in sync.",
        status: "coming_soon",
        color: "#FF5200",
        initial: "T",
        emoji: "🍽️",
      },
    ],
  },
  {
    section: "Payments",
    items: [
      {
        key: "STRIPE",
        platformKey: null,
        label: "Stripe",
        description: "Accept cards, wallets, and local payment methods online.",
        status: "coming_soon",
        color: "#635BFF",
        initial: "S",
        emoji: "💳",
      },
      {
        key: "PAYPAL",
        platformKey: null,
        label: "PayPal",
        description: "Let customers pay via PayPal on your online store.",
        status: "coming_soon",
        color: "#003087",
        initial: "P",
        emoji: "🔵",
      },
      {
        key: "JAZZCASH",
        platformKey: null,
        label: "JazzCash",
        description: "Accept JazzCash mobile wallet and card payments.",
        status: "coming_soon",
        color: "#C8102E",
        initial: "J",
        emoji: "📱",
      },
      {
        key: "EASYPAISA",
        platformKey: null,
        label: "Easypaisa",
        description: "Enable Easypaisa checkout for your online orders.",
        status: "coming_soon",
        color: "#00A651",
        initial: "E",
        emoji: "💚",
      },
    ],
  },
  {
    section: "Communication",
    items: [
      {
        key: "WHATSAPP_BUSINESS",
        platformKey: null,
        label: "WhatsApp Business",
        description: "Send order confirmations and updates via WhatsApp.",
        status: "coming_soon",
        color: "#25D366",
        initial: "W",
        emoji: "💬",
      },
      {
        key: "MAILCHIMP",
        platformKey: null,
        label: "Mailchimp",
        description:
          "Grow your customer list and send targeted email campaigns.",
        status: "coming_soon",
        color: "#FFE01B",
        initial: "M",
        emoji: "📧",
        dark: true,
      },
      {
        key: "TWILIO_SMS",
        platformKey: null,
        label: "Twilio SMS",
        description: "Send automated SMS updates to customers on order events.",
        status: "coming_soon",
        color: "#F22F46",
        initial: "T",
        emoji: "📩",
      },
    ],
  },
  {
    section: "Automation",
    items: [
      {
        key: "ZAPIER",
        platformKey: null,
        label: "Zapier",
        description: "Trigger workflows in 6,000+ apps when orders are placed.",
        status: "coming_soon",
        color: "#FF4A00",
        initial: "Z",
        emoji: "⚡",
      },
      {
        key: "MAKE",
        platformKey: null,
        label: "Make (Integromat)",
        description: "Build no-code automations across your entire stack.",
        status: "coming_soon",
        color: "#6D00CC",
        initial: "M",
        emoji: "🔗",
      },
      {
        key: "GOOGLE_SHEETS",
        platformKey: null,
        label: "Google Sheets",
        description: "Export orders, inventory, and sales data automatically.",
        status: "coming_soon",
        color: "#34A853",
        initial: "G",
        emoji: "📊",
      },
    ],
  },
];

const inp =
  "w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState([]);
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Foodpanda connect slide-over
  const [connectOpen, setConnectOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // existing integration doc
  const [form, setForm] = useState({ storeId: "", apiKey: "", apiSecret: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});

  // Notify me
  const [notifiedKeys, setNotifiedKeys] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("eatsdesk_notified") || "{}");
    } catch {
      return {};
    }
  });
  const [notifyingKey, setNotifyingKey] = useState(null);

  // Developer / API section
  const [showApiKey, setShowApiKey] = useState(false);
  const apiKeyRef = useRef(null);
  const fakeApiKey = "edk_live_••••••••••••••••••••••••••••••••";
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/^http:\/\/localhost(:\d+)?/, "https://api.eatsdesk.com") ||
    "https://api.eatsdesk.com";
  const webhookUrlTemplate = `${apiBaseUrl}/webhooks/[platform]/[restaurantId]`;

  const { confirm } = useConfirmDialog();

  async function loadIntegrations() {
    setPageLoading(true);
    try {
      const data = await getIntegrations();
      setIntegrations(data);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        toast.error(err.message || "Failed to load integrations");
      }
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadIntegrations();
  }, []);

  // ── Foodpanda connect / edit ──────────────────────────────────────────────

  function openConnect(existing) {
    setEditTarget(existing || null);
    setForm({
      storeId: existing?.storeId || "",
      apiKey: "",
      apiSecret: "",
    });
    setFormError("");
    setConnectOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.storeId.trim()) {
      setFormError("Store ID is required");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = { platform: "FOODPANDA", storeId: form.storeId.trim() };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      if (form.apiSecret.trim()) payload.apiSecret = form.apiSecret.trim();
      const updated = await saveIntegration(payload);
      setIntegrations((prev) => {
        const exists = prev.find((i) => i.platform === updated.platform);
        return exists
          ? prev.map((i) => (i.platform === updated.platform ? updated : i))
          : [...prev, updated];
      });
      setConnectOpen(false);
      toast.success(
        editTarget ? "Integration updated" : "Foodpanda connected!",
      );
    } catch (err) {
      setFormError(err.message || "Failed to save integration");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(integration) {
    setTogglingId(integration.id);
    try {
      const updated = await toggleIntegration(integration.id);
      setIntegrations((prev) =>
        prev.map((i) => (i.id === integration.id ? updated : i)),
      );
      toast.success(
        updated.isActive ? "Integration activated" : "Integration paused",
      );
    } catch (err) {
      toast.error(err.message || "Failed to toggle integration");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Disconnect Foodpanda",
      message:
        "This will stop receiving orders from Foodpanda. You can reconnect at any time.",
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteIntegration(id);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      toast.success("Foodpanda disconnected");
    } catch (err) {
      toast.error(err.message || "Failed to disconnect");
    }
  }

  // ── Notify me ────────────────────────────────────────────────────────────

  async function handleNotify(item) {
    setNotifyingKey(item.key);
    try {
      const data = await notifyIntegration(item.key);
      const updated = { ...notifiedKeys, [item.key]: true };
      setNotifiedKeys(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("eatsdesk_notified", JSON.stringify(updated));
      }
      const email = data?.email;
      toast.success(
        email
          ? `We'll notify you at ${email} when ${item.label} is available.`
          : `Got it! We'll let you know when ${item.label} launches.`,
        { duration: 5000 },
      );
    } catch {
      // Fail silently — still mark locally notified
      const updated = { ...notifiedKeys, [item.key]: true };
      setNotifiedKeys(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("eatsdesk_notified", JSON.stringify(updated));
      }
      toast.success(
        `Got it! We'll let you know when ${item.label} is available.`,
        { duration: 5000 },
      );
    } finally {
      setNotifyingKey(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function copyToClipboard(text) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success("Copied to clipboard"));
  }

  const connectedMap = Object.fromEntries(
    integrations.map((i) => [i.platform, i]),
  );

  if (pageLoading) {
    return (
      <AdminLayout title="Integrations" suspended={suspended}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Link2 className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
              Loading integrations...
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Integrations" suspended={suspended}>
      <div className="space-y-10">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400 max-w-xl">
              Connect EatsDesk with the tools and platforms you already use.
              Manage all your orders, payments, and customer communications from
              one place.
            </p>
          </div>
          <button
            type="button"
            onClick={loadIntegrations}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Catalog sections */}
        {CATALOG.map(({ section, items }) => (
          <div key={section}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-neutral-500 mb-4">
              {section}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const connected = item.platformKey
                  ? connectedMap[item.platformKey]
                  : null;
                const isConnected = Boolean(connected?.isActive);
                const isConfigured = Boolean(connected);
                const isNotified = notifiedKeys[item.key];
                const isNotifying = notifyingKey === item.key;
                const isToggling = connected && togglingId === connected.id;

                return (
                  <IntegrationCard
                    key={item.key}
                    item={item}
                    connected={connected}
                    isConnected={isConnected}
                    isConfigured={isConfigured}
                    isNotified={isNotified}
                    isNotifying={isNotifying}
                    isToggling={isToggling}
                    onConnect={() => openConnect(null)}
                    onSettings={() => openConnect(connected)}
                    onToggle={() => handleToggle(connected)}
                    onDisconnect={() => handleDelete(connected.id)}
                    onNotify={() => handleNotify(item)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Test sync — only when Foodpanda is active */}
        {integrations.some((i) => i.isActive) && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-neutral-500 mb-4">
              Testing
            </h2>
            <TestSyncCard
              integrations={integrations}
              onOrderCreated={loadIntegrations}
            />
          </div>
        )}

        {/* Developer / API section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-neutral-500 mb-4">
            Developer
          </h2>
          <div className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-gray-900 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  Build your own integration
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                  Use the EatsDesk REST API to build custom workflows, connect
                  internal tools, or automate order processing.
                </p>
                <a
                  href="#"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  View API Documentation <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-neutral-800 pt-5 space-y-5">
              {/* API Key */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    API Key
                  </label>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 tracking-wide">
                    LIVE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700">
                    <code className="flex-1 text-xs font-mono text-gray-900 dark:text-white truncate">
                      {showApiKey
                        ? "edk_live_4f9c2b8a1d3e5f7g9h0i2j4k6l8m"
                        : fakeApiKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard("edk_live_4f9c2b8a1d3e5f7g9h0i2j4k6l8m")
                      }
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast("API key regeneration coming soon.")}
                    className="inline-flex items-center gap-1.5 h-12 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-neutral-500">
                  Keep this secret. Do not expose it in client-side code.
                </p>
              </div>

              {/* Webhook URL */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Webhook URL
                </label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700">
                  <code
                    className="flex-1 text-xs font-mono text-gray-500 dark:text-neutral-400 truncate"
                    ref={apiKeyRef}
                  >
                    {webhookUrlTemplate}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(webhookUrlTemplate)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-neutral-500">
                  Replace <code>[platform]</code> and{" "}
                  <code>[restaurantId]</code> with your values.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Foodpanda connect / edit slide-over */}
      {connectOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConnectOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="ml-auto relative w-full max-w-md h-full bg-white dark:bg-neutral-950 border-l-2 border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-neutral-800">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0"
                style={{ backgroundColor: "#D70F64" }}
              >
                🐼
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {editTarget
                    ? "Edit Foodpanda Credentials"
                    : "Connect Foodpanda"}
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {editTarget
                    ? "Update your merchant API credentials"
                    : "Enter your Foodpanda merchant credentials"}
                </p>
              </div>
              <button
                onClick={() => setConnectOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleSave}
              autoComplete="off"
              className="flex-1 p-5 space-y-5"
            >
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Store ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fp_store_id"
                  autoComplete="off"
                  value={form.storeId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, storeId: e.target.value }))
                  }
                  placeholder="e.g. s8dy-fnk2"
                  className={inp}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  API Key{" "}
                  {editTarget && (
                    <span className="font-normal text-gray-400">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  name="fp_api_key"
                  autoComplete="off"
                  value={form.apiKey}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, apiKey: e.target.value }))
                  }
                  placeholder={
                    editTarget
                      ? "••••" + (editTarget.apiKey?.slice(-4) || "****")
                      : "Paste your API key"
                  }
                  className={`${inp} font-mono`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  API Secret{" "}
                  {editTarget && (
                    <span className="font-normal text-gray-400">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  name="fp_api_secret"
                  autoComplete="new-password"
                  value={form.apiSecret}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, apiSecret: e.target.value }))
                  }
                  placeholder={
                    editTarget ? "••••••••" : "Paste your API secret"
                  }
                  className={`${inp} font-mono`}
                />
              </div>

              <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <p className="font-semibold">Where do I find these?</p>
                <p>
                  Log in to your Foodpanda Vendor Portal → Settings → API
                  Access. Copy your Store ID, API Key, and API Secret.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {saving
                    ? "Saving..."
                    : editTarget
                      ? "Update credentials"
                      : "Connect Foodpanda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// ─── Integration card ─────────────────────────────────────────────────────────

function IntegrationCard({
  item,
  connected,
  isConnected,
  isConfigured,
  isNotified,
  isNotifying,
  isToggling,
  onConnect,
  onSettings,
  onToggle,
  onDisconnect,
  onNotify,
}) {
  return (
    <div
      className={`relative rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all ${
        isConnected
          ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5"
          : isConfigured
            ? "border-orange-200 dark:border-orange-500/30 bg-orange-50/30 dark:bg-orange-500/5"
            : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
      }`}
    >
      {/* Status chip (top right) */}
      <div className="absolute top-3 right-3">
        {isConnected ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Connected
          </span>
        ) : isConfigured ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 text-[10px] font-bold border border-orange-200 dark:border-orange-500/30">
            Paused
          </span>
        ) : item.status === "available" ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
            Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 text-[10px] font-semibold border border-gray-200 dark:border-neutral-700">
            Coming soon
          </span>
        )}
      </div>

      {/* Logo + name */}
      <div className="flex items-center gap-3 pr-20">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm"
          style={{
            backgroundColor: item.color + "22",
            border: `1.5px solid ${item.color}44`,
          }}
        >
          <span>{item.emoji}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
            {item.label}
          </p>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 leading-tight">
            {item.description}
          </p>
        </div>
      </div>

      {/* Connected stats */}
      {isConfigured && connected && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 px-2.5 py-1.5">
            <p className="text-gray-400 dark:text-neutral-500">Last sync</p>
            <p className="font-semibold text-gray-700 dark:text-neutral-300">
              {connected.lastSyncAt
                ? new Date(connected.lastSyncAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </p>
          </div>
          <div className="rounded-lg bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 px-2.5 py-1.5">
            <p className="text-gray-400 dark:text-neutral-500">Store ID</p>
            <p className="font-semibold font-mono text-gray-700 dark:text-neutral-300 truncate">
              {connected.storeId || "—"}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto">
        {item.key === "FOODPANDA" && !isConfigured ? (
          <p className="mb-2 text-[11px] leading-4 text-gray-500 dark:text-neutral-400">
            Full integration with order sync, menu sync, and status updates -
            coming soon.
          </p>
        ) : null}
        {isConfigured ? (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle active/pause */}
            <button
              type="button"
              onClick={onToggle}
              disabled={isToggling}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                isConnected
                  ? "border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                  : "border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              }`}
            >
              {isToggling ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isConnected ? (
                <ToggleRight className="w-3.5 h-3.5" />
              ) : (
                <ToggleLeft className="w-3.5 h-3.5" />
              )}
              {isConnected ? "Pause" : "Activate"}
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={onSettings}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>

            {/* Disconnect */}
            <button
              type="button"
              onClick={onDisconnect}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        ) : item.status === "available" ? (
          <button
            type="button"
            onClick={onConnect}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors w-full justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </button>
        ) : (
          <button
            type="button"
            onClick={isNotified ? undefined : onNotify}
            disabled={isNotifying}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-semibold border transition-colors w-full justify-center ${
              isNotified
                ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-default"
                : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 disabled:opacity-60"
            }`}
          >
            {isNotifying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isNotified ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
            {isNotified ? "Notified" : "Notify me"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Test Sync card (kept from original) ─────────────────────────────────────

function TestSyncCard({ integrations, onOrderCreated }) {
  const [testForm, setTestForm] = useState({
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    items: "Cheezy Pizza:1:1300",
    paymentMethod: "ONLINE",
    total: "",
  });
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  const foodpanda = integrations.find(
    (i) => i.platform === "FOODPANDA" && i.isActive,
  );
  if (!foodpanda) return null;

  async function handleTest(e) {
    e.preventDefault();
    setTesting(true);
    setTestError("");
    setResult(null);
    try {
      const parsedItems = testForm.items
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [name, qty, price] = s.split(":");
          return {
            name: (name || "").trim(),
            quantity: parseInt(qty) || 1,
            unitPrice: parseFloat(price) || 0,
          };
        });
      if (parsedItems.length === 0) {
        setTestError("At least one item is required (format: name:qty:price)");
        setTesting(false);
        return;
      }
      const computedTotal =
        parseFloat(testForm.total) ||
        parsedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const apiBase =
        typeof window !== "undefined"
          ? window.location.origin.replace(":3000", ":5001")
          : "";
      const auth = JSON.parse(
        typeof window !== "undefined"
          ? window.localStorage.getItem("restaurantos_auth") || "{}"
          : "{}",
      );
      const headers = { "Content-Type": "application/json" };
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
      const slugMatch = window.location.pathname.match(/^\/r\/([^/]+)\//);
      if (slugMatch) headers["x-tenant-slug"] = slugMatch[1];
      const res = await fetch(`${apiBase}/api/integrations/test-order`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          externalOrderId: `FP-TEST-${Date.now()}`,
          customerName: testForm.customerName || "Test Customer",
          customerPhone: testForm.customerPhone || "",
          deliveryAddress: testForm.deliveryAddress || "Test Address",
          items: parsedItems,
          paymentMethod: testForm.paymentMethod,
          total: computedTotal,
          subtotal: computedTotal,
          discountAmount: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) setTestError(data.message || "Test failed");
      else {
        setResult(data);
        if (onOrderCreated) onOrderCreated();
      }
    } catch (err) {
      setTestError(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const inp2 =
    "w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

  return (
    <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Test Foodpanda Sync
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            Simulate an order to verify your integration
          </p>
        </div>
      </div>
      <form onSubmit={handleTest} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
              Customer Name
            </label>
            <input
              type="text"
              value={testForm.customerName}
              onChange={(e) =>
                setTestForm((p) => ({ ...p, customerName: e.target.value }))
              }
              placeholder="Foodpanda Customer"
              className={inp2}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
              Phone
            </label>
            <input
              type="text"
              value={testForm.customerPhone}
              onChange={(e) =>
                setTestForm((p) => ({ ...p, customerPhone: e.target.value }))
              }
              placeholder="+923166222269"
              className={inp2}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
            Delivery Address
          </label>
          <input
            type="text"
            value={testForm.deliveryAddress}
            onChange={(e) =>
              setTestForm((p) => ({ ...p, deliveryAddress: e.target.value }))
            }
            placeholder="Food Street Phase 7, Bahria Town RWP"
            className={inp2}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
            Items{" "}
            <span className="font-normal text-gray-400">
              (name:qty:price, comma-separated)
            </span>
          </label>
          <input
            type="text"
            value={testForm.items}
            onChange={(e) =>
              setTestForm((p) => ({ ...p, items: e.target.value }))
            }
            placeholder="Cheezy Pizza:2:1300, Crunch Burger:1:550"
            className={`${inp2} font-mono`}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
              Payment Method
            </label>
            <select
              value={testForm.paymentMethod}
              onChange={(e) =>
                setTestForm((p) => ({ ...p, paymentMethod: e.target.value }))
              }
              className={inp2}
            >
              <option value="ONLINE">Online</option>
              <option value="CASH">Cash on Delivery</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
              Total{" "}
              <span className="font-normal text-gray-400">(auto if blank)</span>
            </label>
            <input
              type="number"
              min="0"
              value={testForm.total}
              onChange={(e) =>
                setTestForm((p) => ({ ...p, total: e.target.value }))
              }
              placeholder="Auto"
              className={inp2}
            />
          </div>
        </div>
        {testError && (
          <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {testError}
          </div>
        )}
        {result && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Order created! Order number:{" "}
            <span className="font-bold">{result.orderNumber}</span>
          </div>
        )}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={testing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {testing ? "Sending..." : "Send Test Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
