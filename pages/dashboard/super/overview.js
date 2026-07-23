import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import DataTable from "../../../components/ui/DataTable";
import {
  getLeadStatsForSuperAdmin,
  getSuperInvoices,
  getSuperRestaurantActivitySummary,
  getSuperWhatsappStats,
} from "../../../lib/apiClient";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Clock,
  CreditCard,
  FileText,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  RefreshCw,
  Store,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

const ENGAGEMENT_COLORS = {
  active: "#10b981",
  quiet: "#f59e0b",
  new: "#0ea5e9",
  configured: "#8b5cf6",
  dormant: "#71717a",
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

const PLAN_COLORS = {
  ENTERPRISE: "#FF5400",
  PROFESSIONAL: "#0ea5e9",
  ESSENTIAL: "#64748b",
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

function formatShortDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
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

function DonutChart({ segments, size = 148, centerLabel, centerValue }) {
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  const r = Math.round(size * 0.36);
  const sw = Math.round(size * 0.16);
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
          stroke="#e5e7eb"
          strokeWidth={sw}
          className="dark:stroke-neutral-800"
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
            <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-none">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-[10px] font-medium text-gray-500 dark:text-neutral-500 mt-1">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function HBar({ items, maxValue }) {
  const max = maxValue || Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-gray-600 dark:text-neutral-400 truncate">
              {item.label}
            </span>
            <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white shrink-0">
              {item.value}
              {item.suffix ? (
                <span className="font-medium text-gray-400 dark:text-neutral-500 ml-1">
                  {item.suffix}
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                backgroundColor: item.color || "#FF5400",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, description, action, children, className = "" }) {
  return (
    <section
      className={`bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-neutral-900">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
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

function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  href,
}) {
  const tones = {
    neutral: {
      icon: "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300",
      value: "text-gray-900 dark:text-white",
    },
    primary: {
      icon: "bg-primary/10 text-primary",
      value: "text-primary",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
      value: "text-emerald-700 dark:text-emerald-400",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-400",
    },
    rose: {
      icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
      value: "text-rose-700 dark:text-rose-400",
    },
    sky: {
      icon: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
      value: "text-sky-700 dark:text-sky-400",
    },
  };
  const t = tones[tone] || tones.neutral;
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.icon}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        {href && <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" />}
      </div>
      <p className="text-[11px] font-medium text-gray-500 dark:text-neutral-500 mb-0.5">
        {label}
      </p>
      <p className={`text-xl font-bold leading-tight tabular-nums ${t.value}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-1 leading-snug">
          {sub}
        </p>
      )}
    </>
  );
  const cls =
    "bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 h-full";
  if (href) {
    return (
      <Link href={href} className={`${cls} hover:border-primary/40 transition-colors`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function AttentionRow({ title, meta, href, severity = "warn" }) {
  const dot =
    severity === "critical"
      ? "bg-rose-500"
      : severity === "info"
        ? "bg-sky-500"
        : "bg-amber-500";
  return (
    <Link
      href={href}
      className="flex items-start gap-3 py-2.5 border-b border-gray-100 dark:border-neutral-900 last:border-0 hover:bg-gray-50/80 dark:hover:bg-neutral-900/40 -mx-1 px-1 rounded-lg transition-colors"
    >
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {title}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-neutral-500 truncate">
          {meta}
        </p>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1" />
    </Link>
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
  const [sortKey, setSortKey] = useState("ordersLast30Days");
  const [sortDir, setSortDir] = useState("desc");

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

  const insights = useMemo(() => {
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;

    let orders7 = 0;
    let orders30 = 0;
    let ordersLife = 0;
    let revenue30 = 0;
    let websiteOrders30 = 0;
    let branches = 0;
    let menuItems = 0;
    let team = 0;
    let signed7 = 0;
    let signed30 = 0;
    let pendingApproval = 0;
    let expiringSoon = 0;

    const byEngagement = {
      active: 0,
      quiet: 0,
      new: 0,
      configured: 0,
      dormant: 0,
    };
    const byStatus = {};
    const byPlan = {};
    const bySource = {};

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
      branches += a.branchesCount || 0;
      menuItems += a.menuItemsCount || 0;
      team += a.teamMembersCount || 0;

      const created = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      if (created >= d7) signed7 += 1;
      if (created >= d30) signed30 += 1;

      const status = String(sub.status || "UNKNOWN").toUpperCase();
      byStatus[status] = (byStatus[status] || 0) + 1;
      const plan = String(sub.plan || "ESSENTIAL").toUpperCase();
      byPlan[plan] = (byPlan[plan] || 0) + 1;

      const source = r.createdSource || "unknown";
      bySource[source] = (bySource[source] || 0) + 1;

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
          meta: "Quiet — had orders, none in 30 days",
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
          meta: "Signed up 14+ days ago · no orders yet",
          href: `/super/restaurants/${r.id}`,
          rank: 4,
        });
      }
    }

    attention.sort((a, b) => b.rank - a.rank);
    const seen = new Set();
    const attentionUnique = [];
    for (const item of attention) {
      const key = item.href;
      if (seen.has(key)) continue;
      seen.add(key);
      attentionUnique.push(item);
      if (attentionUnique.length >= 8) break;
    }

    const total = restaurants.length || 1;
    const engaged = byEngagement.active || 0;

    return {
      orders7,
      orders30,
      ordersLife,
      revenue30,
      websiteOrders30,
      websiteShare: pct(websiteOrders30, orders30),
      branches,
      menuItems,
      team,
      signed7,
      signed30,
      pendingApproval,
      expiringSoon,
      activeRate: pct(engaged, total),
      avgOrdersActive:
        engaged > 0 ? Math.round(orders30 / engaged) : 0,
      byEngagement,
      byStatus,
      byPlan,
      bySource,
      attention: attentionUnique,
    };
  }, [restaurants]);

  const sortedRows = useMemo(() => {
    const rows = [...restaurants];
    const mult = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let va;
      let vb;
      switch (sortKey) {
        case "name":
          va = (a.website?.name || "").toLowerCase();
          vb = (b.website?.name || "").toLowerCase();
          return va < vb ? -mult : va > vb ? mult : 0;
        case "createdAt":
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            mult
          );
        case "ordersLast7Days":
          return (
            ((a.activity?.ordersLast7Days ?? 0) -
              (b.activity?.ordersLast7Days ?? 0)) *
            mult
          );
        case "ordersLast30Days":
          return (
            ((a.activity?.ordersLast30Days ?? 0) -
              (b.activity?.ordersLast30Days ?? 0)) *
            mult
          );
        case "revenueLast30Days":
          return (
            ((a.activity?.revenueLast30Days ?? 0) -
              (b.activity?.revenueLast30Days ?? 0)) *
            mult
          );
        case "ordersLifetime":
          return (
            ((a.activity?.ordersLifetime ?? 0) -
              (b.activity?.ordersLifetime ?? 0)) *
            mult
          );
        case "lastOrderAt": {
          const ta = a.activity?.lastOrderAt
            ? new Date(a.activity.lastOrderAt).getTime()
            : 0;
          const tb = b.activity?.lastOrderAt
            ? new Date(b.activity.lastOrderAt).getTime()
            : 0;
          return (ta - tb) * mult;
        }
        case "engagement": {
          const order = {
            active: 5,
            quiet: 4,
            new: 3,
            configured: 2,
            dormant: 1,
          };
          return (
            ((order[a.engagement?.key] ?? 0) - (order[b.engagement?.key] ?? 0)) *
            mult
          );
        }
        default:
          return 0;
      }
    });
    return rows;
  }, [restaurants, sortKey, sortDir]);

  const engagementSegments = useMemo(
    () =>
      ["active", "quiet", "new", "configured", "dormant"].map((key) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        value: insights.byEngagement[key] || 0,
        color: ENGAGEMENT_COLORS[key],
      })),
    [insights.byEngagement],
  );

  const statusBars = useMemo(() => {
    const order = ["ACTIVE", "TRIAL", "PAST_DUE", "GRACE", "EXPIRED", "SUSPENDED"];
    const keys = [
      ...order.filter((k) => insights.byStatus[k]),
      ...Object.keys(insights.byStatus).filter((k) => !order.includes(k)),
    ];
    return keys.map((k) => ({
      label: k.replace(/_/g, " "),
      value: insights.byStatus[k] || 0,
      color: SUB_STATUS_COLORS[k] || "#94a3b8",
      suffix: `${pct(insights.byStatus[k] || 0, restaurants.length)}%`,
    }));
  }, [insights.byStatus, restaurants.length]);

  const planBars = useMemo(
    () =>
      ["ENTERPRISE", "PROFESSIONAL", "ESSENTIAL"]
        .filter((k) => insights.byPlan[k])
        .map((k) => ({
          label: k.charAt(0) + k.slice(1).toLowerCase(),
          value: insights.byPlan[k] || 0,
          color: PLAN_COLORS[k],
          suffix: `${pct(insights.byPlan[k] || 0, restaurants.length)}%`,
        })),
    [insights.byPlan, restaurants.length],
  );

  const sourceBars = useMemo(() => {
    const labels = {
      self_signup: "Self signup",
      super_admin: "Created by admin",
      lead_convert: "Lead convert",
      unknown: "Unknown",
    };
    return Object.entries(insights.bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({
        label: labels[k] || k,
        value: v,
        color: "#FF5400",
        suffix: `${pct(v, restaurants.length)}%`,
      }));
  }, [insights.bySource, restaurants.length]);

  const s = data?.summary;
  const SORT_OPTIONS = [
    { key: "ordersLast30Days", label: "30-day orders" },
    { key: "revenueLast30Days", label: "30-day revenue" },
    { key: "ordersLifetime", label: "All-time orders" },
    { key: "ordersLast7Days", label: "7-day orders" },
    { key: "engagement", label: "Health" },
    { key: "name", label: "Name" },
    { key: "lastOrderAt", label: "Last order" },
    { key: "createdAt", label: "Signed up" },
  ];

  return (
    <AdminLayout
      title="Platform Overview"
      subtitle="Live health, revenue, subscriptions, and ops across every tenant."
    >
      <SuperPageGate permission="platform.overview.view">
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <LayoutDashboard className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">
                Loading platform console…
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Live snapshot
                  </span>
                </div>
                {data?.generatedAt && (
                  <span className="text-xs text-gray-500 dark:text-neutral-500">
                    Updated {formatDate(data.generatedAt)}
                  </span>
                )}
                {insights.pendingApproval > 0 && (
                  <Link
                    href="/super/restaurants"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-400"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {insights.pendingApproval} pending approval
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => load()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Refresh
                </button>
                <Link
                  href="/super/restaurants"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Manage restaurants
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            {/* Hero volume strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-[#FF5400] to-[#ff7a33] p-5 text-white shadow-sm">
                <p className="text-xs font-medium text-white/80">
                  Platform GMV · 30 days
                </p>
                <p className="text-3xl font-bold tabular-nums mt-1 tracking-tight">
                  {formatMoney(insights.revenue30)}
                </p>
                <p className="text-[11px] text-white/75 mt-2">
                  Across {s?.engagedLast30Days ?? 0} active tenants
                </p>
              </div>
              <MetricTile
                label="Orders · 30 days"
                value={formatCompact(insights.orders30)}
                sub={`${formatCompact(insights.orders7)} in last 7 days · ${formatCompact(insights.ordersLife)} all-time`}
                icon={Activity}
                tone="emerald"
              />
              <MetricTile
                label="Active rate"
                value={`${insights.activeRate}%`}
                sub={`${s?.engagedLast30Days ?? 0} of ${s?.totalRestaurants ?? 0} ordered in 30d · avg ${insights.avgOrdersActive}/active`}
                icon={TrendingUp}
                tone="primary"
              />
              <MetricTile
                label="New tenants · 30 days"
                value={insights.signed30}
                sub={`${insights.signed7} signed up this week`}
                icon={Store}
                tone="sky"
                href="/super/restaurants"
              />
            </div>

            {/* Tenant health KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricTile
                label="Total restaurants"
                value={s?.totalRestaurants ?? 0}
                sub="Non-deleted tenants"
                icon={Building2}
                tone="primary"
                href="/super/restaurants"
              />
              <MetricTile
                label="Active (30 days)"
                value={s?.engagedLast30Days ?? 0}
                sub="≥1 order in last 30 days"
                icon={TrendingUp}
                tone="emerald"
              />
              <MetricTile
                label="Ever ordered"
                value={s?.everHadOrders ?? 0}
                sub="Lifetime order count > 0"
                icon={Zap}
                tone="sky"
              />
              <MetricTile
                label="No orders yet"
                value={s?.neverHadOrders ?? 0}
                sub="Signed up but never ordered"
                icon={AlertCircle}
                tone="amber"
              />
              <MetricTile
                label="Quiet"
                value={s?.quietHadOrdersBefore ?? 0}
                sub="Had orders, none in 30d"
                icon={Clock}
                tone="rose"
              />
            </div>

            {/* Analytics row */}
            <div className="grid lg:grid-cols-3 gap-4">
              <Panel
                title="Engagement breakdown"
                description="Health labels across the fleet"
              >
                <div className="flex flex-wrap items-center gap-5">
                  <DonutChart
                    segments={engagementSegments}
                    centerValue={s?.totalRestaurants ?? 0}
                    centerLabel="tenants"
                  />
                  <div className="flex flex-col gap-2 min-w-[150px] flex-1">
                    {engagementSegments.map((seg) => (
                      <div key={seg.label} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="text-xs text-gray-600 dark:text-neutral-400 flex-1">
                          {seg.label}
                        </span>
                        <span className="text-xs font-bold tabular-nums text-gray-900 dark:text-white">
                          {seg.value}
                        </span>
                        <span className="text-[10px] tabular-nums text-gray-400 w-8 text-right">
                          {pct(seg.value, restaurants.length)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel
                title="Subscription lifecycle"
                description="Plan status across tenants"
              >
                {statusBars.length ? (
                  <HBar items={statusBars} />
                ) : (
                  <p className="text-sm text-gray-500">No subscription data</p>
                )}
                {insights.expiringSoon > 0 && (
                  <p className="mt-4 text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {insights.expiringSoon} ending within 14 days
                  </p>
                )}
              </Panel>

              <Panel
                title="Needs attention"
                description="Approvals, churn risk, onboarding gaps"
                action={
                  <Link
                    href="/super/restaurants"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View all
                  </Link>
                }
              >
                {insights.attention.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      All clear
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      No urgent tenant issues right now
                    </p>
                  </div>
                ) : (
                  <div>
                    {insights.attention.map((item) => (
                      <AttentionRow
                        key={item.id}
                        title={item.title}
                        meta={item.meta}
                        href={item.href}
                        severity={item.severity}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            {/* Footprint + mix */}
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Panel title="Platform footprint" description="Aggregate setup depth">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Branches",
                      value: insights.branches,
                      icon: Building2,
                    },
                    {
                      label: "Menu items",
                      value: insights.menuItems,
                      icon: UtensilsCrossed,
                    },
                    {
                      label: "Team seats",
                      value: insights.team,
                      icon: Users,
                    },
                    {
                      label: "Website orders · 30d",
                      value: insights.websiteOrders30,
                      icon: Store,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 p-3"
                    >
                      <item.icon className="w-3.5 h-3.5 text-gray-400 mb-2" />
                      <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                        {formatCompact(item.value)}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-3">
                  Website is {insights.websiteShare}% of 30-day order volume
                </p>
              </Panel>

              <Panel title="Plan mix" description="Commercial packaging">
                {planBars.length ? (
                  <HBar items={planBars} />
                ) : (
                  <p className="text-sm text-gray-500">No plan data</p>
                )}
              </Panel>

              <Panel title="Acquisition source" description="How tenants joined">
                {sourceBars.length ? (
                  <HBar items={sourceBars} />
                ) : (
                  <p className="text-sm text-gray-500">No source data</p>
                )}
              </Panel>

              <Panel title="Ops pulse" description="Billing, pipeline & WhatsApp">
                <div className="space-y-2">
                  <Link
                    href="/super/invoices"
                    className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-neutral-800 px-3 py-2.5 hover:border-primary/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        Invoices
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {invoiceStats
                          ? `${invoiceStats.overdueCount} overdue · ${invoiceStats.paidCount} paid`
                          : "Open billing console"}
                      </p>
                    </div>
                    {invoiceStats?.overdueCount > 0 && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                        {invoiceStats.overdueCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/super/leads"
                    className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-neutral-800 px-3 py-2.5 hover:border-primary/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-sky-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        Leads
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {leadsStats
                          ? `${leadsStats.openCount ?? 0} open · ${leadsStats.winRate ?? 0}% win`
                          : "Open sales pipeline"}
                      </p>
                    </div>
                    {(leadsStats?.overdueFollowUps ?? 0) > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                        {leadsStats.overdueFollowUps}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/super/whatsapp"
                    className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-neutral-800 px-3 py-2.5 hover:border-primary/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        WhatsApp
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {waStats
                          ? `${waStats.totalActive ?? 0} live · ${waStats.conversationsToday ?? 0} chats today`
                          : "Open WhatsApp ops"}
                      </p>
                    </div>
                    {(waStats?.totalPending ?? 0) > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                        {waStats.totalPending}
                      </span>
                    )}
                  </Link>
                  {invoiceStats && (
                    <div className="pt-1 text-[11px] text-gray-500 dark:text-neutral-500">
                      Paid {formatMoney(invoiceStats.paidAmount)} · pending{" "}
                      {formatMoney(invoiceStats.pendingAmount)}
                      {invoiceStats.overdueAmount > 0
                        ? ` · overdue ${formatMoney(invoiceStats.overdueAmount)}`
                        : ""}
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            {/* Leaderboard */}
            <Panel
              title="Top performing restaurants"
              description="Ranked by current sort · click a row destination from Restaurants"
              className="overflow-hidden"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={sortKey}
                    onChange={(e) => {
                      const k = e.target.value;
                      setSortKey(k);
                      setSortDir(
                        k === "name" || k === "createdAt" ? "asc" : "desc",
                      );
                    }}
                    className="h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        Sort by {opt.label}
                      </option>
                    ))}
                  </select>
                  <Link
                    href="/super/restaurants"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Full list
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              }
            >
              <div className="-mx-5 -mb-5 overflow-hidden rounded-b-2xl">
                <DataTable
                  rows={sortedRows.slice(0, 12)}
                  getRowId={(row) => row.id}
                  emptyMessage="No restaurants found."
                  onRowClick={(row) => {
                    if (typeof window !== "undefined") {
                      window.location.href = `/super/restaurants/${row.id}`;
                    }
                  }}
                  columns={[
                    {
                      key: "rank",
                      header: "#",
                      render: (_, __, idx) => (
                        <span className="text-xs font-bold text-gray-400 tabular-nums">
                          {idx + 1}
                        </span>
                      ),
                    },
                    {
                      key: "name",
                      header: "Restaurant",
                      render: (_, row) => {
                        const w = row.website || {};
                        return (
                          <div className="min-w-0">
                            <span
                              className="font-semibold text-gray-900 dark:text-white truncate block max-w-[200px]"
                              title={w.name}
                            >
                              {w.name || "Untitled"}
                            </span>
                            <span className="font-mono text-[10px] text-gray-400">
                              {w.subdomain || "—"}
                            </span>
                          </div>
                        );
                      },
                    },
                    {
                      key: "planStatus",
                      header: "Plan / status",
                      hideOnMobile: true,
                      render: (_, row) => {
                        const sub = row.subscription || {};
                        return (
                          <span className="text-xs">
                            <span className="text-gray-500 dark:text-neutral-500">
                              {sub.plan || "—"}
                            </span>
                            <span className="text-gray-300 dark:text-neutral-700 mx-1">
                              ·
                            </span>
                            <span
                              className={
                                sub.status === "ACTIVE"
                                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                  : sub.status === "SUSPENDED" ||
                                      sub.status === "EXPIRED"
                                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                                    : "text-amber-600 dark:text-amber-400 font-semibold"
                              }
                            >
                              {sub.status || "—"}
                            </span>
                          </span>
                        );
                      },
                    },
                    {
                      key: "ordersLast7Days",
                      header: "7d",
                      align: "right",
                      render: (_, row) => (
                        <span className="tabular-nums text-gray-700 dark:text-neutral-300">
                          {row.activity?.ordersLast7Days ?? 0}
                        </span>
                      ),
                    },
                    {
                      key: "ordersLast30Days",
                      header: "30d",
                      align: "right",
                      render: (_, row) => (
                        <span className="tabular-nums font-semibold text-gray-900 dark:text-white">
                          {row.activity?.ordersLast30Days ?? 0}
                        </span>
                      ),
                    },
                    {
                      key: "revenueLast30Days",
                      header: "Revenue 30d",
                      align: "right",
                      hideOnTablet: true,
                      render: (_, row) => {
                        const a = row.activity?.revenueLast30Days;
                        return (
                          <span className="tabular-nums text-xs text-gray-600 dark:text-neutral-400">
                            {a != null && a > 0 ? formatMoney(a) : "—"}
                          </span>
                        );
                      },
                    },
                    {
                      key: "ordersLifetime",
                      header: "All-time",
                      align: "right",
                      hideOnMobile: true,
                      render: (_, row) => (
                        <span className="tabular-nums">
                          {row.activity?.ordersLifetime ?? 0}
                        </span>
                      ),
                    },
                    {
                      key: "webShare",
                      header: "Web 30d",
                      align: "right",
                      hideOnTablet: true,
                      render: (_, row) => (
                        <span className="tabular-nums text-xs text-gray-500">
                          {row.activity?.websiteOrdersLast30Days ?? 0}
                        </span>
                      ),
                    },
                    {
                      key: "setup",
                      header: "Setup",
                      hideOnTablet: true,
                      render: (_, row) => (
                        <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
                          {row.activity?.menuItemsCount ?? 0}m ·{" "}
                          {row.activity?.branchesCount ?? 0}b ·{" "}
                          {row.activity?.teamMembersCount ?? 0}t
                        </span>
                      ),
                    },
                    {
                      key: "lastOrderAt",
                      header: "Last order",
                      hideOnTablet: true,
                      render: (_, row) => (
                        <span className="text-xs text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                          {formatDate(row.activity?.lastOrderAt)}
                        </span>
                      ),
                    },
                    {
                      key: "engagement",
                      header: "Health",
                      render: (_, row) => {
                        const eg = row.engagement || {};
                        const badgeClass =
                          ENGAGEMENT_STYLES[eg.key] || ENGAGEMENT_STYLES.dormant;
                        return (
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                            title={eg.description}
                          >
                            {eg.label}
                          </span>
                        );
                      },
                    },
                  ]}
                />
              </div>
            </Panel>

            {/* Billing highlight if overdue */}
            {(invoiceStats?.overdueCount > 0 || insights.expiringSoon > 0) && (
              <div className="grid sm:grid-cols-2 gap-3">
                {invoiceStats?.overdueCount > 0 && (
                  <Link
                    href="/super/invoices"
                    className="flex items-center gap-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/20 px-5 py-4 hover:border-rose-300 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
                        {invoiceStats.overdueCount} overdue invoice
                        {invoiceStats.overdueCount === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-rose-700/80 dark:text-rose-400/80">
                        {formatMoney(invoiceStats.overdueAmount)} outstanding
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-rose-500" />
                  </Link>
                )}
                {insights.expiringSoon > 0 && (
                  <Link
                    href="/super/restaurants"
                    className="flex items-center gap-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-5 py-4 hover:border-amber-300 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
                        {insights.expiringSoon} subscription
                        {insights.expiringSoon === 1 ? "" : "s"} ending soon
                      </p>
                      <p className="text-xs text-amber-800/80 dark:text-amber-400/80">
                        Within the next 14 days
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-amber-600" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </SuperPageGate>
    </AdminLayout>
  );
}
