import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import { getOverview, getSalesReport, SubscriptionInactiveError } from "../../lib/apiClient";
import { ShoppingBag, TrendingUp, TrendingDown, DollarSign, Package, CreditCard, BarChart3, Loader2, LayoutDashboard } from "lucide-react";
import toast from "react-hot-toast";

// Simple SVG line chart for hourly trend
function MiniLineChart({ data }) {
  const width = 220;
  const height = 60;
  const bottomMargin = 18;
  const leftMargin = 24;
  const innerWidth = width - leftMargin;
  const innerHeight = height - bottomMargin;
  const max = Math.max(...data, 1);

  const points = data
    .map((v, i) => {
      const x = leftMargin + (i / (data.length - 1 || 1)) * innerWidth;
      const y = innerHeight - (v / max) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const hours = Array.from({ length: 24 }, (_, i) =>
    `${i.toString().padStart(2, "0")}:00`
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Axes */}
      <line
        x1={leftMargin}
        y1={innerHeight}
        x2={width}
        y2={innerHeight}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
      <line
        x1={leftMargin}
        y1={0}
        x2={leftMargin}
        y2={innerHeight}
        stroke="#e5e7eb"
        strokeWidth="1"
      />

      {/* Line + area */}
      <polyline
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        points={points}
      />
      <polygon
        fill="url(#lineFill)"
        points={`${points} ${leftMargin + innerWidth},${innerHeight} ${leftMargin},${innerHeight}`}
      />

      {/* Y axis labels (0 and max) */}
      <text
        x={leftMargin - 4}
        y={innerHeight}
        textAnchor="end"
        fontSize="7"
        fill="#9ca3af"
        dy="-1"
      >
        0
      </text>
      <text
        x={leftMargin - 4}
        y={0}
        textAnchor="end"
        fontSize="7"
        fill="#9ca3af"
        dy="6"
      >
        {max >= 1000 ? `${(max / 1000).toFixed(0)}k` : max}
      </text>

      {/* X axis labels for each hour (tilted for readability, show every hour) */}
      {hours.map((label, i) => {
        const x = leftMargin + (i / (hours.length - 1)) * innerWidth;
        const y = height - 1;
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="end"
            fontSize="7"
            fill="#9ca3af"
            transform={`rotate(-45 ${x} ${y})`}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// Simple multi-segment pie chart using stroked circles
function MiniPieChart({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 40 40" className="w-24 h-24">
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke="#111827"
        strokeWidth="8"
      />
      {segments.map((seg, idx) => {
        const fraction = seg.value / total;
        const dash = fraction * circumference;
        const dashArray = `${dash} ${circumference - dash}`;
        const rotation = (offset / total) * 360 - 90;
        offset += seg.value;
        return (
          <circle
            key={idx}
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="8"
            strokeDasharray={dashArray}
            transform={`rotate(${rotation} 20 20)`}
          />
        );
      })}
    </svg>
  );
}

// Map distribution keys to display labels and colors
const typeColors = { DINE_IN: "#f97316", TAKEAWAY: "#22c55e", DELIVERY: "#3b82f6" };
const typeLabels = { DINE_IN: "Dine-in", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };
const paymentColors = { CASH: "#0ea5e9", CARD: "#22c55e", ONLINE: "#6366f1", OTHER: "#f97316" };
const paymentLabels = { CASH: "Cash", CARD: "Card", ONLINE: "Online", OTHER: "Foodpanda" };
const sourceColors = { POS: "#3b82f6", WEBSITE: "#6366f1", FOODPANDA: "#f97316" };
const sourceLabels = { POS: "POS", WEBSITE: "Website", FOODPANDA: "Foodpanda" };
const productColors = ["#3b82f6", "#22c55e", "#6366f1", "#f97316", "#eab308"];

function buildSegments(distribution, labels, colors) {
  return Object.entries(distribution)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      label: labels[key] || key,
      value,
      color: colors[key] || "#9ca3af",
    }));
}

// Daily/hourly sales line chart (non-cumulative): X = day or hour, Y = sales (Rs). Shows remaining days/hours.
function DailySalesLineChart({ period, dailySales, hourlySales, remainingHoursStart }) {
  const width = 1000;
  const height = 220;
  const leftMargin = 40;
  const bottomMargin = 28;
  const rightMargin = 12;
  const topMargin = 12;
  const innerWidth = width - leftMargin - rightMargin;
  const innerHeight = height - topMargin - bottomMargin;

  const isMonthly = period === "monthly";
  const data = isMonthly
    ? (dailySales || []).map((d) => ({ x: d.day, y: d.sales, label: String(d.day), isRemaining: !!d.isRemaining }))
    : Array.from({ length: hourlySales?.length || 0 }, (_, i) => ({
        x: i,
        y: (hourlySales || [])[i] || 0,
        label: `${i}:00`,
        isRemaining: remainingHoursStart != null && i >= remainingHoursStart,
      }));

  const maxY = data.length > 0 ? Math.max(...data.map((d) => d.y), 0) : 1;
  const formatY = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));

  const n = data.length;
  const xScale = n > 1 ? (i) => (i / (n - 1)) * innerWidth : () => innerWidth / 2;
  const yScale = (y) => (maxY > 0 ? (y / maxY) * innerHeight : 0);

  const points = data
    .map((d, i) => {
      const x = leftMargin + xScale(i);
      const y = topMargin + innerHeight - yScale(d.y);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full min-w-0 ">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 text-gray-600 dark:text-neutral-400" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="dailySalesLineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Axes */}
        <line x1={leftMargin} y1={topMargin} x2={leftMargin} y2={topMargin + innerHeight} stroke="currentColor" strokeWidth="1" opacity={0.3} />
        <line x1={leftMargin} y1={topMargin + innerHeight} x2={leftMargin + innerWidth} y2={topMargin + innerHeight} stroke="currentColor" strokeWidth="1" opacity={0.3} />
        {/* Y labels: 0 and max (dynamic to highest single-day/hour sale) */}
        <text x={leftMargin - 6} y={topMargin + innerHeight} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.7}>0</text>
        <text x={leftMargin - 6} y={topMargin} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.7}>{formatY(maxY)}</text>
        {/* Area under line */}
        <polygon
          fill="url(#dailySalesLineFill)"
          points={`${points} ${leftMargin + innerWidth},${topMargin + innerHeight} ${leftMargin},${topMargin + innerHeight}`}
        />
        {/* Line (goes up and down with daily/hourly sales) */}
        <polyline
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className="dark:stroke-sky-400"
        />
        {/* X-axis labels: remaining times/days in muted style */}
        {data.map((d, i) => (
          <text
            key={i}
            x={leftMargin + xScale(i)}
            y={topMargin + innerHeight + 16}
            textAnchor="middle"
            fontSize="9"
            fill={d.isRemaining ? "#94a3b8" : "currentColor"}
            opacity={d.isRemaining ? 0.7 : 0.8}
            className={d.isRemaining ? "dark:fill-neutral-500" : ""}
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    revenue: 0,
    totalBudgetCost: 0,
    totalProfit: 0,
    lowStockItems: [],
    hourlySales: new Array(24).fill(0),
    salesTypeDistribution: {},
    paymentDistribution: {},
    sourceDistribution: {},
    topProducts: [],
    productsPerformance: [],
  });

  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [periodReport, setPeriodReport] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalOrders: 0,
    topItems: [],
    dailySales: [],
  });
  const [reportPeriod, setReportPeriod] = useState("monthly"); // "today" | "monthly" – applies to full page
  const [periodLoading, setPeriodLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getOverview();
        setStats(data);
        setPageLoading(false);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          console.error("Failed to load overview:", err);
          toast.error(err.message || "Failed to load overview");
        }
        setPageLoading(false);
      }
    })();
  }, []);

  // Fetch report from backend for the selected period (today or current month)
  useEffect(() => {
    let cancelled = false;
    setPeriodLoading(true);
    (async () => {
      const now = new Date();
      let fromStr;
      let toStr;
      if (reportPeriod === "today") {
        fromStr = now.toISOString().slice(0, 10);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        toStr = tomorrow.toISOString().slice(0, 10);
      } else {
        fromStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const firstNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        toStr = firstNextMonth.toISOString().slice(0, 10);
      }
      try {
        const report = await getSalesReport({ from: fromStr, to: toStr });
        if (!cancelled) {
          setPeriodReport({
            totalRevenue: report.totalRevenue ?? 0,
            totalProfit: report.totalProfit ?? 0,
            totalOrders: report.totalOrders ?? 0,
            topItems: report.topItems ?? [],
            dailySales: report.dailySales ?? [],
          });
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to load period report:", err);
      } finally {
        if (!cancelled) setPeriodLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportPeriod]);

  const salesTypeSegments = buildSegments(stats.salesTypeDistribution, typeLabels, typeColors);
  const paymentSegments = buildSegments(stats.paymentDistribution, paymentLabels, paymentColors);
  const sourceSegments = buildSegments(stats.sourceDistribution, sourceLabels, sourceColors);
  const topProductSegments = (stats.topProducts || []).slice(0, 5).map((p, i) => ({
    label: p.name,
    value: p.qty,
    color: productColors[i % productColors.length],
  }));
  const displayTopProductSegments = (periodReport.topItems || []).slice(0, 5).map((p, i) => ({
    label: p.name,
    value: p.quantity,
    color: productColors[i % productColors.length],
  }));

  const periodSubtitle =
    reportPeriod === "today"
      ? new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const now = new Date();
  const todayDayOfMonth = now.getDate();
  const currentHour = now.getHours();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const salesByDay = {};
  (periodReport.dailySales || []).forEach((d) => { salesByDay[d.day] = d.sales; });
  const fullMonthDailySales = Array.from({ length: lastDayOfMonth }, (_, i) => {
    const day = i + 1;
    return { day, sales: salesByDay[day] ?? 0, isRemaining: day > todayDayOfMonth };
  });
  const fullDayHourlySales = Array.from({ length: 24 }, (_, i) => (i <= currentHour ? (stats.hourlySales[i] || 0) : 0));
  const remainingHoursStart = currentHour + 1;

  return (
    <AdminLayout
      title="Overview"
      subtitle={periodSubtitle}
      suspended={suspended}
    >
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <LayoutDashboard className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
              Loading overview...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Period filter – applies to full page data from backend */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Report period:</span>
        <div className="inline-flex rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setReportPeriod("today")}
            disabled={periodLoading}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              reportPeriod === "today"
                ? "bg-primary text-white shadow-md"
                : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-800"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod("monthly")}
            disabled={periodLoading}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              reportPeriod === "monthly"
                ? "bg-primary text-white shadow-md"
                : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-neutral-800"
            }`}
          >
            Monthly
          </button>
        </div>
        {periodLoading && (
          <span className="text-xs text-gray-500 dark:text-neutral-400">Loading…</span>
        )}
      </div>

      {/* KPIs row - Premium style with gradients */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 mb-6">
        {/* Total Orders (this month) */}
        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-2xl hover:border-purple-300 dark:hover:border-purple-500/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <span className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
                +{periodReport.totalOrders > 0 ? Math.round((periodReport.totalOrders / (periodReport.totalOrders + 10)) * 100) : 0}%
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mb-2">Total Orders</p>
            <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">{periodReport.totalOrders}</p>
          </div>
        </div>

        {/* Total Sales (this month) */}
        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-2xl hover:border-primary/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className=" h-10 w-10 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <span className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
                +{periodReport.totalRevenue > 0 ? Math.round((periodReport.totalRevenue / (periodReport.totalRevenue + 1000)) * 100) : 0}%
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mb-2">Total Sales</p>
            <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">Rs {Math.round(periodReport.totalRevenue ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Average Value (this month) */}
        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-2xl hover:border-orange-300 dark:hover:border-orange-500/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <span className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400 rounded-xl">
                -4.8%
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mb-2">Average Value</p>
            <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Rs {periodReport.totalOrders ? Math.round((periodReport.totalRevenue ?? 0) / periodReport.totalOrders).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {/* In Progress */}
        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-2xl hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Package className="w-7 h-7 text-white" />
              </div>
              <span className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
                +{stats.pendingOrders}%
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mb-2">In Progress</p>
            <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingOrders}</p>
          </div>
        </div>
      </div>

      {/* Monthly Report row */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-emerald-300 dark:border-emerald-500/30 rounded-2xl p-6 hover:shadow-2xl hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400">{reportPeriod === "monthly" ? "This Month Profit" : "Today's Profit"}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">Rs {Math.round(periodReport.totalProfit ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="sm:col-span-2 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Daily sales</h3>
          </div>
          {/* <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
            X-axis: {reportPeriod === "monthly"
              ? (todayDayOfMonth < lastDayOfMonth ? `day of month (1–${lastDayOfMonth}); days ${todayDayOfMonth + 1}–${lastDayOfMonth} remaining` : `day of month (1–${lastDayOfMonth})`)
              : (currentHour < 23 ? `hour (0–23); hours ${remainingHoursStart}–23 remaining` : "hour (0–23)")
            }. Y-axis: sales (Rs). Not cumulative. Data up to {reportPeriod === "monthly" ? "today" : "current hour"}.
          </p> */}
          {reportPeriod === "monthly" ? (
            fullMonthDailySales.length > 0 ? (
              <DailySalesLineChart period="monthly" dailySales={fullMonthDailySales} hourlySales={null} remainingHoursStart={null} />
            ) : (
              <p className="text-sm text-gray-500 dark:text-neutral-400 py-6 text-center">No data yet this month</p>
            )
          ) : (
            <DailySalesLineChart period="today" dailySales={null} hourlySales={fullDayHourlySales} remainingHoursStart={remainingHoursStart} />
          )}
        </div>
      </div>

      {/* Top Selling & Sales Performance row */}
      <div className="grid gap-5 lg:grid-cols-3 mb-6">
        {/* Top Selling Item */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">🔥 Top Selling Items</h3>
            <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400">{reportPeriod === "monthly" ? "Monthly" : "Today"}</span>
          </div>
          {displayTopProductSegments.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-500/10 dark:to-orange-500/5 border border-orange-200 dark:border-orange-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <span className="text-2xl">👑</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {displayTopProductSegments[0]?.label || "No data"}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-neutral-400 font-medium">
                      {displayTopProductSegments[0]?.value || 0} {reportPeriod === "monthly" ? "sold" : "orders"}
                    </p>
                  </div>
                </div>
              </div>
              
              {displayTopProductSegments.slice(1, 5).map((item, i) => (
                <div key={item.label} className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center h-6 w-6 rounded-lg bg-gray-100 dark:bg-neutral-800 text-xs font-bold text-gray-600 dark:text-neutral-400">
                      {i + 2}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-neutral-300">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all" 
                        style={{ 
                          width: `${(displayTopProductSegments[0].value ? (item.value / displayTopProductSegments[0].value) * 100 : 0)}%`,
                          backgroundColor: item.color 
                        }} 
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-10 text-right">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No sales data yet</p>
            </div>
          )}
        </div>

        {/* Sales Performance Gauge */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Sales Performance</h3>
            <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              View All
            </button>
          </div>
          <div className="flex items-center justify-center py-8">
            {/* Enhanced gauge */}
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="16"
                  className="dark:stroke-neutral-800"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="url(#gaugeGradient)"
                  strokeWidth="16"
                  strokeDasharray={`${2 * Math.PI * 70 * 0.4} ${2 * Math.PI * 70}`}
                  strokeLinecap="round"
                  className="drop-shadow-lg"
                />
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">40%</span>
                <span className="text-xs text-gray-500 dark:text-neutral-500 font-medium mt-1">Target</span>
              </div>
            </div>
          </div>
          <div className="text-center px-4 py-3 rounded-xl bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-500/10 dark:to-orange-500/5 border border-orange-200 dark:border-orange-500/20">
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
              Weekly target achievement
            </p>
          </div>
        </div>

        {/* Payment Distribution */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-5">💳 Payment Methods</h3>
          <div className="space-y-4">
            {paymentSegments.length > 0 ? paymentSegments.map(s => {
              const total = paymentSegments.reduce((sum, seg) => sum + seg.value, 0);
              const percent = ((s.value / total) * 100).toFixed(0);
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-gray-700 dark:text-neutral-300">{s.label}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{percent}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="h-full rounded-full transition-all duration-500 shadow-sm" 
                      style={{ width: `${percent}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                  <CreditCard className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No payment data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main row with revenue chart and category stats */}
      <div className="grid gap-5 lg:grid-cols-3 mb-6">
        {/* Total Revenue Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Total Revenue</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                {reportPeriod === "monthly" ? "Monthly performance" : "Today's performance"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <input type="checkbox" id="revenue-toggle" className="rounded" defaultChecked />
                <label htmlFor="revenue-toggle" className="text-xs font-semibold text-blue-700 dark:text-blue-400 cursor-pointer">Revenue</label>
              </div>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-neutral-400 font-medium mb-0.5">
                  {reportPeriod === "monthly" ? "This Month" : "Today"}
                </p>
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  Rs {(periodReport.totalRevenue ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          {/* Bar chart: period summary */}
          {reportPeriod === "monthly" ? (
            <div className="flex items-end gap-3 h-40 mt-4 px-2">
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-500 shadow-lg shadow-blue-500/30 h-full min-h-[80px]" />
                <span className="text-xs font-semibold mt-1 text-gray-600 dark:text-neutral-400">This month</span>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-3 h-40 mt-4 px-2">
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-500 shadow-lg shadow-blue-500/30 h-full min-h-[80px]" />
                <span className="text-xs font-semibold mt-1 text-gray-600 dark:text-neutral-400">Today</span>
              </div>
            </div>
          )}
        </div>

        {/* Category Statistics */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">📈 Order Types</h3>
            <select className="text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-2 py-1 outline-none">
              <option>Today</option>
              <option>Monthly</option>
            </select>
          </div>
          <div className="flex items-center justify-center mb-6 py-4">
            {salesTypeSegments.length > 0 ? (
              <div className="relative">
                <MiniPieChart segments={salesTypeSegments} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-white dark:bg-neutral-950 border-4 border-gray-100 dark:border-neutral-800" />
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 dark:from-neutral-900 dark:to-neutral-800" />
            )}
          </div>
          <div className="space-y-3">
            {salesTypeSegments.length > 0 ? salesTypeSegments.map(s => (
              <div key={s.label} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: s.color }} />
                  <span className="font-semibold text-gray-700 dark:text-neutral-300">{s.label}</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{s.value}</span>
              </div>
            )) : (
              <p className="text-sm text-center text-gray-500 dark:text-neutral-400 py-4">No order data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Products performance table - Premium design */}
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all">
        <div className="px-6 py-5 border-b-2 border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-gray-50/50 dark:from-neutral-900/30 to-transparent">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Products Performance</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Items sold this month based on completed orders</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-neutral-900/50 dark:to-neutral-900/30">
              <tr>
                <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Product Name</th>
                <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Category</th>
                <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Qty Sold</th>
                <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100 dark:divide-neutral-800">
              {(stats.productsPerformance || []).length > 0 ? (
                stats.productsPerformance.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                    <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{p.name}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="inline-flex items-center justify-center min-w-[60px] px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">
                        {p.qtySold}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-primary text-base">Rs {p.priceSold.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                        <Package className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No sales data yet today</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Products will appear here once orders are completed</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
