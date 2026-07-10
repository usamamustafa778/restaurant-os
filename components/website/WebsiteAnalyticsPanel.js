import { useEffect, useMemo, useState } from "react";
import { getWebsiteAnalytics } from "../../lib/apiClient";
import {
  Activity,
  Eye,
  Globe,
  Loader2,
  Monitor,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const PRESETS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

function fmtDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtShortDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtRs(value) {
  return `Rs ${Math.round(Number(value) || 0).toLocaleString()}`;
}

function formatPathLabel(path) {
  const raw = String(path || "/");
  const [pathname] = raw.split("?");
  if (pathname === "/" || pathname === "") return "Home";
  if (pathname === "/account") return "My account";
  if (pathname.startsWith("/orders/")) return "Track order";
  return pathname;
}

function deviceLabel(device) {
  const d = String(device || "").toLowerCase();
  if (d === "mobile") return "Mobile";
  if (d === "tablet") return "Tablet";
  if (d === "desktop") return "Desktop";
  return "Unknown";
}

function DailyTrendChart({ daily = [] }) {
  const maxViews = Math.max(1, ...daily.map((d) => Number(d.pageViews) || 0));

  if (!daily.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-neutral-800 text-sm text-gray-500">
        No traffic recorded in this period yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
      <div className="flex h-40 items-end gap-1.5">
        {daily.map((row) => {
          const views = Number(row.pageViews) || 0;
          const height = Math.max(6, Math.round((views / maxViews) * 100));
          return (
            <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-orange-500/90 dark:bg-orange-500"
                style={{ height: `${height}%` }}
                title={`${row.pageViews} views`}
              />
              <span className="truncate text-[10px] text-gray-500 dark:text-neutral-400">
                {fmtShortDate(row.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddonHeadline({ addons, dateLabel }) {
  const headline = addons?.headline || addons?.summary;
  if (!headline) return null;

  const revenue = Number(headline.modifierRevenue) || 0;
  const share = Number(headline.modifierShareOfRevenue) || 0;
  const ordersWithAddons =
    Number(headline.ordersWithAddons ?? addons?.summary?.ordersWithAddons) || 0;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm dark:border-emerald-500/30 dark:from-emerald-950/40 dark:via-neutral-950 dark:to-teal-950/30">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Add-on revenue proof
          </p>
          <p className="mt-2 text-xl font-black leading-snug text-gray-900 dark:text-white sm:text-2xl">
            Add-ons generated{" "}
            <span className="text-emerald-600 dark:text-emerald-400">{fmtRs(revenue)}</span>{" "}
            this period
            {share > 0 ? (
              <>
                {" "}
                (<span className="text-emerald-600 dark:text-emerald-400">{share}%</span> of
                revenue)
              </>
            ) : null}{" "}
            across{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {ordersWithAddons.toLocaleString()}
            </span>{" "}
            {ordersWithAddons === 1 ? "order" : "orders"}.
          </p>
          {dateLabel ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-neutral-400">{dateLabel}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AddonPerformanceSection({ addons }) {
  const summary = addons?.summary;
  if (!summary) return null;

  const topByRevenue = addons?.topAddonsByRevenue || [];
  const topByCount = addons?.topAddonsByCount || [];

  return (
    <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <ShoppingBag className="h-4 w-4" />
            Add-ons &amp; Upsell Performance
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            Modifier add-ons and &ldquo;Complete your meal&rdquo; cross-sell revenue from website
            orders.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Add-on revenue
          </p>
          <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {fmtRs(summary.modifierRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Attach rate
          </p>
          <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {summary.attachRate}%
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
            {summary.ordersWithAddons} of {summary.totalOrders} orders
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Avg add-on / order
          </p>
          <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {fmtRs(summary.avgAddonValuePerOrder)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Cross-sell revenue
          </p>
          <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
            {fmtRs(summary.crossSellRevenue)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
            vs {fmtRs(summary.menuLineRevenue)} from menu
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <TrendingUp className="h-4 w-4" />
            Top add-ons by revenue
          </h3>
          <div className="mt-3 space-y-2">
            {topByRevenue.length > 0 ? (
              topByRevenue.map((row) => (
                <div
                  key={`rev-${row.optionId || row.name}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-900"
                >
                  <span className="truncate text-sm text-gray-800 dark:text-neutral-200">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                    {fmtRs(row.revenue)} · {row.count}×
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-gray-500">
                No paid add-ons recorded in this period yet.
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Top add-ons by count
          </h3>
          <div className="mt-3 space-y-2">
            {topByCount.length > 0 ? (
              topByCount.map((row) => (
                <div
                  key={`cnt-${row.optionId || row.name}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-900"
                >
                  <span className="truncate text-sm text-gray-800 dark:text-neutral-200">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                    {row.count}× · {fmtRs(row.revenue)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-gray-500">
                No paid add-ons recorded in this period yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function WebsiteAnalyticsPanel() {
  const [preset, setPreset] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr("");
        const data = await getWebsiteAnalytics({ preset });
        if (!cancelled) setReport(data || null);
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load website analytics");
          setReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [preset]);

  const topPage = report?.topPages?.[0] || null;
  const dateLabel = useMemo(() => {
    if (!report?.from || !report?.to) return "";
    return `${fmtDate(report.from)} – ${fmtDate(report.to)}`;
  }, [report]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {dateLabel ? (
          <p className="text-xs text-gray-500 dark:text-neutral-500">{dateLabel}</p>
        ) : (
          <span />
        )}
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 p-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                preset === p.id
                  ? "bg-primary text-white"
                  : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[32vh] items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading analytics…
        </div>
      ) : err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {err}
        </div>
      ) : (
        <>
          <AddonHeadline addons={report?.addons} dateLabel={dateLabel} />
          <AddonPerformanceSection addons={report?.addons} />

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <Eye className="h-4 w-4" />
                Page views
              </div>
              <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">
                {(report?.summary?.pageViews || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <Users className="h-4 w-4" />
                Unique visitors
              </div>
              <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">
                {(report?.summary?.uniqueVisitors || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <Activity className="h-4 w-4" />
                Top page
              </div>
              <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
                {topPage ? formatPathLabel(topPage.path) : "—"}
              </p>
              {topPage ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                  {topPage.views.toLocaleString()} views · {topPage.share}%
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Daily traffic</h2>
            <div className="mt-4">
              <DailyTrendChart daily={report?.daily || []} />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Top pages</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500">
                    <tr>
                      <th className="py-2">Page</th>
                      <th className="py-2">Views</th>
                      <th className="py-2">Visitors</th>
                      <th className="py-2">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.topPages || []).map((row) => (
                      <tr
                        key={row.path}
                        className="border-t border-gray-100 dark:border-neutral-800"
                      >
                        <td className="py-2">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatPathLabel(row.path)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-neutral-400">
                            {row.path}
                          </div>
                        </td>
                        <td className="py-2">{row.views.toLocaleString()}</td>
                        <td className="py-2">{row.uniqueVisitors.toLocaleString()}</td>
                        <td className="py-2">{row.share}%</td>
                      </tr>
                    ))}
                    {(!report?.topPages || report.topPages.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500">
                          No page views yet. Visit your storefront to start collecting data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                  <Globe className="h-4 w-4" />
                  Top referrers
                </h2>
                <div className="mt-3 space-y-2">
                  {(report?.referrers || []).map((row) => (
                    <div
                      key={row.source}
                      className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-900"
                    >
                      <span className="truncate text-sm text-gray-800 dark:text-neutral-200">
                        {row.source}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                        {row.views.toLocaleString()} · {row.share}%
                      </span>
                    </div>
                  ))}
                  {(!report?.referrers || report.referrers.length === 0) && (
                    <p className="py-4 text-sm text-gray-500">No referrer data yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Devices</h2>
                <div className="mt-3 space-y-2">
                  {(report?.devices || []).map((row) => {
                    const Icon =
                      row.device === "mobile"
                        ? Smartphone
                        : row.device === "desktop"
                          ? Monitor
                          : Activity;
                    return (
                      <div
                        key={row.device}
                        className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-900"
                      >
                        <span className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-neutral-200">
                          <Icon className="h-4 w-4" />
                          {deviceLabel(row.device)}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                          {row.views.toLocaleString()} · {row.share}%
                        </span>
                      </div>
                    );
                  })}
                  {(!report?.devices || report.devices.length === 0) && (
                    <p className="py-4 text-sm text-gray-500">No device data yet.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
