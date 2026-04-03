import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import DataTable from "../../../../components/ui/DataTable";
import {
  Loader2,
  BookOpen,
  Printer,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Download,
  Building2,
  FileSearch,
  TrendingDown,
  Users,
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

function fmtAmt(n) {
  return fmtMoneyPK(n);
}

function fmtDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("T")[0].split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const dateInputCls =
  "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors";

function exportCSV(suppliers, asOfDate, totalPayable) {
  const headers = ["#", "Supplier", "Phone", "Balance Payable"];
  const lines = [
    headers.join(","),
    ...suppliers.map((s, i) =>
      [
        i + 1,
        `"${String(s.name || "").replace(/"/g, '""')}"`,
        `"${String(s.phone || "").replace(/"/g, '""')}"`,
        s.balance ?? 0,
      ].join(","),
    ),
    ["Total", "", "", totalPayable ?? 0].join(","),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payables-${asOfDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SummaryCards({ sym, totalPayable, supplierCount, asOfDate }) {
  const cards = [
    {
      label: "Total payable",
      value: `${sym} ${fmtAmt(totalPayable)}`,
      sub: `As of ${fmtDisplayDate(asOfDate)}`,
      icon: TrendingDown,
      iconClass: "text-orange-500 dark:text-orange-400",
    },
    {
      label: "Suppliers with balance",
      value: String(supplierCount),
      sub: "Amounts you owe",
      icon: Users,
      iconClass: "text-gray-400 dark:text-neutral-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
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

export default function PayablesPage() {
  const sym = getCurrencySymbol();
  const router = useRouter();
  const [asOfDate, setAsOfDate] = useState(today());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const runReport = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const data = await apiFetch(
        `/api/accounting/reports/payables?asOfDate=${asOfDate}`,
      );
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to load payables");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  function resetFilters() {
    setAsOfDate(today());
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

  const suppliers = report?.suppliers || [];
  const hasRows = suppliers.length > 0;

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Supplier",
        render: (name) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {name || "—"}
          </span>
        ),
      },
      {
        key: "phone",
        header: "Phone",
        hideOnMobile: true,
        render: (p) => (
          <span className="text-gray-500 dark:text-neutral-400">
            {p || "—"}
          </span>
        ),
      },
      {
        key: "balance",
        header: "Balance payable",
        align: "right",
        cellClassName: "tabular-nums",
        render: (bal) => (
          <span className="font-semibold text-orange-500 dark:text-orange-400">
            {sym} {fmtAmt(bal)}
          </span>
        ),
      },
      {
        key: "_ledger",
        header: "Ledger",
        align: "center",
        render: (_, row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(
                `/dashboard/accounting/reports/ledger?partyId=${row._id}`,
              );
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </button>
        ),
      },
      {
        key: "_pay",
        header: "Pay",
        align: "center",
        render: (_, row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const q = new URLSearchParams({
                partyId: String(row._id),
                partyName: String(row.name || ""),
                suggestedAmount: String(row.balance ?? 0),
              });
              router.push(
                `/dashboard/accounting/vouchers/cash-payment?${q.toString()}`,
              );
            }}
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm shadow-orange-500/20 transition-colors"
          >
            Pay
          </button>
        ),
      },
    ],
    [router, sym],
  );

  function handleExportCSV() {
    if (!report || !hasRows) {
      toast.error("Run a report with suppliers first");
      return;
    }
    exportCSV(suppliers, asOfDate, report.totalPayable);
    setExportOpen(false);
  }

  function handleExportPrint() {
    setExportOpen(false);
    window.print();
  }

  const tableRows = useMemo(() => {
    let i = 0;
    return suppliers.map((s) => ({ ...s, __stripe: i++ % 2 === 1 }));
  }, [suppliers]);

  return (
    <AdminLayout title="Payables">
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="space-y-4">
        <ReportsNav />
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <Building2 className="w-4 h-4 text-gray-500 dark:text-neutral-400" />

          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Supplier balances you still owe as of a chosen date. Run the report,
            export CSV, or open a party&apos;s ledger from the table.
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Report parameters
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">
              Supplier AP
            </span>
          </div>
          <div className="p-5">
            <div className="max-w-xs">
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                As of date
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className={`w-full ${dateInputCls}`}
              />
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 rounded-b-2xl flex flex-wrap items-center justify-end gap-2 overflow-visible relative z-10">
            <button
              type="button"
              onClick={() => hasRun && runReport()}
              disabled={loading || !hasRun}
              title="Refresh with current date"
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
              onClick={resetFilters}
              className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Reset
            </button>
            <div className="relative z-50" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                disabled={!hasRows}
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
          <h2 className="text-lg font-bold">
            Payables — as of {fmtDisplayDate(asOfDate)}
          </h2>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Loading payables…
            </p>
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Couldn&apos;t load payables
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              Try again with Run Report, or check your connection.
            </p>
          </div>
        )}

        {!loading && report && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Results
              </h2>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                As of {fmtDisplayDate(asOfDate)}
                <span className="text-gray-400 dark:text-neutral-600">
                  {" "}
                  · {suppliers.length}{" "}
                  {suppliers.length === 1 ? "supplier" : "suppliers"}
                </span>
              </p>
            </div>

            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-neutral-800 no-print">
              <SummaryCards
                sym={sym}
                totalPayable={report.totalPayable}
                supplierCount={suppliers.length}
                asOfDate={asOfDate}
              />
            </div>

            {!hasRows ? (
              <div className="text-center py-16 px-6 border-t border-gray-100 dark:border-neutral-800">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
                  <FileSearch className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  No outstanding payables
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
                  No supplier balances as of {fmtDisplayDate(asOfDate)}.
                </p>
              </div>
            ) : (
              <>
                <div className="no-print px-0 sm:px-1 pb-1">
                  <DataTable
                    columns={columns}
                    data={tableRows}
                    getRowId={(row) => row._id}
                    getRowClassName={(row) =>
                      row.__stripe ? "bg-gray-50/50 dark:bg-neutral-900/35" : ""
                    }
                    tableClassName="payables-print-table text-sm"
                    emptyMessage="No suppliers"
                    loading={false}
                  />
                </div>
                <div className="hidden print:block px-4 pb-4">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-2 text-left">
                          Supplier
                        </th>
                        <th className="border border-gray-300 px-2 py-2 text-left">
                          Phone
                        </th>
                        <th className="border border-gray-300 px-2 py-2 text-right">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((s) => (
                        <tr key={s._id}>
                          <td className="border border-gray-300 px-2 py-2">
                            {s.name}
                          </td>
                          <td className="border border-gray-300 px-2 py-2">
                            {s.phone || "—"}
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">
                            {sym} {fmtAmt(s.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td
                          colSpan={2}
                          className="border border-gray-300 px-2 py-2"
                        >
                          Total
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-right tabular-nums">
                          {sym} {fmtAmt(report.totalPayable)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 flex items-center justify-between no-print">
                  <span className="text-sm font-medium text-gray-600 dark:text-neutral-400">
                    {suppliers.length} suppliers
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                    Total{" "}
                    <span className="text-orange-500 dark:text-orange-400">
                      {sym} {fmtAmt(report.totalPayable)}
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
