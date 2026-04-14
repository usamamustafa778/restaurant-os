import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import { Eye, Printer, X, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";
import { getGrns, getAccountingParties, getGrnPrintUrl, getCurrencySymbol } from "../../../lib/apiClient";

function StatCard({ label, value }) {
  return (
    <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[11px] text-gray-500 dark:text-neutral-500">{label}</p>
      <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums">{value}</p>
    </div>
  );
}

export default function PurchaseHistoryPage() {
  const sym = getCurrencySymbol();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ thisMonthTotal: 0, cashTotal: 0, creditTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    supplierId: "",
    paymentType: "",
  });

  async function load() {
    setLoading(true);
    try {
      const data = await getGrns(filters);
      setRows(data?.grns || []);
      setSummary(data?.summary || { thisMonthTotal: 0, cashTotal: 0, creditTotal: 0 });
    } catch (err) {
      toast.error(err.message || "Failed to load purchase history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getAccountingParties({ type: "supplier", limit: 200 })
      .then((d) => setSuppliers(d?.parties || []))
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => { load(); }, [filters.dateFrom, filters.dateTo, filters.supplierId, filters.paymentType]); // eslint-disable-line

  const pendingPayables = useMemo(
    () => rows.filter((r) => r.paymentType === "credit").reduce((sum, r) => sum + Number(r.totalCost || 0), 0),
    [rows]
  );

  const columns = [
    { key: "grnNumber", header: "GRN No", render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: "receivedDate", header: "Date", render: (v) => new Date(v).toLocaleDateString("en-PK") },
    { key: "supplierName", header: "Supplier" },
    { key: "invoiceNumber", header: "Invoice No", render: (v) => v || "—" },
    { key: "lines", header: "Items", align: "center", render: (v) => v?.length || 0 },
    { key: "totalCost", header: "Total", align: "right", render: (v) => `${sym} ${Number(v || 0).toLocaleString()}` },
    { key: "paymentType", header: "Payment", render: (v) => <span className="capitalize">{v}</span> },
    { key: "accountingVoucherNumber", header: "Voucher", render: (v) => v || "—" },
    {
      key: "_actions",
      header: "Actions",
      align: "right",
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <button type="button" className="p-1.5 hover:bg-gray-100 rounded" onClick={() => setDetail(row)}>
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button type="button" className="p-1.5 hover:bg-gray-100 rounded" onClick={() => window.open(getGrnPrintUrl(row._id), "_blank")}>
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Purchase History">
      <div className="space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          <StatCard label="This Month" value={`${sym} ${Number(summary.thisMonthTotal || 0).toLocaleString()}`} />
          <StatCard label="Cash" value={`${sym} ${Number(summary.cashTotal || 0).toLocaleString()}`} />
          <StatCard label="Credit" value={`${sym} ${Number(summary.creditTotal || 0).toLocaleString()}`} />
          <StatCard label="Pending Payables from stock" value={`${sym} ${pendingPayables.toLocaleString()}`} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input type="date" className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={filters.dateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          <input type="date" className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={filters.dateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          <select className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
            value={filters.supplierId} onChange={(e) => setFilters((f) => ({ ...f, supplierId: e.target.value }))}>
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
            {["", "cash", "credit"].map((p) => (
              <button key={p || "all"} type="button" onClick={() => setFilters((f) => ({ ...f, paymentType: p }))}
                className={`px-3 h-9 text-sm ${filters.paymentType === p ? "bg-orange-500 text-white" : "bg-white dark:bg-neutral-900"}`}>
                {p || "All"}
              </button>
            ))}
          </div>
        </div>

        <DataTable variant="card" loading={loading} rows={rows} columns={columns} emptyMessage="No GRNs found." />
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDetail(null)} />
          <div className="w-full max-w-2xl bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4" /> {detail.grnNumber}</h3>
              <button type="button" onClick={() => setDetail(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid md:grid-cols-2 gap-2 text-sm mb-4">
              <p><strong>Date:</strong> {new Date(detail.receivedDate).toLocaleDateString("en-PK")}</p>
              <p><strong>Supplier:</strong> {detail.supplierName}</p>
              <p><strong>Invoice:</strong> {detail.invoiceNumber || "—"}</p>
              <p><strong>PO Ref:</strong> {detail.poNumber || "—"}</p>
              <p><strong>Payment:</strong> {detail.paymentType}</p>
              <p><strong>Voucher:</strong> {detail.accountingVoucherNumber || "—"}</p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              {(detail.lines || []).map((l, i) => (
                <div key={i} className="px-3 py-2 border-b last:border-b-0 text-xs flex justify-between">
                  <span>{l.itemName} ({l.receivedQty} {l.unit} x {l.unitCost})</span>
                  <span>{sym} {Number(l.totalCost || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="px-3 py-2 text-right font-bold bg-orange-50 dark:bg-orange-500/10">
                Grand Total: {sym} {Number(detail.totalCost || 0).toLocaleString()}
              </div>
            </div>
            <div className="mt-4">
              <Button type="button" onClick={() => window.open(getGrnPrintUrl(detail._id), "_blank")}>
                <Printer className="w-4 h-4" /> Print GRN
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
