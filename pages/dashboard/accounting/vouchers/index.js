import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../../components/layout/AdminLayout";
import DataTable from "../../../../components/ui/DataTable";
import {
  ChevronLeft, ChevronRight, Eye, Printer, X, Loader2,
  ChevronDown, Plus, FileX, Receipt, CheckCircle2,
  Clock, Ban, TrendingUp, RefreshCw, RotateCcw,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import { fmtMoneyPK } from "../../../../lib/accountingFormat";
import VoucherPagesNav from "../../../../components/accounting/VoucherPagesNav";
import { NEW_VOUCHER_MENU_LINKS } from "../../../../components/accounting/voucherNavConfig";

// ─── API ─────────────────────────────────────────────────────────────────────

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

async function printVoucher(id) {
  try {
    const res = await fetch(`${API}/api/accounting/vouchers/${id}/print`, { headers: buildHeaders() });
    if (!res.ok) { toast.error("Could not load print view"); return; }
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    toast.error("Failed to open print view");
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LIMIT = 50;

const TYPE_LABELS = {
  cash_payment:  "Cash Payment",
  cash_receipt:  "Cash Receipt",
  bank_payment:  "Bank Payment",
  bank_receipt:  "Bank Receipt",
  journal:       "Journal Entry",
  card_transfer: "Card Transfer",
};

const CANCEL_VOUCHER_ROLES = new Set([
  "restaurant_admin",
  "super_admin",
  "admin",
]);

const REVERSE_VOUCHER_ROLES = new Set([
  "restaurant_admin",
  "super_admin",
  "admin",
]);

const TYPE_COLORS = {
  cash_payment:  "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-500/20",
  cash_receipt:  "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-500/20",
  bank_payment:  "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-1 ring-orange-300 dark:ring-orange-500/20",
  bank_receipt:  "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-500/20",
  journal:       "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-300 dark:ring-violet-500/20",
  card_transfer: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-300 dark:ring-cyan-500/20",
};

const STATUS_COLORS = {
  posted:    "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-500/20",
  draft:     "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 ring-1 ring-yellow-300 dark:ring-yellow-500/20",
  cancelled: "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 ring-1 ring-gray-200 dark:ring-neutral-700",
};

const filterSelectCls = "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-600 dark:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer";

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function fmt(n) {
  return fmtMoneyPK(n);
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ vouchers, total, loading }) {
  const sym = getCurrencySymbol();
  const posted    = vouchers.filter((v) => v.status === "posted");
  const drafts    = vouchers.filter((v) => v.status === "draft");
  const cancelled = vouchers.filter((v) => v.status === "cancelled");
  const totalAmt  = vouchers.reduce((s, v) => s + (v.totalAmount || 0), 0);

  const cards = [
    { label: "Total Vouchers",    value: loading ? "—" : total,           icon: Receipt,      sub: "this query" },
    { label: "Posted",            value: loading ? "—" : posted.length,   icon: CheckCircle2, sub: "on this page" },
    { label: "Draft",             value: loading ? "—" : drafts.length,   icon: Clock,        sub: "pending post" },
    { label: "Cancelled",         value: loading ? "—" : cancelled.length,icon: Ban,          sub: "voided" },
    { label: `Total Amount (${sym})`, value: loading ? "—" : `${sym} ${fmt(totalAmt)}`, icon: TrendingUp, sub: "this page" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 dark:text-neutral-500">{c.label}</span>
            <c.icon className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-700" />
          </div>
          <div className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">{c.value}</div>
          {c.sub && <div className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Voucher Detail Slide-over ────────────────────────────────────────────────

function VoucherSlideOver({
  voucher,
  onClose,
  onCancelled,
  onReversed,
  detailLoading = false,
}) {
  const sym = getCurrencySymbol();
  const [cancelling, setCancelling] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const auth = getStoredAuth();
  const canCancel  = CANCEL_VOUCHER_ROLES.has(auth?.user?.role);
  const canReverse = REVERSE_VOUCHER_ROLES.has(auth?.user?.role);

  async function handleCancel() {
    if (
      !window.confirm(
        `Cancel voucher ${voucher.voucherNumber}? Posted vouchers will be voided and related journal entries removed. This cannot be undone.`,
      )
    )
      return;
    setCancelling(true);
    try {
      await apiFetch(`/api/accounting/vouchers/${voucher._id}/cancel`, { method: "POST" });
      toast.success("Voucher cancelled");
      onCancelled(voucher._id);
    } catch (err) {
      toast.error(err.message || "Failed to cancel voucher");
    } finally { setCancelling(false); }
  }

  async function confirmReverse() {
    setReversing(true);
    try {
      const data = await apiFetch(`/api/accounting/vouchers/${voucher._id}/reverse`, { method: "POST" });
      toast.success(`Reversal voucher ${data.reversal?.voucherNumber} created`);
      setReverseModalOpen(false);
      onReversed?.(data.reversal, voucher._id);
    } catch (err) {
      toast.error(err.message || "Failed to reverse voucher");
    } finally { setReversing(false); }
  }

  const totalDebit  = (voucher.lines || []).reduce((s, l) => s + (l.debit  || 0), 0);
  const totalCredit = (voucher.lines || []).reduce((s, l) => s + (l.credit || 0), 0);
  const createdBy   = voucher.createdBy?.name || voucher.createdBy?.email || "—";
  const createdAt   = voucher.createdAt
    ? new Date(voucher.createdAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col shadow-2xl relative">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-orange-500 dark:text-orange-400 tracking-tight">
                {voucher.voucherNumber}
              </h2>
              <div className="flex items-center flex-wrap gap-1.5 mt-2.5 mb-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[voucher.type] || ""}`}>
                  {TYPE_LABELS[voucher.type] || voucher.type}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[voucher.status] || ""}`}>
                  {voucher.status}
                </span>
                {voucher.autoPosted && (
                  <span className="text-[11px] bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 rounded-full px-2 py-0.5 font-medium">AUTO</span>
                )}
                {voucher.isReversal && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-500/20 rounded-full px-2.5 py-0.5 font-semibold">
                    <RotateCcw className="w-2.5 h-2.5" /> Reversal
                  </span>
                )}
                {voucher.isReversed && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-1 ring-rose-300 dark:ring-rose-500/20 rounded-full px-2.5 py-0.5 font-semibold">
                    Reversed
                  </span>
                )}
              </div>
              <p className="text-base font-semibold text-gray-800 dark:text-neutral-200 tabular-nums">
                Total {sym} {fmt(voucher.totalAmount)}
              </p>
            </div>
            <button type="button" onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info row: Date | Reference | Created by | Time */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-neutral-500">
            <span><span className="text-gray-400 dark:text-neutral-600">Date</span>{" "}<span className="text-gray-700 dark:text-neutral-300 font-medium">{fmtDate(voucher.date)}</span></span>
            <span><span className="text-gray-400 dark:text-neutral-600">Reference No</span>{" "}<span className="text-gray-700 dark:text-neutral-300 font-medium">{voucher.referenceNo || "—"}</span></span>
            <span><span className="text-gray-400 dark:text-neutral-600">Created by</span>{" "}<span className="text-gray-700 dark:text-neutral-300 font-medium">{createdBy}</span></span>
            <span><span className="text-gray-400 dark:text-neutral-600">Time</span>{" "}<span className="text-gray-700 dark:text-neutral-300 font-medium">{createdAt}</span></span>
          </div>

          {/* Notes */}
          {voucher.notes && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/15 rounded-lg px-3 py-2">
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mt-0.5 flex-shrink-0">Note</span>
              <span className="text-xs text-gray-600 dark:text-neutral-400">{voucher.notes}</span>
            </div>
          )}

          {/* Related voucher links */}
          {voucher.isReversal && voucher.reversalOf && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-500">
              <RotateCcw className="w-3 h-3 text-amber-500 flex-shrink-0" />
              <span>Reversal of</span>
              <span className="font-mono font-semibold text-orange-500 dark:text-orange-400">
                {voucher.reversalOf?.voucherNumber ?? String(voucher.reversalOf)}
              </span>
            </div>
          )}
          {voucher.isReversed && voucher.reversedBy && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-500">
              <RotateCcw className="w-3 h-3 text-rose-500 flex-shrink-0" />
              <span>Reversed by</span>
              <span className="font-mono font-semibold text-orange-500 dark:text-orange-400">
                {voucher.reversedBy?.voucherNumber ?? String(voucher.reversedBy)}
              </span>
            </div>
          )}
        </div>

        {/* ── Transaction Lines ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto border-t border-gray-100 dark:border-neutral-800">
          <div className="overflow-x-auto">
            {detailLoading && (
              <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-500 dark:text-neutral-400">
                <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                Loading lines…
              </div>
            )}
            {!detailLoading && (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-neutral-800">
                  <th className="pl-5 pr-3 py-2.5 text-left font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">Account</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">Party</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide">Debit</th>
                  <th className="pr-5 pl-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                {(voucher.lines || []).map((line, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="pl-5 pr-3 py-3 font-mono font-medium text-gray-800 dark:text-neutral-200 whitespace-nowrap">
                      {line.accountName || "—"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {line.partyName
                        ? <span className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 rounded px-1.5 py-0.5">{line.partyName}</span>
                        : <span className="text-gray-300 dark:text-neutral-700">—</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-400 dark:text-neutral-500 max-w-[140px] truncate">
                      {line.description || <span className="text-gray-200 dark:text-neutral-800">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">
                      {line.debit > 0
                        ? <span className="text-blue-600 dark:text-blue-400">{sym} {fmt(line.debit)}</span>
                        : <span className="text-gray-200 dark:text-neutral-800">—</span>}
                    </td>
                    <td className="pr-5 pl-3 py-3 text-right tabular-nums font-semibold">
                      {line.credit > 0
                        ? <span className="text-emerald-600 dark:text-emerald-400">{sym} {fmt(line.credit)}</span>
                        : <span className="text-gray-200 dark:text-neutral-800">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-neutral-700 bg-gray-50/80 dark:bg-neutral-800/30">
                  <td colSpan={3} className="pl-5 pr-3 py-3 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">Total</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-sm text-blue-600 dark:text-blue-400">{sym} {fmt(totalDebit)}</td>
                  <td className="pr-5 pl-3 py-3 text-right tabular-nums font-bold text-sm text-emerald-600 dark:text-emerald-400">{sym} {fmt(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-3 flex-shrink-0 bg-gray-50/50 dark:bg-neutral-900/40">
          <button type="button" onClick={() => printVoucher(voucher._id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print Voucher
          </button>
          <div className="ml-auto flex items-center gap-2">
            {voucher.status === "posted" && !voucher.isReversed && canReverse && (
              <button type="button" onClick={() => setReverseModalOpen(true)} disabled={reversing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-700/50 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" />
                Reverse Voucher
              </button>
            )}
            {voucher.status === "posted" && canCancel && (
              <button type="button" onClick={handleCancel} disabled={cancelling}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800/50 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Cancel Voucher
              </button>
            )}
          </div>
        </div>

        {/* ── Reversal Confirmation Modal ─────────────────────────────────── */}
        {reverseModalOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl max-w-sm w-full mx-6 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Reverse Voucher</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mb-2">
                This will create a new reversal voucher with opposite debit/credit entries.
              </p>
              <p className="text-sm text-gray-500 dark:text-neutral-500 mb-6">
                The original voucher{" "}
                <span className="font-mono font-semibold text-gray-700 dark:text-neutral-300">{voucher.voucherNumber}</span>{" "}
                will remain unchanged for audit trail.
              </p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setReverseModalOpen(false)} disabled={reversing}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={confirmReverse} disabled={reversing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 shadow-sm shadow-amber-500/25">
                  {reversing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Confirm Reverse
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VouchersListPage() {
  const sym = getCurrencySymbol();
  const [vouchers, setVouchers]   = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [voucherDetailLoading, setVoucherDetailLoading] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);

  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function fetchVouchers(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (dateFrom)     params.set("dateFrom", dateFrom);
      if (dateTo)       params.set("dateTo",   dateTo);
      if (typeFilter)   params.set("type",     typeFilter);
      if (statusFilter) params.set("status",   statusFilter);
      const data = await apiFetch(`/api/accounting/vouchers?${params.toString()}`);
      setVouchers(data.vouchers || []);
      setTotal(data.total || 0);
      setPage(data.page  || 1);
    } catch (err) {
      toast.error(err.message || "Failed to load vouchers");
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchVouchers(1); }, []);

  useEffect(() => {
    function handler(e) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) setNewMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleCancelled(id) {
    setVouchers((prev) => prev.map((v) => v._id === id ? { ...v, status: "cancelled" } : v));
    setSelectedVoucher((prev) => prev?._id === id ? { ...prev, status: "cancelled" } : prev);
  }

  function handleReversed(reversalVoucher, originalId) {
    // Prepend the new reversal to the top of the list; mark original as reversed
    setVouchers((prev) => [
      reversalVoucher,
      ...prev.map((v) =>
        v._id === originalId
          ? { ...v, isReversed: true, reversedBy: { _id: reversalVoucher._id, voucherNumber: reversalVoucher.voucherNumber } }
          : v
      ),
    ]);
    // Refresh the open slide-over to show the Reversed badge immediately
    setSelectedVoucher((prev) =>
      prev?._id === originalId
        ? { ...prev, isReversed: true, reversedBy: { _id: reversalVoucher._id, voucherNumber: reversalVoucher.voucherNumber } }
        : prev
    );
  }

  async function openVoucherDetail(v) {
    setSelectedVoucher(v);
    setVoucherDetailLoading(true);
    try {
      const full = await apiFetch(`/api/accounting/vouchers/${v._id}`);
      setSelectedVoucher(full);
    } catch (err) {
      toast.error(err.message || "Could not load voucher details");
    } finally {
      setVoucherDetailLoading(false);
    }
  }

  const hasFilters = dateFrom || dateTo || typeFilter || statusFilter;
  const totalPages = Math.ceil(total / LIMIT);

  // DataTable columns
  const columns = [
    {
      key: "voucherNumber",
      header: "Voucher No.",
      render: (num, v) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openVoucherDetail(v);
            }}
            className="font-mono text-orange-500 dark:text-orange-400 text-sm font-semibold hover:underline text-left"
          >
            {num}
          </button>
          {v.autoPosted && (
            <span className="text-[10px] bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 rounded-full px-2 py-0.5 font-medium">AUTO</span>
          )}
          {v.isReversal && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full px-2 py-0.5 font-semibold">Reversal</span>
          )}
          {v.isReversed && (
            <span className="text-[10px] bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 rounded-full px-2 py-0.5 font-semibold">Reversed</span>
          )}
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (d) => <span className="tabular-nums text-gray-500 dark:text-neutral-400">{fmtDate(d)}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (t) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[t] || ""}`}>
          {TYPE_LABELS[t] || t}
        </span>
      ),
    },
    {
      key: "notes",
      header: "Reference / Notes",
      hideOnMobile: true,
      render: (notes, v) => (
        <span className="text-xs text-gray-400 dark:text-neutral-500 truncate block max-w-[200px]">
          {notes || v.referenceNo || "—"}
        </span>
      ),
    },
    {
      key: "totalAmount",
      header: "Amount",
      align: "right",
      render: (n) => <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{sym} {fmt(n)}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (s) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[s] || ""}`}>
          {s}
        </span>
      ),
    },
    {
      key: "_actions",
      header: "Actions",
      align: "right",
      render: (_, v) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openVoucherDetail(v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" title="View">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => printVoucher(v._id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" title="Print">
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Vouchers">
      <div className="space-y-4">
        <VoucherPagesNav />

        {/* Stats strip */}
        <StatsStrip vouchers={vouchers} total={total} loading={loading} />

        {/* Toolbar: filters + New Voucher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date From */}
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors" />

          {/* Date To */}
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors" />

          {/* Type */}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={filterSelectCls}>
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          {/* Status */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterSelectCls}>
            <option value="">All Statuses</option>
            <option value="posted">Posted</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Apply */}
          <button type="button" onClick={() => fetchVouchers(1)}
            className="h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-xs font-semibold text-white transition-colors">
            Apply
          </button>

          {/* Clear */}
          {hasFilters && (
            <button type="button" onClick={() => {
              setDateFrom(""); setDateTo(""); setTypeFilter(""); setStatusFilter("");
              setTimeout(() => fetchVouchers(1), 0);
            }} className="text-xs text-gray-400 dark:text-neutral-600 hover:text-gray-700 dark:hover:text-neutral-300 underline underline-offset-2">
              Clear
            </button>
          )}

          <span className="text-xs text-gray-400 dark:text-neutral-600">{total} {total === 1 ? "voucher" : "vouchers"}</span>

          {/* Refresh + New Voucher — pushed right */}
          <button type="button" onClick={() => fetchVouchers(page)}
            className="ml-auto flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* New Voucher dropdown */}
          <div ref={newMenuRef} className="relative">
            <button type="button" onClick={() => setNewMenuOpen((v) => !v)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20">
              <Plus className="w-4 h-4" /> New Voucher <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {newMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden z-20">
                {NEW_VOUCHER_MENU_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href}
                    className="block px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors">
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <DataTable
          variant="card"
          columns={columns}
          data={vouchers}
          getRowId={(row) => row._id}
          loading={loading}
          emptyMessage={
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                <FileX className="w-7 h-7 text-gray-400 dark:text-neutral-500" />
              </div>
              {hasFilters ? (
                <>
                  <p className="text-base font-medium text-gray-700 dark:text-neutral-300 mb-1">No vouchers match your filters</p>
                  <p className="text-sm text-gray-500 dark:text-neutral-500 text-center max-w-xs mb-4">
                    Try adjusting the date range, type, or status filters.
                  </p>
                  <button type="button" onClick={() => {
                    setDateFrom(""); setDateTo(""); setTypeFilter(""); setStatusFilter("");
                    setTimeout(() => fetchVouchers(1), 0);
                  }} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                    <X className="w-3.5 h-3.5" /> Clear Filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-base font-medium text-gray-700 dark:text-neutral-300 mb-1">No vouchers yet</p>
                  <p className="text-sm text-gray-500 dark:text-neutral-500 text-center max-w-xs mb-5">
                    Create your first voucher using the New Voucher button above.
                  </p>
                </>
              )}
            </div>
          }
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500 dark:text-neutral-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fetchVouchers(page - 1)} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 dark:text-neutral-400 tabular-nums">{page} / {totalPages}</span>
              <button type="button" onClick={() => fetchVouchers(page + 1)} disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedVoucher && (
        <VoucherSlideOver
          voucher={selectedVoucher}
          detailLoading={voucherDetailLoading}
          onClose={() => {
            setSelectedVoucher(null);
            setVoucherDetailLoading(false);
          }}
          onCancelled={handleCancelled}
          onReversed={handleReversed}
        />
      )}
    </AdminLayout>
  );
}
