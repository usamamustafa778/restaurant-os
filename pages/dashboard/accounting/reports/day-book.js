import { useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import { Loader2, RefreshCw, Printer, Download, BookOpen } from "lucide-react";
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

const today = () => new Date().toISOString().split("T")[0];

function fmtTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

function fmtAmt(n) {
  return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VOUCHER_TYPE_LABELS = {
  cash_payment:  "Cash Payment",
  cash_receipt:  "Cash Receipt",
  bank_payment:  "Bank Payment",
  bank_receipt:  "Bank Receipt",
  journal:       "Journal",
  card_transfer: "Card Transfer",
};

const VOUCHER_TYPE_COLORS = {
  cash_payment:  "bg-red-500/10 text-red-400 border border-red-500/20",
  cash_receipt:  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  bank_payment:  "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  bank_receipt:  "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  journal:       "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  card_transfer: "bg-neutral-500/10 text-neutral-400 border border-neutral-700",
};

const VOUCHER_TYPES = [
  { value: "", label: "All Types" },
  { value: "cash_payment",  label: "Cash Payment" },
  { value: "cash_receipt",  label: "Cash Receipt" },
  { value: "bank_payment",  label: "Bank Payment" },
  { value: "bank_receipt",  label: "Bank Receipt" },
  { value: "journal",       label: "Journal" },
];

function SummaryCard({ label, amount, color }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>Rs {fmtAmt(amount)}</p>
    </div>
  );
}

function VoucherCard({ voucher }) {
  const typeLabel = VOUCHER_TYPE_LABELS[voucher.type] || voucher.type;
  const typeColor = VOUCHER_TYPE_COLORS[voucher.type] || "";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden print:border print:border-gray-300 print:rounded print:mb-4">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono font-bold text-white">{voucher.voucherNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>{typeLabel}</span>
          {voucher.autoPosted && (
            <span className="text-[10px] bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded font-mono">AUTO</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500 text-xs">{fmtTime(voucher.createdAt)}</span>
          <span className="text-orange-400 font-bold tabular-nums">Rs {fmtAmt(voucher.totalAmount)}</span>
        </div>
      </div>

      {/* Lines table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-2 text-left text-neutral-600 font-medium">Account</th>
              <th className="px-4 py-2 text-left text-neutral-600 font-medium">Party</th>
              <th className="px-4 py-2 text-left text-neutral-600 font-medium">Description</th>
              <th className="px-4 py-2 text-right text-neutral-600 font-medium">Debit</th>
              <th className="px-4 py-2 text-right text-neutral-600 font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {(voucher.lines || []).map((line, i) => (
              <tr key={i} className="border-b border-neutral-800/50 last:border-0">
                <td className="px-4 py-2 text-neutral-300">{line.accountName || "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{line.partyName || "—"}</td>
                <td className="px-4 py-2 text-neutral-500 max-w-[200px] truncate">{line.description || "—"}</td>
                <td className="px-4 py-2 text-right text-blue-400 tabular-nums">{line.debit > 0 ? `Rs ${fmtAmt(line.debit)}` : ""}</td>
                <td className="px-4 py-2 text-right text-emerald-400 tabular-nums">{line.credit > 0 ? `Rs ${fmtAmt(line.credit)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {voucher.notes && (
        <div className="px-4 py-2 border-t border-neutral-800 text-xs text-neutral-500">
          {voucher.notes}
        </div>
      )}
    </div>
  );
}

function exportCSV(vouchers, date) {
  const headers = ["Voucher No","Type","Date","Time","Account","Party","Description","Debit","Credit"];
  const rows = [];
  vouchers.forEach((v) => {
    (v.lines || []).forEach((l) => {
      rows.push([
        v.voucherNumber,
        VOUCHER_TYPE_LABELS[v.type] || v.type,
        fmtDate(v.date),
        fmtTime(v.createdAt),
        `"${(l.accountName||"").replace(/"/g,'""')}"`,
        `"${(l.partyName||"").replace(/"/g,'""')}"`,
        `"${(l.description||"").replace(/"/g,'""')}"`,
        l.debit || "",
        l.credit || "",
      ].join(","));
    });
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `day-book-${date}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function DayBookPage() {
  const [date, setDate]         = useState(today());
  const [typeFilter, setType]   = useState("");
  const [report, setReport]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [hasRun, setHasRun]     = useState(false);

  async function runReport() {
    setLoading(true); setHasRun(true);
    try {
      const p = new URLSearchParams({ date });
      if (typeFilter) p.set("type", typeFilter);
      const data = await apiFetch(`/api/accounting/reports/day-book?${p.toString()}`);
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to load day book"); setReport(null);
    } finally { setLoading(false); }
  }

  async function syncSales() {
    setSyncing(true);
    try {
      const data = await apiFetch("/api/accounting/sync-sales", { method: "POST", body: JSON.stringify({ date }) });
      toast.success(`Synced ${data.synced} orders, skipped ${data.skipped}${data.errors?.length ? `, ${data.errors.length} errors` : ""}`);
      if (hasRun) runReport();
    } catch (err) {
      toast.error(err.message || "Sync failed");
    } finally { setSyncing(false); }
  }

  const summary = report?.summary || {};

  return (
    <AdminLayout>
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 no-print flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Day Book</h1>
            <p className="text-sm text-neutral-500 mt-0.5">All vouchers posted on a given day</p>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <>
                <button type="button" onClick={() => exportCSV(report.vouchers, date)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
                  <Download className="w-4 h-4" /> CSV
                </button>
                <button type="button" onClick={() => window.print()}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
                  <Printer className="w-4 h-4" /> Print
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6 no-print">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Voucher Type</label>
              <select value={typeFilter} onChange={(e) => setType(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                {VOUCHER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <button type="button" onClick={runReport} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Run Report
            </button>
            <button type="button" onClick={syncSales} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync Sales
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 no-print">
            <SummaryCard label="Cash In"  amount={summary.cash_receipt || 0}  color="text-emerald-400" />
            <SummaryCard label="Cash Out" amount={summary.cash_payment || 0}  color="text-red-400" />
            <SummaryCard label="Bank In"  amount={summary.bank_receipt || 0}  color="text-blue-400" />
            <SummaryCard label="Bank Out" amount={summary.bank_payment || 0}  color="text-orange-400" />
          </div>
        )}

        {/* Print header */}
        <div className="hidden print:block mb-6 text-center">
          <h2 className="text-lg font-bold">Day Book — {fmtDate(date)}</h2>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        )}

        {!loading && hasRun && report && report.vouchers.length === 0 && (
          <div className="text-center py-16 text-neutral-500 text-sm bg-neutral-900/50 border border-neutral-800 rounded-2xl">
            No vouchers found for {fmtDate(date)}.
          </div>
        )}

        {!loading && report && report.vouchers.length > 0 && (
          <div className="space-y-4">
            {report.vouchers.map((v) => <VoucherCard key={v._id} voucher={v} />)}

            {/* Totals footer */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center justify-between no-print">
              <span className="text-sm font-semibold text-neutral-400">{report.vouchers.length} vouchers</span>
              <span className="text-base font-bold text-orange-400">Total: Rs {fmtAmt(summary.total || 0)}</span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
