import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import { getOverview, SubscriptionInactiveError, getStoredAuth } from "../../lib/apiClient";
import { DollarSign, ShoppingBag, Timer } from "lucide-react";

// Simple SVG line chart for static hourly trend
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
        {max}
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

export default function OverviewPage() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    revenue: 0
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

  return (
    <AdminLayout title={isManager ? "Manager Dashboard" : "Overview"} suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {isManager ? (
        <>
          {/* KPIs row similar to Nimbus: sales snapshot */}
          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <Card title="Number of Sales">
              <div className="text-2xl font-semibold">{stats.totalOrders}</div>
              <p className="mt-1 text-[11px] text-neutral-400">Today&apos;s completed orders</p>
            </Card>
            <Card title="Total Sales">
              <div className="text-2xl font-semibold">
                Rs {stats.revenue.toFixed(0)}
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">Gross revenue today</p>
            </Card>
            <Card title="Average Sale">
              <div className="text-2xl font-semibold">
                Rs {stats.totalOrders ? Math.round(stats.revenue / stats.totalOrders) : 0}
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">Per completed order</p>
            </Card>
            <Card title="Orders In Progress">
              <div className="text-2xl font-semibold">{stats.pendingOrders}</div>
              <p className="mt-1 text-[11px] text-neutral-400">Kitchen / pending status</p>
            </Card>
          </div>

          {/* Charts row (static placeholders for now) */}
          <div className="grid gap-4 xl:grid-cols-4 mb-6">
            <Card title="Sales Trends - Hourly">
              <MiniLineChart data={[0, 1, 2, 4, 3, 2, 1, 0]} />
            </Card>
            <Card title="Sales Type Distribution">
              <div className="flex items-center gap-4">
                <MiniPieChart
                  segments={[
                    { label: "Delivery", value: 7, color: "#3b82f6" },
                    { label: "Takeaway", value: 7, color: "#22c55e" },
                    { label: "Dine-in", value: 3, color: "#f97316" }
                  ]}
                />
                <ul className="text-[11px] space-y-1 text-neutral-500">
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6] mr-1" />Delivery</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] mr-1" />Takeaway</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#f97316] mr-1" />Dine‑in</li>
                </ul>
              </div>
            </Card>
            <Card title="Payment Method Sales">
              <div className="flex items-center gap-4">
                <MiniPieChart
                  segments={[
                    { label: "Card", value: 9, color: "#22c55e" },
                    { label: "Cash", value: 5, color: "#0ea5e9" },
                    { label: "Foodpanda", value: 3, color: "#f97316" }
                  ]}
                />
                <ul className="text-[11px] space-y-1 text-neutral-500">
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] mr-1" />Card</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#0ea5e9] mr-1" />Cash</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#f97316] mr-1" />Foodpanda</li>
                </ul>
              </div>
            </Card>
            <Card title="Top 5 Products">
              <div className="flex items-center gap-4">
                <MiniPieChart
                  segments={[
                    { label: "Chicken Wrap", value: 5, color: "#3b82f6" },
                    { label: "Beef Burger", value: 4, color: "#22c55e" },
                    { label: "Soft Drinks", value: 3, color: "#6366f1" },
                    { label: "Fries", value: 3, color: "#f97316" },
                    { label: "Dessert", value: 2, color: "#eab308" }
                  ]}
                />
                <ul className="text-[11px] space-y-1 text-neutral-500">
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6] mr-1" />Chicken Wrap</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] mr-1" />Beef Burger</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#6366f1] mr-1" />Soft Drinks</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#f97316] mr-1" />Fries</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#eab308] mr-1" />Dessert</li>
                </ul>
              </div>
            </Card>
          </div>

          {/* Order Sources / Score pie chart */}
          <div className="mb-6">
            <Card title="Order Sources">
              <div className="flex items-center gap-4">
                <MiniPieChart
                  segments={[
                    { label: "POS", value: 9, color: "#3b82f6" },
                    { label: "App", value: 5, color: "#6366f1" },
                    { label: "Foodpanda", value: 3, color: "#f97316" }
                  ]}
                />
                <ul className="text-[11px] space-y-1 text-neutral-500">
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6] mr-1" />POS</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#6366f1] mr-1" />App</li>
                  <li><span className="inline-block w-2 h-2 rounded-full bg-[#f97316] mr-1" />Foodpanda</li>
                </ul>
              </div>
            </Card>
          </div>

          {/* Products performance table */}
          <Card
            title="Products Performance"
            description="Snapshot of items sold today. Connect this table to live order data later."
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
                  {/* Static sample rows for now */}
                  <tr>
                    <td className="py-2 pr-3">Beef Burger</td>
                    <td className="py-2 pr-3">BURGERS</td>
                    <td className="py-2 pr-3 text-right">3</td>
                    <td className="py-2 pr-3 text-right">1650</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">Chicken Wrap</td>
                    <td className="py-2 pr-3">WRAPS</td>
                    <td className="py-2 pr-3 text-right">5</td>
                    <td className="py-2 pr-3 text-right">2750</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">Soft Drinks</td>
                    <td className="py-2 pr-3">DRINKS</td>
                    <td className="py-2 pr-3 text-right">9</td>
                    <td className="py-2 pr-3 text-right">900</td>
                  </tr>
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
                  <div className="text-xs text-neutral-400 mt-1">All-time orders</div>
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
                    ${stats.revenue.toFixed(2)}
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

          <div className="grid gap-4 md:grid-cols-2">
            <Card
              title="Operations Snapshot"
              description="Track live service health and bottlenecks."
            >
              <ul className="text-xs space-y-2 text-gray-900 dark:text-neutral-300">
                <li className="flex justify-between">
                  <span>Average prep time</span>
                  <span className="font-medium text-gray-900 dark:text-neutral-100">18 min</span>
                </li>
                <li className="flex justify-between">
                  <span>Orders in kitchen</span>
                  <span className="font-medium text-gray-900 dark:text-neutral-100">
                    {stats.pendingOrders}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Cancellation rate</span>
                  <span className="font-medium text-green-400">2.1%</span>
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

