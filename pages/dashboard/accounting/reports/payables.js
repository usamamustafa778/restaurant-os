import { useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import { Loader2, BookOpen, Printer, ExternalLink } from "lucide-react";
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

function fmtAmt(n) {
  return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayablesPage() {
  const router = useRouter();
  const [asOfDate, setAsOfDate] = useState(today());
  const [report, setReport]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [hasRun, setHasRun]     = useState(false);

  async function runReport() {
    setLoading(true); setHasRun(true);
    try {
      const data = await apiFetch(`/api/accounting/reports/payables?asOfDate=${asOfDate}`);
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to load payables"); setReport(null);
    } finally { setLoading(false); }
  }

  return (
    <AdminLayout>
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 no-print flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Payables Report</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Outstanding amounts owed to suppliers</p>
          </div>
          {report && (
            <button type="button" onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
              <Printer className="w-4 h-4" /> Print
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 mb-6 no-print">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">As of Date</label>
              <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <button type="button" onClick={runReport} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Run Report
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-6 text-center">
          <h2 className="text-lg font-bold">Payables Report — As of {asOfDate}</h2>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        )}

        {!loading && report && (
          <>
            {/* Total card */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-5 mb-6 no-print">
              <p className="text-xs text-orange-100 uppercase tracking-wider font-semibold mb-1">Total Payable</p>
              <p className="text-3xl font-bold text-white tabular-nums">Rs {fmtAmt(report.totalPayable)}</p>
              <p className="text-xs text-orange-200 mt-1">As of {asOfDate} · {report.suppliers.length} supplier{report.suppliers.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Print total */}
            <div className="hidden print:block mb-4 p-3 border border-gray-300 rounded">
              <strong>Total Payable: Rs {fmtAmt(report.totalPayable)}</strong>
            </div>

            {report.suppliers.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 text-sm bg-neutral-900/50 border border-neutral-800 rounded-2xl">
                No outstanding payables as of {asOfDate}.
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-900 border-b border-neutral-800">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Balance Payable</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider no-print">Ledger</th>
                    </tr>
                  </thead>
                  <tbody className="bg-neutral-950 divide-y divide-neutral-800/50">
                    {report.suppliers.map((s, i) => (
                      <tr key={s._id} className="hover:bg-neutral-900/40 transition-colors">
                        <td className="px-4 py-3 text-neutral-600 text-xs tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-neutral-400">{s.phone || "—"}</td>
                        <td className="px-4 py-3 text-right text-orange-400 font-semibold tabular-nums">Rs {fmtAmt(s.balance)}</td>
                        <td className="px-4 py-3 text-center no-print">
                          <button type="button"
                            onClick={() => router.push(`/accounting/reports/ledger?partyId=${s._id}`)}
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> View Ledger
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-neutral-900 border-t border-neutral-700">
                      <td colSpan={3} className="px-4 py-3 text-sm font-bold text-white">Total</td>
                      <td className="px-4 py-3 text-right text-orange-400 font-bold tabular-nums">Rs {fmtAmt(report.totalPayable)}</td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}

        {!loading && hasRun && !report && (
          <div className="text-center py-16 text-neutral-500 text-sm">No data available.</div>
        )}
      </div>
    </AdminLayout>
  );
}
