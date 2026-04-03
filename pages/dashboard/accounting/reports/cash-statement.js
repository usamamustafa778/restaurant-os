import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../../../components/layout/AdminLayout";
import { Loader2, Search, X, BookOpen, Printer, Download } from "lucide-react";
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

function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split("T")[0];
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

function fmtAmt(n) {
  return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Account picker ───────────────────────────────────────────────────────────

function AccountSelect({ value, onChange }) {
  const [q, setQ]           = useState("");
  const [opts, setOpts]     = useState([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const debRef              = useRef(null);
  const wrapRef             = useRef(null);

  async function search(query) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ type: "asset" });
      if (query) p.set("q", query);
      const data = await apiFetch(`/api/accounting/accounts?${p.toString()}`);
      const all = (data.accounts || []).filter((a) =>
        ["301","302","303"].some((prefix) => a.code.startsWith(prefix))
      );
      setOpts(all);
    } catch { setOpts([]); } finally { setLoading(false); }
  }

  useEffect(() => { clearTimeout(debRef.current); debRef.current = setTimeout(() => search(q), 300); }, [q]);
  useEffect(() => { search(""); }, []);
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = value ? opts.find((o) => o._id === value) : null;

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-1 focus:ring-orange-500 hover:border-neutral-600 min-w-[220px]">
        <span className={`truncate ${selected ? "text-white" : "text-neutral-500"}`}>
          {selected ? `${selected.code} – ${selected.name}` : "Select account…"}
        </span>
        {value && <span onMouseDown={(e) => { e.stopPropagation(); onChange(null, null); }} className="text-neutral-500 hover:text-white flex-shrink-0"><X className="w-3 h-3" /></span>}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-700">
            <Search className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none" />
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500 flex-shrink-0" />}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {opts.length === 0
              ? <p className="px-3 py-3 text-xs text-neutral-500">No results</p>
              : opts.map((o) => (
                <button key={o._id} type="button"
                  onMouseDown={() => { onChange(o._id, o); setOpen(false); setQ(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 transition-colors ${o._id === value ? "text-orange-400 bg-orange-500/10" : "text-white"}`}>
                  {o.code} – {o.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function exportCSV(report, accountName, dateFrom, dateTo) {
  const headers = ["Section","Date","Voucher No","Voucher Type","Description","Amount"];
  const rows = [];

  rows.push(["RECEIPTS","","","","Opening Balance", report.openingBalance.toFixed(2)]);
  report.receipts.forEach((e) => rows.push([
    "RECEIPTS", fmtDate(e.date), e.voucherNumber || "", e.voucherType || "",
    `"${(e.description||"").replace(/"/g,'""')}"`, e.debit.toFixed(2),
  ]));
  rows.push(["PAYMENTS","","","","","",]);
  report.payments.forEach((e) => rows.push([
    "PAYMENTS", fmtDate(e.date), e.voucherNumber || "", e.voucherType || "",
    `"${(e.description||"").replace(/"/g,'""')}"`, e.credit.toFixed(2),
  ]));

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `cash-statement-${accountName}-${dateFrom}-${dateTo}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Entry table ──────────────────────────────────────────────────────────────

function EntryTable({ entries, amtKey, color, label }) {
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden mb-6">
      <div className={`px-4 py-2.5 border-b border-neutral-800 ${color} text-xs font-bold uppercase tracking-wider`}>
        {label}
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-500 text-center">No entries</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-900 border-b border-neutral-800">
              {["Date","Voucher No","Type","Description","Amount"].map((h) => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-neutral-950 divide-y divide-neutral-800/50">
            {entries.map((e, i) => (
              <tr key={i} className="hover:bg-neutral-900/40 transition-colors">
                <td className="px-4 py-2.5 text-neutral-400 tabular-nums whitespace-nowrap">{fmtDate(e.date)}</td>
                <td className="px-4 py-2.5 font-mono text-orange-400 text-xs">{e.voucherNumber || "—"}</td>
                <td className="px-4 py-2.5">
                  {e.voucherType && <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">{e.voucherType}</span>}
                </td>
                <td className="px-4 py-2.5 text-white max-w-[200px] truncate">{e.description || "—"}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${amtKey === "debit" ? "text-emerald-400" : "text-red-400"}`}>
                  Rs {fmtAmt(e[amtKey])}
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
  const [accountId, setAccountId]   = useState(null);
  const [accountObj, setAccountObj] = useState(null);
  const [dateFrom, setDateFrom]     = useState(monthStart());
  const [dateTo, setDateTo]         = useState(today());
  const [report, setReport]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [hasRun, setHasRun]         = useState(false);

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

  return (
    <AdminLayout>
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 no-print flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Cash / Bank Statement</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Receipts and payments for a cash or bank account</p>
          </div>
          {report && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => exportCSV(report, accountObj?.name || "account", dateFrom, dateTo)}
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

        {/* Filters */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6 no-print">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Account <span className="text-red-400">*</span></label>
              <AccountSelect value={accountId} onChange={(v, obj) => { setAccountId(v); setAccountObj(obj); }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <button type="button" onClick={runReport} disabled={loading || !accountId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Run Report
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4 text-center">
          <h2 className="text-lg font-bold">Cash / Bank Statement — {accountObj?.name}</h2>
          <p className="text-sm text-gray-600">{dateFrom} to {dateTo}</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        )}

        {!loading && report && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 no-print">
              {[
                { label: "Opening Balance", value: report.openingBalance, color: "text-white" },
                { label: "Total Receipts",  value: report.totalReceipts,  color: "text-emerald-400" },
                { label: "Total Payments",  value: report.totalPayments,  color: "text-red-400" },
                { label: "Closing Balance", value: report.closingBalance, color: report.closingBalance >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map((c) => (
                <div key={c.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-1">{c.label}</p>
                  <p className={`text-base font-bold tabular-nums ${c.color}`}>
                    {c.value < 0 ? "-" : ""}Rs {fmtAmt(c.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Print summary */}
            <div className="hidden print:flex gap-8 mb-6 border-b border-gray-300 pb-4">
              {[
                { label: "Opening Balance", value: report.openingBalance },
                { label: "Total Receipts",  value: report.totalReceipts },
                { label: "Total Payments",  value: report.totalPayments },
                { label: "Closing Balance", value: report.closingBalance },
              ].map((c) => (
                <div key={c.label}>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-base font-bold">Rs {fmtAmt(c.value)}</p>
                </div>
              ))}
            </div>

            <EntryTable entries={report.receipts} amtKey="debit"  color="bg-emerald-500/10 text-emerald-400" label="Receipts (Money In)" />
            <EntryTable entries={report.payments} amtKey="credit" color="bg-red-500/10 text-red-400"         label="Payments (Money Out)" />
          </>
        )}

        {!loading && hasRun && !report && (
          <div className="text-center py-16 text-neutral-500 text-sm">No data available.</div>
        )}
      </div>
    </AdminLayout>
  );
}
