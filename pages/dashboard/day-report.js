import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";

const paymentRows = [
  { method: "Foodpanda", orders: 9, amount: 12187, percent: "51.7%" },
  { method: "Card", orders: 8, amount: 11415, percent: "48.0%" },
  { method: "Cash", orders: 1, amount: 800, percent: "0.3%" },
  { method: "Total", orders: 18, amount: 23802, percent: "100%" }
];

const orderTypeRows = [
  { type: "Delivery", orders: 9, amount: 12187, percent: "51.7%" },
  { type: "Dine-in", orders: 4, amount: 5600, percent: "23.5%" },
  { type: "Takeaway", orders: 5, amount: 8015, percent: "24.8%" }
];

export default function DayReportPage() {
  const salesDetails = {
    grossSales: 23802,
    netSales: 23802,
    discounts: 0,
    deliveryCharges: 0,
    totalRevenue: 23802,
    taxAmount: 0
  };

  const insights = {
    totalOrders: 18,
    completedSales: 17,
    paidSales: 18,
    cancelledToday: 0
  };

  return (
    <AdminLayout title="Day Report">
      {/* Branch / Day header */}
      <Card title="Today's Day Report">
        <div className="grid gap-4 md:grid-cols-4 text-xs">
          <div>
            <div className="text-neutral-500">Branch</div>
            <div className="font-semibold text-gray-900">Main Branch</div>
          </div>
          <div>
            <div className="text-neutral-500">Day Opened</div>
            <div className="font-semibold text-gray-900">Feb 9, 2026</div>
          </div>
          <div>
            <div className="text-neutral-500">Day Closed</div>
            <div className="font-semibold text-gray-900">N/A</div>
          </div>
          <div>
            <div className="text-neutral-500">Status</div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-[11px] font-medium">
              Open
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

      {/* Payment wise sales */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Payment Wise Sales">
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
        </Card>

        {/* Order type sales */}
        <Card title="Order Type Sales">
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
        </Card>
      </div>
    </AdminLayout>
  );
}

