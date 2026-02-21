import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import { getDayReport, SubscriptionInactiveError } from "../../lib/apiClient";
import { Calendar, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

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

  const reportDateObj = report?.date ? new Date(report.date) : new Date(selectedDate);
  const formattedDate = reportDateObj.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

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
          <Card title="Day Report">
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
                    Rs {salesDetails.grossSales.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Net Sales (Inc. Tax)</div>
                  <div className="text-lg font-semibold text-gray-900">
                    Rs {salesDetails.netSales.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Total Revenue</div>
                  <div className="text-lg font-semibold text-gray-900">
                    Rs {salesDetails.totalRevenue.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Discounts</div>
                  <div className="text-lg font-semibold text-rose-500">
                    - Rs {salesDetails.discounts.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Delivery Charges</div>
                  <div className="text-lg font-semibold text-gray-900">
                    Rs {salesDetails.deliveryCharges.toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-neutral-500">Tax Amount</div>
                  <div className="text-lg font-semibold text-gray-900">
                    Rs {salesDetails.taxAmount.toLocaleString()}
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
                    Rs {salesDetails.budgetCost.toLocaleString()}
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
                    Rs {salesDetails.profit.toLocaleString()}
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
                      render: val => `Rs ${val.toLocaleString()}`
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
                      render: val => `Rs ${val.toLocaleString()}`
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
