import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getSalesReport, SubscriptionInactiveError } from "../../lib/apiClient";
import { Filter } from "lucide-react";

export default function HistoryPage() {
  const [filters, setFilters] = useState({
    from: "",
    to: ""
  });
  const [report, setReport] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    topItems: []
  });

  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");

  async function loadReport(input = filters) {
    try {
      const data = await getSalesReport(input);
      setReport({
        totalRevenue: data.totalRevenue || 0,
        totalOrders: data.totalOrders || 0,
        topItems: data.topItems || []
      });
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        console.error("Failed to load sales report:", err);
        setError(err.message || "Failed to load sales report");
      }
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApplyFilters(e) {
    e.preventDefault();
    await loadReport(filters);
  }

  function handleResetFilters() {
    const reset = { from: "", to: "" };
    setFilters(reset);
    loadReport(reset);
  }

  return (
    <AdminLayout title="Sales & Inventory Reports" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <Card
        title="Filters"
        description="View daily or monthly performance and top‑selling items."
      >
        <form
          onSubmit={handleApplyFilters}
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-end text-xs mb-4"
        >
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px]">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={e =>
                setFilters(prev => ({ ...prev, from: e.target.value }))
              }
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px]">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={e =>
                setFilters(prev => ({ ...prev, to: e.target.value }))
              }
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>

          <Button type="submit" className="gap-1">
            <Filter className="w-3 h-3" />
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleResetFilters}
            className="text-neutral-300"
          >
            Reset
          </Button>
        </form>

        <div className="grid gap-4 md:grid-cols-3 mb-4 text-xs">
          <div className="rounded-xl border border-gray-300 bg-bg-secondary p-4">
            <p className="text-[11px] text-gray-900 mb-1">Total revenue</p>
            <p className="text-xl font-semibold text-gray-900">
              PKR {report.totalRevenue.toFixed(0)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-300 bg-bg-secondary p-4">
            <p className="text-[11px] text-gray-900 mb-1">Total orders</p>
            <p className="text-xl font-semibold text-gray-900">{report.totalOrders}</p>
          </div>
          <div className="rounded-xl border border-gray-300 bg-bg-secondary p-4">
            <p className="text-[11px] text-gray-900 mb-1">Average ticket</p>
            <p className="text-xl font-semibold text-gray-900">
              PKR{" "}
              {report.totalOrders
                ? Math.round(report.totalRevenue / report.totalOrders)
                : 0}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[11px] uppercase text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Quantity sold</th>
                <th className="py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {report.topItems.map(item => (
                <tr key={item.menuItemId} className="hover:bg-bg-primary">
                  <td className="py-3 pr-3">
                    <div className="font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="py-3 pr-3 text-right">{item.quantity}</td>
                  <td className="py-3 pr-3 text-right">
                    PKR {item.revenue?.toFixed ? item.revenue.toFixed(0) : item.revenue}
                  </td>
                </tr>
              ))}

              {report.topItems.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="py-6 text-center text-xs text-neutral-500"
                  >
                    No sales data for this range yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminLayout>
  );
}

