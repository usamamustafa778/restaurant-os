import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import { Loader2, Search, Printer, Download, X, BookOpen } from "lucide-react";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0];

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

function fmtAmt(n) {
  if (!n && n !== 0) return "";
  return Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VOUCHER_TYPE_LABELS = {
  cash_payment: "CPV", cash_receipt: "CRV",
  bank_payment: "BPV", bank_receipt: "BRV",
  journal: "JV", card_transfer: "CT",
};

// ─── Searchable async select ──────────────────────────────────────────────────

function AsyncSelect({ placeholder, fetchFn, value, onChange, displayFn, keyFn, className = "" }) {
  const [q, setQ]           = useState("");
  const [opts, setOpts]     = useState([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const debRef              = useRef(null);
  const wrapRef             = useRef(null);

  const search = async (query) => {
    setLoading(true);
    try { setOpts(await fetchFn(query)); } catch { setOpts([]); } finally { setLoading(false); }
  };

  useEffect(() => { clearTimeout(debRef.current); debRef.current = setTimeout(() => search(q), 300); return () => clearTimeout(debRef.current); }, [q]);
  useEffect(() => { search(""); }, []);
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = value ? opts.find((o) => keyFn(o) === value) : null;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-1 focus:ring-orange-500 hover:border-neutral-600 transition-colors">
        <span className={`truncate ${selected ? "text-white" : "text-neutral-500"}`}>
          {selected ? displayFn(selected) : placeholder}
        </span>
        {value && <span onMouseDown={(e) => { e.stopPropagation(); onChange(null, null); }} className="text-neutral-500 hover:text-white flex-shrink-0"><X className="w-3 h-3" /></span>}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-700">
            <Search className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none" />
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500 flex-shrink-0" />}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {opts.length === 0 ? <p className="px-3 py-3 text-xs text-neutral-500">No results</p>
              : opts.map((o) => (
                <button key={keyFn(o)} type="button"
                  onMouseDown={() => { onChange(keyFn(o), o); setOpen(false); setQ(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 transition-colors ${keyFn(o) === value ? "text-orange-400 bg-orange-500/10" : "text-white"}`}>
                  {displayFn(o)}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(rows, accountName) {
  const headers = ["Date", "Voucher No", "Type", "Description", "Party", "Debit", "Credit", "Balance"];
  const lines = [headers.join(","),
    ...rows.map((r) => [
      r.label || fmtDate(r.date),
      r.voucherNumber || "",
      r.typeLabel || "",
      `"${(r.description || "").replace(/"/g, '""')}"`,
      `"${(r.partyName || "").replace(/"/g, '""')}"`,
      r.debit || "",
      r.credit || "",
      r.balance !== undefined ? r.balance.toFixed(2) : "",
    ].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `ledger-${accountName}-${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LedgerPage() {
  const router = useRouter();

  const [accountId, setAccountId]   = useState(null);
  const [accountObj, setAccountObj] = useState(null);
  const [partyId, setPartyId]       = useState(null);
  const [partyObj, setPartyObj]     = useState(null);
  const [dateFrom, setDateFrom]     = useState(monthStart());
  const [dateTo, setDateTo]         = useState(today());

  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun]   = useState(false);

  // Pre-fill from query params (coming from Payables "View Ledger" link)
  useEffect(() => {
    if (router.isReady) {
      if (router.query.accountId) setAccountId(router.query.accountId);
      if (router.query.partyId)   setPartyId(router.query.partyId);
    }
  }, [router.isReady, router.query]);

  const fetchAccounts = async (q) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const d = await apiFetch(`/api/accounting/accounts?${p.toString()}`);
    return d.accounts || [];
  };

  const fetchParties = async (q) => {
    const p = new URLSearchParams({ limit: 40 });
    if (q) p.set("q", q);
    const d = await apiFetch(`/api/accounting/parties?${p.toString()}`);
    return d.parties || [];
  };

  async function runReport() {
    if (!accountId) { toast.error("Please select an account"); return; }
    setLoading(true);
    setHasRun(true);
    try {
      const p = new URLSearchParams({ accountId, dateFrom, dateTo });
      if (partyId) p.set("partyId", partyId);
      const data = await apiFetch(`/api/accounting/reports/ledger?${p.toString()}`);
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to run report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  // Build flat row list for table + CSV
  const tableRows = [];
  if (report) {
    tableRows.push({ label: "Opening Balance", balance: report.openingBalance, isHeader: true });
    report.entries.forEach((e) => {
      tableRows.push({
        ...e,
        typeLabel: VOUCHER_TYPE_LABELS[e.voucherType] || e.voucherType || "",
      });
    });
    tableRows.push({ label: "Closing Balance", balance: report.closingBalance, isHeader: true });
  }

  return (
    <AdminLayout>
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 no-print">
          <div>
            <h1 className="text-xl font-bold text-white">Ledger Report</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Account activity with running balance</p>
          </div>
          {report && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => exportCSV(tableRows, accountObj?.name || "ledger")}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Account <span className="text-red-400">*</span></label>
              <AsyncSelect
                placeholder="Select account…"
                fetchFn={fetchAccounts}
                value={accountId}
                onChange={(v, obj) => { setAccountId(v); setAccountObj(obj); }}
                displayFn={(a) => `${a.code} – ${a.name}`}
                keyFn={(a) => a._id}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Party <span className="text-neutral-600">(optional)</span></label>
              <AsyncSelect
                placeholder="Filter by party…"
                fetchFn={fetchParties}
                value={partyId}
                onChange={(v, obj) => { setPartyId(v); setPartyObj(obj); }}
                displayFn={(p) => p.name}
                keyFn={(p) => p._id}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
          </div>
          <button type="button" onClick={runReport} disabled={loading || !accountId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            Run Report
          </button>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4 text-center">
          <h2 className="text-lg font-bold">Ledger Report — {accountObj?.name}</h2>
          <p className="text-sm text-gray-600">{dateFrom} to {dateTo}{partyObj ? ` · ${partyObj.name}` : ""}</p>
        </div>

        {/* Report table */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="text-center py-16 text-neutral-500 text-sm">No data found for the selected criteria.</div>
        )}

        {!loading && report && (
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-900 border-b border-neutral-800">
                    {["Date","Voucher No","Type","Description","Party","Debit","Credit","Balance"].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider ${["Debit","Credit","Balance"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-neutral-950 divide-y divide-neutral-800/50">
                  {tableRows.map((row, i) => {
                    if (row.isHeader) {
                      const bal = row.balance;
                      const isNeg = bal < 0;
                      return (
                        <tr key={i} className="bg-neutral-900/70">
                          <td colSpan={7} className="px-4 py-3 text-sm font-bold text-white">{row.label}</td>
                          <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${isNeg ? "text-red-400" : "text-emerald-400"}`}>
                            {isNeg ? "-" : ""}Rs {fmtAmt(bal)}
                          </td>
                        </tr>
                      );
                    }
                    const isNeg = row.balance < 0;
                    return (
                      <tr key={i} className="hover:bg-neutral-900/40 transition-colors">
                        <td className="px-4 py-2.5 text-neutral-400 tabular-nums whitespace-nowrap">{fmtDate(row.date)}</td>
                        <td className="px-4 py-2.5 font-mono text-orange-400 text-xs">{row.voucherNumber || "—"}</td>
                        <td className="px-4 py-2.5">
                          {row.typeLabel && (
                            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">{row.typeLabel}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-white max-w-[180px] truncate">{row.description || "—"}</td>
                        <td className="px-4 py-2.5 text-neutral-400 max-w-[140px] truncate">{row.partyName || "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-blue-400">
                          {row.debit > 0 ? `Rs ${fmtAmt(row.debit)}` : ""}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">
                          {row.credit > 0 ? `Rs ${fmtAmt(row.credit)}` : ""}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${isNeg ? "text-red-400" : "text-white"}`}>
                          {isNeg ? "-" : ""}Rs {fmtAmt(row.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
