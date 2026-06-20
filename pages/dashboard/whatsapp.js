import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getWhatsAppDashboardState,
  postWhatsAppSetupRequest,
  patchWhatsAppSettings,
  getWhatsAppConversations,
  getStoredAuth,
} from "../../lib/apiClient";
import {
  Loader2,
  MessageCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Phone,
  ShoppingBag,
  Zap,
  CheckCircle2,
  Sparkles,
  X,
  User,
  ArrowRight,
  PauseCircle,
  Mail,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

function formatSubmitted(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatRelativeTime(d) {
  if (!d) return "";
  try {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Answer customers",
    desc: "Menu, hours, location — instantly in Urdu or English.",
  },
  {
    icon: ShoppingBag,
    title: "Take orders",
    desc: "Customers order on WhatsApp. Orders go straight to your kitchen.",
  },
  {
    icon: Phone,
    title: "Hand off to staff",
    desc: "AI transfers to your manager when a human is needed.",
  },
];

const SETUP_STEPS = [
  { label: "Request submitted", done: true },
  { label: "EatsDesk connects your number", done: false },
  { label: "AI goes live", done: false },
];

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-600";

const DEFAULT_SETTINGS = {
  greetingMessage: "",
  aiLanguagePreference: "auto",
  responseStyle: "friendly",
  defaultOrderType: "ask",
  deliveryTimeMin: 30,
  deliveryTimeMax: 45,
  takeawayTimeMin: 15,
  takeawayTimeMax: 20,
  customInstructions: "",
  humanHandoffNumber: "",
  aiHoursMode: "always",
  aiCustomHoursText: "",
};

function normalizeSettings(raw) {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const lang = raw.aiLanguagePreference === "both" ? "auto" : raw.aiLanguagePreference || "auto";
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    aiLanguagePreference: lang,
  };
}

const settingsFieldClass =
  "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30";

const settingsToggleClass = (active) =>
  active
    ? "bg-orange-500 text-white border-orange-500"
    : "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400";

export default function WhatsAppDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState("not_connected");
  const [pendingRequest, setPendingRequest] = useState(null);
  const [live, setLive] = useState(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [reqNumber, setReqNumber] = useState("");
  const [reqLang, setReqLang] = useState("both");
  const [reqHandoff, setReqHandoff] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  const [convOpen, setConvOpen] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [conversations, setConversations] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWhatsAppDashboardState();
      setState(data.state || "not_connected");
      setPendingRequest(data.pendingRequest || null);
      setLive(data.live || null);
    } catch (e) {
      const msg = String(e?.message || "");
      const isUnavailable =
        msg.includes("Not Found") ||
        msg.includes("404") ||
        msg.includes("/api/whatsapp/dashboard-state");
      if (!isUnavailable) {
        toast.error(msg || "Failed to load WhatsApp status");
      }
      setState("not_connected");
      setPendingRequest(null);
      setLive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.user?.role === "order_taker" && typeof window !== "undefined") {
      window.location.href = "/order-taker";
      return;
    }
    load();
  }, [load]);

  useEffect(() => {
    if (live?.settings) {
      setSettings(normalizeSettings(live.settings));
    }
  }, [live]);

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await patchWhatsAppSettings(settings);
      toast.success("Settings saved");
      await load();
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSetupSubmit(e) {
    e.preventDefault();
    if (!reqNumber.trim()) {
      toast.error("Please enter your business WhatsApp number");
      return;
    }
    setSubmitting(true);
    try {
      await postWhatsAppSetupRequest({
        requestedNumber: reqNumber.trim(),
        language: reqLang,
        handoffNumber: reqHandoff.trim(),
      });
      toast.success("Request submitted. We will contact you within 24–48 hours.");
      setRequestOpen(false);
      setReqNumber("");
      setReqHandoff("");
      setReqLang("both");
      await load();
    } catch (err) {
      toast.error(err.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleConversations() {
    if (convOpen) {
      setConvOpen(false);
      return;
    }
    setConvOpen(true);
    setConvLoading(true);
    try {
      const data = await getWhatsAppConversations({ limit: 30, page: 1 });
      setConversations(data.conversations || []);
    } catch (e) {
      toast.error(e.message || "Failed to load conversations");
    } finally {
      setConvLoading(false);
    }
  }

  const statusConfig = {
    not_connected: {
      label: "Not connected",
      dot: "bg-gray-400",
      badge: "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400",
    },
    pending: {
      label: "Setup in progress",
      dot: "bg-amber-500 animate-pulse",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    },
    live: {
      label: "Live",
      dot: "bg-emerald-500",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    },
    live_paused: {
      label: "Paused",
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200",
    },
  };

  const isLive = state === "live" || state === "live_paused";
  const isPaused = state === "live_paused" || (live && live.isActive === false);
  const status = isLive ? (isPaused ? "live_paused" : "live") : state;
  const sc = statusConfig[status] || statusConfig.not_connected;
  const restaurantName =
    getStoredAuth()?.restaurant?.website?.name ||
    getStoredAuth()?.restaurant?.name ||
    "your restaurant";

  return (
    <AdminLayout title="WhatsApp AI">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        {/* Hero */}
        <div
          className={`relative mb-8 overflow-hidden rounded-2xl border p-6 md:p-8 ${
            isPaused
              ? "border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-500/25 dark:from-amber-950/40 dark:via-neutral-950 dark:to-orange-950/20"
              : "border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:border-emerald-500/20 dark:from-emerald-950/30 dark:via-neutral-950 dark:to-teal-950/20"
          }`}
        >
          <div
            className={`pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl ${
              isPaused ? "bg-amber-400/10" : "bg-emerald-400/10"
            }`}
          />
          <div
            className={`pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full blur-2xl ${
              isPaused ? "bg-orange-400/10" : "bg-teal-400/10"
            }`}
          />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                  isPaused
                    ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25"
                    : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25"
                }`}
              >
                {isPaused ? (
                  <PauseCircle className="h-7 w-7" strokeWidth={1.75} />
                ) : (
                  <MessageCircle className="h-7 w-7" strokeWidth={1.75} />
                )}
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white md:text-2xl">
                    WhatsApp AI Receptionist
                  </h1>
                  {!loading && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sc.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  )}
                </div>
                <p className="max-w-md text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
                  {isPaused
                    ? "Your WhatsApp line is connected but the AI is turned off. Customers won't get automated replies until service is resumed."
                    : "Your AI answers WhatsApp, takes orders, and books tables — 24/7. We host everything on EatsDesk."}
                </p>
              </div>
            </div>

            {status === "not_connected" && !loading && (
              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                Get started
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-20 dark:border-neutral-800 dark:bg-neutral-950">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm text-gray-500 dark:text-neutral-500">Loading status…</p>
          </div>
        ) : state === "not_connected" ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mb-1 text-sm font-bold text-gray-900 dark:text-white">{title}</p>
                  <p className="text-xs leading-relaxed text-gray-500 dark:text-neutral-500">{desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Ready to connect?</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-neutral-500">
                    Rs 4,500/month add-on · Setup in 24–48 hours · No Meta account needed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
                >
                  Request setup
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : state === "pending" ? (
          <div className="rounded-2xl border border-amber-200/60 bg-white p-6 dark:border-amber-500/20 dark:bg-neutral-950">
            <p className="mb-1 text-lg font-bold text-gray-900 dark:text-white">We&apos;re connecting your WhatsApp</p>
            <p className="mb-6 text-sm text-gray-500 dark:text-neutral-500">
              Our team usually completes this within 24–48 hours. This page will show &quot;Live&quot; when ready.
            </p>

            <div className="mb-6 space-y-0">
              {SETUP_STEPS.map((step, i) => (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-emerald-600 text-white"
                          : "border-2 border-gray-200 bg-white text-gray-400 dark:border-neutral-700 dark:bg-neutral-900"
                      }`}
                    >
                      {i === 0 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    {i < SETUP_STEPS.length - 1 && (
                      <div className={`my-1 h-8 w-0.5 ${i === 0 ? "bg-emerald-300 dark:bg-emerald-700" : "bg-gray-200 dark:bg-neutral-700"}`} />
                    )}
                  </div>
                  <div className={`pb-5 ${i === SETUP_STEPS.length - 1 ? "pb-0" : ""}`}>
                    <p className={`text-sm font-semibold ${i === 0 ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-neutral-600"}`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {pendingRequest && (
              <dl className="grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3 dark:bg-neutral-900">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Submitted</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                    {formatSubmitted(pendingRequest.submittedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Number</dt>
                  <dd className="mt-0.5 font-mono text-sm font-medium text-gray-900 dark:text-white">
                    {pendingRequest.maskedNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">Language</dt>
                  <dd className="mt-0.5 capitalize text-sm font-medium text-gray-900 dark:text-white">
                    {pendingRequest.language}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {isPaused && (
              <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-950/30">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-amber-950 dark:text-amber-100">
                      Service paused — AI is not responding
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                      Incoming WhatsApp messages on{" "}
                      <span className="font-mono font-semibold">{live?.maskedNumber}</span> will not be
                      answered by your AI receptionist. New orders and bookings are not being taken until
                      EatsDesk reactivates your line.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm text-amber-900/70 dark:text-amber-200/70">
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        Your number stays connected — only the AI auto-replies are off
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        Past conversations and settings are saved and will apply when resumed
                      </li>
                    </ul>
                    <a
                      href="mailto:support@eatsdesk.com?subject=Resume%20WhatsApp%20AI"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98] dark:bg-amber-600 dark:hover:bg-amber-500"
                    >
                      <Mail className="h-4 w-4" />
                      Contact support to resume
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Live / paused stats */}
            <div
              className={`rounded-2xl border bg-white p-5 dark:bg-neutral-950 ${
                isPaused
                  ? "border-amber-200/60 dark:border-amber-500/20"
                  : "border-gray-200 dark:border-neutral-800"
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-500 dark:text-neutral-500">
                  Connected line{" "}
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">{live?.maskedNumber}</span>
                </p>
                {isPaused && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <PauseCircle className="h-3 w-3" />
                    Not accepting messages
                  </span>
                )}
              </div>

              <div className={`grid grid-cols-3 gap-3 ${isPaused ? "opacity-60" : ""}`}>
                {[
                  { icon: MessageCircle, value: live?.stats?.conversationsToday ?? 0, label: "Chats today" },
                  { icon: ShoppingBag, value: live?.stats?.ordersToday ?? 0, label: "Orders placed" },
                  {
                    icon: Zap,
                    value: isPaused ? "—" : live?.stats?.avgResponseSec != null ? `${live.stats.avgResponseSec}s` : "—",
                    label: "Avg response",
                  },
                ].map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className={`rounded-xl border px-3 py-4 text-center ${
                      isPaused
                        ? "border-amber-100/80 bg-amber-50/50 dark:border-amber-500/10 dark:bg-amber-950/20"
                        : "border-gray-100 bg-gray-50/80 dark:border-neutral-800 dark:bg-neutral-900/80"
                    }`}
                  >
                    <Icon
                      className={`mx-auto mb-2 h-4 w-4 ${
                        isPaused ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    />
                    <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{value}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-neutral-500">{label}</p>
                  </div>
                ))}
              </div>
              {isPaused && (
                <p className="mt-3 text-center text-xs text-amber-800/70 dark:text-amber-300/60">
                  Stats shown are from today — no new AI activity while paused
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={toggleConversations}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                    convOpen
                      ? isPaused
                        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversations
                  {convOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen((s) => !s)}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                    settingsOpen
                      ? isPaused
                        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                  {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {convOpen && (
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                <div className="border-b border-gray-100 px-5 py-3.5 dark:border-neutral-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent conversations</h3>
                </div>
                {convLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="mb-2 h-8 w-8 text-gray-300 dark:text-neutral-700" />
                    <p className="text-sm text-gray-500 dark:text-neutral-500">No conversations yet</p>
                  </div>
                ) : (
                  <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto dark:divide-neutral-800">
                    {conversations.map((c) => (
                      <li key={c._id} className="flex gap-3 px-5 py-3.5 transition hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {c.customerName || c.customerPhone}
                            </span>
                            <span className="shrink-0 text-[11px] text-gray-400 dark:text-neutral-500">
                              {formatRelativeTime(c.lastMessageAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-neutral-500">
                            {c.lastMessagePreview || "No preview"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {settingsOpen && (
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                {isPaused && (
                  <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/80 px-3.5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Settings can be updated now but won&apos;t take effect until your WhatsApp AI is resumed.
                  </div>
                )}

                <div className="mt-4 space-y-5 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50 mx-1 mb-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white -mt-1">AI settings</h3>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                      Greeting Message
                    </label>
                    <textarea
                      value={settings.greetingMessage}
                      onChange={(e) => updateSetting("greetingMessage", e.target.value)}
                      rows={2}
                      placeholder={`Assalam o Alaikum! Welcome to ${restaurantName} 🍗`}
                      className={`${settingsFieldClass} resize-none`}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Sent when customer first messages. Leave blank for default.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                      Language
                    </label>
                    <div className="flex gap-2">
                      {[
                        { val: "auto", label: "🌐 Auto-detect" },
                        { val: "english", label: "🇬🇧 English" },
                        { val: "urdu", label: "🇵🇰 Roman Urdu" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => updateSetting("aiLanguagePreference", opt.val)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${settingsToggleClass(
                            settings.aiLanguagePreference === opt.val
                          )}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                      Response Style
                    </label>
                    <div className="flex gap-2">
                      {[
                        { val: "formal", label: "👔 Formal" },
                        { val: "friendly", label: "😊 Friendly" },
                        { val: "casual", label: "😎 Casual" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => updateSetting("responseStyle", opt.val)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${settingsToggleClass(
                            settings.responseStyle === opt.val
                          )}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                      Default Order Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { val: "ask", label: "❓ Always ask customer" },
                        { val: "delivery", label: "🛵 Assume delivery" },
                        { val: "takeaway", label: "🥡 Assume takeaway" },
                        { val: "dine_in", label: "🍽 Assume dine-in" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => updateSetting("defaultOrderType", opt.val)}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors ${settingsToggleClass(
                            settings.defaultOrderType === opt.val
                          )}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                      Estimated Times
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                        <p className="text-xs text-gray-500 mb-2">🛵 Delivery</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={settings.deliveryTimeMin}
                            onChange={(e) => updateSetting("deliveryTimeMin", Number(e.target.value))}
                            className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                          />
                          <span className="text-xs text-gray-400">to</span>
                          <input
                            type="number"
                            min={0}
                            value={settings.deliveryTimeMax}
                            onChange={(e) => updateSetting("deliveryTimeMax", Number(e.target.value))}
                            className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                          />
                          <span className="text-xs text-gray-400">min</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                        <p className="text-xs text-gray-500 mb-2">🥡 Takeaway</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={settings.takeawayTimeMin}
                            onChange={(e) => updateSetting("takeawayTimeMin", Number(e.target.value))}
                            className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                          />
                          <span className="text-xs text-gray-400">to</span>
                          <input
                            type="number"
                            min={0}
                            value={settings.takeawayTimeMax}
                            onChange={(e) => updateSetting("takeawayTimeMax", Number(e.target.value))}
                            className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                          />
                          <span className="text-xs text-gray-400">min</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                      Custom Instructions
                    </label>
                    <textarea
                      value={settings.customInstructions}
                      onChange={(e) => updateSetting("customInstructions", e.target.value)}
                      rows={4}
                      placeholder={
                        "Examples:\n- We are 100% halal certified\n- Free delivery above Rs 500\n- No MSG used in our food\n- Student discount 10% with ID card"
                      }
                      className={`${settingsFieldClass} resize-none`}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Tell the AI anything specific about your restaurant. This is injected directly into AI instructions.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                      Human Handoff Number
                    </label>
                    <input
                      type="tel"
                      value={settings.humanHandoffNumber}
                      onChange={(e) => updateSetting("humanHandoffNumber", e.target.value)}
                      placeholder="03001234567"
                      className={settingsFieldClass}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      If AI can&apos;t handle a request, it gives customers this number.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={savingSettings}
                    className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Setup modal */}
        {requestOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-setup-title"
          >
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-neutral-950">
              <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="whatsapp-setup-title" className="text-base font-bold text-gray-900 dark:text-white">
                      Request WhatsApp setup
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-neutral-500">We&apos;ll connect your business number</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSetupSubmit} className="space-y-4 p-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Business WhatsApp number
                  </span>
                  <input
                    required
                    value={reqNumber}
                    onChange={(e) => setReqNumber(e.target.value)}
                    className={inputClass}
                    placeholder="+923001234567 or 03001234567"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Preferred language
                  </span>
                  <select value={reqLang} onChange={(e) => setReqLang(e.target.value)} className={inputClass}>
                    <option value="urdu">Urdu / Roman Urdu</option>
                    <option value="english">English</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Manager handoff number <span className="font-normal text-gray-400">(optional)</span>
                  </span>
                  <input
                    value={reqHandoff}
                    onChange={(e) => setReqHandoff(e.target.value)}
                    className={inputClass}
                    placeholder="Phone for when AI needs a human"
                  />
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestOpen(false)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Submit request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
