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
  Bot,
  Loader2,
  MessageCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  List,
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
  const [greeting, setGreeting] = useState("");
  const [handoff, setHandoff] = useState("");
  const [setLang, setSetLang] = useState("both");
  const [hoursMode, setHoursMode] = useState("always");
  const [customHours, setCustomHours] = useState("");
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
      if (data.live?.settings) {
        setGreeting(data.live.settings.greetingMessage || "");
        setHandoff(data.live.settings.humanHandoffNumber || "");
        setSetLang(data.live.settings.aiLanguagePreference || "both");
        setHoursMode(data.live.settings.aiHoursMode || "always");
        setCustomHours(data.live.settings.aiCustomHoursText || "");
      }
    } catch (e) {
      toast.error(e.message || "Failed to load WhatsApp status");
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

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await patchWhatsAppSettings({
        greetingMessage: greeting,
        humanHandoffNumber: handoff,
        aiLanguagePreference: setLang,
        aiHoursMode: hoursMode,
        aiCustomHoursText: customHours,
      });
      toast.success("Settings saved");
      await load();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingSettings(false);
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

  const cardClass =
    "rounded-2xl border border-gray-200/90 bg-white/95 p-6 shadow-lg shadow-primary/5 dark:border-neutral-800 dark:bg-neutral-900/95";

  return (
    <AdminLayout title="WhatsApp AI">
      <div className="mx-auto max-w-lg px-4 py-8 md:py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <Bot className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-2xl">
              WhatsApp AI Receptionist
            </h1>
            <p className="text-sm text-gray-600 dark:text-neutral-400">
              EatsDesk connects your line — no Meta account required on your side.
            </p>
          </div>
        </div>

        {loading ? (
          <div className={`flex flex-col items-center justify-center gap-3 py-16 ${cardClass}`}>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-gray-600 dark:text-neutral-400">Loading…</p>
          </div>
        ) : state === "not_connected" ? (
          <div className={cardClass}>
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                Not connected
              </span>
            </div>
            <p className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
              Let AI handle your WhatsApp
            </p>
            <p className="mb-6 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
              Answer questions, take orders, and book tables 24/7. We host everything on EatsDesk&apos;s
              WhatsApp Business platform — you keep using your business number.
            </p>
            <p className="mb-4 text-sm font-semibold text-gray-800 dark:text-neutral-200">
              Rs 2,000/month add-on
            </p>
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 active:scale-[0.99]"
            >
              Request WhatsApp Setup
            </button>
          </div>
        ) : state === "pending" ? (
          <div className={cardClass}>
            <div className="mb-2 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
              <span className="text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Setup in progress
              </span>
            </div>
            <p className="mb-2 text-lg font-bold text-gray-900 dark:text-white">We&apos;re connecting your WhatsApp</p>
            <p className="mb-6 text-sm text-gray-600 dark:text-neutral-400">
              Our team usually completes this within 24–48 hours. You&apos;ll see &quot;Live&quot; here when it&apos;s ready.
            </p>
            {pendingRequest && (
              <dl className="space-y-2 border-t border-gray-100 pt-4 text-sm dark:border-neutral-800">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-neutral-500">Submitted</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {formatSubmitted(pendingRequest.submittedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-neutral-500">Number</dt>
                  <dd className="font-mono font-medium text-gray-900 dark:text-white">
                    {pendingRequest.maskedNumber}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-neutral-500">Language</dt>
                  <dd className="capitalize text-gray-900 dark:text-white">{pendingRequest.language}</dd>
                </div>
              </dl>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cardClass}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-gray-900 dark:text-white">WhatsApp AI Receptionist</span>
                </div>
                {live?.isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    ON
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                    Paused
                  </span>
                )}
              </div>
              <p className="mb-4 text-sm text-gray-600 dark:text-neutral-400">
                Connected:{" "}
                <span className="font-mono font-semibold text-gray-900 dark:text-white">{live?.maskedNumber}</span>
              </p>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-neutral-800/80">
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    {live?.stats?.conversationsToday ?? 0}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-neutral-500">Conversations today</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-neutral-800/80">
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    {live?.stats?.ordersToday ?? 0}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-neutral-500">Orders placed</p>
                </div>
                <div className="col-span-2 rounded-xl bg-gray-50 px-3 py-3 sm:col-span-1 dark:bg-neutral-800/80">
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    {live?.stats?.avgResponseSec != null ? `${live.stats.avgResponseSec}s` : "—"}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-neutral-500">Avg response</p>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={toggleConversations}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 transition hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  <List className="h-4 w-4" />
                  View conversations
                  {convOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen((s) => !s)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 transition hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                  {settingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {convOpen && (
              <div className={`${cardClass} !py-4`}>
                <h3 className="mb-3 px-1 text-sm font-bold text-gray-900 dark:text-white">Recent conversations</h3>
                {convLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="px-1 text-sm text-gray-500 dark:text-neutral-500">No conversations yet.</p>
                ) : (
                  <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto dark:divide-neutral-800">
                    {conversations.map((c) => (
                      <li key={c._id} className="px-1 py-2.5 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {c.customerName || c.customerPhone}
                          </span>
                          <span className="text-xs text-gray-400">
                            {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : ""}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-neutral-400">
                          {c.lastMessagePreview || "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {settingsOpen && (
              <form onSubmit={handleSaveSettings} className={cardClass}>
                <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">AI settings</h3>
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">
                    Greeting message
                  </span>
                  <textarea
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  />
                </label>
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">
                    Human handoff number
                  </span>
                  <input
                    value={handoff}
                    onChange={(e) => setHandoff(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    placeholder="+92..."
                  />
                </label>
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">
                    Language preference
                  </span>
                  <select
                    value={setLang}
                    onChange={(e) => setSetLang(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    <option value="urdu">Urdu / Roman Urdu</option>
                    <option value="english">English</option>
                    <option value="both">Both (auto-detect)</option>
                  </select>
                </label>
                <label className="mb-3 block">
                  <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">
                    Auto-reply hours
                  </span>
                  <select
                    value={hoursMode}
                    onChange={(e) => setHoursMode(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    <option value="always">Always on</option>
                    <option value="custom">Custom (describe below)</option>
                  </select>
                </label>
                {hoursMode === "custom" && (
                  <label className="mb-4 block">
                    <span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-neutral-400">
                      When should the AI tell customers it&apos;s available?
                    </span>
                    <textarea
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      rows={2}
                      placeholder="e.g. 11am–11pm daily"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </label>
                )}
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save settings
                </button>
              </form>
            )}
          </div>
        )}

        {requestOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-setup-title"
          >
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
              <h2 id="whatsapp-setup-title" className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                Request WhatsApp setup
              </h2>
              <p className="mb-4 text-sm text-gray-600 dark:text-neutral-400">
                We&apos;ll link your business number to EatsDesk&apos;s WhatsApp Business account.
              </p>
              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Business WhatsApp number
                  </span>
                  <input
                    required
                    value={reqNumber}
                    onChange={(e) => setReqNumber(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    placeholder="+923001234567 or 03001234567"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Preferred language
                  </span>
                  <select
                    value={reqLang}
                    onChange={(e) => setReqLang(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    <option value="urdu">Urdu / Roman Urdu</option>
                    <option value="english">English</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Human handoff number
                  </span>
                  <input
                    value={reqHandoff}
                    onChange={(e) => setReqHandoff(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    placeholder="Manager or owner phone if AI needs help"
                  />
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestOpen(false)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-800 dark:border-neutral-700 dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-60"
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
