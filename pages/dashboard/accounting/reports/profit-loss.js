import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
  Loader2,
  Printer,
  Download,
  TrendingUp,
  BookOpen,
  ChevronDown,
  RefreshCw,
  LineChart,
  FileSearch,
  PiggyBank,
  Wallet,
  Receipt,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import ReportsNav from "../../../../components/accounting/ReportsNav";
import { localToday, localISODate, fmtMoneyPK } from "../../../../lib/accountingFormat";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function buildHeaders() {
  const auth = getStoredAuth();
  const h = { "Content-Type": "application/json" };
  if (auth?.token) h["Authorization"] = `Bearer ${auth.token}`;
  const slug = auth?.user?.tenantSlug || auth?.tenantSlug;
  if (slug) h["x-tenant-slug"] = slug;
  return h;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...buildHeaders(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function thisMonthRange() {
  const now = new Date();
  const from = localISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = localToday();
  return { from, to };
}

function lastMonthRange() {
  const now = new Date();
  const from = localISODate(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
  );
  const to = localISODate(new Date(now.getFullYear(), now.getMonth(), 0));
  return { from, to };
}

function thisYearRange() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: localToday() };
}

function fmtDisplayRange(fromIso, toIso) {
  const fmt = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("T")[0].split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };
  return `${fmt(fromIso)} → ${fmt(toIso)}`;
}

const dateInputCls =
  "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors";

function exportCSV(report) {
  const rows = [["Section", "Account Code", "Account Name", "Amount"]];
  report.revenue.forEach((a) =>
    rows.push(["Revenue", a.code, a.name, a.net.toFixed(2)]),
  );
  rows.push(["Revenue", "", "Gross Revenue", report.grossRevenue.toFixed(2)]);
  report.cogs.forEach((a) =>
    rows.push(["COGS", a.code, a.name, a.net.toFixed(2)]),
  );
  rows.push(["COGS", "", "Total COGS", report.totalCOGS.toFixed(2)]);
  rows.push(["", "", "Gross Profit", report.grossProfit.toFixed(2)]);
  report.expenses.forEach((a) =>
    rows.push(["Expenses", a.code, a.name, a.net.toFixed(2)]),
  );
  rows.push([
    "Expenses",
    "",
    "Total Expenses",
    report.totalExpenses.toFixed(2),
  ]);
  rows.push(["", "", "Net Profit / (Loss)", report.netProfit.toFixed(2)]);

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pl-${report.dateFrom}-${report.dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function fmtAmt(n) {
  return fmtMoneyPK(n);
}

function SectionHeader({ label, color }) {
  return (
    <tr className={color}>
      <td
        colSpan={2}
        className="px-4 sm:px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest"
      >
        {label}
      </td>
    </tr>
  );
}

function AccountRow({ account, indent = 0 }) {
  if (!account) return null;
  const sym = getCurrencySymbol();
  return (
    <tr className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50/80 dark:hover:bg-neutral-900/40 transition-colors">
      <td
        className="px-4 sm:px-5 py-2.5 text-sm text-gray-800 dark:text-neutral-200"
        style={{ paddingLeft: `${16 + indent * 14}px` }}
      >
        <span className="font-mono text-[11px] text-gray-400 dark:text-neutral-500 mr-2 tabular-nums">
          {account.code}
        </span>
        {account.name}
      </td>
      <td className="px-4 sm:px-5 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-neutral-400">
        {account.net > 0 ? (
          `${sym} ${fmtAmt(account.net)}`
        ) : account.net < 0 ? (
          <span className="text-red-600 dark:text-red-400">
            ({sym} {fmtAmt(account.net)})
          </span>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function SubtotalRow({ label, amount, bold = false, large = false, colorFn }) {
  const sym = getCurrencySymbol();
  const isNeg = amount < 0;
  const color = colorFn
    ? colorFn(amount)
    : isNeg
      ? "text-red-600 dark:text-red-400"
      : "text-emerald-600 dark:text-emerald-400";
  return (
    <tr className="border-b border-gray-200 dark:border-neutral-700/60 bg-gray-50/90 dark:bg-neutral-900/65">
      <td
        className={`px-4 sm:px-5 py-2.5 text-sm ${bold ? "font-bold text-gray-900 dark:text-white" : "text-gray-600 dark:text-neutral-400"} ${large ? "text-base" : ""}`}
      >
        {label}
      </td>
      <td
        className={`px-4 sm:px-5 py-2.5 text-right tabular-nums ${color} ${bold ? "font-bold" : "font-semibold"} ${large ? "text-base" : "text-sm"}`}
      >
        {isNeg ? `(${sym} ${fmtAmt(amount)})` : `${sym} ${fmtAmt(amount)}`}
      </td>
    </tr>
  );
}

function Divider() {
  return (
    <tr>
      <td colSpan={2} className="h-px bg-gray-200 dark:bg-neutral-800 p-0" />
    </tr>
  );
}

function KpiStrip({ report, sym }) {
  const cards = useMemo(
    () => [
      {
        label: "Gross revenue",
        value: report.grossRevenue,
        icon: Receipt,
        iconClass: "text-emerald-600 dark:text-emerald-400",
        valueClass: "text-emerald-600 dark:text-emerald-400",
      },
      {
        label: "Total COGS",
        value: report.totalCOGS,
        icon: Wallet,
        iconClass: "text-orange-600 dark:text-orange-400",
        valueClass: "text-orange-600 dark:text-orange-400",
      },
      {
        label: "Total expenses",
        value: report.totalExpenses,
        icon: PiggyBank,
        iconClass: "text-red-600 dark:text-red-400",
        valueClass: "text-red-600 dark:text-red-400",
      },
      {
        label: "Net result",
        value: report.netProfit,
        icon: TrendingUp,
        iconClass:
          report.netProfit >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        valueClass:
          report.netProfit >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
      },
    ],
    [report],
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 bg-white dark:bg-neutral-950"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 dark:text-neutral-500">
              {c.label}
            </span>
            <c.icon className={`w-3.5 h-3.5 ${c.iconClass}`} />
          </div>
          <p className={`text-base font-semibold tabular-nums ${c.valueClass}`}>
            {c.value < 0
              ? `(${sym} ${fmtAmt(c.value)})`
              : `${sym} ${fmtAmt(c.value)}`}
          </p>
        </div>
      ))}
    </div>
  );
}

const QUICK = [
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
  { id: "custom", label: "Custom" },
];

export default function ProfitLossPage() {
  const sym = getCurrencySymbol();
  const m = thisMonthRange();

  const [mode, setMode] = useState("thisMonth");
  const [dateFrom, setFrom] = useState(m.from);
  const [dateTo, setTo] = useState(m.to);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  function applyMode(next) {
    setMode(next);
    if (next === "thisMonth") {
      const r = thisMonthRange();
      setFrom(r.from);
      setTo(r.to);
    }
    if (next === "lastMonth") {
      const r = lastMonthRange();
      setFrom(r.from);
      setTo(r.to);
    }
    if (next === "thisYear") {
      const r = thisYearRange();
      setFrom(r.from);
      setTo(r.to);
    }
  }

  const runReport = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const data = await apiFetch(
        `/api/accounting/reports/profit-loss?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to run report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  function resetFilters() {
    const r = thisMonthRange();
    setMode("thisMonth");
    setFrom(r.from);
    setTo(r.to);
    setReport(null);
    setHasRun(false);
  }

  useEffect(() => {
    if (!exportOpen) return;
    function handleDown(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [exportOpen]);

  function handleExportCSV() {
    if (!report) {
      toast.error("Generate a report first");
      return;
    }
    exportCSV(report);
    setExportOpen(false);
  }

  function handleExportPrint() {
    setExportOpen(false);
    window.print();
  }

  return (
    <AdminLayout title="P&L Statement">
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } .print-table td, .print-table th { border:1px solid #ddd; padding:6px 10px; } }`}</style>
      <div className="space-y-4">
        <ReportsNav />
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <LineChart className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Revenue, cost of sales, and expenses for a period — from your chart
            of accounts. Pick a preset range or custom dates, then generate.
            Export CSV or print like other accounting reports.
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Report parameters
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">
              Accrual P&amp;L
            </span>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-2 tracking-wide uppercase">
                Period
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => applyMode(q.id)}
                    className={`h-9 px-3 rounded-xl text-xs font-semibold transition-colors border ${
                      mode === q.id
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20"
                        : "bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-neutral-700 hover:border-orange-300 dark:hover:border-orange-500/40 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                    Date from
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setFrom(e.target.value)}
                    className={`w-full ${dateInputCls}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                    Date to
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setTo(e.target.value)}
                    className={`w-full ${dateInputCls}`}
                  />
                </div>
              </div>
            )}

            {mode !== "custom" && (
              <p className="text-xs text-gray-500 dark:text-neutral-500">
                {fmtDisplayRange(dateFrom, dateTo)}
              </p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 rounded-b-2xl flex flex-wrap items-center justify-end gap-2 overflow-visible relative z-10">
            <button
              type="button"
              onClick={() => hasRun && runReport()}
              disabled={loading || !hasRun}
              title="Refresh with current range"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-orange-500 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={runReport}
              disabled={loading}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BookOpen className="w-4 h-4" />
              )}
              Run Report
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Reset
            </button>
            <div className="relative z-50" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                disabled={!report}
                className="flex items-center gap-2 h-9 pl-3 pr-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                Export
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${exportOpen ? "rotate-180" : ""}`}
                />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl z-[200] overflow-hidden ring-1 ring-black/5 dark:ring-white/10 py-1">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPrint}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    <Printer className="w-4 h-4 text-gray-400" />
                    Print
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Running P&amp;L…
            </p>
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              No data for this period
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              Try another range or check that accounts are posted for{" "}
              {fmtDisplayRange(dateFrom, dateTo)}.
            </p>
          </div>
        )}

        {!loading && report && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Statement
              </h2>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                {fmtDisplayRange(report.dateFrom, report.dateTo)}
              </p>
            </div>

            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-neutral-800 no-print">
              <KpiStrip report={report} sym={sym} />
            </div>

            <div className="hidden print:block mb-4 text-center px-4">
              <h2 className="text-lg font-bold">Profit &amp; loss statement</h2>
              <p className="text-sm text-gray-600">
                {report.dateFrom} to {report.dateTo}
              </p>
            </div>

            <div className="overflow-x-auto print-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-950">
                  <SectionHeader
                    label="Revenue"
                    color="bg-emerald-100/80 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  />
                  {report.revenue.map((a) => (
                    <AccountRow key={a._id} account={a} />
                  ))}
                  <SubtotalRow
                    label="Gross revenue"
                    amount={report.grossRevenue}
                    bold
                    colorFn={(v) =>
                      v >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  />
                  <Divider />

                  <SectionHeader
                    label="Cost of goods sold"
                    color="bg-orange-100/80 dark:bg-orange-500/10 text-orange-800 dark:text-orange-300"
                  />
                  {report.cogs.map((a) => (
                    <AccountRow key={a._id} account={a} />
                  ))}
                  <SubtotalRow label="Total COGS" amount={report.totalCOGS} />
                  <SubtotalRow
                    label="Gross profit"
                    amount={report.grossProfit}
                    bold
                    colorFn={(v) =>
                      v >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }
                  />
                  <Divider />

                  <SectionHeader
                    label="Operating expenses"
                    color="bg-red-100/80 dark:bg-red-500/10 text-red-800 dark:text-red-300"
                  />
                  {report.expenses
                    .filter((a) => a.net > 0)
                    .map((a) => (
                      <AccountRow key={a._id} account={a} />
                    ))}
                  <SubtotalRow
                    label="Total expenses"
                    amount={report.totalExpenses}
                  />
                  <Divider />

                  <tr
                    className={`${report.netProfit >= 0 ? "bg-emerald-100/50 dark:bg-emerald-500/15" : "bg-red-100/50 dark:bg-red-500/15"}`}
                  >
                    <td
                      className={`px-4 sm:px-5 py-4 text-sm font-bold ${report.netProfit >= 0 ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}
                    >
                      {report.netProfit >= 0 ? "Net profit" : "Net loss"}
                    </td>
                    <td
                      className={`px-4 sm:px-5 py-4 text-right text-lg font-bold tabular-nums ${report.netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
                    >
                      {report.netProfit < 0
                        ? `(${sym} ${fmtAmt(report.netProfit)})`
                        : `${sym} ${fmtAmt(report.netProfit)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
