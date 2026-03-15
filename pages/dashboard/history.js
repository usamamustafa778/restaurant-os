import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getSalesReport, SubscriptionInactiveError } from "../../lib/apiClient";
import {
  BarChart3, DollarSign, ShoppingBag, TrendingUp,
  HelpCircle, Loader2, Award, RefreshCw, FileDown, Printer,
} from "lucide-react";
import toast from "react-hot-toast";

const PRESETS = [
  { id: "today",      label: "Today" },
  { id: "yesterday",  label: "Yesterday" },
  { id: "this_week",  label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "all",        label: "All Time" },
  { id: "custom",     label: "Custom" },
];

function fmt(d) {
  return d.toISOString().split("T")[0];
}

function getPresetDates(preset) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (preset) {
    case "today":
      return { from: fmt(today), to: fmt(tomorrow) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(today) };
    }
    case "this_week": {
      const dow = today.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      return { from: fmt(monday), to: fmt(tomorrow) };
    }
    case "this_month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(first), to: fmt(tomorrow) };
    }
    case "last_month": {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { from: fmt(firstLast), to: fmt(firstThis) };
    }
    case "all":
      return { from: "", to: "" };
    default:
      return null;
  }
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function downloadCSV(filename, rows) {
  const content = rows.map(toCSVRow).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function buildPeriodLabel(preset, customFrom, customTo) {
  if (preset === "custom") {
    if (customFrom && customTo)
      return `${new Date(customFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(customTo).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    if (customFrom)
      return `From ${new Date(customFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    if (customTo)
      return `Up to ${new Date(customTo).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    return "Custom range";
  }
  return PRESETS.find(p => p.id === preset)?.label || "All Time";
}

export default function HistoryPage() {
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [preset, setPreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    topItems: [],
    paymentRows: [],
    paymentAccountRows: [],
    orderTypeRows: [],
  });
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  async function loadReport(input) {
    try {
      const data = await getSalesReport(input);
      setReport({
        totalRevenue: data.totalRevenue || 0,
        totalOrders: data.totalOrders || 0,
        topItems: data.topItems || [],
        paymentRows: data.paymentRows || [],
        paymentAccountRows: data.paymentAccountRows || [],
        orderTypeRows: data.orderTypeRows || [],
      });
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        toast.error(err.message || "Failed to load sales report");
      }
    } finally {
      setPageLoading(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport({ from: "", to: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(id) {
    setPreset(id);
    if (id === "custom") return;
    const dates = getPresetDates(id);
    setLoading(true);
    loadReport(dates);
  }

  function applyCustom(e) {
    e.preventDefault();
    setLoading(true);
    loadReport({ from: customFrom, to: customTo });
  }

  const avgTicket = report.totalOrders
    ? Math.round(report.totalRevenue / report.totalOrders)
    : 0;

  const topRevenue = report.topItems[0]?.revenue || 1;
  const totalItemRevenue = report.topItems.reduce((s, i) => s + (i.revenue || 0), 0) || 1;
  const periodLabel = buildPeriodLabel(preset, customFrom, customTo);

  const paymentRows = report.paymentRows || [];
  const paymentAccountRows = report.paymentAccountRows || [];
  const orderTypeRows = report.orderTypeRows || [];

  const paymentTotalsByMethod = paymentRows.reduce(
    (acc, row) => {
      const key = (row.method || "").toUpperCase();
      if (!key) return acc;
      const amount = Number(row.amount || 0);
      const orders = Number(row.orders || 0);
      if (!acc[key]) acc[key] = { amount: 0, orders: 0 };
      acc[key].amount += amount;
      acc[key].orders += orders;
      return acc;
    },
    {},
  );

  function handleExportCSV() {
    const rows = [
      ["Sales & Reports"],
      ["Period", periodLabel],
      ["Generated", new Date().toLocaleString("en-PK")],
      [],
      ["SUMMARY"],
      ["Metric", "Value"],
      ["Total Revenue", `Rs ${Number(report.totalRevenue.toFixed(0)).toLocaleString()}`],
      ["Total Orders", report.totalOrders],
      ["Avg Ticket Size", `Rs ${avgTicket.toLocaleString()}`],
      ...(paymentRows.length > 0
        ? [
            [],
            ["PAYMENT WISE SALES"],
            ["Payment Method", "Orders", "Amount (Rs)", "Percentage"],
            ...paymentRows.map((r) => [r.method, r.orders, r.amount, r.percent]),
          ]
        : []),
      ...(paymentAccountRows.length > 0
        ? [
            [],
            ["ONLINE PAYMENT ACCOUNTS"],
            ["Paid To", "Orders", "Amount (Rs)"],
            ...paymentAccountRows.map((r) => [r.accountName, r.orders, r.amount]),
          ]
        : []),
      ...(orderTypeRows.length > 0
        ? [
            [],
            ["ORDER TYPE SALES"],
            ["Order Type", "Orders", "Amount (Rs)", "Percentage"],
            ...orderTypeRows.map((r) => [r.type, r.orders, r.amount, r.percent]),
          ]
        : []),
      [],
      ["TOP SELLING ITEMS"],
      ["Rank", "Item Name", "Qty Sold", "Revenue (Rs)", "Revenue Share %"],
      ...report.topItems.map((item, i) => [
        i + 1,
        item.name,
        item.quantity ?? 0,
        Number(item.revenue?.toFixed?.(0) ?? 0),
        `${Math.round(((item.revenue || 0) / totalItemRevenue) * 100)}%`,
      ]),
    ];
    downloadCSV(`sales-report-${periodLabel.replace(/[\s/]/g, "-")}.csv`, rows);
    toast.success("CSV exported");
  }

  function handlePrint() {
    const generated = new Date().toLocaleString("en-PK");
    const itemRows = report.topItems.map((item, i) => {
      const sharePct = Math.round(((item.revenue || 0) / totalItemRevenue) * 100);
      const medals = ["🥇", "🥈", "🥉"];
      return `<tr>
        <td>${i < 3 ? medals[i] : `#${i + 1}`}</td>
        <td><strong>${item.name}</strong></td>
        <td>${item.quantity ?? 0}</td>
        <td style="font-weight:700">Rs ${Number((item.revenue || 0).toFixed(0)).toLocaleString()}</td>
        <td>${sharePct}%</td>
      </tr>`;
    }).join("");

    const paymentTable = paymentRows.length > 0
      ? `<h2>Payment Wise Sales</h2><table>
          <thead><tr><th>Method</th><th>Orders</th><th>Amount</th><th>%</th></tr></thead>
          <tbody>${paymentRows
            .map(
              (r) =>
                `<tr><td>${r.method}</td><td>${r.orders}</td><td>Rs ${r.amount?.toLocaleString?.() ?? r.amount}</td><td>${r.percent}</td></tr>`,
            )
            .join("")}</tbody>
        </table>` : "";

    const accountTable = paymentAccountRows.length > 0
      ? `<h2>Online Payment Accounts</h2><table>
          <thead><tr><th>Paid To</th><th>Orders</th><th>Amount</th></tr></thead>
          <tbody>${paymentAccountRows
            .map(
              (r) =>
                `<tr><td>${r.accountName}</td><td>${r.orders}</td><td>Rs ${r.amount?.toLocaleString?.() ?? r.amount}</td></tr>`,
            )
            .join("")}</tbody>
        </table>` : "";

    const html = `<!DOCTYPE html><html><head><title>Sales Report – ${periodLabel}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:900px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .meta{font-size:12px;color:#6b7280;margin-bottom:28px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px}
  .kpi{border:1px solid #e5e7eb;border-radius:12px;padding:16px}
  .kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px}
  .kpi-value{font-size:24px;font-weight:800;color:#111}
  h2{font-size:14px;font-weight:700;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
  h2{font-size:14px;font-weight:700;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:8px 12px;border-bottom:2px solid #e5e7eb}
  td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}
  @media print{body{padding:0}}
</style></head><body>
<h1>Sales & Reports</h1>
<p class="meta">Period: <strong>${periodLabel}</strong> &nbsp;·&nbsp; Generated: ${generated}</p>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">Rs ${Number(report.totalRevenue.toFixed(0)).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Total Orders</div><div class="kpi-value">${report.totalOrders}</div></div>
  <div class="kpi"><div class="kpi-label">Avg Ticket Size</div><div class="kpi-value">Rs ${avgTicket.toLocaleString()}</div></div>
</div>
${paymentTable}
${accountTable}
<h2>Top Selling Items</h2>
<table>
  <thead><tr><th>Rank</th><th>Item Name</th><th>Qty Sold</th><th>Revenue</th><th>Share %</th></tr></thead>
  <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af">No data for this period</td></tr>'}</tbody>
</table>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups to print."); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  return (
    <AdminLayout title="Sales & Reports" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <BarChart3 className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Loading sales report...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Filter panel ── */}
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">

            {/* Header row */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Report Period</h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                  Showing: <span className="font-semibold text-primary">{periodLabel}</span>
                  {loading && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin text-primary" />}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={loading || report.topItems.length === 0}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Export to Excel / CSV"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Print report"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  title="How does date filtering work?"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick presets */}
            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100 dark:border-neutral-800">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  disabled={loading}
                  className={`h-8 px-4 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
                    preset === p.id
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm shadow-primary/30"
                      : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date inputs — only shown when Custom is selected */}
            {preset === "custom" && (
              <form
                onSubmit={applyCustom}
                className="px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
              >
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400">From Date</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400">To Date</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || (!customFrom && !customTo)}
                  className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <RefreshCw className="w-4 h-4" />
                  }
                  Apply
                </button>
              </form>
            )}
          </div>

          {/* ── KPI cards ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 hover:shadow-xl hover:border-primary/30 transition-all overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Total Revenue</p>
                  <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                    Rs {Number(report.totalRevenue.toFixed(0)).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">from completed orders</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 hover:shadow-xl hover:border-violet-300 dark:hover:border-violet-500/30 transition-all overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Total Orders</p>
                  <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{report.totalOrders}</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">completed & delivered</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Avg. Ticket Size</p>
                  <p className="text-3xl font-extrabold text-gray-900 dark:text-white">Rs {avgTicket.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">revenue per order</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Payment breakdown ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Payment Summary</h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    How customers paid in this period
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["CASH", "CARD", "ONLINE"].map((method) => {
                  const data = paymentTotalsByMethod[method] || { amount: 0, orders: 0 };
                  const label =
                    method === "CASH" ? "Cash" : method === "CARD" ? "Card" : "Online";
                  return (
                    <div
                      key={method}
                      className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-900/60 px-3 py-3 flex flex-col justify-between"
                    >
                      <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                        {label}
                      </p>
                      <p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white">
                        Rs {Number(data.amount || 0).toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400 dark:text-neutral-500">
                        {Number(data.orders || 0).toLocaleString()} orders
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Online Payment Accounts
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Breakdown by JazzCash, bank, etc.
                  </p>
                </div>
              </div>
              {paymentAccountRows.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400 dark:text-neutral-500">
                  No online payments in this period.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs">
                  {paymentAccountRows.map((row) => (
                    <div
                      key={row.accountName}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {row.accountName}
                        </p>
                        {row.accountLabel && (
                          <p className="text-[11px] text-gray-400 dark:text-neutral-500 truncate">
                            {row.accountLabel}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">
                          Rs {Number(row.amount || 0).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                          {Number(row.orders || 0).toLocaleString()} orders
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Top selling items ── */}
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
                  <Award className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top Selling Items</h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">Best performers in selected period</p>
                </div>
              </div>
              {report.topItems.length > 0 && (
                <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
                  {report.topItems.length} items
                </span>
              )}
            </div>

            {report.topItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                  <BarChart3 className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                </div>
                <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400">No sales data for this range</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Try selecting a different period</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {report.topItems.map((item, index) => {
                  const barPct = Math.round((item.revenue / topRevenue) * 100);
                  const sharePct = Math.round((item.revenue / totalItemRevenue) * 100);
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={item.menuItemId} className="px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-7 text-center flex-shrink-0">
                          {index < 3 ? (
                            <span className="text-lg leading-none">{medals[index]}</span>
                          ) : (
                            <span className="text-xs font-bold text-gray-400 dark:text-neutral-500">#{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{item.name}</span>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                                <ShoppingBag className="w-3 h-3" />{item.quantity} sold
                              </span>
                              <span className="text-xs text-gray-400 dark:text-neutral-500 font-medium hidden sm:block">
                                {sharePct}% share
                              </span>
                              <span className="text-sm font-bold text-primary min-w-[72px] text-right">
                                Rs {item.revenue?.toFixed ? Number(item.revenue.toFixed(0)).toLocaleString() : item.revenue}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Help modal ── */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">How date filtering works</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-neutral-300">
              <p><strong>From date</strong> — includes from the <strong>start of this day</strong> (00:00).</p>
              <p>
                <strong>To date</strong> — includes up to the <strong>start of this day</strong> (00:00).
                The &quot;To&quot; date itself is not included.
              </p>
              <p className="text-gray-500 dark:text-neutral-400">
                <strong>Example:</strong> From <strong>14 Feb</strong> to <strong>15 Feb</strong> covers only
                the full day of the 14th. To include the 15th, set To to <strong>16 Feb</strong>.
              </p>
              <p className="text-gray-500 dark:text-neutral-400">
                Only <strong>completed</strong> orders count towards all metrics.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
