import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getSalesReport, SubscriptionInactiveError } from "../../lib/apiClient";
import { Filter, BarChart3, DollarSign, ShoppingBag, TrendingUp, Calendar, HelpCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function HistoryPage() {
  const [showDateHelpModal, setShowDateHelpModal] = useState(false);
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
  const [pageLoading, setPageLoading] = useState(true);

  async function loadReport(input = filters) {
    try {
      const data = await getSalesReport(input);
      setReport({
        totalRevenue: data.totalRevenue || 0,
        totalOrders: data.totalOrders || 0,
        topItems: data.topItems || []
      });
      setPageLoading(false);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        console.error("Failed to load sales report:", err);
        toast.error(err.message || "Failed to load sales report");
      }
      setPageLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApplyFilters(e) {
    e.preventDefault();
    const toastId = toast.loading("Loading report...");
    try {
      await loadReport(filters);
      toast.success("Report loaded successfully!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to load report", { id: toastId });
    }
  }

  function handleResetFilters() {
    const reset = { from: "", to: "" };
    setFilters(reset);
    loadReport(reset);
  }

  return (
    <AdminLayout title="Sales & Reports" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <BarChart3 className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
              Loading sales report...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-6 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Date Range Filter</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Select a custom date range for your report</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDateHelpModal(true)}
            className="p-2 rounded-lg text-gray-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            title="How does date filtering work?"
            aria-label="How does date filtering work?"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleApplyFilters}
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] items-end"
        >
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={e =>
                setFilters(prev => ({ ...prev, from: e.target.value }))
              }
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={e =>
                setFilters(prev => ({ ...prev, to: e.target.value }))
              }
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>

          <button 
            type="submit" 
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            <Filter className="w-4 h-4" />
            Apply Filter
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Reset
          </button>
        </form>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-5 md:grid-cols-3 mb-6">
        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-2xl hover:border-primary/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mb-2">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              Rs {report.totalRevenue.toFixed(0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-2xl hover:border-purple-300 dark:hover:border-purple-500/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mb-2">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{report.totalOrders}</p>
          </div>
        </div>

        <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-2xl hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400 mb-2">Average Ticket</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              Rs{" "}
              {report.totalOrders
                ? Math.round(report.totalRevenue / report.totalOrders).toLocaleString()
                : 0}
            </p>
          </div>
        </div>
      </div>

      {/* Top Items Table */}
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all">
        <div className="px-6 py-5 border-b-2 border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-gray-50/50 dark:from-neutral-900/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Top Selling Items</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Best performing products in selected period</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-neutral-900/50 dark:to-neutral-900/30">
              <tr>
                <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Item</th>
                <th className="py-4 px-6 text-center font-bold text-gray-700 dark:text-neutral-300">Quantity Sold</th>
                <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100 dark:divide-neutral-800">
              {report.topItems.map((item, index) => (
                <tr key={item.menuItemId} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold shadow-lg">
                        #{index + 1}
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white">{item.name}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center min-w-[60px] px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold">
                      {item.quantity}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="text-base font-bold text-primary">
                      Rs {item.revenue?.toFixed ? item.revenue.toFixed(0).toLocaleString() : item.revenue}
                    </span>
                  </td>
                </tr>
              ))}

              {report.topItems.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
                        <BarChart3 className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No sales data for this range</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Try selecting a different date range</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        </>
      )}

      {/* Date filter help modal */}
      {showDateHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDateHelpModal(false)}>
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">How date filtering works</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-neutral-300">
              <p>
                <strong>From date</strong> — Report includes from the <strong>start of this day</strong> (00:00).
              </p>
              <p>
                <strong>To date</strong> — Report includes up to the <strong>start of this day</strong> (00:00). So the &quot;To&quot; date itself is not included; only the moment at midnight is.
              </p>
              <p className="text-gray-600 dark:text-neutral-400">
                <strong>Example:</strong> If you select From <strong>14 Feb</strong> and To <strong>15 Feb</strong>, you get completed orders from the <strong>full day of the 14th only</strong>. To include the 15th as well, select To <strong>16 Feb</strong> (or the day after your last desired day).
              </p>
              <p className="text-gray-600 dark:text-neutral-400">
                Only <strong>completed</strong> orders are included in revenue, orders count, and top selling items.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDateHelpModal(false)}
                className="px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

