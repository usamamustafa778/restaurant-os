import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
  Loader2, Search, X, BookOpen, Printer, Download,
  RefreshCw, ChevronDown, FileSearch, Wallet,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import {
  localToday,
  localMonthStart,
  fmtMoneyPK,
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
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...buildHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

const today = () => localToday();
function monthStart() { return localMonthStart(); }

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function fmtAmt(n) { return fmtMoneyPK(n); }

const VOUCHER_TYPE_LABELS = {
  cash_payment: "Cash Payment",
  cash_receipt: "Cash Receipt",
  bank_payment: "Bank Payment",
  bank_receipt: "Bank Receipt",
  journal: "Journal Entry",
  card_transfer: "Card Transfer",
};

const dateInputCls =
  "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors";

// ─── Account picker ───────────────────────────────────────────────────────────

function AccountSelect({ value, onChange }) {
  const [q, setQ]             = useState("");
  const [opts, setOpts]       = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const debRef                = useRef(null);
  const wrapRef               = useRef(null);

  async function search(query) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ type: "asset" });
      if (query) p.set("q", query);
      const data = await apiFetch(`/api/accounting/accounts?${p.toString()}`);
      const all = (data.accounts || []).filter((a) =>
        ["301", "302", "303"].some((prefix) => a.code.startsWith(prefix))
      );
      setOpts(all);
    } catch { setOpts([]); } finally { setLoading(false); }
  }

  useEffect(() => { clearTimeout(debRef.current); debRef.current = setTimeout(() => search(q), 300); }, [q]);
  useEffect(() => { search(""); }, []);
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = value ? opts.find((o) => o._id === value) : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 flex items-center justify-between gap-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg px-3 text-xs text-left focus:outline-none focus:ring-1 focus:ring-orange-500 hover:border-gray-300 dark:hover:border-neutral-700 transition-colors"
      >
        <span className={`truncate ${selected ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-neutral-500"}`}>
          {selected ? `${selected.code} – ${selected.name}` : "Select account…"}
        </span>
        {value
          ? <span onMouseDown={(e) => { e.stopPropagation(); onChange(null, null); }} className="text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-white flex-shrink-0"><X className="w-3 h-3" /></span>
          : null}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-neutral-800">
            <Search className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 flex-shrink-0" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none" />
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 flex-shrink-0" />}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {opts.length === 0
              ? <p className="px-3 py-3 text-xs text-gray-500 dark:text-neutral-500">No results</p>
              : opts.map((o) => (
                <button key={o._id} type="button"
                  onMouseDown={() => { onChange(o._id, o); setOpen(false); setQ(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors ${o._id === value ? "text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10" : "text-gray-900 dark:text-white"}`}>
                  {o.code} – {o.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(report, accountName, dateFrom, dateTo) {
  const headers = ["Section", "Date", "Voucher No", "Voucher Type", "Description", "Amount"];
  const rows = [];
  rows.push(["RECEIPTS", "", "", "", "Opening Balance", report.openingBalance.toFixed(2)]);
  report.receipts.forEach((e) => rows.push([
    "RECEIPTS", fmtDate(e.date), e.voucherNumber || "", e.voucherType || "",
    `"${(e.description || "").replace(/"/g, '""')}"`, e.debit.toFixed(2),
  ]));
  report.payments.forEach((e) => rows.push([
    "PAYMENTS", fmtDate(e.date), e.voucherNumber || "", e.voucherType || "",
    `"${(e.description || "").replace(/"/g, '""')}"`, e.credit.toFixed(2),
  ]));
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cash-statement-${accountName}-${dateFrom}-${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Entry table ──────────────────────────────────────────────────────────────

function EntryTable({ entries, amtKey, colorClass, label }) {
  const sym = getCurrencySymbol();
  return (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden mb-4 last:mb-0">
      <div className={`px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 ${colorClass} text-xs font-bold uppercase tracking-wider`}>
        {label}
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 dark:text-neutral-500 text-center">No entries</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800">
              {["Date", "Voucher No", "Type", "Description", "Amount"].map((h) => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-950 divide-y divide-gray-50 dark:divide-neutral-800/50">
            {entries.map((e, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-neutral-900/40 transition-colors">
                <td className="px-4 py-2.5 text-gray-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="px-4 py-2.5 font-mono text-orange-500 dark:text-orange-400 text-xs">{e.voucherNumber || "—"}</td>
                <td className="px-4 py-2.5">
                  {e.voucherType && (
                    <span className="text-[10px] bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 px-1.5 py-0.5 rounded font-medium">
                      {VOUCHER_TYPE_LABELS[e.voucherType] || e.voucherType}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-neutral-300 max-w-[200px] truncate">{e.description || "—"}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${amtKey === "debit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                  {sym} {fmtAmt(e[amtKey])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashStatementPage() {
  const sym = getCurrencySymbol();
  const [accountId, setAccountId]   = useState(null);
  const [accountObj, setAccountObj] = useState(null);
  const [dateFrom, setDateFrom]     = useState(monthStart());
  const [dateTo, setDateTo]         = useState(today());
  const [report, setReport]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [hasRun, setHasRun]         = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef               = useRef(null);

  async function runReport() {
    if (!accountId) { toast.error("Please select an account"); return; }
    setLoading(true); setHasRun(true);
    try {
      const p = new URLSearchParams({ accountId, dateFrom, dateTo });
      const data = await apiFetch(`/api/accounting/reports/cash-statement?${p.toString()}`);
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to load statement"); setReport(null);
    } finally { setLoading(false); }
  }

  function resetFilters() {
    setAccountId(null); setAccountObj(null);
    setDateFrom(monthStart()); setDateTo(today());
    setReport(null); setHasRun(false);
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
    if (!report) { toast.error("Run a report first"); return; }
    exportCSV(report, accountObj?.name || "account", dateFrom, dateTo);
    setExportOpen(false);
  }

  function handleExportPrint() {
    setExportOpen(false);
    window.print();
  }

  return (
    <AdminLayout title="Cash Statement">
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="space-y-4">
        <ReportsNav />

        {/* Intro */}
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <Wallet className="w-4 h-4 text-gray-500 dark:text-neutral-400 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cash or bank account activity for a period — opening balance, receipts, payments, and closing balance.
            Select a cash/bank account and date range, then run the report. Export CSV or print.
          </p>
        </div>

        {/* Parameters */}
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Report parameters</h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">Cash / Bank</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                  Account <span className="text-red-500">*</span>
                </label>
                <AccountSelect value={accountId} onChange={(v, obj) => { setAccountId(v); setAccountObj(obj); }} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">Date from</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`w-full ${dateInputCls}`} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">Date to</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`w-full ${dateInputCls}`} />
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 rounded-b-2xl flex flex-wrap items-center justify-end gap-2 overflow-visible relative z-10">
            <button
              type="button"
              onClick={() => hasRun && runReport()}
              disabled={loading || !hasRun || !accountId}
              title="Refresh with current filters"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-orange-500 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={runReport}
              disabled={loading || !accountId}
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

        {/* Print header */}
        <div className="hidden print:block mb-4 text-center">
          <h2 className="text-lg font-bold">Cash / Bank Statement — {accountObj?.name}</h2>
          <p className="text-sm text-gray-600">{fmtDateRangeHuman(dateFrom, dateTo, "to")}</p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500 dark:text-neutral-400">Loading statement…</p>
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">No data available</p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              No transactions found for the selected account and date range. Try different filters.
            </p>
          </div>
        )}

        {!loading && report && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            {/* Results header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Statement</h2>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                {accountObj ? `${accountObj.code} – ${accountObj.name}` : "Account"}
                <span className="text-gray-400 dark:text-neutral-600">
                  {" "}
                  · {fmtDateRangeHuman(dateFrom, dateTo)}
                </span>
              </p>
            </div>

            {/* Summary cards */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-neutral-800 no-print">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Opening Balance", value: report.openingBalance, color: "text-gray-900 dark:text-white" },
                  { label: "Total Receipts",  value: report.totalReceipts,  color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Total Payments",  value: report.totalPayments,  color: "text-red-600 dark:text-red-400" },
                  {
                    label: "Closing Balance",
                    value: report.closingBalance,
                    color: report.closingBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                  },
                ].map((c) => (
                  <div key={c.label} className="border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                    <p className="text-[11px] text-gray-500 dark:text-neutral-500 mb-1">{c.label}</p>
                    <p className={`text-base font-bold tabular-nums ${c.color}`}>
                      {c.value < 0 ? `(${sym} ${fmtAmt(Math.abs(c.value))})` : `${sym} ${fmtAmt(c.value)}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Print summary */}
            <div className="hidden print:flex gap-8 px-5 py-4 mb-2 border-b border-gray-300">
              {[
                { label: "Opening Balance", value: report.openingBalance },
                { label: "Total Receipts",  value: report.totalReceipts },
                { label: "Total Payments",  value: report.totalPayments },
                { label: "Closing Balance", value: report.closingBalance },
              ].map((c) => (
                <div key={c.label}>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-base font-bold">{sym} {fmtAmt(c.value)}</p>
                </div>
              ))}
            </div>

            <div className="p-4 sm:p-5">
              <EntryTable entries={report.receipts} amtKey="debit"  colorClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" label="Receipts (Money In)" />
              <EntryTable entries={report.payments} amtKey="credit" colorClass="bg-red-500/10 text-red-700 dark:text-red-400"             label="Payments (Money Out)" />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
