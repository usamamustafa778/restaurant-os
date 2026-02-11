import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import { getOverview, SubscriptionInactiveError, getStoredAuth } from "../../lib/apiClient";
import { DollarSign, ShoppingBag, Timer, TrendingUp, TrendingDown } from "lucide-react";

// Simple SVG line chart for hourly trend
function MiniLineChart({ data }) {
  const width = 220;
  const height = 60;
  const bottomMargin = 18;
  const leftMargin = 24;
  const innerWidth = width - leftMargin;
  const innerHeight = height - bottomMargin;
  const max = Math.max(...data, 1);

  const points = data
    .map((v, i) => {
      const x = leftMargin + (i / (data.length - 1 || 1)) * innerWidth;
      const y = innerHeight - (v / max) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const hours = Array.from({ length: 24 }, (_, i) =>
    `${i.toString().padStart(2, "0")}:00`
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Axes */}
      <line
        x1={leftMargin}
        y1={innerHeight}
        x2={width}
        y2={innerHeight}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
      <line
        x1={leftMargin}
        y1={0}
        x2={leftMargin}
        y2={innerHeight}
        stroke="#e5e7eb"
        strokeWidth="1"
      />

      {/* Line + area */}
      <polyline
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        points={points}
      />
      <polygon
        fill="url(#lineFill)"
        points={`${points} ${leftMargin + innerWidth},${innerHeight} ${leftMargin},${innerHeight}`}
      />

      {/* Y axis labels (0 and max) */}
      <text
        x={leftMargin - 4}
        y={innerHeight}
        textAnchor="end"
        fontSize="7"
        fill="#9ca3af"
        dy="-1"
      >
        0
      </text>
      <text
        x={leftMargin - 4}
        y={0}
        textAnchor="end"
        fontSize="7"
        fill="#9ca3af"
        dy="6"
      >
        {max >= 1000 ? `${(max / 1000).toFixed(0)}k` : max}
      </text>

      {/* X axis labels for each hour (tilted for readability, show every hour) */}
      {hours.map((label, i) => {
        const x = leftMargin + (i / (hours.length - 1)) * innerWidth;
        const y = height - 1;
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="end"
            fontSize="7"
            fill="#9ca3af"
            transform={`rotate(-45 ${x} ${y})`}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// Simple multi-segment pie chart using stroked circles
function MiniPieChart({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 40 40" className="w-24 h-24">
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke="#111827"
        strokeWidth="8"
      />
      {segments.map((seg, idx) => {
        const fraction = seg.value / total;
        const dash = fraction * circumference;
        const dashArray = `${dash} ${circumference - dash}`;
        const rotation = (offset / total) * 360 - 90;
        offset += seg.value;
        return (
          <circle
            key={idx}
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="8"
            strokeDasharray={dashArray}
            transform={`rotate(${rotation} 20 20)`}
          />
        );
      })}
    </svg>
  );
}

// Map distribution keys to display labels and colors
const typeColors = { DINE_IN: "#f97316", TAKEAWAY: "#22c55e", DELIVERY: "#3b82f6" };
const typeLabels = { DINE_IN: "Dine-in", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };
const paymentColors = { CASH: "#0ea5e9", CARD: "#22c55e", ONLINE: "#6366f1", OTHER: "#f97316" };
const paymentLabels = { CASH: "Cash", CARD: "Card", ONLINE: "Online", OTHER: "Foodpanda" };
const sourceColors = { POS: "#3b82f6", WEBSITE: "#6366f1", FOODPANDA: "#f97316" };
const sourceLabels = { POS: "POS", WEBSITE: "Website", FOODPANDA: "Foodpanda" };
const productColors = ["#3b82f6", "#22c55e", "#6366f1", "#f97316", "#eab308"];

function buildSegments(distribution, labels, colors) {
  return Object.entries(distribution)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      label: labels[key] || key,
      value,
      color: colors[key] || "#9ca3af",
    }));
}

export default function OverviewPage() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    revenue: 0,
    totalBudgetCost: 0,
    totalProfit: 0,
    lowStockItems: [],
    hourlySales: new Array(24).fill(0),
    salesTypeDistribution: {},
    paymentDistribution: {},
    sourceDistribution: {},
    topProducts: [],
    productsPerformance: [],
  });

  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState(null);

  useEffect(() => {
    const auth = typeof window !== "undefined" ? getStoredAuth() : null;
    setRole(auth?.user?.role || null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getOverview();
        setStats(data);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          console.error("Failed to load overview:", err);
          setError(err.message || "Failed to load overview");
        }
      }
    })();
  }, []);

  const isManager = role === "manager";

  const salesTypeSegments = buildSegments(stats.salesTypeDistribution, typeLabels, typeColors);
  const paymentSegments = buildSegments(stats.paymentDistribution, paymentLabels, paymentColors);
  const sourceSegments = buildSegments(stats.sourceDistribution, sourceLabels, sourceColors);
  const topProductSegments = (stats.topProducts || []).slice(0, 5).map((p, i) => ({
    label: p.name,
    value: p.qty,
    color: productColors[i % productColors.length],
  }));

  return (
    <AdminLayout title={isManager ? "Manager Dashboard" : "Overview"} suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {isManager ? (
        <>
          {/* KPIs row */}
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <Card title="Number of Sales">
              <div className="text-2xl font-semibold">{stats.totalOrders}</div>
              <p className="mt-1 text-[11px] text-neutral-400">Today&apos;s completed orders</p>
            </Card>
            <Card title="Total Sales">
              <div className="text-2xl font-semibold">
                Rs {Math.round(stats.revenue).toLocaleString()}
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">Gross revenue today</p>
            </Card>
            <Card title="Average Sale">
              <div className="text-2xl font-semibold">
                Rs {stats.totalOrders ? Math.round(stats.revenue / stats.totalOrders).toLocaleString() : 0}
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">Per completed order</p>
            </Card>
            <Card title="Orders In Progress">
              <div className="text-2xl font-semibold">{stats.pendingOrders}</div>
              <p className="mt-1 text-[11px] text-neutral-400">Kitchen / pending status</p>
            </Card>
          </div>

          {/* Budget & Profit row */}
          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            <Card title="Budget Cost">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-2xl font-semibold text-amber-600">
                    Rs {stats.totalBudgetCost.toLocaleString()}
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">Inventory cost for today&apos;s sales</p>
                </div>
              </div>
            </Card>
            <Card title="Profit">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${stats.totalProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500" : "bg-rose-50 dark:bg-rose-500/10 text-rose-500"}`}>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-2xl font-semibold ${stats.totalProfit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    Rs {stats.totalProfit.toLocaleString()}
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Revenue - Cost
                    {stats.revenue > 0 && ` (${((stats.totalProfit / stats.revenue) * 100).toFixed(1)}% margin)`}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid gap-4 xl:grid-cols-4 mb-6">
            <Card title="Sales Trends - Hourly">
              <MiniLineChart data={stats.hourlySales} />
            </Card>
            <Card title="Sales Type Distribution">
              {salesTypeSegments.length > 0 ? (
                <div className="flex items-center gap-4">
                  <MiniPieChart segments={salesTypeSegments} />
                  <ul className="text-[11px] space-y-1 text-neutral-500">
                    {salesTypeSegments.map(s => (
                      <li key={s.label}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.color }} />{s.label} ({s.value})</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-neutral-500">No data yet</div>
              )}
            </Card>
            <Card title="Payment Method Sales">
              {paymentSegments.length > 0 ? (
                <div className="flex items-center gap-4">
                  <MiniPieChart segments={paymentSegments} />
                  <ul className="text-[11px] space-y-1 text-neutral-500">
                    {paymentSegments.map(s => (
                      <li key={s.label}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.color }} />{s.label} ({s.value})</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-neutral-500">No data yet</div>
              )}
            </Card>
            <Card title="Top 5 Products">
              {topProductSegments.length > 0 ? (
                <div className="flex items-center gap-4">
                  <MiniPieChart segments={topProductSegments} />
                  <ul className="text-[11px] space-y-1 text-neutral-500">
                    {topProductSegments.map(s => (
                      <li key={s.label}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.color }} />{s.label} ({s.value})</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-neutral-500">No data yet</div>
              )}
            </Card>
          </div>

          {/* Order Sources */}
          <div className="mb-6">
            <Card title="Order Sources">
              {sourceSegments.length > 0 ? (
                <div className="flex items-center gap-4">
                  <MiniPieChart segments={sourceSegments} />
                  <ul className="text-[11px] space-y-1 text-neutral-500">
                    {sourceSegments.map(s => (
                      <li key={s.label}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.color }} />{s.label} ({s.value})</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-neutral-500">No data yet</div>
              )}
            </Card>
          </div>

          {/* Products performance table */}
          <Card
            title="Products Performance"
            description="Items sold today based on completed orders."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-neutral-800 text-[11px] uppercase text-neutral-500">
                  <tr>
                    <th className="py-2 text-left">Product Name</th>
                    <th className="py-2 text-left">Category</th>
                    <th className="py-2 text-right">Qty Sold</th>
                    <th className="py-2 text-right">Price Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {(stats.productsPerformance || []).length > 0 ? (
                    stats.productsPerformance.map((p, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-3">{p.name}</td>
                        <td className="py-2 pr-3">{p.category}</td>
                        <td className="py-2 pr-3 text-right">{p.qtySold}</td>
                        <td className="py-2 pr-3 text-right">Rs {p.priceSold.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-neutral-500">
                        No sales data yet today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card title="Total Orders">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold">{stats.totalOrders}</div>
                  <div className="text-xs text-neutral-400 mt-1">Today&apos;s orders</div>
                </div>
                <div className="h-9 w-9 rounded-lg bg-bg-primary flex items-center justify-center text-primary">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
            </Card>

            <Card title="Pending Orders">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold">{stats.pendingOrders}</div>
                  <div className="text-xs text-neutral-400 mt-1">Awaiting action</div>
                </div>
                <div className="h-9 w-9 rounded-lg bg-bg-primary flex items-center justify-center text-amber-400">
                  <Timer className="w-4 h-4" />
                </div>
              </div>
            </Card>

            <Card title="Revenue">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold">
                    Rs {Math.round(stats.revenue).toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Completed order revenue
                  </div>
                </div>
                <div className="h-9 w-9 rounded-lg bg-bg-primary flex items-center justify-center text-green-400">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
            </Card>
          </div>

          {/* Budget & Profit for non-manager */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card title="Budget Cost">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold text-amber-600">
                    Rs {stats.totalBudgetCost.toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">Inventory cost today</div>
                </div>
                <div className="h-9 w-9 rounded-lg bg-bg-primary flex items-center justify-center text-amber-400">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
            </Card>
            <Card title="Profit">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-semibold ${stats.totalProfit >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    Rs {stats.totalProfit.toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Net profit today
                    {stats.revenue > 0 && ` (${((stats.totalProfit / stats.revenue) * 100).toFixed(1)}%)`}
                  </div>
                </div>
                <div className={`h-9 w-9 rounded-lg bg-bg-primary flex items-center justify-center ${stats.totalProfit >= 0 ? "text-green-400" : "text-rose-400"}`}>
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card
              title="Operations Snapshot"
              description="Track live service health and bottlenecks."
            >
              <ul className="text-xs space-y-2 text-gray-900 dark:text-neutral-300">
                <li className="flex justify-between">
                  <span>Orders in kitchen</span>
                  <span className="font-medium text-gray-900 dark:text-neutral-100">
                    {stats.pendingOrders}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Completed today</span>
                  <span className="font-medium text-gray-900 dark:text-neutral-100">
                    {stats.totalOrders}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Revenue</span>
                  <span className="font-medium text-green-400">
                    Rs {Math.round(stats.revenue).toLocaleString()}
                  </span>
                </li>
              </ul>
            </Card>

            <Card
              title="Admin Tips"
              description="Best practices for clean, safe operations."
            >
              <ul className="text-xs list-disc list-inside text-gray-900 dark:text-neutral-300 space-y-2">
                <li>Always move orders forward in the status flow – never backwards.</li>
                <li>Review completed orders daily in Order History for anomalies.</li>
                <li>Keep menu availability updated to prevent guest disappointment.</li>
                <li>Use Deals to shift demand to off-peak hours.</li>
              </ul>
            </Card>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
