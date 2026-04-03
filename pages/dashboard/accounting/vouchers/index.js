import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../../components/layout/AdminLayout";
import {
  ChevronLeft, ChevronRight, Eye, Printer, X, Loader2,
  ChevronDown, Plus, FileText,
} from "lucide-react";
import { getStoredAuth } from "../../../../lib/apiClient";
import toast from "react-hot-toast";

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

// ─── Constants ───────────────────────────────────────────────────────────────

const LIMIT = 50;

const TYPE_LABELS = {
  cash_payment:  "Cash Payment",
  cash_receipt:  "Cash Receipt",
  bank_payment:  "Bank Payment",
  bank_receipt:  "Bank Receipt",
  journal:       "Journal",
  card_transfer: "Card Transfer",
};

const TYPE_COLORS = {
  cash_payment:  "bg-red-500/15 text-red-400 ring-red-500/20",
  cash_receipt:  "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  bank_payment:  "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  bank_receipt:  "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  journal:       "bg-violet-500/15 text-violet-400 ring-violet-500/20",
  card_transfer: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/20",
};

const STATUS_COLORS = {
  posted:    "bg-emerald-500/15 text-emerald-400",
  draft:     "bg-yellow-500/15 text-yellow-400",
  cancelled: "bg-neutral-500/15 text-neutral-500",
};

const NEW_VOUCHER_LINKS = [
  { href: "/accounting/vouchers/cash-payment", label: "Cash Payment" },
  { href: "/accounting/vouchers/cash-receipt",  label: "Cash Receipt" },
  { href: "/accounting/vouchers/bank-payment",  label: "Bank Payment" },
  { href: "/accounting/vouchers/bank-receipt",  label: "Bank Receipt" },
  { href: "/accounting/vouchers/journal",        label: "Journal" },
];

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

// ─── Voucher Detail Slide-over ────────────────────────────────────────────────

function VoucherSlideOver({ voucher, onClose, onCancelled }) {
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    if (!window.confirm(`Cancel voucher ${voucher.voucherNumber}? This will reverse all journal entries.`)) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/accounting/vouchers/${voucher._id}/cancel`, { method: "POST" });
      toast.success("Voucher cancelled");
      onCancelled(voucher._id);
    } catch (err) {
      toast.error(err.message || "Failed to cancel voucher");
    } finally {
      setCancelling(false);
    }
  }

  const totalDebit  = (voucher.lines || []).reduce((s, l) => s + (l.debit  || 0), 0);
  const totalCredit = (voucher.lines || []).reduce((s, l) => s + (l.credit || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TYPE_COLORS[voucher.type] || ""}`}>
              {TYPE_LABELS[voucher.type] || voucher.type}
            </span>
            <span className="font-mono text-orange-400 text-sm font-semibold">{voucher.voucherNumber}</span>
            {voucher.autoPosted && <span className="text-[10px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">AUTO</span>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => window.open(`${API}/api/accounting/vouchers/${voucher._id}/print`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            {voucher.status !== "cancelled" && (
              <button type="button" onClick={handleCancel} disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/50 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Cancel
              </button>
            )}
            <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-6 py-4 border-b border-neutral-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm flex-shrink-0">
          {[
            ["Date",      fmtDate(voucher.date)],
            ["Status",    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[voucher.status] || ""}`}>{voucher.status}</span>],
            ["Reference", voucher.referenceNo || "—"],
            ["Amount",    `Rs ${(voucher.totalAmount || 0).toLocaleString()}`],
            ["Notes",     voucher.notes || "—"],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
              <p className="text-white">{val}</p>
            </div>
          ))}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/50">
                  <th className="pl-6 pr-2 py-3 text-left text-xs font-medium text-neutral-500">Account</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-neutral-500">Party</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-neutral-500">Description</th>
                  <th className="px-2 py-3 text-right text-xs font-medium text-neutral-500">Debit</th>
                  <th className="pr-6 py-3 text-right text-xs font-medium text-neutral-500">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {(voucher.lines || []).map((line, i) => (
                  <tr key={i} className="hover:bg-neutral-800/20">
                    <td className="pl-6 pr-2 py-2.5 text-white text-xs">
                      <span className="font-mono text-neutral-400 mr-1.5">{line.accountName || "—"}</span>
                    </td>
                    <td className="px-2 py-2.5 text-neutral-400 text-xs">{line.partyName || "—"}</td>
                    <td className="px-2 py-2.5 text-neutral-500 text-xs">{line.description || "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-blue-400 text-xs">
                      {line.debit > 0 ? `Rs ${line.debit.toLocaleString()}` : ""}
                    </td>
                    <td className="pr-6 py-2.5 text-right tabular-nums text-emerald-400 text-xs">
                      {line.credit > 0 ? `Rs ${line.credit.toLocaleString()}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-700 bg-neutral-900/50">
                  <td colSpan={3} className="pl-6 py-2.5 text-right text-xs font-semibold text-neutral-400">Total</td>
                  <td className="px-2 py-2.5 text-right tabular-nums font-bold text-blue-400 text-xs">Rs {totalDebit.toLocaleString()}</td>
                  <td className="pr-6 py-2.5 text-right tabular-nums font-bold text-emerald-400 text-xs">Rs {totalCredit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VouchersListPage() {
  const today = new Date().toISOString().split("T")[0];

  const [vouchers, setVouchers]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [newMenuOpen, setNewMenuOpen]  = useState(false);
  const newMenuRef                     = useRef(null);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function fetchVouchers(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (dateFrom)    params.set("dateFrom", dateFrom);
      if (dateTo)      params.set("dateTo",   dateTo);
      if (typeFilter)  params.set("type",     typeFilter);
      if (statusFilter) params.set("status",  statusFilter);
      const data = await apiFetch(`/api/accounting/vouchers?${params.toString()}`);
      setVouchers(data.vouchers || []);
      setTotal(data.total || 0);
      setPage(data.page  || 1);
    } catch (err) {
      toast.error(err.message || "Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchVouchers(1); }, []);

  // Close new-voucher menu on outside click
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

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Vouchers</h1>
            <p className="text-sm text-neutral-500 mt-0.5">All accounting vouchers posted to the general ledger</p>
          </div>
          {/* New Voucher dropdown */}
          <div ref={newMenuRef} className="relative">
            <button type="button" onClick={() => setNewMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors">
              <Plus className="w-4 h-4" /> New Voucher <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {newMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden z-20">
                {NEW_VOUCHER_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href}
                    className="block px-4 py-2.5 text-sm text-white hover:bg-neutral-700 transition-colors">
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3 mb-5 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
              <option value="">All Statuses</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button type="button" onClick={() => fetchVouchers(1)}
            className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors">
            Filter
          </button>
          {(dateFrom || dateTo || typeFilter || statusFilter) && (
            <button type="button" onClick={() => {
              setDateFrom(""); setDateTo(""); setTypeFilter(""); setStatusFilter("");
              setTimeout(() => fetchVouchers(1), 0);
            }} className="text-xs text-neutral-500 hover:text-white underline underline-offset-2 transition-colors">
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-900 border-b border-neutral-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Voucher No.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Notes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="bg-neutral-950 divide-y divide-neutral-800/60">
                {loading ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400 mx-auto" />
                  </td></tr>
                ) : vouchers.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <FileText className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                    <p className="text-neutral-500 text-sm">No vouchers found</p>
                  </td></tr>
                ) : vouchers.map((v) => (
                  <tr key={v._id}
                    onClick={() => setSelectedVoucher(v)}
                    className="hover:bg-neutral-900/50 transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-orange-400 text-sm">{v.voucherNumber}</span>
                        {v.autoPosted && <span className="text-[9px] text-neutral-600 bg-neutral-800 px-1 py-0.5 rounded tracking-wider">AUTO</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 tabular-nums">{fmtDate(v.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TYPE_COLORS[v.type] || ""}`}>
                        {TYPE_LABELS[v.type] || v.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs max-w-[200px] truncate">{v.notes || v.referenceNo || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-medium">
                      Rs {(v.totalAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[v.status] || ""}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setSelectedVoucher(v)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button"
                          onClick={() => window.open(`${API}/api/accounting/vouchers/${v._id}/print`, "_blank")}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors" title="Print">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800 bg-neutral-900">
              <span className="text-xs text-neutral-500">
                Showing {(page-1)*LIMIT + 1}–{Math.min(page*LIMIT, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fetchVouchers(page - 1)} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-neutral-400">{page} / {totalPages}</span>
                <button type="button" onClick={() => fetchVouchers(page + 1)} disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedVoucher && (
        <VoucherSlideOver
          voucher={selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
          onCancelled={handleCancelled}
        />
      )}
    </AdminLayout>
  );
}
