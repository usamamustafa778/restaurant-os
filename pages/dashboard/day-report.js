import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import {
  getDayReport,
  SubscriptionInactiveError,
  getCurrencySymbol,
} from "../../lib/apiClient";
import { Calendar, Loader2, FileDown, Printer } from "lucide-react";
import toast from "react-hot-toast";

// ─── Export helpers ───────────────────────────────────────────────────────────

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function downloadCSV(filename, rows) {
  const content = rows.map(toCSVRow).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function DayReportPage() {
  const [report, setReport] = useState(null);
  const [pageLoading, setPageLoading] = useState(true) ;
  const [suspended, setSuspended] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    (async () => {
      setPageLoading(true);
      try {
        const data = await getDayReport(selectedDate);
        setReport(data);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          console.error("Failed to load day report:", err);
          toast.error(err.message || "Failed to load day report");
        }
      } finally {
        setPageLoading(false);
      }
    })();
  }, [selectedDate]);

  const salesDetails = report?.salesDetails || {
    grossSales: 0, netSales: 0, discounts: 0, deliveryCharges: 0,
    totalRevenue: 0, taxAmount: 0, budgetCost: 0, profit: 0,
  };
  const insights = report?.insights || {
    totalOrders: 0, completedSales: 0, paidSales: 0, cancelledToday: 0,
  };
  const paymentRows = report?.paymentRows || [];
  const orderTypeRows = report?.orderTypeRows || [];
  const currencySymbol = getCurrencySymbol();

  const reportDateObj = report?.date ? new Date(report.date) : new Date(selectedDate);
  const formattedDate = reportDateObj.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  function handleExportCSV() {
    const rows = [
      ["Day Report"],
      ["Date", formattedDate],
      ["Generated", new Date().toLocaleString("en-PK")],
      [],
      ["SALES DETAILS"],
      ["Metric", `Value (${currencySymbol})`],
      ["Gross Sales", salesDetails.grossSales],
      ["Net Sales (Inc. Tax)", salesDetails.netSales],
      ["Total Revenue", salesDetails.totalRevenue],
      ["Discounts", salesDetails.discounts],
      ["Delivery Charges", salesDetails.deliveryCharges],
      ["Tax Amount", salesDetails.taxAmount],
      [],
      ["BUDGET COST & PROFIT"],
      ["Total Inventory Cost", salesDetails.budgetCost],
      ["Net Profit", salesDetails.profit],
      salesDetails.totalRevenue > 0
        ? ["Profit Margin %", `${((salesDetails.profit / salesDetails.totalRevenue) * 100).toFixed(1)}%`]
        : ["Profit Margin %", "N/A"],
      [],
      ["INSIGHTS"],
      ["Metric", "Count"],
      ["Total Orders", insights.totalOrders],
      ["Completed Sales", insights.completedSales],
      ["Paid Sales", insights.paidSales],
      ["Cancelled Orders", insights.cancelledToday],
      ...(paymentRows.length > 0 ? [
        [],
        ["PAYMENT WISE SALES"],
        ["Payment Method", "Orders", `Amount (${currencySymbol})`, "Percentage"],
        ...paymentRows.map((r) => [r.method, r.orders, r.amount, r.percent]),
      ] : []),
      ...(orderTypeRows.length > 0 ? [
        [],
        ["ORDER TYPE SALES"],
        ["Order Type", "Orders", `Amount (${currencySymbol})`, "Percentage"],
        ...orderTypeRows.map((r) => [r.type, r.orders, r.amount, r.percent]),
      ] : []),
    ];
    downloadCSV(`day-report-${selectedDate}.csv`, rows);
    toast.success("CSV exported");
  }

  function handlePrint() {
    const generated = new Date().toLocaleString("en-PK");
    const isProfit = salesDetails.profit >= 0;
    const marginPct = salesDetails.totalRevenue > 0
      ? ((salesDetails.profit / salesDetails.totalRevenue) * 100).toFixed(1) : "0";

    const paymentTable = paymentRows.length > 0
      ? `<h2>Payment Wise Sales</h2><table>
          <thead><tr><th>Method</th><th>Orders</th><th>Amount</th><th>%</th></tr></thead>
          <tbody>${paymentRows.map((r) => `<tr><td>${r.method}</td><td>${r.orders}</td><td>${currencySymbol} ${r.amount?.toLocaleString?.() ?? r.amount}</td><td>${r.percent}</td></tr>`).join("")}</tbody>
        </table>` : "";

    const orderTypeTable = orderTypeRows.length > 0
      ? `<h2>Order Type Sales</h2><table>
          <thead><tr><th>Type</th><th>Orders</th><th>Amount</th><th>%</th></tr></thead>
          <tbody>${orderTypeRows.map((r) => `<tr><td>${r.type}</td><td>${r.orders}</td><td>${currencySymbol} ${r.amount?.toLocaleString?.() ?? r.amount}</td><td>${r.percent}</td></tr>`).join("")}</tbody>
        </table>` : "";

    const html = `<!DOCTYPE html><html><head><title>Day Report – ${formattedDate}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:900px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .meta{font-size:12px;color:#6b7280;margin-bottom:28px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
  .section{border:1px solid #e5e7eb;border-radius:12px;padding:16px}
  .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;font-weight:700;margin-bottom:12px}
  .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
  .row:last-child{border-bottom:none}
  .val{font-weight:700}
  .profit{color:${isProfit ? "#059669" : "#dc2626"}}
  h2{font-size:14px;font-weight:700;margin:20px 0 10px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:8px 12px;border-bottom:2px solid #e5e7eb}
  td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}
  @media print{body{padding:0}}
</style></head><body>
<h1>Day Report</h1>
<p class="meta">Date: <strong>${formattedDate}</strong> &nbsp;·&nbsp; Generated: ${generated}</p>

<div class="grid2">
  <div class="section">
    <div class="section-title">Sales Details</div>
    <div class="row"><span>Gross Sales</span><span class="val">${currencySymbol} ${salesDetails.grossSales.toLocaleString()}</span></div>
    <div class="row"><span>Net Sales (Inc. Tax)</span><span class="val">${currencySymbol} ${salesDetails.netSales.toLocaleString()}</span></div>
    <div class="row"><span>Total Revenue</span><span class="val">${currencySymbol} ${salesDetails.totalRevenue.toLocaleString()}</span></div>
    <div class="row"><span>Discounts</span><span class="val" style="color:#dc2626">- ${currencySymbol} ${salesDetails.discounts.toLocaleString()}</span></div>
    <div class="row"><span>Delivery Charges</span><span class="val">${currencySymbol} ${salesDetails.deliveryCharges.toLocaleString()}</span></div>
    <div class="row"><span>Tax Amount</span><span class="val">${currencySymbol} ${salesDetails.taxAmount.toLocaleString()}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Insights</div>
    <div class="row"><span>Total Orders</span><span class="val">${insights.totalOrders}</span></div>
    <div class="row"><span>Completed Sales</span><span class="val" style="color:#059669">${insights.completedSales}</span></div>
    <div class="row"><span>Paid Sales</span><span class="val">${insights.paidSales}</span></div>
    <div class="row"><span>Cancelled</span><span class="val" style="color:#dc2626">${insights.cancelledToday}</span></div>
    <div class="row"><span>Inventory Cost</span><span class="val" style="color:#d97706">${currencySymbol} ${salesDetails.budgetCost.toLocaleString()}</span></div>
    <div class="row"><span>Net Profit</span><span class="val profit">${currencySymbol} ${salesDetails.profit.toLocaleString()} (${marginPct}%)</span></div>
  </div>
</div>
${paymentTable}
${orderTypeTable}
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked — please allow pop-ups to print."); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  return (
    <AdminLayout title="Day Report" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <Calendar className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
              Loading day report...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Branch / Day header */}
          <Card title="Day Report"
            headerActions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={pageLoading || !report}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={pageLoading || !report}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
              </div>
            }
          >
        <div className="grid gap-4 md:grid-cols-4 text-xs">
          <div>
            <div className="text-neutral-500">Branch</div>
            <div className="font-semibold text-gray-900">Main Branch</div>
          </div>
          <div>
            <div className="text-neutral-500">Report Date</div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="mt-1 px-2 py-1 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>
          <div>
            <div className="text-neutral-500">Day Opened</div>
            <div className="font-semibold text-gray-900">{formattedDate}</div>
          </div>
          <div>
            <div className="text-neutral-500">Status</div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
              selectedDate === new Date().toISOString().slice(0, 10)
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-neutral-100 text-neutral-600 border border-neutral-300"
            }`}>
              {selectedDate === new Date().toISOString().slice(0, 10) ? "Open" : "Closed"}
            </span>
          </div>
        </div>
          </Card>

          {/* Sales details + Insights */}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Card title="Sales Details">
              <div className="grid gap-3 md:grid-cols-3 text-xs">
                <div className="space-y-1">
                  <div className="text-neutral-500">Gross Sales</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {currencySymbol} {salesDetails.grossSales.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Net Sales (Inc. Tax)</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {currencySymbol} {salesDetails.netSales.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Total Revenue</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {currencySymbol} {salesDetails.totalRevenue.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Discounts</div>
                  <div className="text-lg font-semibold text-rose-500">
                    - {currencySymbol} {salesDetails.discounts.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Delivery Charges</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {currencySymbol} {salesDetails.deliveryCharges.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Tax Amount</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {currencySymbol} {salesDetails.taxAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Insights">
              <div className="grid gap-3 md:grid-cols-2 text-xs">
                <div className="space-y-1">
                  <div className="text-neutral-500">Total Orders</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {insights.totalOrders}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Orders processed today
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Completed Sales</div>
                  <div className="text-lg font-semibold text-emerald-600">
                    {insights.completedSales}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Orders with completed status
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Paid Sales</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {insights.paidSales}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Orders with completed payment
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Total Cancelled Orders</div>
                  <div className="text-lg font-semibold text-rose-500">
                    {insights.cancelledToday}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Orders cancelled today
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Budget Cost & Profit */}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Card title="Budget Cost">
              <div className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Inventory Cost</span>
                  <span className="text-lg font-semibold text-amber-600">
                    {currencySymbol} {salesDetails.budgetCost.toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Calculated from inventory consumption of sold items
                </div>
              </div>
            </Card>
            <Card title="Profit">
              <div className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Net Profit</span>
                  <span className={`text-lg font-semibold ${salesDetails.profit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {currencySymbol} {salesDetails.profit.toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Revenue ({salesDetails.totalRevenue.toLocaleString()}) - Cost ({salesDetails.budgetCost.toLocaleString()})
                </div>
                {salesDetails.totalRevenue > 0 && (
                  <div className="mt-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 h-2">
                    <div
                      className={`h-2 rounded-full ${salesDetails.profit >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, (salesDetails.profit / salesDetails.totalRevenue) * 100))}%` }}
                    />
                  </div>
                )}
                {salesDetails.totalRevenue > 0 && (
                  <div className="text-[11px] text-neutral-400">
                    Profit margin: {((salesDetails.profit / salesDetails.totalRevenue) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Payment wise sales */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card title="Payment Wise Sales">
              {paymentRows.length > 0 ? (
                <DataTable
                  columns={[
                    { key: "method", header: "Payment Method" },
                    { key: "orders", header: "Orders", align: "right" },
                    {
                      key: "amount",
                      header: "Amount",
                      align: "right",
                      render: val => `${currencySymbol} ${val.toLocaleString()}`
                    },
                    { key: "percent", header: "Percentage", align: "right" }
                  ]}
                  rows={paymentRows}
                  getRowId={row => row.method}
                />
              ) : (
                <div className="py-4 text-center text-xs text-neutral-500">No sales data</div>
              )}
            </Card>

            {/* Order type sales */}
            <Card title="Order Type Sales">
              {orderTypeRows.length > 0 ? (
                <DataTable
                  columns={[
                    { key: "type", header: "Order Type" },
                    { key: "orders", header: "Orders", align: "right" },
                    {
                      key: "amount",
                      header: "Amount",
                      align: "right",
                      render: val => `${currencySymbol} ${val.toLocaleString()}`
                    },
                    { key: "percent", header: "Percentage", align: "right" }
                  ]}
                  rows={orderTypeRows}
                  getRowId={row => row.type}
                />
              ) : (
                <div className="py-4 text-center text-xs text-neutral-500">No sales data</div>
              )}
            </Card>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
