import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import DataTable from "../../../components/ui/DataTable";
import { getSuperRestaurantActivitySummary } from "../../../lib/apiClient";
import {
  ArrowUpRight,
  Loader2,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Building2,
  Activity,
  Zap,
  AlertCircle,
} from "lucide-react";

// ── Donut ring chart (matches tenant overview) ─────────────────────────────
function DonutChart({ segments, size = 140 }) {
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  const r = Math.round(size * 0.36);
  const sw = Math.round(size * 0.17);
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="flex-shrink-0"
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#f3f4f6"
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
          />
        );
      })}
    </svg>
  );
}

const ENGAGEMENT_STYLES = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  quiet: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  new: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  configured: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  dormant: "bg-neutral-500/20 text-neutral-300 border-neutral-600",
};

const ENGAGEMENT_COLORS = {
  active: "#10b981",
  quiet: "#f59e0b",
  new: "#0ea5e9",
  configured: "#8b5cf6",
  dormant: "#71717a",
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

export default function SuperOverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("ordersLast30Days");
  const [sortDir, setSortDir] = useState("desc");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await getSuperRestaurantActivitySummary();
      setData(res);
    } catch (e) {
      setError(e?.message || "Failed to load activity summary");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sortedRows = useMemo(() => {
    const rows = data?.restaurants ? [...data.restaurants] : [];
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
          va = new Date(a.createdAt).getTime();
          vb = new Date(b.createdAt).getTime();
          return (va - vb) * mult;
        case "ordersLast7Days":
          va = a.activity?.ordersLast7Days ?? 0;
          vb = b.activity?.ordersLast7Days ?? 0;
          return (va - vb) * mult;
        case "ordersLast30Days":
          va = a.activity?.ordersLast30Days ?? 0;
          vb = b.activity?.ordersLast30Days ?? 0;
          return (va - vb) * mult;
        case "revenueLast30Days":
          va = a.activity?.revenueLast30Days ?? 0;
          vb = b.activity?.revenueLast30Days ?? 0;
          return (va - vb) * mult;
        case "ordersLifetime":
          va = a.activity?.ordersLifetime ?? 0;
          vb = b.activity?.ordersLifetime ?? 0;
          return (va - vb) * mult;
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
          va = order[a.engagement?.key] ?? 0;
          vb = order[b.engagement?.key] ?? 0;
          return (va - vb) * mult;
        }
        default:
          return 0;
      }
    });
    return rows;
  }, [data, sortKey, sortDir]);

  const engagementSegments = useMemo(() => {
    const counts = { active: 0, quiet: 0, new: 0, configured: 0, dormant: 0 };
    for (const r of data?.restaurants ?? []) {
      const key = r.engagement?.key || "dormant";
      if (counts[key] !== undefined) counts[key]++;
    }
    return ["active", "quiet", "new", "configured", "dormant"].map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: counts[key] || 0,
      color: ENGAGEMENT_COLORS[key] || "#71717a",
    }));
  }, [data?.restaurants]);

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

  const s = data?.summary;

  const KPI_CARDS = [
    {
      label: "Total restaurants",
      sub: "Non-deleted tenants",
      value: s?.totalRestaurants ?? 0,
      icon: Building2,
      color: "text-primary",
      bg: "bg-primary/10 dark:bg-primary/20",
      border: "border-primary/20 dark:border-primary/30",
    },
    {
      label: "Active (30 days)",
      sub: "≥1 order in last 30 days",
      value: s?.engagedLast30Days ?? 0,
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-100 dark:border-emerald-500/20",
      pulse: (s?.engagedLast30Days ?? 0) > 0,
    },
    {
      label: "Ever ordered",
      sub: "Lifetime order count > 0",
      value: s?.everHadOrders ?? 0,
      icon: Activity,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-500/10",
      border: "border-sky-100 dark:border-sky-500/20",
    },
    {
      label: "No orders yet",
      sub: "Signed up but no orders",
      value: s?.neverHadOrders ?? 0,
      icon: AlertCircle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-100 dark:border-amber-500/20",
    },
    {
      label: "Quiet",
      sub: "Had orders, none in 30d",
      value: s?.quietHadOrdersBefore ?? 0,
      icon: Zap,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-500/10",
      border: "border-violet-100 dark:border-violet-500/20",
    },
  ];

  return (
    <AdminLayout title="Platform Overview">
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <LayoutDashboard className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">
              Loading platform stats…
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Control bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Platform Health
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => load()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </button>
              <Link
                href="/dashboard/super/restaurants"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Manage restaurants
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {KPI_CARDS.map(({ label, sub, value, icon: Icon, color, bg, border, pulse }) => (
              <div
                key={label}
                className={`bg-white dark:bg-neutral-950 border ${border} rounded-2xl p-4`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  {pulse && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      live
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-neutral-500 mb-0.5">
                  {label}
                </p>
                <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Charts row: donut + gradient highlight */}
          <div className="grid lg:grid-cols-3 gap-5 mb-5">
            <div className="lg:col-span-2 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                Engagement breakdown
              </h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4">
                Restaurants by health status
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <DonutChart segments={engagementSegments} size={140} />
                <div className="flex flex-col gap-2 min-w-[140px]">
                  {engagementSegments
                    .filter((seg) => seg.value > 0)
                    .map((seg) => (
                      <div key={seg.label} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="text-xs text-gray-600 dark:text-neutral-400 flex-1 truncate">
                          {seg.label}
                        </span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                          {seg.value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-emerald-100 text-xs font-medium">Active tenants (30 days)</p>
                  <p className="text-white text-2xl font-bold leading-tight mt-0.5">
                    {s?.engagedLast30Days ?? 0}
                  </p>
                  <p className="text-emerald-100/90 text-[11px] mt-1">
                    Using POS, website or integrations
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Restaurant table */}
          <Card
            title="Top 10 performing restaurants"
            description="Top 10 by current sort (default: 30-day orders)."
            headerActions={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => {
                    const k = e.target.value;
                    setSortKey(k);
                    setSortDir(k === "name" || k === "createdAt" ? "asc" : "desc");
                  }}
                  className="h-9 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      Sort by {opt.label}
                    </option>
                  ))}
                </select>
                {data?.generatedAt && (
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                    Snapshot: {formatDate(data.generatedAt)}
                  </span>
                )}
              </div>
            }
          >
            <DataTable
              variant="card"
              rows={sortedRows.slice(0, 10)}
              getRowId={(row) => row.id}
              emptyMessage="No restaurants found."
              columns={[
                {
                  key: "name",
                  header: "Restaurant",
                  render: (_, row) => {
                    const w = row.website || {};
                    return (
                      <span className="font-semibold text-gray-900 dark:text-white truncate block max-w-[180px]" title={w.name}>
                        {w.name || "Untitled"}
                      </span>
                    );
                  },
                },
                {
                  key: "subdomain",
                  header: "Subdomain",
                  hideOnMobile: true,
                  render: (_, row) => (
                    <span className="font-mono text-xs text-gray-500 dark:text-neutral-400">
                      {row.website?.subdomain || "—"}
                    </span>
                  ),
                },
                {
                  key: "planStatus",
                  header: "Plan / status",
                  hideOnMobile: true,
                  render: (_, row) => {
                    const sub = row.subscription || {};
                    return (
                      <span className="text-xs">
                        <span className="text-gray-500 dark:text-neutral-500">{sub.plan || "—"}</span>
                        <span className="text-gray-400 dark:text-neutral-600 mx-1">·</span>
                        <span
                          className={
                            sub.status === "ACTIVE"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : sub.status === "SUSPENDED"
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {sub.status || "—"}
                        </span>
                      </span>
                    );
                  },
                },
                {
                  key: "createdAt",
                  header: "Signed up",
                  hideOnTablet: true,
                  render: (_, row) => (
                    <span className="text-xs text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                      {formatShortDate(row.createdAt)}
                    </span>
                  ),
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
                  header: "Revenue",
                  align: "right",
                  hideOnTablet: true,
                  render: (_, row) => {
                    const a = row.activity?.revenueLast30Days;
                    return (
                      <span className="tabular-nums text-xs text-gray-500 dark:text-neutral-400">
                        {a != null && a > 0
                          ? `PKR ${Number(a).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
                          : "—"}
                      </span>
                    );
                  },
                },
                {
                  key: "ordersLifetime",
                  header: "All-time",
                  align: "right",
                  render: (_, row) => (
                    <span className="tabular-nums">{row.activity?.ordersLifetime ?? 0}</span>
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
                  key: "menuItemsCount",
                  header: "Menu",
                  align: "right",
                  render: (_, row) => (
                    <span className="tabular-nums text-gray-500 dark:text-neutral-400">
                      {row.activity?.menuItemsCount ?? 0}
                    </span>
                  ),
                },
                {
                  key: "branchesCount",
                  header: "Branches",
                  align: "right",
                  render: (_, row) => (
                    <span className="tabular-nums text-gray-500 dark:text-neutral-400">
                      {row.activity?.branchesCount ?? 0}
                    </span>
                  ),
                },
                {
                  key: "teamMembersCount",
                  header: "Team",
                  align: "right",
                  render: (_, row) => (
                    <span className="tabular-nums text-gray-500 dark:text-neutral-400">
                      {row.activity?.teamMembersCount ?? 0}
                    </span>
                  ),
                },
                {
                  key: "engagement",
                  header: "Health",
                  render: (_, row) => {
                    const eg = row.engagement || {};
                    const badgeClass = ENGAGEMENT_STYLES[eg.key] || ENGAGEMENT_STYLES.dormant;
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
        </Card>
      </div>
      )}
    </AdminLayout>
  );
}
