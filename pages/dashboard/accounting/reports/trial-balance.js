import { useCallback, useMemo, useRef, useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
  BookOpen,
  ChevronDown,
  Download,
  FileSearch,
  Loader2,
  Printer,
  RefreshCw,
  LayoutList,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import ReportsNav from "../../../../components/accounting/ReportsNav";
import {
  localToday,
  localISODate,
  fmtMoneyPK,
  fmtDateRangeHuman,
  fmtDateHuman,
} from "../../../../lib/accountingFormat";

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

// ── Date range helpers ──────────────────────────────────────────────────────
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

// ── Number formatting ───────────────────────────────────────────────────────
function fmtTB(n) {
  if (!n || n === 0) return "";
  return fmtMoneyPK(n);
}

// ── CSV Export ──────────────────────────────────────────────────────────────
function exportCSV(report) {
  const cols = [
    "Account Code",
    "Account Name",
    "Opening Dr",
    "Opening Cr",
    "Period Dr",
    "Period Cr",
    "Closing Dr",
    "Closing Cr",
  ];
  const rows = [cols];

  const push = (...cells) =>
    rows.push(cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`));

  report.groups.forEach((g) => {
    push(g.label.toUpperCase(), "", "", "", "", "", "", "");
    g.accounts.forEach((a) => {
      push(
        a.accountCode,
        a.accountName,
        a.openingDr || "",
        a.openingCr || "",
        a.periodDr || "",
        a.periodCr || "",
        a.closingDr || "",
        a.closingCr || "",
      );
      a.parties.forEach((p) => {
        push(
          "",
          `  ${p.partyName}`,
          p.openingDr || "",
          p.openingCr || "",
          p.periodDr || "",
          p.periodCr || "",
          p.closingDr || "",
          p.closingCr || "",
        );
      });
    });
    const s = g.subtotal;
    push(
      `${g.label} TOTAL`,
      "",
      s.openingDr || "",
      s.openingCr || "",
      s.periodDr || "",
      s.periodCr || "",
      s.closingDr || "",
      s.closingCr || "",
    );
    push("", "", "", "", "", "", "", "");
  });

  const gt = report.grandTotal;
  push(
    "GRAND TOTAL",
    "",
    gt.openingDr || "",
    gt.openingCr || "",
    gt.periodDr || "",
    gt.periodCr || "",
    gt.closingDr || "",
    gt.closingCr || "",
  );

  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `trial-balance-${report.dateFrom}-${report.dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Style constants ─────────────────────────────────────────────────────────
const TH =
  "px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 text-right first:text-left";
const AMT_CELL =
  "px-3 py-2 text-right tabular-nums text-[11.5px] text-gray-700 dark:text-neutral-300 font-mono";
const DATE_CLS =
  "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors";

const QUICK_MODES = [
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
  { id: "custom", label: "Custom" },
];

const TYPE_COLORS = {
  capital:   "bg-violet-100/80 dark:bg-violet-500/15 text-violet-900 dark:text-violet-200",
  liability: "bg-red-100/80 dark:bg-red-500/15 text-red-900 dark:text-red-200",
  asset:     "bg-sky-100/80 dark:bg-sky-500/15 text-sky-900 dark:text-sky-200",
  revenue:   "bg-emerald-100/80 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  cogs:      "bg-orange-100/80 dark:bg-orange-500/15 text-orange-900 dark:text-orange-200",
  expense:   "bg-rose-100/80 dark:bg-rose-500/15 text-rose-900 dark:text-rose-200",
};

// ── Sub-components ──────────────────────────────────────────────────────────

function AmtCell({ value, red = false }) {
  if (!value) return <td className={AMT_CELL} />;
  return (
    <td className={`${AMT_CELL}${red ? " text-red-600 dark:text-red-400" : ""}`}>
      {fmtTB(value)}
    </td>
  );
}

function TypeHeaderRow({ label, type }) {
  return (
    <tr className={TYPE_COLORS[type]}>
      <td
        colSpan={8}
        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
      >
        {label}
      </td>
    </tr>
  );
}

function AccountRow({ account, showParties }) {
  return (
    <>
      <tr className="border-b border-gray-100 dark:border-neutral-800/50 hover:bg-gray-50/70 dark:hover:bg-neutral-900/30 transition-colors">
        <td className="px-3 py-2 font-mono text-[11px] text-gray-400 dark:text-neutral-500 whitespace-nowrap">
          {account.accountCode}
        </td>
        <td className="px-3 py-2 text-sm text-gray-800 dark:text-neutral-200 pl-5">
          {account.accountName}
        </td>
        <AmtCell value={account.openingDr} />
        <AmtCell value={account.openingCr} />
        <AmtCell value={account.periodDr} />
        <AmtCell value={account.periodCr} />
        <AmtCell value={account.closingDr} />
        <AmtCell value={account.closingCr} />
      </tr>
      {showParties &&
        account.parties.map((p) => <PartyRow key={p.partyId} party={p} />)}
    </>
  );
}

function PartyRow({ party }) {
  return (
    <tr className="border-b border-gray-100/60 dark:border-neutral-800/30 bg-gray-50/30 dark:bg-neutral-900/20">
      <td className="px-3 py-1.5" />
      <td className="px-3 py-1.5 pl-10 text-[11px] text-gray-500 dark:text-neutral-500 italic">
        {party.partyName}
      </td>
      <AmtCell value={party.openingDr} />
      <AmtCell value={party.openingCr} />
      <AmtCell value={party.periodDr} />
      <AmtCell value={party.periodCr} />
      <AmtCell value={party.closingDr} />
      <AmtCell value={party.closingCr} />
    </tr>
  );
}

function SubtotalRow({ label, totals }) {
  return (
    <tr className="border-t border-b border-gray-300 dark:border-neutral-700 bg-gray-100/80 dark:bg-neutral-900/60">
      <td className="px-3 py-2 font-mono text-[10px] text-gray-400 dark:text-neutral-500" />
      <td className="px-3 py-2 text-[11px] font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wide">
        {label}
      </td>
      {["openingDr", "openingCr", "periodDr", "periodCr", "closingDr", "closingCr"].map(
        (k) => (
          <td key={k} className={`${AMT_CELL} font-bold text-gray-800 dark:text-neutral-200`}>
            {fmtTB(totals[k])}
          </td>
        ),
      )}
    </tr>
  );
}

function GrandTotalRow({ totals }) {
  return (
    <tr className="border-t-4 border-double border-gray-400 dark:border-neutral-600 bg-gray-200/70 dark:bg-neutral-800/60">
      <td className="px-3 py-3 font-mono text-[10px] text-gray-400" />
      <td className="px-3 py-3 text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
        Grand Total
      </td>
      {["openingDr", "openingCr", "periodDr", "periodCr", "closingDr", "closingCr"].map(
        (k) => (
          <td
            key={k}
            className={`${AMT_CELL} font-black text-gray-900 dark:text-white text-[12px]`}
          >
            {fmtTB(totals[k])}
          </td>
        ),
      )}
    </tr>
  );
}

// ── Print styles ────────────────────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; color: #111 !important; font-size: 11px; }
  .print-table th, .print-table td { border: 1px solid #bbb; padding: 4px 7px; font-size: 10px; }
  .print-table th { background: #e0e0e0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-type-hdr { background: #d4d4d4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-subtotal { background: #ebebeb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-grand-total { background: #d0d0d0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; border-top: 3px double #555; }
  @page { size: A4 landscape; margin: 1.2cm; }
}
`;

// ── Main page ───────────────────────────────────────────────────────────────
export default function TrialBalancePage() {
  const sym = getCurrencySymbol();
  const m = thisMonthRange();

  const [mode, setMode] = useState("thisMonth");
  const [dateFrom, setFrom] = useState(m.from);
  const [dateTo, setTo] = useState(m.to);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [showParties, setShowParties] = useState(true);
  const [hideZero, setHideZero] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  function applyMode(next) {
    setMode(next);
    if (next === "thisMonth") { const r = thisMonthRange(); setFrom(r.from); setTo(r.to); }
    if (next === "lastMonth") { const r = lastMonthRange(); setFrom(r.from); setTo(r.to); }
    if (next === "thisYear")  { const r = thisYearRange();  setFrom(r.from); setTo(r.to); }
  }

  const runReport = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const data = await apiFetch(
        `/api/accounting/reports/trial-balance?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      );
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to run report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const visibleGroups = useMemo(() => {
    if (!report) return [];
    if (!hideZero) return report.groups;
    return report.groups
      .map((g) => ({
        ...g,
        accounts: g.accounts.filter(
          (a) =>
            a.openingDr || a.openingCr || a.periodDr ||
            a.periodCr  || a.closingDr || a.closingCr,
        ),
      }))
      .filter((g) => g.accounts.length > 0);
  }, [report, hideZero]);

  function handleExportCSV() {
    if (!report) { toast.error("Generate a report first"); return; }
    exportCSV(report);
    setExportOpen(false);
  }
  function handlePrint() {
    setExportOpen(false);
    window.print();
  }

  const colHeaders = [
    "Account Code",
    "Account Description",
    "Op. Debit",
    "Op. Credit",
    "Period Debit",
    "Period Credit",
    "Closing Dr",
    "Closing Cr",
  ];

  return (
    <AdminLayout title="Trial Balance">
      <style>{PRINT_CSS}</style>
      <div className="space-y-4">
        <ReportsNav />

        {/* Info banner */}
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <LayoutList className="w-4 h-4 text-gray-500 dark:text-neutral-400 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            All accounts with opening balances, period movements, and closing
            balances. Debits and credits are shown on one side per row (net
            basis). Grand total debits must equal grand total credits.
          </p>
        </div>

        {/* Filter panel */}
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Report parameters
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">
              Trial Balance
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
            {/* Toggle: show parties */}
            <button
              type="button"
              onClick={() => setShowParties((v) => !v)}
              className="h-9 px-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center gap-2"
            >
              <span>Show parties</span>
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showParties ? "bg-orange-500" : "bg-gray-300 dark:bg-neutral-700"}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showParties ? "translate-x-5" : "translate-x-1"}`}
                />
              </span>
            </button>
            {/* Toggle: hide zero */}
            <button
              type="button"
              onClick={() => setHideZero((v) => !v)}
              className="h-9 px-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center gap-2"
            >
              <span>Hide zero rows</span>
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${hideZero ? "bg-gray-500 dark:bg-gray-400" : "bg-gray-300 dark:bg-neutral-700"}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hideZero ? "translate-x-5" : "translate-x-1"}`}
                />
              </span>
            </button>
            {/* Refresh */}
            <button
              type="button"
              onClick={() => hasRun && runReport()}
              disabled={loading || !hasRun}
              title="Refresh"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-orange-500 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {/* Run */}
            <button
              type="button"
              onClick={runReport}
              disabled={loading}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Run Report
            </button>
            {/* Export dropdown */}
            <div className="relative z-50" ref={exportRef}>
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
                    onClick={handlePrint}
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
              Building trial balance…
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && hasRun && !report && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              No data for this period
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              Try another date range or check that vouchers are posted for{" "}
              {fmtDateRangeHuman(dateFrom, dateTo)}.
            </p>
          </div>
        )}

        {/* Report table */}
        {!loading && report && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            {/* Card header — visible on screen */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 no-print">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Trial Balance
              </h2>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                {fmtDateRangeHuman(report.dateFrom, report.dateTo)}
              </p>
            </div>

            {/* Print-only header */}
            <div className="hidden print:block px-6 py-4 text-center border-b border-gray-300">
              <h1 className="text-xl font-black uppercase tracking-widest">Trial Balance</h1>
              <p className="text-xs text-gray-600 mt-1">
                From: {fmtDateHuman(report.dateFrom)} &nbsp;&nbsp;To: {fmtDateHuman(report.dateTo)}
              </p>
            </div>

            {/* Balance check notice */}
            {(() => {
              const gt = report.grandTotal;
              const diff = Math.abs(
                (gt.openingDr + gt.periodDr + gt.closingDr) -
                (gt.openingCr + gt.periodCr + gt.closingCr),
              );
              const balanced = diff < 0.02;
              return (
                <div
                  className={`px-5 py-2 text-[11px] font-medium no-print ${balanced ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"}`}
                >
                  {balanced
                    ? "✓ Trial balance is balanced — debits equal credits."
                    : `⚠ Trial balance is out by ${sym} ${fmtMoneyPK(diff)}. Check for unposted or orphan entries.`}
                </div>
              );
            })()}

            <div className="overflow-x-auto">
              <table className="w-full text-sm print-table">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                    {colHeaders.map((h, i) => (
                      <th
                        key={h}
                        className={`${TH} ${i === 0 ? "w-[100px]" : i === 1 ? "w-auto" : "w-[110px]"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-950">
                  {visibleGroups.map((group) => (
                    <>
                      <TypeHeaderRow
                        key={`hdr-${group.type}`}
                        label={group.label}
                        type={group.type}
                      />
                      {group.accounts.map((account) => (
                        <AccountRow
                          key={account.accountId}
                          account={account}
                          showParties={showParties}
                        />
                      ))}
                      <SubtotalRow
                        key={`sub-${group.type}`}
                        label={`${group.label} total`}
                        totals={group.subtotal}
                      />
                    </>
                  ))}
                  <GrandTotalRow totals={report.grandTotal} />
                </tbody>
              </table>
            </div>

            {/* Print footer */}
            <div className="hidden print:flex justify-between items-center px-6 py-3 border-t border-gray-300 text-[9px] text-gray-500">
              <span>
                Generated: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                &nbsp;{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="font-semibold">EatsDesk — Accounting</span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
