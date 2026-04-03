import { useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../../components/layout/AdminLayout";
import { Loader2, Printer, Download, TrendingUp, ChevronRight } from "lucide-react";
import { getStoredAuth } from "../../../../lib/apiClient";
import toast from "react-hot-toast";

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
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...buildHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split("T")[0];

function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const to   = todayStr();
  return { from, to };
}

function lastMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const to   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
  return { from, to };
}

function thisYearRange() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: todayStr() };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function exportCSV(report) {
  const rows = [["Section","Account Code","Account Name","Amount"]];
  report.revenue.forEach((a) => rows.push(["Revenue", a.code, a.name, a.net.toFixed(2)]));
  rows.push(["Revenue","","Gross Revenue", report.grossRevenue.toFixed(2)]);
  report.cogs.forEach((a) => rows.push(["COGS", a.code, a.name, a.net.toFixed(2)]));
  rows.push(["COGS","","Total COGS", report.totalCOGS.toFixed(2)]);
  rows.push(["","","Gross Profit", report.grossProfit.toFixed(2)]);
  report.expenses.forEach((a) => rows.push(["Expenses", a.code, a.name, a.net.toFixed(2)]));
  rows.push(["Expenses","","Total Expenses", report.totalExpenses.toFixed(2)]);
  rows.push(["","","Net Profit / (Loss)", report.netProfit.toFixed(2)]);

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `pl-${report.dateFrom}-${report.dateTo}.csv`; a.click();
}

function fmtAmt(n) {
  return Math.abs(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Components ───────────────────────────────────────────────────────────────

function SectionHeader({ label, color }) {
  return (
    <tr className={`${color}`}>
      <td colSpan={2} className="px-5 py-2 text-xs font-bold uppercase tracking-widest">{label}</td>
    </tr>
  );
}

function AccountRow({ account, indent = 0 }) {
  if (!account) return null;
  return (
    <tr className="border-b border-neutral-800/40 hover:bg-neutral-900/30 transition-colors">
      <td className="px-5 py-2.5 text-sm text-neutral-300" style={{ paddingLeft: `${20 + indent * 16}px` }}>
        <span className="font-mono text-[11px] text-neutral-600 mr-2">{account.code}</span>
        {account.name}
      </td>
      <td className="px-5 py-2.5 text-right text-sm tabular-nums text-neutral-400">
        {account.net > 0 ? `Rs ${fmtAmt(account.net)}` : account.net < 0 ? <span className="text-red-400">(Rs {fmtAmt(account.net)})</span> : "—"}
      </td>
    </tr>
  );
}

function SubtotalRow({ label, amount, bold = false, large = false, colorFn }) {
  const isNeg = amount < 0;
  const color = colorFn ? colorFn(amount) : (isNeg ? "text-red-400" : "text-emerald-400");
  return (
    <tr className="border-b border-neutral-700/50 bg-neutral-900/60">
      <td className={`px-5 py-2.5 text-sm ${bold ? "font-bold text-white" : "text-neutral-400 italic"} ${large ? "text-base" : ""}`}>{label}</td>
      <td className={`px-5 py-2.5 text-right tabular-nums ${color} ${bold ? "font-bold" : "font-medium"} ${large ? "text-base" : "text-sm"}`}>
        {isNeg ? "(Rs " + fmtAmt(amount) + ")" : "Rs " + fmtAmt(amount)}
      </td>
    </tr>
  );
}

function Divider() {
  return <tr><td colSpan={2} className="h-px bg-neutral-800 p-0" /></tr>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfitLossPage() {
  const now = new Date();
  const m   = thisMonthRange();

  const [mode, setMode]       = useState("thisMonth");  // thisMonth | lastMonth | thisYear | custom
  const [dateFrom, setFrom]   = useState(m.from);
  const [dateTo, setTo]       = useState(m.to);
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun]   = useState(false);

  function applyMode(m) {
    setMode(m);
    if (m === "thisMonth")  { const r = thisMonthRange(); setFrom(r.from); setTo(r.to); }
    if (m === "lastMonth")  { const r = lastMonthRange(); setFrom(r.from); setTo(r.to); }
    if (m === "thisYear")   { const r = thisYearRange();  setFrom(r.from); setTo(r.to); }
  }

  async function runReport() {
    setLoading(true); setHasRun(true);
    try {
      const data = await apiFetch(`/api/accounting/reports/profit-loss?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to run report"); setReport(null);
    } finally { setLoading(false); }
  }

  const QUICK = [
    { id: "thisMonth", label: "This Month" },
    { id: "lastMonth", label: "Last Month" },
    { id: "thisYear",  label: "This Year"  },
    { id: "custom",    label: "Custom"     },
  ];

  return (
    <AdminLayout>
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } .print-table td, .print-table th { border:1px solid #ddd; padding:6px 10px; } }`}</style>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3 no-print">
          <div>
            <h1 className="text-xl font-bold text-white">Profit & Loss Statement</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Revenue, cost of goods sold, and expenses</p>
          </div>
          {report && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => exportCSV(report)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
                <Download className="w-4 h-4" /> CSV
              </button>
              <button type="button" onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          )}
        </div>

        {/* Quick date buttons + run */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6 no-print">
          <div className="flex flex-wrap gap-2 mb-4">
            {QUICK.map((q) => (
              <button key={q.id} type="button" onClick={() => applyMode(q.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === q.id ? "bg-orange-500 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"}`}>
                {q.label}
              </button>
            ))}
          </div>

          {mode === "custom" && (
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setFrom(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">To</label>
                <input type="date" value={dateTo} onChange={(e) => setTo(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
            </div>
          )}

          <button type="button" onClick={runReport} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Generate Report
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="text-center py-16 text-neutral-500 text-sm">No data available for this period.</div>
        )}

        {!loading && report && (
          <>
            {/* Print header */}
            <div className="hidden print:block mb-6 text-center">
              <h2 className="text-xl font-bold">Profit & Loss Statement</h2>
              <p className="text-sm text-gray-600">{report.dateFrom} to {report.dateTo}</p>
            </div>

            <div className="rounded-xl border border-neutral-800 overflow-hidden print-table">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-900 border-b border-neutral-700">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Description</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-neutral-950">

                  {/* REVENUE */}
                  <SectionHeader label="Revenue" color="bg-emerald-500/10 text-emerald-400" />
                  {report.revenue.map((a) => <AccountRow key={a._id} account={a} />)}
                  <SubtotalRow label="Gross Revenue" amount={report.grossRevenue} bold
                    colorFn={(v) => v >= 0 ? "text-emerald-400" : "text-red-400"} />
                  <Divider />

                  {/* COGS */}
                  <SectionHeader label="Cost of Goods Sold" color="bg-orange-500/10 text-orange-400" />
                  {report.cogs.map((a) => <AccountRow key={a._id} account={a} />)}
                  <SubtotalRow label="Total COGS" amount={report.totalCOGS} />
                  <SubtotalRow label="GROSS PROFIT" amount={report.grossProfit} bold
                    colorFn={(v) => v >= 0 ? "text-emerald-400" : "text-red-400"} />
                  <Divider />

                  {/* EXPENSES */}
                  <SectionHeader label="Operating Expenses" color="bg-red-500/10 text-red-400" />
                  {report.expenses.filter((a) => a.net > 0).map((a) => <AccountRow key={a._id} account={a} />)}
                  <SubtotalRow label="Total Expenses" amount={report.totalExpenses} />
                  <Divider />

                  {/* NET PROFIT */}
                  <tr className={`${report.netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    <td className={`px-5 py-4 text-base font-black ${report.netProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {report.netProfit >= 0 ? "NET PROFIT" : "NET LOSS"}
                    </td>
                    <td className={`px-5 py-4 text-right text-xl font-black tabular-nums ${report.netProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {report.netProfit < 0 ? "(Rs " + fmtAmt(report.netProfit) + ")" : "Rs " + fmtAmt(report.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 no-print">
              {[
                { label: "Gross Revenue",  value: report.grossRevenue,  color: "text-emerald-400" },
                { label: "Total COGS",     value: report.totalCOGS,     color: "text-orange-400" },
                { label: "Total Expenses", value: report.totalExpenses,  color: "text-red-400" },
                { label: "Net Profit",     value: report.netProfit,      color: report.netProfit >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map((c) => (
                <div key={c.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">{c.label}</p>
                  <p className={`text-sm font-bold tabular-nums ${c.color}`}>
                    {c.value < 0 ? "(Rs " + fmtAmt(c.value) + ")" : "Rs " + fmtAmt(c.value)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
