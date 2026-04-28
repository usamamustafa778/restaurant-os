import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
  ArrowDownToLine,
  BookOpen,
  ChevronDown,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import {
  localToday,
  localISODate,
  fmtMoneyPK,
  fmtDateHuman,
  fmtDateRangeHuman,
} from "../../../../lib/accountingFormat";
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
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...buildHeaders(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function thisMonthRange() {
  const now = new Date();
  return {
    from: localISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localToday(),
  };
}
function lastMonthRange() {
  const now = new Date();
  return {
    from: localISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: localISODate(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}
function thisYearRange() {
  return { from: `${new Date().getFullYear()}-01-01`, to: localToday() };
}
function pkFiscalRange() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${startYear}-07-01`, to: localToday() };
}

// ── Formatting ────────────────────────────────────────────────────────────────
function fmtCell(n) {
  if (n === 0 || n === null || n === undefined) return "";
  return fmtMoneyPK(n);
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(report) {
  const cols = [
    "Code",
    "Party Description",
    "O. Receivable",
    "Activity",
    "Cash Rec",
    "Bank Rec",
    "Receivable",
  ];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [cols.map(q).join(",")];

  report.customers.forEach((c) => {
    rows.push(
      [
        c.code,
        c.name,
        c.openingRec  || "",
        c.activity    || "",
        c.cashRec     || "",
        c.bankRec     || "",
        c.receivable  || "",
      ]
        .map(q)
        .join(","),
    );
  });

  const t = report.totals;
  rows.push(
    ["", "TOTAL", t.openingRec || "", t.activity || "", t.cashRec || "", t.bankRec || "", t.receivable || ""]
      .map(q)
      .join(","),
  );

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `receivables-${report.dateFrom}-${report.dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Shared style constants ────────────────────────────────────────────────────
const DATE_CLS =
  "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors";

const TH_CLS =
  "px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 whitespace-nowrap";

const QUICK_MODES = [
  { id: "pkFiscal",  label: "Financial Year" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisYear",  label: "This Year" },
  { id: "allTime",   label: "All Time" },
  { id: "custom",    label: "Custom" },
];

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: #111 !important; font-size: 10px; }
  .ra-print-table th, .ra-print-table td {
    border: 1px solid #bbb; padding: 4px 7px; font-size: 9.5px;
  }
  .ra-print-table th { background: #e0e0e0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ra-print-totals td { background: #ebebeb !important; border-top: 2px solid #888; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 landscape; margin: 1.2cm; }
}
`;

// ── Amount cell ───────────────────────────────────────────────────────────────
function AmtTD({ value, bold = false, accent = false }) {
  const n = value ?? 0;
  const neg = n < 0;
  const display = n === 0 ? "" : neg ? `(${fmtMoneyPK(Math.abs(n))})` : fmtMoneyPK(n);

  if (!display) return <td className="px-3 py-2 text-right tabular-nums font-mono text-[11.5px]" />;

  return (
    <td
      className={`px-3 py-2 text-right tabular-nums font-mono text-[11.5px] whitespace-nowrap ${
        neg
          ? "text-red-600 dark:text-red-400"
          : accent
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-gray-700 dark:text-neutral-300"
      } ${bold ? "font-bold" : ""}`}
    >
      {display}
    </td>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReceivablesPage() {
  const sym = getCurrencySymbol();
  const router = useRouter();

  const def = pkFiscalRange();
  const [mode, setMode] = useState("pkFiscal");
  const [dateFrom, setFrom] = useState(def.from);
  const [dateTo, setTo] = useState(def.to);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  function applyMode(next) {
    setMode(next);
    const map = {
      pkFiscal:  pkFiscalRange(),
      thisMonth: thisMonthRange(),
      lastMonth: lastMonthRange(),
      thisYear:  thisYearRange(),
      allTime:   { from: "2000-01-01", to: localToday() },
    };
    if (map[next]) { setFrom(map[next].from); setTo(map[next].to); }
  }

  const runReport = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const data = await apiFetch(
        `/api/accounting/reports/receivables?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to load receivables");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  function resetFilters() {
    const r = pkFiscalRange();
    setMode("pkFiscal");
    setFrom(r.from);
    setTo(r.to);
    setReport(null);
    setHasRun(false);
  }

  useEffect(() => {
    if (!exportOpen) return;
    const handle = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target))
        setExportOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [exportOpen]);

  const customers = report?.customers || [];
  const totals    = report?.totals    || {};

  return (
    <AdminLayout title="Receivables — Party Analysis">
      <style>{PRINT_CSS}</style>
      <div className="space-y-4">
        <ReportsNav />

        {/* Info banner */}
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <ArrowDownToLine className="w-4 h-4 text-gray-500 dark:text-neutral-400 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Party Receivable Analysis — opening balance, new activity, cash &
            bank receipts, and closing receivable for each customer. Default
            range is the current Pakistan financial year.
          </p>
        </div>

        {/* Filter panel */}
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Report parameters
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">
              Customer AR
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-2 tracking-wide uppercase">
                Period
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_MODES.map((q) => (
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
                    className={`w-full ${DATE_CLS}`}
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
                    className={`w-full ${DATE_CLS}`}
                  />
                </div>
              </div>
            )}

            {mode !== "custom" && (
              <p className="text-xs text-gray-500 dark:text-neutral-500">
                {fmtDateRangeHuman(dateFrom, dateTo)}
              </p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 rounded-b-2xl flex flex-wrap items-center justify-end gap-2 relative z-10">
            <button
              type="button"
              onClick={() => hasRun && runReport()}
              disabled={loading || !hasRun}
              title="Refresh"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-orange-500 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={runReport}
              disabled={loading}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Run Report
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Reset
            </button>
            <div className="relative z-50" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                disabled={!report || !customers.length}
                className="flex items-center gap-2 h-9 pl-3 pr-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                Export
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl z-[200] overflow-hidden ring-1 ring-black/5 dark:ring-white/10 py-1">
                  <button
                    type="button"
                    onClick={() => { exportCSV(report); setExportOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => { setExportOpen(false); window.print(); }}
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

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Loading receivables…
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && hasRun && !report && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Couldn&apos;t load receivables
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              Try again with Run Report, or check your connection.
            </p>
          </div>
        )}

        {/* Report */}
        {!loading && report && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            {/* Screen header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 no-print flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Party Receivable Analysis
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                  {fmtDateRangeHuman(report.dateFrom, report.dateTo)}
                  <span className="text-gray-400 dark:text-neutral-600">
                    {" "}· {customers.length}{" "}
                    {customers.length === 1 ? "party" : "parties"}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider">
                  Total Receivable
                </p>
                <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {sym} {fmtMoneyPK(totals.receivable || 0)}
                </p>
              </div>
            </div>

            {/* Print-only header */}
            <div className="hidden print:block px-6 py-4 border-b border-gray-300">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-lg font-black uppercase tracking-widest">
                    Party Receivable Analysis
                  </h1>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">
                    Customer Accounts Receivable
                  </p>
                </div>
                <div className="text-right text-[10px] text-gray-600">
                  <div>From: {fmtDateHuman(report.dateFrom)}</div>
                  <div>To: {fmtDateHuman(report.dateTo)}</div>
                </div>
              </div>
            </div>

            {/* Empty customers */}
            {customers.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
                  <FileSearch className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  No receivable activity
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
                  No customer transactions found for{" "}
                  {fmtDateRangeHuman(report.dateFrom, report.dateTo)}.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full ra-print-table">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                        <th className={`${TH_CLS} text-left w-12`}>Code</th>
                        <th className={`${TH_CLS} text-left`}>Party</th>
                        <th className={`${TH_CLS} text-right`}>O. Receivable</th>
                        <th className={`${TH_CLS} text-right`}>Activity</th>
                        <th className={`${TH_CLS} text-right`}>Cash Rec</th>
                        <th className={`${TH_CLS} text-right`}>Bank Rec</th>
                        <th className={`${TH_CLS} text-right`}>Receivable</th>
                        <th className={`${TH_CLS} text-center no-print`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/60 bg-white dark:bg-neutral-950">
                      {customers.map((c, idx) => (
                        <tr
                          key={String(c._id)}
                          className={`hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40 dark:bg-neutral-900/25" : ""}`}
                        >
                          {/* Code */}
                          <td className="px-3 py-2.5 font-mono text-[11px] text-gray-400 dark:text-neutral-600 whitespace-nowrap">
                            {String(c.code).padStart(3, "0")}
                          </td>
                          {/* Name */}
                          <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white min-w-[160px]">
                            {c.name}
                            {c.city ? (
                              <span className="ml-1.5 text-[10px] text-gray-400 dark:text-neutral-600 font-normal">
                                {c.city}
                              </span>
                            ) : null}
                          </td>
                          {/* Amounts */}
                          <AmtTD value={c.openingRec} />
                          <AmtTD value={c.activity} />
                          <AmtTD value={c.cashRec} />
                          <AmtTD value={c.bankRec} />
                          <AmtTD value={c.receivable} bold accent />
                          {/* Actions */}
                          <td className="px-3 py-2.5 text-center no-print">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/accounting/reports/ledger?partyId=${c._id}`,
                                  )
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Ledger
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Totals */}
                    <tfoot>
                      <tr className="ra-print-totals border-t-2 border-gray-300 dark:border-neutral-700 bg-gray-100/80 dark:bg-neutral-900/60">
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3 text-xs font-black text-gray-900 dark:text-white uppercase tracking-wide">
                          Total
                          <span className="ml-2 font-normal text-[10px] text-gray-400 dark:text-neutral-600 normal-case tracking-normal">
                            {customers.length} {customers.length === 1 ? "party" : "parties"}
                          </span>
                        </td>
                        {["openingRec", "activity", "cashRec", "bankRec"].map((k) => (
                          <td
                            key={k}
                            className="px-3 py-3 text-right tabular-nums font-mono text-[11.5px] font-bold text-gray-800 dark:text-neutral-200"
                          >
                            {fmtCell(totals[k])}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-right tabular-nums font-mono text-[12px] font-black text-emerald-600 dark:text-emerald-400">
                          {fmtCell(totals.receivable)}
                        </td>
                        <td className="no-print" />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Print footer */}
                <div className="hidden print:flex justify-between items-center px-6 py-3 border-t border-gray-300 text-[9px] text-gray-500 mt-2">
                  <span>
                    Printed:{" "}
                    {new Date().toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    {new Date().toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-semibold">EatsDesk — Accounting</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
