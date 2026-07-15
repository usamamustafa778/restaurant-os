import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getWebsiteAnalytics } from "../../lib/apiClient";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Eye,
  Globe,
  Lock,
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

const ANALYTICS_FEATURES = [
  {
    icon: Eye,
    title: "Traffic at a glance",
    desc: "Page views, unique visitors, and daily trends from your storefront.",
  },
  {
    icon: ShoppingBag,
    title: "Add-on revenue proof",
    desc: "See how modifiers and upsells contribute to online order value.",
  },
  {
    icon: Globe,
    title: "Top pages & sources",
    desc: "Know which pages convert and where guests are coming from.",
  },
  {
    icon: Smartphone,
    title: "Device breakdown",
    desc: "Mobile vs desktop mix so you can optimize the experience that matters.",
  },
];

function AnalyticsLockedPresentation() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="relative border-b border-gray-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 px-6 py-8 dark:border-neutral-800 dark:from-orange-950/30 dark:via-neutral-950 dark:to-amber-950/20 sm:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 20%, rgba(249,115,22,0.18), transparent 42%), radial-gradient(circle at 88% 10%, rgba(251,191,36,0.16), transparent 38%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-700 shadow-sm dark:border-orange-500/30 dark:bg-neutral-900/80 dark:text-orange-300">
              <Lock className="h-3 w-3" />
              Module available
            </span>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Unlock Website Analytics
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-neutral-300">
              Turn storefront visits into clear decisions — track traffic, top
              pages, devices, and the add-on revenue your menu is already
              generating.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-primary/35"
              >
                Enable on Subscription
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                Or ask EatsDesk support if this should already be active.
              </p>
            </div>
          </div>

          <div className="grid w-full max-w-sm grid-cols-2 gap-2.5 lg:shrink-0">
            {[
              { label: "Page views", value: "1.2k", icon: Eye },
              { label: "Visitors", value: "438", icon: Users },
              { label: "Add-on share", value: "18%", icon: TrendingUp },
              { label: "Top device", value: "Mobile", icon: Smartphone },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/70"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  <card.icon className="h-3 w-3 text-primary" />
                  {card.label}
                </div>
                <p className="mt-1.5 text-xl font-black text-gray-900 dark:text-white">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-neutral-800 sm:grid-cols-2">
        {ANALYTICS_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex gap-3 bg-white p-5 dark:bg-neutral-950 sm:p-6"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <feature.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {feature.title}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-neutral-400">
                {feature.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/40 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
          <BarChart3 className="h-4 w-4 text-primary" />
          Sample metrics shown above — real data appears once the module is
          enabled.
        </div>
        <Link
          href="/subscription"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2"
        >
          View subscription options
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

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
  const [moduleLocked, setModuleLocked] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr("");
        setModuleLocked(false);
        const data = await getWebsiteAnalytics({ preset });
        if (!cancelled) setReport(data || null);
      } catch (e) {
        if (!cancelled) {
          const locked =
            e?.details?.code === "MODULE_NOT_ACTIVE" ||
            e?.code === 403;
          setModuleLocked(locked);
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
      {moduleLocked ? (
        <AnalyticsLockedPresentation />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            {dateLabel ? (
              <p className="text-xs text-gray-500 dark:text-neutral-500">
                {dateLabel}
              </p>
            ) : (
              <span />
            )}
            <div className="inline-flex rounded-lg border border-gray-200 p-1 dark:border-neutral-700">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`h-8 rounded-md px-3 text-xs font-semibold transition ${
                    preset === p.id
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:bg-gray-50 dark:text-neutral-400 dark:hover:bg-neutral-900"
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
              <p>{err}</p>
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
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Daily traffic
                </h2>
                <div className="mt-4">
                  <DailyTrendChart daily={report?.daily || []} />
                </div>
              </section>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Top pages
                  </h2>
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
                            <td className="py-2">
                              {row.uniqueVisitors.toLocaleString()}
                            </td>
                            <td className="py-2">{row.share}%</td>
                          </tr>
                        ))}
                        {(!report?.topPages || report.topPages.length === 0) && (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-8 text-center text-gray-500"
                            >
                              No page views yet. Visit your storefront to start
                              collecting data.
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
                        <p className="py-4 text-sm text-gray-500">
                          No referrer data yet.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      Devices
                    </h2>
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
                        <p className="py-4 text-sm text-gray-500">
                          No device data yet.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
