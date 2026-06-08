import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  getSuperWhatsappStats,
  getSuperWhatsappRequests,
  getSuperWhatsappRestaurants,
  postSuperWhatsappActivate,
  patchSuperWhatsappPause,
  getSuperWhatsappConversations,
  getStoredAuth,
} from "../../../lib/apiClient";
import {
  Loader2,
  MessageCircle,
  Copy,
  Check,
  X,
  Pause,
  Play,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";

function langLabel(code) {
  if (code === "urdu") return "Urdu / Roman Urdu";
  if (code === "english") return "English";
  return "Both (Urdu + English)";
}

function maskForDisplay(num) {
  const d = String(num || "").replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `${d.slice(0, 4)}-xxxxxx${d.slice(-2)}`;
}

function formatShort(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const FRONTEND_WEBHOOK_FALLBACK_BASE = "https://your-backend.onrender.com";

/** Ensure Meta always gets a full HTTPS callback URL. */
function resolveAbsoluteWebhookUrl(apiWebhookUrl) {
  const raw = String(apiWebhookUrl || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : "/api/whatsapp/webhook";
  if (base) return `${base}${path}`;
  return `${FRONTEND_WEBHOOK_FALLBACK_BASE}${path}`;
}

export default function SuperWhatsappPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [restaurants, setRestaurants] = useState([]);

  const [activateRow, setActivateRow] = useState(null);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [activating, setActivating] = useState(false);
  const [postActivate, setPostActivate] = useState(null);

  const [drawerRestaurant, setDrawerRestaurant] = useState(null);
  const [drawerName, setDrawerName] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerConvs, setDrawerConvs] = useState([]);

  const [pauseBusyId, setPauseBusyId] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, reqData, restData] = await Promise.all([
        getSuperWhatsappStats(),
        getSuperWhatsappRequests({ status: "pending" }),
        getSuperWhatsappRestaurants(),
      ]);
      setStats(s);
      setPending(reqData.requests || []);
      setRestaurants(restData.restaurants || []);
    } catch (e) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.user?.role !== "super_admin") {
      if (typeof window !== "undefined") window.location.href = "/overview";
      return;
    }
    load();
  }, [load]);

  async function copyText(key, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function handleActivate(e) {
    e.preventDefault();
    if (!activateRow) return;
    setActivating(true);
    setPostActivate(null);
    try {
      const res = await postSuperWhatsappActivate(activateRow.restaurantId, {
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
      });
      const webhookUrl = resolveAbsoluteWebhookUrl(res.webhookUrl);
      setPostActivate({
        verifyToken: res.verifyToken,
        webhookUrl,
        name: activateRow.restaurantName,
      });
      toast.success(`${activateRow.restaurantName} is now live!`);
      setPhoneNumberId("");
      setAccessToken("");
      await load();
    } catch (err) {
      toast.error(err.message || "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  function closeModal() {
    setActivateRow(null);
    setPostActivate(null);
    setPhoneNumberId("");
    setAccessToken("");
  }

  async function togglePause(restaurantId) {
    setPauseBusyId(restaurantId);
    try {
      const res = await patchSuperWhatsappPause(restaurantId);
      toast.success(res.isActive ? "Resumed" : "Paused");
      await load();
    } catch (e) {
      toast.error(e.message || "Update failed");
    } finally {
      setPauseBusyId(null);
    }
  }

  async function openDrawer(r) {
    setDrawerRestaurant(r.restaurantId);
    setDrawerName(r.name);
    setDrawerLoading(true);
    setDrawerConvs([]);
    try {
      const data = await getSuperWhatsappConversations(r.restaurantId, { limit: 50, page: 1 });
      setDrawerConvs(data.conversations || []);
    } catch (e) {
      toast.error(e.message || "Failed to load conversations");
    } finally {
      setDrawerLoading(false);
    }
  }

  const activeRows = restaurants.filter((r) => r.status === "live" || r.status === "paused");

  const statCard = (label, value) => (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900 dark:text-white">{value}</p>
    </div>
  );

  return (
    <AdminLayout title="WhatsApp (Platform)">
      <div className="px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              WhatsApp management
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400">
              Onboard tenant numbers on EatsDesk&apos;s Meta app, webhook verify tokens, and pause/resume AI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </button>
        </div>

        {loading && !stats ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
              {statCard("Active", stats?.totalActive ?? 0)}
              {statCard("Pending", stats?.totalPending ?? 0)}
              {statCard("Convos today", stats?.conversationsToday ?? 0)}
              {statCard("WhatsApp orders today", stats?.whatsappOrdersToday ?? 0)}
            </div>
            <p className="-mt-6 mb-10 text-center text-xs text-gray-500 dark:text-neutral-500">
              Avg response time: {stats?.avgResponseTime ?? "coming soon"}
            </p>

            <section className="mb-12">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Setup requests</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                  {pending.length}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/80">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-neutral-800">
                  <thead className="bg-gray-50 dark:bg-neutral-950/80">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Restaurant
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Number
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Language
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Submitted
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-neutral-300">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {pending.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-neutral-500">
                          No pending requests.
                        </td>
                      </tr>
                    ) : (
                      pending.map((row) => (
                        <tr key={row._id}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {row.restaurantName}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700 dark:text-neutral-300">
                            {maskForDisplay(row.requestedNumber)}
                          </td>
                          <td className="px-4 py-3 capitalize text-gray-700 dark:text-neutral-300">
                            {row.language}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-neutral-400">
                            {formatShort(row.submittedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setActivateRow(row);
                                setPostActivate(null);
                                setPhoneNumberId("");
                                setAccessToken("");
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              Activate
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Active restaurants</h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/80">
                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-neutral-800">
                  <thead className="bg-gray-50 dark:bg-neutral-950/80">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Restaurant
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Number
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-neutral-300">
                        Convos today
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-neutral-300">
                        Orders today
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-neutral-300">
                        Since
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-neutral-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {activeRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-neutral-500">
                          No live or paused WhatsApp lines yet.
                        </td>
                      </tr>
                    ) : (
                      activeRows.map((r) => (
                        <tr key={r.restaurantId}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.name}</td>
                          <td className="px-4 py-3 font-mono text-gray-700 dark:text-neutral-300">{r.number}</td>
                          <td className="px-4 py-3">
                            {r.status === "live" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Live
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                Paused
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-800 dark:text-neutral-200">
                            {r.conversationsToday}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-800 dark:text-neutral-200">
                            {r.ordersToday}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-neutral-400">
                            {formatShort(r.activatedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openDrawer(r)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-neutral-600 dark:text-white dark:hover:bg-neutral-800"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                View convos
                              </button>
                              <button
                                type="button"
                                disabled={pauseBusyId === r.restaurantId}
                                onClick={() => togglePause(r.restaurantId)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:text-white dark:hover:bg-neutral-800"
                              >
                                {pauseBusyId === r.restaurantId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : r.status === "live" ? (
                                  <>
                                    <Pause className="h-3.5 w-3.5" />
                                    Pause
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-3.5 w-3.5" />
                                    Resume
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {activateRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Activate WhatsApp — {activateRow.restaurantName}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-neutral-950/80">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-neutral-500">Requested number</dt>
                <dd className="font-mono font-medium text-gray-900 dark:text-white">
                  {maskForDisplay(activateRow.requestedNumber)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-neutral-500">Language</dt>
                <dd className="text-gray-900 dark:text-white">{langLabel(activateRow.language)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-neutral-500">Handoff number</dt>
                <dd className="font-mono text-gray-900 dark:text-white">
                  {activateRow.handoffNumber
                    ? maskForDisplay(activateRow.handoffNumber)
                    : "—"}
                </dd>
              </div>
            </dl>

            {!postActivate ? (
              <form onSubmit={handleActivate} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Phone number ID
                  </span>
                  <input
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    placeholder="From Meta → WhatsApp → API Setup"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    Access token
                  </span>
                  <input
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    type="password"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    placeholder="Permanent or long-lived token"
                    autoComplete="off"
                  />
                </label>
                <p className="text-xs text-gray-500 dark:text-neutral-500">
                  Get these from Meta Business Suite → WhatsApp → API Setup.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold dark:border-neutral-700 dark:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={activating}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate restaurant"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Configure Meta webhook: use the verify token below when Meta asks for it, and point the
                  callback URL to the webhook URL.
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-neutral-400">
                    Webhook verify token
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 break-all rounded-lg bg-gray-100 px-3 py-2 text-xs dark:bg-neutral-950">
                      {postActivate.verifyToken}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyText("v", postActivate.verifyToken)}
                      className="flex-shrink-0 rounded-lg border border-gray-200 p-2 dark:border-neutral-700"
                    >
                      {copiedKey === "v" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-neutral-400">Webhook URL</p>
                  <div className="flex gap-2">
                    <code className="flex-1 break-all rounded-lg bg-gray-100 px-3 py-2 text-xs dark:bg-neutral-950">
                      {postActivate.webhookUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyText("w", postActivate.webhookUrl)}
                      className="flex-shrink-0 rounded-lg border border-gray-200 p-2 dark:border-neutral-700"
                    >
                      {copiedKey === "w" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/90 p-3 text-xs leading-relaxed text-gray-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                  <p className="mb-2 font-semibold text-gray-800 dark:text-neutral-200">
                    How to connect in Meta dashboard
                  </p>
                  <ol className="list-decimal space-y-1.5 pl-4">
                    <li>Go to Meta for Developers → your app → WhatsApp → Configuration</li>
                    <li>Find Webhook section → click Edit</li>
                    <li>Paste the Webhook URL above as Callback URL</li>
                    <li>Paste the Verify Token above</li>
                    <li>Click Verify and Save</li>
                    <li>Under Webhook fields → enable: messages</li>
                    <li>Done — your WhatsApp is now connected</li>
                  </ol>
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Open Meta Dashboard →
                  </a>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-gray-900"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {drawerRestaurant && (
        <div className="fixed inset-0 z-40" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close overlay"
            onClick={() => setDrawerRestaurant(null)}
          />
          <div
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
            role="dialog"
            aria-label="Conversations"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                    Conversations
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">{drawerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerRestaurant(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                aria-label="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-56px)] overflow-y-auto p-4">
              {drawerLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : drawerConvs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-neutral-500">No conversations yet.</p>
              ) : (
                <ul className="space-y-3">
                  {drawerConvs.map((c) => (
                    <li
                      key={c._id}
                      className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/80"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {c.customerName || c.customerPhone}
                        </span>
                        <span className="text-xs text-gray-400">{formatShort(c.lastMessageAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs text-gray-600 dark:text-neutral-400">
                        {c.lastMessagePreview || "—"}
                      </p>
                      <p className="mt-1 text-[10px] font-medium uppercase text-gray-400">
                        {c.status} · {c.messageCount} msgs
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
