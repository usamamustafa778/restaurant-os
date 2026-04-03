import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
  Loader2, Printer, Download, CheckCircle, AlertCircle,
  BarChart3, ChevronDown, FileSearch, Scale,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import { fmtMoneyPK } from "../../../../lib/accountingFormat";
import ReportsNav from "../../../../components/accounting/ReportsNav";

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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const selectCls =
  "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer";

function fmt(n) {
  if (!n && n !== 0) return "—";
  const v = Math.abs(n);
  const s = fmtMoneyPK(v);
  return n < 0 ? `(${s})` : s;
}

function exportCSV(report, year, month) {
  const rows = [["Section", "Sub-section", "Code", "Description", "Till Prev Month", "Till Curr Month", "Curr Month"]];

  function push(section, sub, a) {
    rows.push([section, sub, a.code || "", a.name || a.label || "", fmt(a.prev), fmt(a.curr), fmt(a.month)]);
  }

  report.assets.current.forEach((a)    => push("Assets", "Current",     a));
  push("Assets", "Current Total",     { code: "", name: "Current Assets Total",     prev: report.assets.totals.prev,      curr: report.assets.totals.curr,      month: report.assets.totals.month });
  report.assets.nonCurrent.forEach((a) => push("Assets", "Non-Current", a));
  push("Assets", "Non-Current Total", { code: "", name: "Non-Current Assets Total", prev: 0,                               curr: 0,                               month: 0 });
  report.capital.accounts.forEach((a)  => push("Capital", "",           a));
  push("Capital", "Total",            { code: "", name: "Capital Total",             prev: report.capital.totals.prev,     curr: report.capital.totals.curr,     month: report.capital.totals.month });
  report.liabilities.current.forEach((a) => push("Liabilities", "Current", a));
  push("Liabilities", "Total",        { code: "", name: "Liabilities Total",         prev: report.liabilities.totals.prev, curr: report.liabilities.totals.curr, month: report.liabilities.totals.month });

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `balance-sheet-${year}-${String(month).padStart(2, "0")}.csv`;
  a.click();
}

// ─── Table primitives ─────────────────────────────────────────────────────────

function SectionHeaderRow({ label, colSpan = 5, color }) {
  return (
    <tr className={color}>
      <td colSpan={colSpan} className="px-4 py-2 text-xs font-black uppercase tracking-widest">{label}</td>
    </tr>
  );
}

function SubHeaderRow({ label }) {
  return (
    <tr className="bg-gray-100/60 dark:bg-neutral-800/60">
      <td colSpan={5} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-400 italic">{label}</td>
    </tr>
  );
}

function AccountRow({ code, name, prev, curr, month, bold = false, italic = false }) {
  const base = `text-sm ${bold ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-neutral-300"} ${italic ? "italic" : ""}`;
  return (
    <tr className="border-b border-gray-100 dark:border-neutral-800/40 hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors">
      <td className="px-4 py-2 font-mono text-[11px] text-gray-400 dark:text-neutral-600 w-20">{code}</td>
      <td className={`px-4 py-2 ${base}`}>{name}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${bold ? "font-bold text-gray-900 dark:text-white" : "text-gray-500 dark:text-neutral-400"}`}>{fmt(prev)}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${bold ? "font-bold text-gray-900 dark:text-white" : "text-gray-500 dark:text-neutral-400"}`}>{fmt(curr)}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${bold ? "font-bold text-gray-900 dark:text-white" : "text-gray-500 dark:text-neutral-400"}`}>{fmt(month)}</td>
    </tr>
  );
}

function TotalRow({ label, prev, curr, month, large = false }) {
  return (
    <tr className="bg-gray-50 dark:bg-neutral-900/80 border-b border-gray-200 dark:border-neutral-700">
      <td className="px-4 py-2.5 w-20" />
      <td className={`px-4 py-2.5 font-bold italic ${large ? "text-gray-900 dark:text-white text-base" : "text-gray-700 dark:text-neutral-300 text-sm"}`}>{label}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${large ? "text-gray-900 dark:text-white text-base" : "text-gray-700 dark:text-neutral-300"}`}>{fmt(prev)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${large ? "text-gray-900 dark:text-white text-base" : "text-gray-700 dark:text-neutral-300"}`}>{fmt(curr)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${large ? "text-gray-900 dark:text-white text-base" : "text-gray-700 dark:text-neutral-300"}`}>{fmt(month)}</td>
    </tr>
  );
}

function Spacer() {
  return <tr className="h-2 bg-gray-50 dark:bg-neutral-950"><td colSpan={5} /></tr>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BalanceSheetPage() {
  const sym = getCurrencySymbol();
  const now = new Date();
  const [year,  setYear]      = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun]   = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  async function generate() {
    setLoading(true); setHasRun(true);
    try {
      const data = await apiFetch(`/api/accounting/reports/balance-sheet?year=${year}&month=${month}`);
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to generate balance sheet"); setReport(null);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!exportOpen) return;
    function handler(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  function handleExportCSV() {
    if (!report) { toast.error("Run the report first"); return; }
    exportCSV(report, year, month);
    setExportOpen(false);
  }

  function handleExportPrint() {
    setExportOpen(false);
    window.print();
  }

  const nonCurrTotals = report ? {
    prev:  report.assets.nonCurrent.reduce((s, a) => s + a.prev,  0),
    curr:  report.assets.nonCurrent.reduce((s, a) => s + a.curr,  0),
    month: report.assets.nonCurrent.reduce((s, a) => s + a.month, 0),
  } : null;

  const currAssetTotals = report ? {
    prev:  report.assets.current.reduce((s, a) => s + a.prev,  0),
    curr:  report.assets.current.reduce((s, a) => s + a.curr,  0),
    month: report.assets.current.reduce((s, a) => s + a.month, 0),
  } : null;

  return (
    <AdminLayout title="Balance Sheet">
      <style>{`
        @media print {
          .no-print { display:none !important; }
          @page { size: landscape; margin: 12mm; }
          body { background:white; color:#111; font-size:11px; }
          .bs-table td, .bs-table th { border: 1px solid #ccc; padding: 4px 8px; }
          .bs-table { border-collapse: collapse; width: 100%; }
        }
      `}</style>
      <div className="space-y-4">
        <ReportsNav />

        {/* Intro */}
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <Scale className="w-4 h-4 text-gray-500 dark:text-neutral-400 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Assets, capital, and liabilities at a month-end snapshot — current vs. prior month plus movement.
            Pick a year and month, then run the report. Export CSV or print in landscape.
          </p>
        </div>

        {/* Parameters */}
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Report parameters</h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">Month-end snapshot</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">Year</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`w-full ${selectCls}`}>
                  {Array.from({ length: 8 }, (_, i) => 2024 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">Month</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`w-full ${selectCls}`}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 rounded-b-2xl flex flex-wrap items-center justify-end gap-2 overflow-visible relative z-10">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              Run Report
            </button>
            <div className="relative z-50" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                disabled={!report}
                className="flex items-center gap-2 h-9 pl-3 pr-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                Export
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl z-[200] overflow-hidden ring-1 ring-black/5 dark:ring-white/10 py-1">
                  <button type="button" onClick={handleExportCSV}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <Download className="w-4 h-4 text-gray-400" /> Download CSV
                  </button>
                  <button type="button" onClick={handleExportPrint}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <Printer className="w-4 h-4 text-gray-400" /> Print
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500 dark:text-neutral-400">Generating balance sheet…</p>
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">No data available</p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              No accounting data found for {MONTHS[month - 1]} {year}. Ensure accounts are posted for this period.
            </p>
          </div>
        )}

        {!loading && report && (
          <>
            {/* Balance check banner */}
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl no-print ${report.balanceCheck.isBalanced ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
              {report.balanceCheck.isBalanced
                ? <><CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" /><span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Balance sheet is balanced</span></>
                : <><AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" /><span className="text-sm font-medium text-red-700 dark:text-red-300">Out of balance by {sym} {fmtMoneyPK(report.balanceCheck.difference)}</span></>
              }
            </div>

            {/* Table card */}
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white">Balance Sheet</h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                    {MONTHS[month - 1]} {year}
                    <span className="text-gray-400 dark:text-neutral-600"> · {report.period.from} → {report.period.to}</span>
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-0.5 flex-shrink-0 ${report.balanceCheck.isBalanced ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-500/20" : "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-500/20"}`}>
                  {report.balanceCheck.isBalanced ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {report.balanceCheck.isBalanced ? "Balanced" : "Unbalanced"}
                </span>
              </div>

              <div className="overflow-x-auto bs-table">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider w-20">Code</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Account</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider w-36">Till Prev Month</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider w-36">Till Curr Month</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider w-36">Current Month</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950 divide-y divide-gray-50 dark:divide-neutral-800/30">

                    {/* ─── ASSETS ─────────────────────────────────────── */}
                    <SectionHeaderRow label="Assets" color="bg-blue-500/10 text-blue-700 dark:text-blue-300" />
                    <SubHeaderRow label="Current Assets" />
                    {report.assets.current.map((a) => (
                      <AccountRow key={a._id} code={a.code} name={a.name} prev={a.prev} curr={a.curr} month={a.month} />
                    ))}
                    <TotalRow label="Current Assets Total" prev={currAssetTotals.prev} curr={currAssetTotals.curr} month={currAssetTotals.month} />

                    <SubHeaderRow label="Non-Current Assets" />
                    {report.assets.nonCurrent.map((a) => (
                      <AccountRow key={a._id} code={a.code} name={a.name} prev={a.prev} curr={a.curr} month={a.month} />
                    ))}
                    <TotalRow label="Non-Current Assets Total" prev={nonCurrTotals.prev} curr={nonCurrTotals.curr} month={nonCurrTotals.month} />
                    <TotalRow label="Assets Total" prev={report.assets.totals.prev} curr={report.assets.totals.curr} month={report.assets.totals.month} large />
                    <Spacer />

                    {/* ─── CAPITAL ────────────────────────────────────── */}
                    <SectionHeaderRow label="Capital" color="bg-violet-500/10 text-violet-700 dark:text-violet-300" />
                    {report.capital.accounts.map((a) => (
                      <AccountRow key={a._id} code={a.code} name={a.name} prev={a.prev} curr={a.curr} month={a.month} />
                    ))}
                    <TotalRow label="Capital Total" prev={report.capital.totals.prev} curr={report.capital.totals.curr} month={report.capital.totals.month} large />
                    <Spacer />

                    {/* ─── LIABILITIES ────────────────────────────────── */}
                    <SectionHeaderRow label="Liabilities" color="bg-orange-500/10 text-orange-700 dark:text-orange-300" />
                    <SubHeaderRow label="Current Liabilities" />
                    {report.liabilities.current.map((a) => (
                      <AccountRow key={a._id} code={a.code} name={a.name} prev={a.prev} curr={a.curr} month={a.month} />
                    ))}
                    <TotalRow label="Current Liabilities Total" prev={report.liabilities.totals.prev} curr={report.liabilities.totals.curr} month={report.liabilities.totals.month} />
                    <TotalRow label="Liabilities Total" prev={report.liabilities.totals.prev} curr={report.liabilities.totals.curr} month={report.liabilities.totals.month} large />
                    <Spacer />

                    {/* Balance row */}
                    <tr className={report.balanceCheck.isBalanced ? "bg-emerald-500/5" : "bg-red-500/5"}>
                      <td className="px-4 py-3 w-20" />
                      <td colSpan={3} className={`px-4 py-3 text-sm font-bold ${report.balanceCheck.isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {report.balanceCheck.isBalanced ? "✓ Balance sheet is balanced" : `⚠ Out of balance by ${sym} ${fmtMoneyPK(report.balanceCheck.difference)}`}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${report.balanceCheck.isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {fmt(report.balanceCheck.difference)}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
