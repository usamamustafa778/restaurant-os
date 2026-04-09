import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import DataTable from "../../../../components/ui/DataTable";
import {
  Loader2,
  RefreshCw,
  Printer,
  Download,
  BookOpen,
  ChevronDown,
  CalendarDays,
  FileSearch,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import { localToday, fmtMoneyPK } from "../../../../lib/accountingFormat";
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

const today = () => localToday();

function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function fmtAmt(n) {
  return fmtMoneyPK(n);
}

const VOUCHER_TYPE_LABELS = {
  cash_payment: "Cash Payment",
  cash_receipt: "Cash Receipt",
  bank_payment: "Bank Payment",
  bank_receipt: "Bank Receipt",
  journal: "Journal Entry",
  card_transfer: "Card Transfer",
};

/** Match vouchers list page */
const TYPE_COLORS = {
  cash_payment:
    "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-500/20",
  cash_receipt:
    "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-500/20",
  bank_payment:
    "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300 dark:ring-orange-500/20",
  bank_receipt:
    "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-500/20",
  journal:
    "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-300 dark:ring-violet-500/20",
  card_transfer:
    "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-300 dark:ring-cyan-500/20",
};

const VOUCHER_TYPES = [
  { value: "", label: "All types" },
  { value: "cash_payment", label: "Cash Payment" },
  { value: "cash_receipt", label: "Cash Receipt" },
  { value: "bank_payment", label: "Bank Payment" },
  { value: "bank_receipt", label: "Bank Receipt" },
  { value: "journal", label: "Journal Entry" },
  { value: "card_transfer", label: "Card Transfer" },
];

const filterSelectCls =
  "h-9 min-w-[160px] px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer";

const dateInputCls =
  "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors";

function SummaryStrip({ summary, sym }) {
  const cards = [
    {
      label: "Cash in",
      value: `${sym} ${fmtAmt(summary.cash_receipt || 0)}`,
      sub: "Receipts",
      icon: ArrowDownLeft,
      iconClass: "text-emerald-500 dark:text-emerald-400",
    },
    {
      label: "Cash out",
      value: `${sym} ${fmtAmt(summary.cash_payment || 0)}`,
      sub: "Supplier payments",
      icon: ArrowUpRight,
      iconClass: "text-red-500 dark:text-red-400",
    },
    {
      label: "Bank in",
      value: `${sym} ${fmtAmt(summary.bank_receipt || 0)}`,
      sub: "Receipts",
      icon: Banknote,
      iconClass: "text-blue-500 dark:text-blue-400",
    },
    {
      label: "Bank out",
      value: `${sym} ${fmtAmt(summary.bank_payment || 0)}`,
      sub: "Payments",
      icon: Banknote,
      iconClass: "text-orange-500 dark:text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <div className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">
            {c.value}
          </div>
          <div className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildLineColumns(sym) {
  return [
    {
      key: "accountName",
      header: "Account",
      render: (v) => (
        <span className="text-gray-800 dark:text-neutral-200">{v || "—"}</span>
      ),
    },
    {
      key: "partyName",
      header: "Party",
      hideOnMobile: true,
      render: (v) => (
        <span className="text-gray-500 dark:text-neutral-400 max-w-[140px] truncate block">
          {v || "—"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "whitespace-normal",
      render: (v) => (
        <span className="text-gray-600 dark:text-neutral-400 max-w-[200px] truncate block text-xs">
          {v || "—"}
        </span>
      ),
    },
    {
      key: "debit",
      header: "Debit",
      align: "right",
      cellClassName: "tabular-nums",
      render: (v, line) =>
        line.debit > 0 ? (
          <span className="text-blue-600 dark:text-blue-400">
            {sym} {fmtAmt(line.debit)}
          </span>
        ) : (
          ""
        ),
    },
    {
      key: "credit",
      header: "Credit",
      align: "right",
      cellClassName: "tabular-nums",
      render: (v, line) =>
        line.credit > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            {sym} {fmtAmt(line.credit)}
          </span>
        ) : (
          ""
        ),
    },
  ];
}

function VoucherCard({ voucher, sym }) {
  const typeLabel = VOUCHER_TYPE_LABELS[voucher.type] || voucher.type;
  const typeColor =
    TYPE_COLORS[voucher.type] ||
    "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 ring-1 ring-gray-200 dark:ring-neutral-700";

  const lineColumns = useMemo(() => buildLineColumns(sym), [sym]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm overflow-hidden print:border print:border-gray-300 print:rounded-lg print:mb-4 print:shadow-none">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Receipt className="w-4 h-4 text-gray-400 dark:text-neutral-600 flex-shrink-0" />
          <span className="font-mono text-sm font-semibold text-orange-500 dark:text-orange-400">
            {voucher.voucherNumber}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeColor}`}
          >
            {typeLabel}
          </span>
          {voucher.autoPosted && (
            <span className="text-[10px] bg-gray-200 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 px-1.5 py-0.5 rounded font-mono">
              AUTO
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums">
            {fmtTime(voucher.createdAt)}
          </span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
            {sym} {fmtAmt(voucher.totalAmount)}
          </span>
        </div>
      </div>

      <DataTable
        columns={lineColumns}
        data={voucher.lines || []}
        getRowId={(_, i) => `${voucher._id}-line-${i}`}
        emptyMessage="No lines"
        tableClassName="text-xs"
      />

      {voucher.notes && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-gray-100 dark:border-neutral-800 text-xs text-gray-500 dark:text-neutral-500 bg-gray-50/40 dark:bg-neutral-900/30">
          {voucher.notes}
        </div>
      )}
    </div>
  );
}

function exportCSV(vouchers, date) {
  const headers = [
    "Voucher No",
    "Type",
    "Date",
    "Time",
    "Account",
    "Party",
    "Description",
    "Debit",
    "Credit",
  ];
  const rows = [];
  vouchers.forEach((v) => {
    (v.lines || []).forEach((l) => {
      rows.push(
        [
          v.voucherNumber,
          VOUCHER_TYPE_LABELS[v.type] || v.type,
          fmtDate(v.date),
          fmtTime(v.createdAt),
          `"${(l.accountName || "").replace(/"/g, '""')}"`,
          `"${(l.partyName || "").replace(/"/g, '""')}"`,
          `"${(l.description || "").replace(/"/g, '""')}"`,
          l.debit || "",
          l.credit || "",
        ].join(","),
      );
    });
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `day-book-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DayBookPage() {
  const sym = getCurrencySymbol();
  const [date, setDate] = useState(today());
  const [typeFilter, setType] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const runReport = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const p = new URLSearchParams({ date });
      if (typeFilter) p.set("type", typeFilter);
      const data = await apiFetch(
        `/api/accounting/reports/day-book?${p.toString()}`,
      );
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to load day book");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [date, typeFilter]);

  async function syncSales() {
    setSyncing(true);
    try {
      const data = await apiFetch("/api/accounting/sync-sales", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      toast.success(
        `Synced ${data.synced} orders, skipped ${data.skipped}${
          data.errors?.length ? `, ${data.errors.length} errors` : ""
        }`,
      );
      if (hasRun) runReport();
    } catch (err) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function resetFilters() {
    setDate(today());
    setType("");
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

  const summary = report?.summary || {};
  const hasVouchers = report?.vouchers?.length > 0;

  function handleExportCSV() {
    if (!report?.vouchers?.length) {
      toast.error("Run a report with vouchers first");
      return;
    }
    exportCSV(report.vouchers, date);
    setExportOpen(false);
  }

  function handleExportPrint() {
    setExportOpen(false);
    window.print();
  }

  return (
    <AdminLayout title="Day Book">
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="space-y-4">
        <ReportsNav />
        {/* Intro */}
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <CalendarDays className="w-4 h-4 text-gray-500 dark:text-neutral-400" />

          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            All posted vouchers for a single day, with cash and bank totals.
            Sync sales from POS for the selected date, then run the report.
            Export CSV or print like other accounting reports.
          </p>
        </div>

        {/* Parameters */}
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Report parameters
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">
              Single day
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full ${dateInputCls}`}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Showing vouchers posted on this date
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                  Voucher type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setType(e.target.value)}
                  className={filterSelectCls}
                >
                  {VOUCHER_TYPES.map((t) => (
                    <option key={t.value || "all"} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 rounded-b-2xl flex flex-wrap items-center justify-end gap-2 overflow-visible relative z-10">
            <button
              type="button"
              onClick={() => hasRun && runReport()}
              disabled={loading || !hasRun}
              title="Refresh with current filters"
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
              onClick={syncSales}
              disabled={syncing}
              className="flex items-center gap-2 h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sync sales
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
                disabled={!hasVouchers}
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

        <div className="hidden print:block mb-6 text-center">
          <h2 className="text-lg font-bold">Day book — {fmtDate(date)}</h2>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Loading day book…
            </p>
          </div>
        )}

        {!loading && hasRun && report && !hasVouchers && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              No vouchers posted on {fmtDate(date)}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              Try a different date
              {typeFilter
                ? ` or voucher type (${VOUCHER_TYPE_LABELS[typeFilter] || typeFilter})`
                : ""}
              . You can also sync sales from POS for this day.
            </p>
          </div>
        )}

        {!loading && hasVouchers && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Results
              </h2>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                {fmtDate(date)}
                {typeFilter
                  ? ` · ${VOUCHER_TYPE_LABELS[typeFilter] || typeFilter}`
                  : " · All types"}
                <span className="text-gray-400 dark:text-neutral-600">
                  {" "}
                  · {report.vouchers.length}{" "}
                  {report.vouchers.length === 1 ? "voucher" : "vouchers"}
                </span>
              </p>
            </div>
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-neutral-800 space-y-4 no-print">
              <SummaryStrip summary={summary} sym={sym} />
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {report.vouchers.map((v) => (
                <VoucherCard key={v._id} voucher={v} sym={sym} />
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 flex items-center justify-between no-print">
              <span className="text-sm font-medium text-gray-600 dark:text-neutral-400">
                {report.vouchers.length} vouchers
              </span>
              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                Total{" "}
                <span className="text-orange-500 dark:text-orange-400">
                  {sym} {fmtAmt(summary.total || 0)}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
