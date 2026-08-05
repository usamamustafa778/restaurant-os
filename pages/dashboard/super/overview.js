import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import {
  getLeadStatsForSuperAdmin,
  getSuperInvoices,
  getSuperRestaurantActivitySummary,
  getSuperWhatsappStats,
} from "../../../lib/apiClient";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Clock,
  CreditCard,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  RefreshCw,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

const ENGAGEMENT_COLORS = {
  active: "#10b981",
  quiet: "#f59e0b",
  new: "#0ea5e9",
  configured: "#a78bfa",
  dormant: "#9ca3af",
};

const ENGAGEMENT_STYLES = {
  active:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50",
  quiet:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/50",
  new: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700/50",
  configured:
    "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-700/50",
  dormant:
    "bg-gray-100 text-gray-600 border-gray-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-600",
};

const SUB_STATUS_COLORS = {
  ACTIVE: "#10b981",
  TRIAL: "#0ea5e9",
  PAST_DUE: "#f43f5e",
  GRACE: "#38bdf8",
  EXPIRED: "#ef4444",
  SUSPENDED: "#71717a",
};

function formatDate(iso) {
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

function formatMoney(n) {
  const v = Number(n) || 0;
  if (v >= 10000000) return `Rs ${(v / 10000000).toFixed(1)} Cr`;
  if (v >= 100000) return `Rs ${(v / 100000).toFixed(1)} Lac`;
  return `Rs ${Math.round(v).toLocaleString("en-PK")}`;
}

function formatCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function daysUntil(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

function subscriptionEnd(sub = {}) {
  return (
    sub.subscriptionEndDate ||
    sub.graceUntilDate ||
    sub.expiresAt ||
    sub.freeTrialEndDate ||
    sub.trialEndsAt ||
    null
  );
}

function DonutChart({ segments, size = 132, centerLabel, centerValue }) {
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  const r = Math.round(size * 0.36);
  const sw = Math.round(size * 0.14);
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          className="text-gray-100 dark:text-neutral-800"
        />
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          if (frac < 0.005) {
            acc += seg.value;
            return null;
          }
          const dash = frac * circ;
          const gap = circ - dash;
          const rot = (acc / total) * 360 - 90;
          acc += seg.value;
          return (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={sw}
              strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
              transform={`rotate(${rot.toFixed(2)} ${c} ${c})`}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      {(centerLabel || centerValue != null) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue != null && (
            <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-[10px] font-medium text-gray-500 dark:text-neutral-500 mt-1 uppercase tracking-wide">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, description, action, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-black/5 bg-white/90 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-neutral-950/90 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-500">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatPill({ label, value, hint, tone = "default" }) {
  const tones = {
    default: "text-gray-900 dark:text-white",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-rose-600 dark:text-rose-400",
    brand: "text-[#FF5400]",
  };
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-gray-500 dark:text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${tones[tone] || tones.default}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] leading-snug text-gray-400 dark:text-neutral-600">
          {hint}
        </p>
      )}
    </div>
  );
}

export default function SuperOverviewPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.overview.view");
  const [data, setData] = useState(null);
  const [invoiceStats, setInvoiceStats] = useState(null);
  const [leadsStats, setLeadsStats] = useState(null);
  const [waStats, setWaStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [activity, invoicesRes, leadsRes, waRes] = await Promise.all([
        getSuperRestaurantActivitySummary(),
        getSuperInvoices({ limit: 200 }).catch(() => null),
        getLeadStatsForSuperAdmin({}).catch(() => null),
        getSuperWhatsappStats().catch(() => null),
      ]);
      setData(activity);

      if (invoicesRes?.invoices) {
        const list = invoicesRes.invoices;
        const paid = list.filter((i) => i.status === "PAID");
        const overdue = list.filter((i) => i.status === "OVERDUE");
        const pending = list.filter((i) =>
          ["SENT", "DRAFT", "OVERDUE"].includes(i.status),
        );
        setInvoiceStats({
          total: invoicesRes.total ?? list.length,
          paidCount: paid.length,
          paidAmount: paid.reduce((s, i) => s + (Number(i.amount) || 0), 0),
          overdueCount: overdue.length,
          overdueAmount: overdue.reduce(
            (s, i) => s + (Number(i.amount) || 0),
            0,
          ),
          pendingCount: pending.length,
          pendingAmount: pending.reduce(
            (s, i) => s + (Number(i.amount) || 0),
            0,
          ),
        });
      } else {
        setInvoiceStats(null);
      }

      setLeadsStats(leadsRes || null);
      setWaStats(waRes || null);
    } catch (e) {
      setError(e?.message || "Failed to load platform overview");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasAccess) return;
    load();
  }, [hasAccess]);

  const restaurants = data?.restaurants || [];
  const s = data?.summary;

  const insights = useMemo(() => {
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;

    let orders7 = 0;
    let orders30 = 0;
    let ordersLife = 0;
    let revenue30 = 0;
    let websiteOrders30 = 0;
    let signed7 = 0;
    let signed30 = 0;
    let pendingApproval = 0;
    let expiringSoon = 0;
    let activeSubs = 0;
    let trialSubs = 0;
    let problemSubs = 0;

    const byEngagement = {
      active: 0,
      quiet: 0,
      new: 0,
      configured: 0,
      dormant: 0,
    };
    const byStatus = {};
    const byPlan = {};
    const attention = [];

    for (const r of restaurants) {
      const a = r.activity || {};
      const sub = r.subscription || {};
      const eg = r.engagement?.key || "dormant";
      if (byEngagement[eg] !== undefined) byEngagement[eg] += 1;

      orders7 += a.ordersLast7Days || 0;
      orders30 += a.ordersLast30Days || 0;
      ordersLife += a.ordersLifetime || 0;
      revenue30 += a.revenueLast30Days || 0;
      websiteOrders30 += a.websiteOrdersLast30Days || 0;

      const created = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      if (created >= d7) signed7 += 1;
      if (created >= d30) signed30 += 1;

      const status = String(sub.status || "UNKNOWN").toUpperCase();
      byStatus[status] = (byStatus[status] || 0) + 1;
      const plan = String(sub.plan || "ESSENTIAL").toUpperCase();
      byPlan[plan] = (byPlan[plan] || 0) + 1;

      if (status === "ACTIVE") activeSubs += 1;
      else if (status === "TRIAL") trialSubs += 1;
      else if (["PAST_DUE", "EXPIRED", "SUSPENDED", "GRACE"].includes(status)) {
        problemSubs += 1;
      }

      if (r.approvalStatus === "pending") {
        pendingApproval += 1;
        attention.push({
          id: r.id,
          severity: "critical",
          title: r.website?.name || "Untitled",
          meta: "Pending approval",
          href: `/super/restaurants/${r.id}`,
          rank: 10,
        });
      }

      const end = subscriptionEnd(sub);
      const days = daysUntil(end);
      if (
        days != null &&
        days >= 0 &&
        days <= 14 &&
        ["ACTIVE", "TRIAL", "PAST_DUE", "GRACE"].includes(status)
      ) {
        expiringSoon += 1;
        attention.push({
          id: `${r.id}-exp`,
          severity: days <= 3 ? "critical" : "warn",
          title: r.website?.name || "Untitled",
          meta: `${status} · ends in ${days}d`,
          href: `/super/restaurants/${r.id}`,
          rank: days <= 3 ? 9 : 6,
        });
      }

      if (eg === "quiet") {
        attention.push({
          id: `${r.id}-quiet`,
          severity: "warn",
          title: r.website?.name || "Untitled",
          meta: "Quiet — no orders in 30 days",
          href: `/super/restaurants/${r.id}`,
          rank: 5,
        });
      }

      if (
        (a.ordersLifetime || 0) === 0 &&
        created > 0 &&
        now - created > 14 * 24 * 60 * 60 * 1000
      ) {
        attention.push({
          id: `${r.id}-never`,
          severity: "info",
          title: r.website?.name || "Untitled",
          meta: "14+ days · still no orders",
          href: `/super/restaurants/${r.id}`,
          rank: 4,
        });
      }
    }

    attention.sort((a, b) => b.rank - a.rank);
    const seen = new Set();
    const attentionUnique = [];
    for (const item of attention) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      attentionUnique.push(item);
      if (attentionUnique.length >= 6) break;
    }

    const total = restaurants.length || 1;
    const engaged = byEngagement.active || 0;

    const topByRevenue = [...restaurants]
      .sort(
        (a, b) =>
          (b.activity?.revenueLast30Days || 0) -
          (a.activity?.revenueLast30Days || 0),
      )
      .filter((r) => (r.activity?.revenueLast30Days || 0) > 0)
      .slice(0, 8);

    const quietList = [...restaurants]
      .filter((r) => r.engagement?.key === "quiet")
      .sort(
        (a, b) =>
          (b.activity?.ordersLifetime || 0) - (a.activity?.ordersLifetime || 0),
      )
      .slice(0, 5);

    return {
      orders7,
      orders30,
      ordersLife,
      revenue30,
      websiteOrders30,
      websiteShare: pct(websiteOrders30, orders30),
      signed7,
      signed30,
      pendingApproval,
      expiringSoon,
      activeSubs,
      trialSubs,
      problemSubs,
      activeRate: pct(engaged, total),
      avgOrdersActive: engaged > 0 ? Math.round(orders30 / engaged) : 0,
      byEngagement,
      byStatus,
      byPlan,
      attention: attentionUnique,
      topByRevenue,
      quietList,
    };
  }, [restaurants]);

  const engagementSegments = useMemo(
    () =>
      ["active", "quiet", "new", "configured", "dormant"].map((key) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        value: insights.byEngagement[key] || 0,
        color: ENGAGEMENT_COLORS[key],
      })),
    [insights.byEngagement],
  );

  const statusRows = useMemo(() => {
    const order = ["ACTIVE", "TRIAL", "PAST_DUE", "GRACE", "EXPIRED", "SUSPENDED"];
    const keys = [
      ...order.filter((k) => insights.byStatus[k]),
      ...Object.keys(insights.byStatus).filter((k) => !order.includes(k)),
    ];
    const max = Math.max(...keys.map((k) => insights.byStatus[k] || 0), 1);
    return keys.map((k) => ({
      label: k.replace(/_/g, " "),
      value: insights.byStatus[k] || 0,
      color: SUB_STATUS_COLORS[k] || "#94a3b8",
      pct: pct(insights.byStatus[k] || 0, restaurants.length),
      width: Math.max(6, ((insights.byStatus[k] || 0) / max) * 100),
    }));
  }, [insights.byStatus, restaurants.length]);

  const maxTopRevenue = Math.max(
    ...insights.topByRevenue.map((r) => r.activity?.revenueLast30Days || 0),
    1,
  );

  const alertCount =
    insights.pendingApproval +
    insights.expiringSoon +
    (invoiceStats?.overdueCount || 0) +
    insights.quietList.length;

  return (
    <AdminLayout
      title="Platform Overview"
      subtitle="Your fleet pulse — volume, money, health, and risk."
    >
      <SuperPageGate permission="platform.overview.view">
        {loading && !data ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF5400]/10">
              <LayoutDashboard className="h-8 w-8 animate-pulse text-[#FF5400]" />
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF5400]" />
              <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">
                Loading platform stats…
              </p>
            </div>
          </div>
        ) : (
          <div className="relative space-y-5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-6 h-72 rounded-3xl bg-[radial-gradient(ellipse_at_top,_rgba(255,84,0,0.14),_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(255,84,0,0.18),_transparent_55%)]"
            />

            {/* Toolbar */}
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
                {data?.generatedAt && (
                  <span className="text-xs text-gray-500 dark:text-neutral-500">
                    Updated {formatDate(data.generatedAt)}
                  </span>
                )}
                {alertCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {alertCount} need attention
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => load()}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </button>
                <Link
                  href="/super/restaurants"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#FF5400] px-3.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/25 hover:brightness-105"
                >
                  Restaurants
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {error && (
              <div className="relative rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {error}
              </div>
            )}

            {/* Hero — platform volume */}
            <section className="relative overflow-hidden rounded-3xl bg-[#1a1410] text-white shadow-xl shadow-orange-900/10">
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,_rgba(255,84,0,0.45),_transparent_50%),radial-gradient(ellipse_at_90%_80%,_rgba(255,140,60,0.2),_transparent_45%)]"
              />
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.3fr_1fr] lg:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-200/80">
                    Platform GMV · 30 days
                  </p>
                  <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                    {formatMoney(insights.revenue30)}
                  </p>
                  <p className="mt-3 max-w-md text-sm text-white/65">
                    Across {s?.engagedLast30Days ?? 0} active restaurants ·{" "}
                    {insights.websiteShare}% from website orders · avg{" "}
                    {insights.avgOrdersActive} orders / active
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {[
                    {
                      label: "Orders · 30d",
                      value: formatCompact(insights.orders30),
                      hint: `${formatCompact(insights.orders7)} last 7d`,
                    },
                    {
                      label: "All-time orders",
                      value: formatCompact(insights.ordersLife),
                      hint: `${s?.totalRestaurants ?? 0} restaurants`,
                    },
                    {
                      label: "Active rate",
                      value: `${insights.activeRate}%`,
                      hint: `${s?.engagedLast30Days ?? 0} ordered in 30d`,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">
                        {m.label}
                      </p>
                      <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
                        {m.value}
                      </p>
                      <p className="mt-1 text-[10px] text-white/45">{m.hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Money + growth */}
            <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                href="/super/invoices"
                className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:border-[#FF5400]/35 dark:border-white/10 dark:bg-neutral-950/90"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <StatPill
                  label="Invoices paid"
                  value={formatMoney(invoiceStats?.paidAmount || 0)}
                  hint={`${invoiceStats?.paidCount ?? 0} paid invoices`}
                  tone="good"
                />
              </Link>
              <Link
                href="/super/invoices"
                className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:border-rose-300/50 dark:border-white/10 dark:bg-neutral-950/90"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <StatPill
                  label="Overdue billing"
                  value={formatMoney(invoiceStats?.overdueAmount || 0)}
                  hint={`${invoiceStats?.overdueCount ?? 0} overdue · ${formatMoney(invoiceStats?.pendingAmount || 0)} pending`}
                  tone={invoiceStats?.overdueCount ? "bad" : "default"}
                />
              </Link>
              <Link
                href="/super/leads"
                className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:border-sky-300/50 dark:border-white/10 dark:bg-neutral-950/90"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                    <Users className="h-4 w-4" />
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <StatPill
                  label="Open leads"
                  value={leadsStats?.openCount ?? 0}
                  hint={`${leadsStats?.overdueFollowUps ?? 0} overdue follow-ups · ${leadsStats?.winRate ?? 0}% win`}
                  tone="default"
                />
              </Link>
              <Link
                href="/super/restaurants"
                className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:border-[#FF5400]/35 dark:border-white/10 dark:bg-neutral-950/90"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF5400]/10 text-[#FF5400]">
                    <Store className="h-4 w-4" />
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <StatPill
                  label="New restaurants · 30d"
                  value={insights.signed30}
                  hint={`${insights.signed7} this week · ${insights.pendingApproval} pending approval`}
                  tone="brand"
                />
              </Link>
            </div>

            {/* Fleet snapshot */}
            <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                {
                  label: "Total restaurants",
                  value: s?.totalRestaurants ?? 0,
                  hint: "Non-deleted tenants",
                  icon: Building2,
                  href: "/super/restaurants",
                },
                {
                  label: "Active · 30d",
                  value: s?.engagedLast30Days ?? 0,
                  hint: "≥1 order in 30 days",
                  icon: Activity,
                  tone: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: "Quiet",
                  value: s?.quietHadOrdersBefore ?? 0,
                  hint: "Had orders, none in 30d",
                  icon: Clock,
                  tone: "text-amber-600 dark:text-amber-400",
                },
                {
                  label: "Never ordered",
                  value: s?.neverHadOrders ?? 0,
                  hint: "Signed up, zero orders",
                  icon: TrendingUp,
                },
                {
                  label: "Subscriptions",
                  value: insights.activeSubs,
                  hint: `${insights.trialSubs} trial · ${insights.problemSubs} at risk`,
                  icon: CreditCard,
                  tone: "text-[#FF5400]",
                  className: "col-span-2 lg:col-span-1",
                },
              ].map((item) => {
                const Icon = item.icon;
                const body = (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-[11px] font-medium text-gray-500 dark:text-neutral-500">
                        {item.label}
                      </p>
                    </div>
                    <p
                      className={`text-2xl font-bold tabular-nums tracking-tight ${item.tone || "text-gray-900 dark:text-white"}`}
                    >
                      {item.value}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400 dark:text-neutral-600">
                      {item.hint}
                    </p>
                  </>
                );
                const cls = `rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-neutral-950/90 ${item.className || ""}`;
                return item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`${cls} transition hover:border-[#FF5400]/35`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={item.label} className={cls}>
                    {body}
                  </div>
                );
              })}
            </div>

            {/* Health · Billing risk · Attention */}
            <div className="relative grid gap-4 lg:grid-cols-3">
              <SectionCard
                title="Fleet health"
                description="Engagement across every restaurant"
              >
                <div className="flex flex-wrap items-center gap-5">
                  <DonutChart
                    segments={engagementSegments}
                    centerValue={s?.totalRestaurants ?? 0}
                    centerLabel="total"
                  />
                  <div className="min-w-[140px] flex-1 space-y-2">
                    {engagementSegments.map((seg) => (
                      <div key={seg.label} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="flex-1 text-xs text-gray-600 dark:text-neutral-400">
                          {seg.label}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                          {seg.value}
                        </span>
                        <span className="w-8 text-right text-[10px] tabular-nums text-gray-400">
                          {pct(seg.value, restaurants.length)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Subscriptions"
                description="Plan status across the fleet"
              >
                {statusRows.length ? (
                  <div className="space-y-3">
                    {statusRows.map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">
                            {row.label}
                          </span>
                          <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                            {row.value}
                            <span className="ml-1 font-medium text-gray-400">
                              {row.pct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${row.width}%`,
                              backgroundColor: row.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {insights.expiringSoon > 0 && (
                      <p className="flex items-center gap-1.5 pt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {insights.expiringSoon} ending within 14 days
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No subscription data</p>
                )}
              </SectionCard>

              <SectionCard
                title="Needs attention"
                description="Approvals, churn risk, billing"
                action={
                  <Link
                    href="/super/restaurants"
                    className="text-xs font-semibold text-[#FF5400] hover:underline"
                  >
                    View all
                  </Link>
                }
              >
                {(invoiceStats?.overdueCount || 0) > 0 && (
                  <Link
                    href="/super/invoices"
                    className="mb-3 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 dark:border-rose-900/40 dark:bg-rose-950/30"
                  >
                    <CreditCard className="h-4 w-4 shrink-0 text-rose-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                        {invoiceStats.overdueCount} overdue invoice
                        {invoiceStats.overdueCount === 1 ? "" : "s"}
                      </p>
                      <p className="text-[11px] text-rose-700/80">
                        {formatMoney(invoiceStats.overdueAmount)}
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
                  </Link>
                )}
                {insights.attention.length === 0 &&
                !(invoiceStats?.overdueCount > 0) ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      All clear
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      No urgent tenant issues right now
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-neutral-900">
                    {insights.attention.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 hover:opacity-80"
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            item.severity === "critical"
                              ? "bg-rose-500"
                              : item.severity === "info"
                                ? "bg-sky-500"
                                : "bg-amber-500"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {item.title}
                          </p>
                          <p className="truncate text-[11px] text-gray-500">
                            {item.meta}
                          </p>
                        </div>
                        <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
                      </Link>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Top performers + quiet */}
            <div className="relative grid gap-4 lg:grid-cols-5">
              <SectionCard
                className="lg:col-span-3"
                title="Top restaurants · 30 days"
                description="Ranked by GMV on your platform"
                action={
                  <Link
                    href="/super/restaurants"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF5400] hover:underline"
                  >
                    Full list
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                }
              >
                {insights.topByRevenue.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">
                    No revenue in the last 30 days yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {insights.topByRevenue.map((row, idx) => {
                      const rev = row.activity?.revenueLast30Days || 0;
                      const eg = row.engagement || {};
                      return (
                        <Link
                          key={row.id}
                          href={`/super/restaurants/${row.id}`}
                          className="group block rounded-xl border border-transparent px-2 py-2 transition hover:border-black/5 hover:bg-gray-50 dark:hover:border-white/10 dark:hover:bg-neutral-900/60"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 text-center text-xs font-bold tabular-nums text-gray-400">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                  {row.website?.name || "Untitled"}
                                </p>
                                <span
                                  className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold ${ENGAGEMENT_STYLES[eg.key] || ENGAGEMENT_STYLES.dormant}`}
                                >
                                  {eg.label || "—"}
                                </span>
                              </div>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
                                <div
                                  className="h-full rounded-full bg-[#FF5400]"
                                  style={{
                                    width: `${Math.max(4, (rev / maxTopRevenue) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                {formatMoney(rev)}
                              </p>
                              <p className="text-[10px] tabular-nums text-gray-400">
                                {row.activity?.ordersLast30Days ?? 0} orders
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                className="lg:col-span-2"
                title="Going quiet"
                description="Were live — no orders in 30 days"
              >
                {insights.quietList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      No quiet restaurants
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Everyone who ordered before is still active
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {insights.quietList.map((row) => (
                      <Link
                        key={row.id}
                        href={`/super/restaurants/${row.id}`}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-amber-50/80 dark:hover:bg-amber-950/20"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {row.website?.name || "Untitled"}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {formatCompact(row.activity?.ordersLifetime || 0)}{" "}
                            all-time · last{" "}
                            {row.activity?.lastOrderAt
                              ? formatDate(row.activity.lastOrderAt)
                              : "—"}
                          </p>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      </Link>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Ops pulse */}
            <div className="relative grid gap-3 sm:grid-cols-3">
              <Link
                href="/super/whatsapp"
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:border-emerald-300/40 dark:border-white/10 dark:bg-neutral-950/90"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500">WhatsApp</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {waStats
                      ? `${waStats.totalActive ?? 0} live`
                      : "Open console"}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {waStats
                      ? `${waStats.conversationsToday ?? 0} chats today · ${waStats.totalPending ?? 0} pending`
                      : "Messaging ops"}
                  </p>
                </div>
              </Link>
              <Link
                href="/super/invoices"
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:border-[#FF5400]/35 dark:border-white/10 dark:bg-neutral-950/90"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5400]/10 text-[#FF5400]">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500">Billing</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {invoiceStats
                      ? `${invoiceStats.pendingCount} open`
                      : "Open invoices"}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {invoiceStats
                      ? `${formatMoney(invoiceStats.pendingAmount)} outstanding`
                      : "Platform invoices"}
                  </p>
                </div>
              </Link>
              <Link
                href="/super/leads"
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm transition hover:border-sky-300/40 dark:border-white/10 dark:bg-neutral-950/90"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                  <Users className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500">Pipeline</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {leadsStats
                      ? `${leadsStats.openCount ?? 0} open leads`
                      : "Open leads"}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {leadsStats
                      ? `${leadsStats.winRate ?? 0}% win rate`
                      : "Sales pipeline"}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </SuperPageGate>
    </AdminLayout>
  );
}
