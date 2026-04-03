import { useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import { Loader2, Printer, Download, CheckCircle, AlertCircle, BarChart3 } from "lucide-react";
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

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmt(n) {
  if (!n && n !== 0) return "—";
  const v = Math.abs(n);
  const s = v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? `(${s})` : s;
}

function exportCSV(report, year, month) {
  const rows = [["Section","Sub-section","Code","Description","Till Prev Month","Till Curr Month","Curr Month"]];

  function push(section, sub, a) {
    rows.push([section, sub, a.code || "", a.name || a.label || "", fmt(a.prev), fmt(a.curr), fmt(a.month)]);
  }

  report.assets.current.forEach((a)    => push("Assets", "Current",     a));
  push("Assets","Current Total", { code:"", name:"Current Assets Total", prev: report.assets.totals.prev, curr: report.assets.totals.curr, month: report.assets.totals.month });
  report.assets.nonCurrent.forEach((a) => push("Assets", "Non-Current", a));
  push("Assets","Non-Current Total", { code:"", name:"Non-Current Assets Total", prev: 0, curr: 0, month: 0 });

  report.capital.accounts.forEach((a)  => push("Capital","",            a));
  push("Capital","Total", { code:"", name:"Capital Total", prev: report.capital.totals.prev, curr: report.capital.totals.curr, month: report.capital.totals.month });

  report.liabilities.current.forEach((a) => push("Liabilities","Current", a));
  push("Liabilities","Total", { code:"", name:"Liabilities Total", prev: report.liabilities.totals.prev, curr: report.liabilities.totals.curr, month: report.liabilities.totals.month });

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `balance-sheet-${year}-${String(month).padStart(2,"0")}.csv`; a.click();
}

// ─── Table primitives ─────────────────────────────────────────────────────────

function SectionHeaderRow({ label, colSpan = 5, color }) {
  return (
    <tr className={`${color}`}>
      <td colSpan={colSpan} className="px-3 py-2 text-xs font-black uppercase tracking-widest">{label}</td>
    </tr>
  );
}

function SubHeaderRow({ label }) {
  return (
    <tr className="bg-neutral-800/60">
      <td colSpan={5} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400 italic">{label}</td>
    </tr>
  );
}

function AccountRow({ code, name, prev, curr, month, bold = false, italic = false }) {
  const base = `text-sm ${bold ? "font-bold text-white" : "text-neutral-300"} ${italic ? "italic" : ""}`;
  return (
    <tr className="border-b border-neutral-800/40 hover:bg-neutral-900/30 transition-colors">
      <td className="px-4 py-2 font-mono text-[11px] text-neutral-600 w-20">{code}</td>
      <td className={`px-4 py-2 ${base}`}>{name}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${bold ? "font-bold text-white" : "text-neutral-400"}`}>{fmt(prev)}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${bold ? "font-bold text-white" : "text-neutral-400"}`}>{fmt(curr)}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${bold ? "font-bold text-white" : "text-neutral-400"}`}>{fmt(month)}</td>
    </tr>
  );
}

function TotalRow({ label, prev, curr, month, large = false }) {
  return (
    <tr className="bg-neutral-900/80 border-b border-neutral-700">
      <td className="px-4 py-2.5 w-20" />
      <td className={`px-4 py-2.5 font-bold italic ${large ? "text-white text-base" : "text-neutral-300 text-sm"}`}>{label}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${large ? "text-white text-base" : "text-neutral-300"}`}>{fmt(prev)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${large ? "text-white text-base" : "text-neutral-300"}`}>{fmt(curr)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${large ? "text-white text-base" : "text-neutral-300"}`}>{fmt(month)}</td>
    </tr>
  );
}

function Spacer() {
  return <tr className="h-2 bg-neutral-950"><td colSpan={5} /></tr>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BalanceSheetPage() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun]   = useState(false);

  async function generate() {
    setLoading(true); setHasRun(true);
    try {
      const data = await apiFetch(`/api/accounting/reports/balance-sheet?year=${year}&month=${month}`);
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to generate balance sheet"); setReport(null);
    } finally { setLoading(false); }
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
    <AdminLayout>
      <style>{`
        @media print {
          .no-print { display:none !important; }
          @page { size: landscape; margin: 12mm; }
          body { background:white; color:#111; font-size:11px; }
          .bs-table td, .bs-table th { border: 1px solid #ccc; padding: 4px 8px; }
          .bs-table { border-collapse: collapse; width: 100%; }
        }
      `}</style>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3 no-print">
          <div>
            <h1 className="text-xl font-bold text-white">Balance Sheet</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Assets, capital, and liabilities at month end</p>
          </div>
          {report && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => exportCSV(report, year, month)}
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

        {/* Controls */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6 no-print">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                {Array.from({ length: 8 }, (_, i) => 2024 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Month</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <button type="button" onClick={generate} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              Generate
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="text-center py-16 text-neutral-500 text-sm">No data available.</div>
        )}

        {!loading && report && (
          <>
            {/* Title block */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">BALANCE SHEET</h2>
              </div>
              <div className="text-right text-xs text-neutral-500">
                <p>FROM: {report.period.from}</p>
                <p>TO: {report.period.to}</p>
              </div>
            </div>

            {/* Balance check */}
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl mb-4 no-print ${report.balanceCheck.isBalanced ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
              {report.balanceCheck.isBalanced
                ? <><CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span className="text-sm font-medium text-emerald-300">Balanced — Assets equal Capital + Liabilities</span></>
                : <><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><span className="text-sm font-medium text-red-300">Out of balance by Rs {Math.abs(report.balanceCheck.difference).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></>
              }
            </div>

            <div className="rounded-xl border border-neutral-800 overflow-hidden overflow-x-auto bs-table">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-neutral-900 border-b border-neutral-700">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-wider w-20">Code</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Account Description</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-neutral-500 uppercase tracking-wider w-32">Till Prev Month</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-neutral-500 uppercase tracking-wider w-32">Till Curr Month</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-neutral-500 uppercase tracking-wider w-32">Current Month</th>
                  </tr>
                </thead>
                <tbody className="bg-neutral-950 divide-y divide-neutral-800/30">

                  {/* ─── ASSETS ─────────────────────────────────────────── */}
                  <SectionHeaderRow label="Assets" color="bg-blue-500/10 text-blue-300" />
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

                  <TotalRow label="ASSETS TOTAL" prev={report.assets.totals.prev} curr={report.assets.totals.curr} month={report.assets.totals.month} large />
                  <Spacer />

                  {/* ─── CAPITAL ─────────────────────────────────────────── */}
                  <SectionHeaderRow label="Capital" color="bg-purple-500/10 text-purple-300" />
                  {report.capital.accounts.map((a) => (
                    <AccountRow key={a._id} code={a.code} name={a.name} prev={a.prev} curr={a.curr} month={a.month} />
                  ))}
                  <TotalRow label="Capital Total" prev={report.capital.totals.prev} curr={report.capital.totals.curr} month={report.capital.totals.month} large />
                  <Spacer />

                  {/* ─── LIABILITIES ─────────────────────────────────────── */}
                  <SectionHeaderRow label="Liabilities" color="bg-orange-500/10 text-orange-300" />
                  <SubHeaderRow label="Current Liabilities" />
                  {report.liabilities.current.map((a) => (
                    <AccountRow key={a._id} code={a.code} name={a.name} prev={a.prev} curr={a.curr} month={a.month} />
                  ))}
                  <TotalRow label="Current Liabilities Total" prev={report.liabilities.totals.prev} curr={report.liabilities.totals.curr} month={report.liabilities.totals.month} />
                  <TotalRow label="LIABILITIES TOTAL" prev={report.liabilities.totals.prev} curr={report.liabilities.totals.curr} month={report.liabilities.totals.month} large />
                  <Spacer />

                  {/* Balance difference */}
                  <tr className={`${report.balanceCheck.isBalanced ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                    <td className="px-4 py-3 w-20" />
                    <td colSpan={3} className={`px-4 py-3 text-sm font-bold ${report.balanceCheck.isBalanced ? "text-emerald-400" : "text-red-400"}`}>
                      {report.balanceCheck.isBalanced ? "✓ Balanced" : `⚠ Out of balance by Rs ${Math.abs(report.balanceCheck.difference).toLocaleString()}`}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${report.balanceCheck.isBalanced ? "text-emerald-400" : "text-red-400"}`}>
                      {fmt(report.balanceCheck.difference)}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
