import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getOverview,
  getSalesReport,
  getOrders,
  getDailyCurrency,
  saveDailyCurrency,
  SubscriptionInactiveError,
  getDaySessions,
  getCurrentDaySession,
  getDaySessionOrders,
  endDaySession,
  updateBranch,
  getInventory,
} from "../../lib/apiClient";
import { getBusinessDate, formatBusinessDate } from "../../lib/businessDay";
import { useBranch } from "../../contexts/BranchContext";
import {
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Package,
  CreditCard,
  BarChart3,
  Loader2,
  LayoutDashboard,
  Clock,
  Wallet,
  Activity,
  X,
  Zap,
  Power,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Smooth area chart (Catmull-Rom → cubic bezier) ───────────────────────────
function SalesAreaChart({
  period,
  dailySales,
  hourlySales,
  remainingHoursStart,
}) {
  const W = 1000,
    H = 260;
  const pL = 58,
    pR = 16,
    pT = 20,
    pB = 36;
  const iW = W - pL - pR,
    iH = H - pT - pB;

  const isMonthly = period === "monthly";
  const data = isMonthly
    ? (dailySales || []).map((d) => ({
        y: d.sales ?? 0,
        label: String(d.day),
        isRem: !!d.isRemaining,
        show: true,
      }))
    : Array.from({ length: (hourlySales || []).length }, (_, i) => ({
        y: (hourlySales || [])[i] || 0,
        label: i % 4 === 0 ? `${i}h` : "",
        isRem: remainingHoursStart != null && i >= remainingHoursStart,
        show: i % 4 === 0,
      }));

  const n = data.length;
  if (n === 0)
    return (
      <div
        style={{ height: H }}
        className="flex items-center justify-center text-sm text-gray-400 dark:text-neutral-600"
      >
        No data for this period
      </div>
    );

  const maxY = Math.max(...data.map((d) => d.y), 1);
  const xOf = (i) => pL + (n > 1 ? (i / (n - 1)) * iW : iW / 2);
  const yOf = (v) => pT + iH - (Math.min(v, maxY) / maxY) * iH;
  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.y) }));

  const smooth = (arr) => {
    if (!arr || arr.length < 2)
      return arr?.length === 1 ? `M ${arr[0].x},${arr[0].y}` : "";
    const k = 0.3;
    let d = `M ${arr[0].x.toFixed(1)},${arr[0].y.toFixed(1)}`;
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[Math.max(0, i - 1)],
        b = arr[i],
        c = arr[i + 1],
        e = arr[Math.min(arr.length - 1, i + 2)];
      d += ` C ${(b.x + (c.x - a.x) * k).toFixed(1)},${(b.y + (c.y - a.y) * k).toFixed(1)} ${(c.x - (e.x - b.x) * k).toFixed(1)},${(c.y - (e.y - b.y) * k).toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = smooth(pts);
  const areaPath = linePath
    ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${pT + iH} L ${pts[0].x.toFixed(1)},${pT + iH} Z`
    : "";
  const splitIdx = data.findIndex((d) => d.isRem);
  const splitX = splitIdx > 0 ? xOf(splitIdx) : splitIdx === 0 ? pL : W + 10;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
  const fmt = (v) =>
    v === 0
      ? "0"
      : v >= 1e6
        ? `${(v / 1e6).toFixed(1)}M`
        : v >= 1000
          ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
          : String(Math.round(v));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="ovFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="ovLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <clipPath id="ovSolid">
          <rect x={pL} y={0} width={Math.max(0, splitX - pL)} height={H} />
        </clipPath>
        <clipPath id="ovRem">
          <rect x={Math.max(pL, splitX - 1)} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={pL}
            y1={yOf(v)}
            x2={W - pR}
            y2={yOf(v)}
            stroke="#e5e7eb"
            strokeWidth={i === 0 ? 1 : 0.5}
            strokeDasharray={i > 0 ? "4 7" : "none"}
            className="dark:stroke-neutral-800"
          />
          <text
            x={pL - 8}
            y={yOf(v)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="11"
            fill="#9ca3af"
          >
            {fmt(v)}
          </text>
        </g>
      ))}
      {areaPath && (
        <path d={areaPath} fill="url(#ovFill)" clipPath="url(#ovSolid)" />
      )}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="url(#ovLine)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#ovSolid)"
        />
      )}
      {linePath && splitIdx >= 0 && (
        <path
          d={linePath}
          fill="none"
          stroke="#d1d5db"
          strokeWidth="1.5"
          strokeDasharray="5 6"
          strokeLinecap="round"
          clipPath="url(#ovRem)"
          className="dark:stroke-neutral-700"
        />
      )}
      {splitIdx > 0 &&
        (() => {
          const py = yOf(data[splitIdx - 1]?.y ?? 0);
          return (
            <g>
              <circle cx={splitX} cy={py} r="6" fill="#f97316" opacity="0.2" />
              <circle
                cx={splitX}
                cy={py}
                r="3.5"
                fill="#f97316"
                stroke="white"
                strokeWidth="2"
              />
            </g>
          );
        })()}
      {data.map((d, i) =>
        d.show && d.label ? (
          <text
            key={i}
            x={xOf(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            fill={d.isRem ? "#d1d5db" : "#9ca3af"}
            className={
              d.isRem ? "dark:fill-neutral-700" : "dark:fill-neutral-500"
            }
          >
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ── Donut ring chart ──────────────────────────────────────────────────────────
function DonutChart({ segments, size = 100 }) {
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  const r = Math.round(size * 0.36);
  const sw = Math.round(size * 0.17);
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="flex-shrink-0"
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={sw}
        className="dark:stroke-neutral-800"
      />
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        if (frac < 0.005) {
          acc += seg.value;
          return null;
        }
        const dash = frac * circ,
          gap = circ - dash;
        const rot = (acc / total) * 360 - 90;
        acc += seg.value;
        return (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={sw}
            strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
            transform={`rotate(${rot.toFixed(2)} ${c} ${c})`}
          />
        );
      })}
    </svg>
  );
}

// ── Map distribution keys to display labels and colors ────────────────────────
const typeColors = {
  DINE_IN: "#f97316",
  TAKEAWAY: "#22c55e",
  DELIVERY: "#3b82f6",
};
const typeLabels = {
  DINE_IN: "Dine-in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};
const productColors = ["#f97316", "#3b82f6", "#22c55e", "#6366f1", "#eab308"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function buildSegments(distribution, labels, colors) {
  return Object.entries(distribution)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      label: labels[key] || key,
      value,
      color: colors[key] || "#9ca3af",
    }));
}

function normalizeHourlySales(input) {
  if (Array.isArray(input)) {
    return Array.from({ length: 24 }, (_, i) => Number(input[i] || 0));
  }
  if (input && typeof input === "object") {
    return Array.from({ length: 24 }, (_, i) =>
      Number(input[i] || input[String(i)] || 0),
    );
  }
  return new Array(24).fill(0);
}

function buildHourlySalesFromOrders(orders, { from, to } = {}) {
  const buckets = new Array(24).fill(0);
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? new Date(to).getTime() : Infinity;

  for (const order of Array.isArray(orders) ? orders : []) {
    const status = normalizeOrderStatus(order?.status);
    if (!(status === "DELIVERED" || status === "COMPLETED")) continue;
    const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    const t = createdAt.getTime();
    if (t < fromMs || t > toMs) continue;
    const hour = createdAt.getHours();
    buckets[hour] += Number(order?.grandTotal ?? order?.total) || 0;
  }

  return buckets;
}

function normalizeOrderStatus(status) {
  if (!status) return "NEW_ORDER";
  if (status === "UNPROCESSED") return "NEW_ORDER";
  if (status === "PENDING") return "PROCESSING";
  if (status === "COMPLETED") return "DELIVERED";
  return status;
}

function isDeliveryOrder(order) {
  const type = String(order?.type || order?.orderType || "").toUpperCase();
  return type.includes("DELIVERY");
}

function isOrderPaid(order) {
  // Prefer API flag — mapOrder sets isPaid from raw paymentMethod; list uses friendly labels ("Cash", "To be paid")
  // so parsing paymentMethod strings alone can wrongly mark paid orders as unpaid.
  if (typeof order?.isPaid === "boolean") return order.isPaid;
  if (order?.source === "FOODPANDA") return true;
  if (order?.paymentAmountReceived != null && order.paymentAmountReceived > 0)
    return true;
  const pm = String(order?.paymentMethod || "").toUpperCase();
  if (pm === "CASH" || pm === "CARD" || pm === "ONLINE" || pm === "FOODPANDA")
    return true;
  if (pm === "TO BE PAID" || pm.includes("TO BE PAID")) return false;
  if (isDeliveryOrder(order) && order?.deliveryPaymentCollected === true)
    return true;
  return false;
}

function computeUpcomingPayments(orders) {
  const rows = {
    NEW_ORDER: { label: "New Orders", count: 0, amount: 0 },
    PROCESSING: { label: "Preparing", count: 0, amount: 0 },
    READY: { label: "Ready", count: 0, amount: 0 },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", count: 0, amount: 0 },
  };
  for (const order of Array.isArray(orders) ? orders : []) {
    const status = normalizeOrderStatus(order?.status);
    if (!rows[status]) continue;
    // Upcoming payments should be unpaid active orders only.
    if (isOrderPaid(order)) continue;
    rows[status].count += 1;
    rows[status].amount += Number(order?.grandTotal ?? order?.total) || 0;
  }
  const list = Object.values(rows);
  return {
    rows: list,
    totalCount: list.reduce((s, r) => s + r.count, 0),
    totalAmount: list.reduce((s, r) => s + r.amount, 0),
  };
}

/** Delivered/completed but payment not recorded (excluded from "Upcoming" above) */
function computeDeliveredUnpaid(orders) {
  let count = 0;
  let amount = 0;
  for (const order of Array.isArray(orders) ? orders : []) {
    const status = normalizeOrderStatus(order?.status);
    if (status !== "DELIVERED") continue;
    if (isOrderPaid(order)) continue;
    count += 1;
    amount += Number(order?.grandTotal ?? order?.total) || 0;
  }
  return { count, amount };
}

export default function OverviewPage() {
  const { currentBranch, setCurrentBranch } = useBranch() || {};

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

  const [invItems, setInvItems] = useState([]);
  const [invLoading, setInvLoading] = useState(true);

  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [periodReport, setPeriodReport] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalOrders: 0,
    topItems: [],
    dailySales: [],
    hourlySales: null,
    paymentDistribution: {},
    paymentRows: [],
    paymentAccountRows: [],
    upcomingPayments: { rows: [], totalCount: 0, totalAmount: 0 },
    deliveredUnpaid: { count: 0, amount: 0 },
  });
  const [reportPeriod, setReportPeriod] = useState("today");
  const [periodLoading, setPeriodLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().getMonth(),
  );
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );

  const cutoffHour = currentBranch?.businessDayCutoffHour ?? 4;
  const businessDate = getBusinessDate(new Date(), cutoffHour);

  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [endingDay, setEndingDay] = useState(false);
  const [savingCutoff, setSavingCutoff] = useState(false);
  // Manual end-day: auto-close uses cutoff on the backend; this modal allows selecting an order boundary.
  const [endMode, setEndMode] = useState("selectedOrder"); // 'cutoff' | 'selectedOrder'
  const [loadingEndOrders, setLoadingEndOrders] = useState(false);
  const [endOrderOptions, setEndOrderOptions] = useState([]); // {id, orderNumber, createdAt, status}
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [endOrderSearch, setEndOrderSearch] = useState("");
  const [showEndOrderMenu, setShowEndOrderMenu] = useState(false);

  async function openEndDayModal() {
    if (!currentBranch?.id) {
      toast.error("Select a branch first to end the business day");
      return;
    }
    setCurrentSession(null);
    setEndMode("selectedOrder");
    setEndOrderOptions([]);
    setSelectedOrderId(null);
    setEndOrderSearch("");
    setShowEndOrderMenu(false);
    setShowEndDayModal(true);
    setLoadingSession(true);
    try {
      const session = await getCurrentDaySession(currentBranch?.id);
      setCurrentSession(session);

      // Load orders for selecting the end boundary (manual closing only).
      setLoadingEndOrders(true);
      try {
        if (session?.id) {
          const res = await getDaySessionOrders(session.id);
          const orders = Array.isArray(res?.orders) ? res.orders : [];
          const eligible = orders
            .filter((o) => o && o.status !== "CANCELLED")
            .slice(0, 50);
          setEndOrderOptions(eligible);
          setSelectedOrderId(eligible[0]?.id || null);
          if (eligible[0]) {
            const dt = eligible[0]?.createdAt
              ? new Date(eligible[0].createdAt).toLocaleString("en-PK", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })
              : "";
            setEndOrderSearch(
              `${(eligible[0].orderNumber || eligible[0].id || "").toString()} · ${dt}`,
            );
          }
        }
      } catch {
        setEndOrderOptions([]);
        setSelectedOrderId(null);
        setEndOrderSearch("");
      } finally {
        setLoadingEndOrders(false);
      }
    } catch {
      setCurrentSession(null);
      setEndOrderOptions([]);
      setSelectedOrderId(null);
      setEndOrderSearch("");
    } finally {
      setLoadingSession(false);
    }
  }

  async function handleEndDay() {
    if (!currentBranch?.id) {
      toast.error("Select a branch first to end the business day");
      return;
    }
    setEndingDay(true);
    try {
      await endDaySession(currentBranch?.id, {
        endMode,
        selectedOrderId,
      });
      toast.success("Business day ended");
      setShowEndDayModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to end business day");
    } finally {
      setEndingDay(false);
    }
  }

  async function handleCutoffChange(e) {
    const newHour = Number(e.target.value);
    if (!currentBranch?.id) return;
    setSavingCutoff(true);
    try {
      await updateBranch(currentBranch.id, {
        ...currentBranch,
        businessDayCutoffHour: newHour,
      });
      setCurrentBranch({ ...currentBranch, businessDayCutoffHour: newHour });
      toast.success("Day reset time updated");
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setSavingCutoff(false);
    }
  }

  const CURRENCY_NOTES = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];
  const [currencyDate, setCurrencyDate] = useState("today");
  const [currencyQuantities, setCurrencyQuantities] = useState(() =>
    Object.fromEntries(CURRENCY_NOTES.map((n) => [n, ""])),
  );
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencySaving, setCurrencySaving] = useState(false);
  const currencySaveTimeoutRef = useRef(null);
  const currencyDirtyRef = useRef(false);
  const currencyDateValue =
    currencyDate === "today"
      ? (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })()
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })();
  const isCurrencyEditable = true;
  const currencyTotal = CURRENCY_NOTES.reduce(
    (sum, note) => sum + (Number(currencyQuantities[note]) || 0) * note,
    0,
  );

  function setCurrencyQty(note, value) {
    currencyDirtyRef.current = true;
    setCurrencyQuantities((prev) => ({ ...prev, [note]: value }));
  }

  useEffect(() => {
    let cancelled = false;
    currencyDirtyRef.current = false;
    setCurrencyLoading(true);
    getDailyCurrency(currencyDateValue)
      .then((res) => {
        if (cancelled) return;
        const q = res?.quantities || {};
        setCurrencyQuantities(
          Object.fromEntries(
            CURRENCY_NOTES.map((n) => [
              n,
              q[n] != null
                ? String(q[n])
                : q[String(n)] != null
                  ? String(q[String(n)])
                  : "",
            ]),
          ),
        );
      })
      .catch(() => {
        if (!cancelled)
          setCurrencyQuantities(
            Object.fromEntries(CURRENCY_NOTES.map((n) => [n, ""])),
          );
      })
      .finally(() => {
        if (!cancelled) setCurrencyLoading(false);
      });
    return () => {
      cancelled = true;
      if (currencySaveTimeoutRef.current)
        clearTimeout(currencySaveTimeoutRef.current);
    };
  }, [currencyDateValue]);

  function handleSaveCurrency() {
    if (!isCurrencyEditable) return;
    const quantitiesToSave = {};
    CURRENCY_NOTES.forEach((n) => {
      const v = currencyQuantities[n];
      const num = Number(v);
      if (!Number.isNaN(num) && num >= 0) quantitiesToSave[String(n)] = num;
    });
    setCurrencySaving(true);
    saveDailyCurrency(currencyDateValue, quantitiesToSave)
      .then(() => {
        setCurrencySaving(false);
        currencyDirtyRef.current = false;
        toast.success("Currency saved");
      })
      .catch((err) => {
        setCurrencySaving(false);
        toast.error(err.message || "Failed to save currency");
      });
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await getOverview();
        setStats(data);
        setPageLoading(false);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else {
          console.error("Failed to load overview:", err);
          toast.error(err.message || "Failed to load overview");
        }
        setPageLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    getInventory()
      .then((data) => setInvItems(Array.isArray(data) ? data : []))
      .catch(() => setInvItems([]))
      .finally(() => setInvLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPeriodLoading(true);
    (async () => {
      const now = new Date();
      let fromStr, toStr;
      /** Same scope as Business Day Report — filter by daySession, not createdAt. */
      let daySessionId;

      if (reportPeriod === "today" || reportPeriod === "yesterday") {
        try {
          // Prefer /current — same OPEN session as POS & Business Day Report (reliable x-branch-id).
          if (reportPeriod === "today" && currentBranch?.id) {
            const cur = await getCurrentDaySession(currentBranch.id);
            if (cur?.id) daySessionId = cur.id;
          }
          const res = await getDaySessions(currentBranch?.id, { limit: 10 });
          const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
          if (reportPeriod === "today" && !daySessionId) {
            const openSess = sessions.find((s) => s.status === "OPEN");
            if (openSess?.id) daySessionId = openSess.id;
          }
          if (reportPeriod === "yesterday") {
            const lastClosed = sessions.find((s) => s.status === "CLOSED");
            if (lastClosed?.id) {
              daySessionId = lastClosed.id;
            } else if (lastClosed?.startAt && lastClosed?.endAt) {
              fromStr = lastClosed.startAt;
              toStr = lastClosed.endAt;
            }
          }
        } catch {
          /* fall through to calendar dates */
        }
      }

      // Calendar fallback (also used for "monthly" period)
      if (!daySessionId && !fromStr) {
        if (reportPeriod === "yesterday") {
          const s = new Date(now);
          s.setDate(s.getDate() - 1);
          s.setHours(0, 0, 0, 0);
          const e = new Date(s);
          e.setHours(23, 59, 59, 999);
          fromStr = s.toISOString();
          toStr = e.toISOString();
        } else if (reportPeriod === "today") {
          fromStr = now.toISOString().slice(0, 10);
          const t = new Date(now);
          t.setDate(t.getDate() + 1);
          toStr = t.toISOString().slice(0, 10);
        } else {
          fromStr = new Date(selectedYear, selectedMonth, 1)
            .toISOString()
            .slice(0, 10);
          toStr = new Date(selectedYear, selectedMonth + 1, 1)
            .toISOString()
            .slice(0, 10);
        }
      }

      try {
        const [report, ordersResp] = await Promise.all([
          daySessionId
            ? getSalesReport({ daySessionId })
            : getSalesReport({ from: fromStr, to: toStr }),
          daySessionId
            ? getOrders({ daySessionId, limit: 2000 })
            : getOrders({ from: fromStr, to: toStr, limit: 2000 }),
        ]);

        const parsedOrders =
          ordersResp &&
          typeof ordersResp === "object" &&
          Array.isArray(ordersResp.orders)
            ? ordersResp.orders
            : Array.isArray(ordersResp)
              ? ordersResp
              : [];

        const sessionIdForMetrics =
          report.daySessionId || daySessionId;
        const ordersForMetrics =
          report.scope === "daySession" && sessionIdForMetrics
            ? parsedOrders.filter(
                (o) =>
                  !o.daySessionId ||
                  String(o.daySessionId) === String(sessionIdForMetrics),
              )
            : parsedOrders;

        const apiHourlySales = normalizeHourlySales(report.hourlySales);
        const hasHourlyPoints = apiHourlySales.some((v) => Number(v) > 0);
        const shouldFallbackHourly =
          !hasHourlyPoints && Number(report.totalRevenue || 0) > 0;
        const hourlyFrom = report.from ?? fromStr;
        const hourlyTo = report.to ?? toStr;
        const resolvedHourlySales = shouldFallbackHourly
          ? buildHourlySalesFromOrders(ordersForMetrics, {
              from: hourlyFrom,
              to: hourlyTo,
            })
          : apiHourlySales;

        if (!cancelled)
          setPeriodReport({
            totalRevenue: report.totalRevenue ?? 0,
            totalProfit: report.totalProfit ?? 0,
            totalOrders: report.totalOrders ?? 0,
            topItems: report.topItems ?? [],
            dailySales: report.dailySales ?? [],
            hourlySales: resolvedHourlySales,
            paymentDistribution: report.paymentDistribution ?? {},
            paymentRows: report.paymentRows ?? [],
            paymentAccountRows: report.paymentAccountRows ?? [],
            upcomingPayments: computeUpcomingPayments(ordersForMetrics),
            deliveredUnpaid: computeDeliveredUnpaid(ordersForMetrics),
          });
      } catch (err) {
        if (!cancelled) console.error("Failed to load period report:", err);
      } finally {
        if (!cancelled) setPeriodLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportPeriod, selectedMonth, selectedYear, currentBranch?.id]);

  // Computed values
  const hasOrders = (periodReport.totalOrders ?? 0) > 0;
  const salesTypeSegments = hasOrders
    ? buildSegments(stats.salesTypeDistribution, typeLabels, typeColors)
    : [];
  const paymentRows = (periodReport.paymentRows || []).filter(
    (row) => row && row.method && row.method !== "Total",
  );
  const paymentAccountRows = periodReport.paymentAccountRows || [];

  const paymentSummary = paymentRows.reduce(
    (acc, row) => {
      const label = String(row.method || "").trim();
      const key = label.toUpperCase();
      const amount = Number(row.amount || 0);
      const orders = Number(row.orders || 0);
      if (key === "CASH") {
        acc.CASH.amount += amount;
        acc.CASH.orders += orders;
      } else if (key === "CARD") {
        acc.CARD.amount += amount;
        acc.CARD.orders += orders;
      } else if (key === "ONLINE") {
        acc.ONLINE.amount += amount;
        acc.ONLINE.orders += orders;
      } else if (
        key === "TO BE PAID" ||
        key === "PENDING" ||
        key === "UNPAID" ||
        key === "PENDING PAYMENT"
      ) {
        // Exclude unpaid rows from Payments accounting.
      } else {
        acc.OTHER.amount += amount;
        acc.OTHER.orders += orders;
      }
      return acc;
    },
    {
      CASH: { amount: 0, orders: 0 },
      CARD: { amount: 0, orders: 0 },
      ONLINE: { amount: 0, orders: 0 },
      OTHER: { amount: 0, orders: 0 },
    },
  );

  const pendingCollection = paymentRows.reduce(
    (acc, row) => {
      const key = String(row.method || "")
        .trim()
        .toUpperCase();
      if (
        key === "TO BE PAID" ||
        key === "PENDING" ||
        key === "UNPAID" ||
        key === "PENDING PAYMENT"
      ) {
        acc.amount += Number(row.amount || 0);
        acc.orders += Number(row.orders || 0);
      }
      return acc;
    },
    { amount: 0, orders: 0 },
  );
  const upcomingPayments = periodReport.upcomingPayments || {
    rows: [],
    totalCount: 0,
    totalAmount: 0,
  };
  const deliveredUnpaid = periodReport.deliveredUnpaid || {
    count: 0,
    amount: 0,
  };
  const totalUnpaidExposure =
    Number(upcomingPayments.totalAmount || 0) +
    Number(deliveredUnpaid.amount || 0);

  const receivedRows = [
    { key: "CASH", label: "Cash", color: "#0ea5e9" },
    { key: "CARD", label: "Card", color: "#22c55e" },
    { key: "ONLINE", label: "Online", color: "#6366f1" },
  ].map((r) => ({
    ...r,
    ...(paymentSummary[r.key] || { amount: 0, orders: 0 }),
  }));
  const totalReceivedAmount = receivedRows.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0,
  );

  const displayTopItems = (periodReport.topItems || [])
    .slice(0, 5)
    .map((p, i) => ({
      label: p.name,
      value: p.quantity,
      color: productColors[i % productColors.length],
    }));

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentHour = now.getHours();
  const viewingYear = reportPeriod === "monthly" ? selectedYear : currentYear;
  const viewingMonthIndex =
    reportPeriod === "monthly" ? selectedMonth : currentMonth;
  const lastDayOfMonth = new Date(
    viewingYear,
    viewingMonthIndex + 1,
    0,
  ).getDate();
  const todayDayOfMonthReal = now.getDate();
  const effectiveTodayInView =
    reportPeriod === "monthly" &&
    (selectedYear !== currentYear || selectedMonth !== currentMonth)
      ? lastDayOfMonth
      : todayDayOfMonthReal;

  const salesByDay = {};
  (periodReport.dailySales || []).forEach((d) => {
    salesByDay[d.day] = d.sales;
  });
  const fullMonthDailySales = Array.from(
    { length: lastDayOfMonth },
    (_, i) => ({
      day: i + 1,
      sales: salesByDay[i + 1] ?? 0,
      isRemaining:
        reportPeriod === "monthly" ? i + 1 > effectiveTodayInView : false,
    }),
  );

  // Keep today's chart consistent with yesterday/monthly data source.
  // Prefer period report hourly data; fall back to overview snapshot.
  const baseHourlySales = normalizeHourlySales(
    periodReport.hourlySales || stats.hourlySales,
  );
  // For "today", do not zero-out higher hour buckets.
  // This avoids a blank chart when the business day spans midnight.
  const fullDayHourlySales =
    reportPeriod === "today"
      ? baseHourlySales
      : Array.from({ length: 24 }, (_, i) =>
          i <= currentHour ? baseHourlySales[i] || 0 : 0,
        );
  const remainingHoursStart = reportPeriod === "today" ? 24 : currentHour + 1;

  const viewTotalOrders = periodReport.totalOrders ?? 0;
  const viewTotalRevenue = periodReport.totalRevenue ?? 0;
  const viewTotalProfit = periodReport.totalProfit ?? 0;
  const viewPendingOrders = stats.pendingOrders;
  const viewAvgOrder = viewTotalOrders
    ? Math.round(viewTotalRevenue / viewTotalOrders)
    : 0;

  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y += 1)
    yearOptions.push(y);

  // Inventory health stats
  const invFiltered = invItems.filter((i) => i.hasBranchRecord !== false);
  const invTotal = invFiltered.length;
  const invOut = invFiltered.filter((i) => (i.currentStock ?? 0) <= 0).length;
  const invLow = invFiltered.filter((i) => {
    const s = i.currentStock ?? 0,
      t = i.lowStockThreshold ?? 0;
    return s > 0 && t > 0 && s <= t;
  }).length;
  const invHealthy = invTotal - invOut - invLow;
  const invNeedAttn = invFiltered.filter(
    (i) => (i.currentStock ?? 0) <= (i.lowStockThreshold ?? 0),
  );

  const periodLabel =
    reportPeriod === "yesterday"
      ? "Yesterday"
      : reportPeriod === "monthly"
        ? `${MONTH_NAMES[viewingMonthIndex]} ${viewingYear}`
        : "Today";

  return (
    <AdminLayout title="Overview" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <LayoutDashboard className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">
              Loading dashboard…
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ─── Control bar ─────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Business day indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatBusinessDate(businessDate)}
                </span>
              </div>

              {/* Default exit time (editable) */}
              <div className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                <Clock className="w-3 h-3 text-gray-400 dark:text-neutral-500 flex-shrink-0" />
                <span className="text-[11px] text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                  Resets at
                </span>
                <div className="relative flex items-center">
                  <select
                    value={cutoffHour}
                    onChange={handleCutoffChange}
                    disabled={savingCutoff || !currentBranch?.id}
                    className="appearance-none pr-4 text-xs font-semibold text-gray-700 dark:text-neutral-200 bg-transparent border-none outline-none cursor-pointer disabled:opacity-50"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0
                          ? "12 AM"
                          : i < 12
                            ? `${i} AM`
                            : i === 12
                              ? "12 PM"
                              : `${i - 12} PM`}
                      </option>
                    ))}
                  </select>
                  {savingCutoff ? (
                    <Loader2 className="absolute right-0 w-2.5 h-2.5 animate-spin text-primary pointer-events-none" />
                  ) : (
                    <ChevronDown className="absolute right-0 w-2.5 h-2.5 text-gray-400 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* End Day */}
              <button
                type="button"
                onClick={openEndDayModal}
                disabled={!currentBranch?.id}
                title={
                  currentBranch?.id
                    ? "End current branch business day"
                    : "Select a branch to end day"
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Power className="w-3.5 h-3.5" />
                End Day
              </button>

            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5">
                {[
                  { value: "yesterday", label: "Yesterday" },
                  { value: "today", label: "Today" },
                  { value: "monthly", label: "Monthly" },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setReportPeriod(p.value)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      reportPeriod === p.value
                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                        : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {reportPeriod === "monthly" && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="h-9 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-2 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="h-9 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-2 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {periodLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
            </div>
          </div>

          {/* ─── KPI strip ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {[
              {
                label: "Revenue",
                sub: periodLabel,
                value: `Rs ${Math.round(viewTotalRevenue).toLocaleString()}`,
                icon: DollarSign,
                color: "text-primary",
                bg: "bg-primary/10 dark:bg-primary/20",
                border: "border-primary/20",
              },
              {
                label: "Orders",
                sub: periodLabel,
                value: viewTotalOrders.toLocaleString(),
                icon: ShoppingBag,
                color: "text-violet-600 dark:text-violet-400",
                bg: "bg-violet-50 dark:bg-violet-500/10",
                border: "border-violet-100 dark:border-violet-500/20",
              },
              {
                label: "Net Profit",
                sub: periodLabel,
                value: `Rs ${Math.round(viewTotalProfit).toLocaleString()}`,
                icon: TrendingUp,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-500/10",
                border: "border-emerald-100 dark:border-emerald-500/20",
              },
              {
                label: "Avg Order",
                sub: periodLabel,
                value: `Rs ${viewAvgOrder.toLocaleString()}`,
                icon: Activity,
                color: "text-sky-600 dark:text-sky-400",
                bg: "bg-sky-50 dark:bg-sky-500/10",
                border: "border-sky-100 dark:border-sky-500/20",
              },
              {
                label: "Active Now",
                sub: "live orders",
                value: viewPendingOrders.toLocaleString(),
                icon: Zap,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-50 dark:bg-amber-500/10",
                border: "border-amber-100 dark:border-amber-500/20",
                pulse: viewPendingOrders > 0,
              },
            ].map(
              ({ label, sub, value, icon: Icon, color, bg, border, pulse }) => (
                <div
                  key={label}
                  className={`bg-white dark:bg-neutral-950 border ${border} rounded-2xl p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    {pulse && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        live
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-gray-500 dark:text-neutral-500 mb-0.5">
                    {label}
                  </p>
                  <p className={`text-lg font-bold leading-tight ${color}`}>
                    {value}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">
                    {sub}
                  </p>
                </div>
              ),
            )}
          </div>

          {/* ─── Main: chart (2/3) + breakdown (1/3) ────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-5 mb-5">
            {/* Sales area chart */}
            <div className="lg:col-span-2 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Sales Overview
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                    {reportPeriod === "monthly"
                      ? `${MONTH_NAMES[viewingMonthIndex]} ${viewingYear} · by day`
                      : reportPeriod === "yesterday"
                        ? "Yesterday · by hour"
                        : "Today · by hour"}
                    {(splitIdx) =>
                      splitIdx > 0 ? " · dashed = remaining" : ""
                    }
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    Rs {Math.round(viewTotalRevenue).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                    total revenue
                  </p>
                </div>
              </div>
              {reportPeriod === "monthly" ? (
                fullMonthDailySales.length > 0 ? (
                  <SalesAreaChart
                    period="monthly"
                    dailySales={fullMonthDailySales}
                    hourlySales={null}
                    remainingHoursStart={null}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-600">
                    No data yet this month
                  </div>
                )
              ) : reportPeriod === "yesterday" ? (
                periodReport.hourlySales ? (
                  <SalesAreaChart
                    period="today"
                    dailySales={null}
                    hourlySales={periodReport.hourlySales}
                    remainingHoursStart={24}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-sm text-gray-400 dark:text-neutral-600">
                    No data for yesterday
                  </div>
                )
              ) : (
                <SalesAreaChart
                  period="today"
                  dailySales={null}
                  hourlySales={fullDayHourlySales}
                  remainingHoursStart={remainingHoursStart}
                />
              )}
            </div>

            {/* Right panel: Order Types + Profit */}
            <div className="flex flex-col gap-4">
              {/* Profit card */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-emerald-100 text-xs font-medium">
                    {reportPeriod === "yesterday"
                      ? "Yesterday's"
                      : reportPeriod === "monthly"
                        ? "Monthly"
                        : "Today's"}{" "}
                    Profit
                  </p>
                  <p className="text-white text-2xl font-bold leading-tight">
                    Rs {Math.round(viewTotalProfit).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Order types donut */}
              <div className="flex-1 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider mb-4">
                  Order Types
                </h4>
                {salesTypeSegments.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <DonutChart segments={salesTypeSegments} size={84} />
                    <div className="flex-1 space-y-2 min-w-0">
                      {salesTypeSegments.map((s) => {
                        const total = salesTypeSegments.reduce(
                          (a, b) => a + b.value,
                          0,
                        );
                        const pct =
                          total > 0 ? Math.round((s.value / total) * 100) : 0;
                        return (
                          <div
                            key={s.label}
                            className="flex items-center gap-2"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="flex-1 text-xs text-gray-600 dark:text-neutral-400 truncate">
                              {s.label}
                            </span>
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6">
                    <BarChart3 className="w-7 h-7 text-gray-200 dark:text-neutral-700 mb-1" />
                    <p className="text-xs text-gray-400 dark:text-neutral-600">
                      No order data
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Received + Upcoming + Top Items ──────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-5 mb-5">
            {/* Received Payments */}
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex items-center justify-between w-full flex-1">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      Received Payments
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                      How money was received in {periodLabel.toLowerCase()}
                    </p>
                  </div>
                  <h2 className="font-bold text-base text-gray-900 dark:text-white">
                    Rs {Math.round(totalReceivedAmount).toLocaleString()}
                  </h2>
                </div>
              </div>

              {hasOrders ? (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {receivedRows.map((row) => {
                      const pct =
                        totalReceivedAmount > 0
                          ? Math.round(
                              (Number(row.amount || 0) / totalReceivedAmount) *
                                100,
                            )
                          : 0;
                      return (
                        <div key={row.key}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: row.color }}
                              />
                              <span className="text-xs text-gray-700 dark:text-neutral-300">
                                {row.label}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                                {Number(row.orders || 0).toLocaleString()}{" "}
                                orders
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">
                                Rs{" "}
                                {Math.round(
                                  Number(row.amount || 0),
                                ).toLocaleString()}
                              </span>
                              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: row.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-neutral-800">
                    <p className="text-[11px] font-semibold text-gray-600 dark:text-neutral-400 mb-2">
                      Online payment accounts
                    </p>
                    {paymentAccountRows.length === 0 ? (
                      <p className="text-[11px] text-gray-400 dark:text-neutral-600">
                        No online payments in this period.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-auto pr-1">
                        {paymentAccountRows.map((row) => (
                          <div
                            key={row.accountName}
                            className="flex items-center justify-between text-[11px]"
                          >
                            <span className="text-gray-600 dark:text-neutral-300 truncate pr-2">
                              {row.accountName}
                            </span>
                            <span className="text-gray-900 dark:text-white font-semibold">
                              Rs {Number(row.amount || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <CreditCard className="w-7 h-7 text-gray-200 dark:text-neutral-700 mb-2" />
                  <p className="text-xs text-gray-400 dark:text-neutral-600">
                    No payment data
                  </p>
                </div>
              )}
            </div>

            {/* Upcoming Payments */}
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-3">
              {hasOrders ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-gray-100 dark:border-neutral-800">
                    <div className="w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex items-center justify-between w-full min-w-0 gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                          Upcoming Payments
                        </h3>
                        <p className="text-[10px] text-gray-500 dark:text-neutral-400 leading-tight mt-0.5">
                          Unpaid in progress (new → out for delivery)
                        </p>
                      </div>
                      <h2 className="font-bold text-sm text-gray-900 dark:text-white shrink-0">
                        Rs{" "}
                        {Math.round(
                          upcomingPayments.totalAmount,
                        ).toLocaleString()}
                      </h2>
                    </div>
                  </div>

                  {(upcomingPayments.rows || []).map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between py-0.5 border-b border-gray-100/80 dark:border-neutral-800/80"
                    >
                      <span className="text-[10px] text-gray-600 dark:text-neutral-400 leading-tight">
                        {row.label} · {row.count.toLocaleString()} orders
                      </span>
                      <p className="text-[10px] font-semibold text-gray-900 dark:text-white tabular-nums">
                        Rs {Math.round(row.amount || 0).toLocaleString()}
                      </p>
                    </div>
                  ))}

                  <div className="flex items-center justify-between py-0.5 border-b border-gray-100/80 dark:border-neutral-800/80">
                    <span className="text-[10px] text-gray-600 dark:text-neutral-400 leading-tight">
                      Delivered · payment not recorded yet ·{" "}
                      {deliveredUnpaid.count.toLocaleString()} orders
                    </span>
                    <p className="text-[10px] font-semibold text-gray-900 dark:text-white tabular-nums">
                      Rs{" "}
                      {Math.round(deliveredUnpaid.amount || 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-gray-200 dark:border-neutral-700">
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-neutral-300 leading-tight">
                      Total unpaid (in progress + delivered above)
                    </span>
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                      Rs {Math.round(totalUnpaidExposure).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-neutral-300 leading-tight">
                      Pending collection ·{" "}
                      {pendingCollection.orders.toLocaleString()} orders
                    </span>
                    <p className="text-[10px] font-semibold text-gray-900 dark:text-white tabular-nums">
                      Rs {Math.round(pendingCollection.amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Clock className="w-7 h-7 text-gray-200 dark:text-neutral-700 mb-2" />
                  <p className="text-xs text-gray-400 dark:text-neutral-600">
                    No upcoming payment data
                  </p>
                </div>
              )}
            </div>

            {/* Top Selling Items */}
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Top Selling
                  </h3>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                  {periodLabel}
                </span>
              </div>
              {displayTopItems.length > 0 ? (
                <div className="space-y-1">
                  {displayTopItems.map((item, i) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900 ${i === 0 ? "bg-orange-50/60 dark:bg-orange-500/5" : ""}`}
                    >
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                          i === 0
                            ? "bg-orange-500 text-white"
                            : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-neutral-200 truncate">
                          {item.label}
                        </p>
                        <div className="h-1 bg-gray-100 dark:bg-neutral-800 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${displayTopItems[0].value ? (item.value / displayTopItems[0].value) * 100 : 0}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-xs font-bold text-gray-900 dark:text-white">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <ShoppingBag className="w-7 h-7 text-gray-200 dark:text-neutral-700 mb-2" />
                  <p className="text-xs text-gray-400 dark:text-neutral-600">
                    No sales data yet
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ─── Inventory Health ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Inventory Health
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">
                    Stock status overview
                  </p>
                </div>
              </div>
              <a
                href="/dashboard/inventory"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all →
              </a>
            </div>

            {invLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            ) : invTotal === 0 ? (
              <p className="text-xs text-gray-400 dark:text-neutral-600 text-center py-6">
                No inventory items found
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Total Items",
                      value: invTotal,
                      color: "text-blue-700 dark:text-blue-400",
                      bg: "bg-blue-50 dark:bg-blue-500/10",
                      border: "border-blue-100 dark:border-blue-500/20",
                    },
                    {
                      label: "Healthy",
                      value: invHealthy,
                      color: "text-emerald-700 dark:text-emerald-400",
                      bg: "bg-emerald-50 dark:bg-emerald-500/10",
                      border: "border-emerald-100 dark:border-emerald-500/20",
                    },
                    {
                      label: "Low Stock",
                      value: invLow,
                      color: "text-orange-700 dark:text-orange-400",
                      bg: "bg-orange-50 dark:bg-orange-500/10",
                      border: "border-orange-100 dark:border-orange-500/20",
                    },
                    {
                      label: "Out of Stock",
                      value: invOut,
                      color: "text-red-700 dark:text-red-400",
                      bg: "bg-red-50 dark:bg-red-500/10",
                      border: "border-red-100 dark:border-red-500/20",
                    },
                  ].map(({ label, value, color, bg, border }) => (
                    <div
                      key={label}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border ${bg} ${border}`}
                    >
                      <p
                        className={`text-2xl font-black tabular-nums leading-tight ${color}`}
                      >
                        {value}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 mt-0.5 text-center">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                {invNeedAttn.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-2">
                      Needs Attention
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {invNeedAttn.slice(0, 8).map((item) => {
                        const isOut = (item.currentStock ?? 0) <= 0;
                        return (
                          <span
                            key={item.id}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${
                              isOut
                                ? "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                                : "bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isOut ? "bg-red-500" : "bg-orange-400"}`}
                            />
                            {item.name}
                            <span className="opacity-60">
                              {isOut ? "· out" : "· low"}
                            </span>
                          </span>
                        );
                      })}
                      {invNeedAttn.length > 8 && (
                        <span className="text-xs text-gray-400 dark:text-neutral-500 self-center">
                          +{invNeedAttn.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── Currency Counter ─────────────────────────────────────────── */}
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Currency Counter
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">
                    Count notes & coins — saved per day
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-0.5">
                  {["today", "yesterday"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCurrencyDate(d)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${currencyDate === d ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-neutral-400"}`}
                    >
                      {d === "today" ? "Today" : "Yesterday"}
                    </button>
                  ))}
                </div>
                {currencyLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Total
                  </span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    Rs {currencyTotal.toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveCurrency}
                  disabled={!isCurrencyEditable || currencySaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-md hover:shadow-primary/25 disabled:opacity-50 transition-all"
                >
                  {currencySaving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
                {CURRENCY_NOTES.map((note) => {
                  const qty = Number(currencyQuantities[note]) || 0;
                  const amount = qty * note;
                  return (
                    <div
                      key={note}
                      className={`rounded-xl border text-center p-2.5 transition-all ${qty > 0 ? "border-primary/30 bg-primary/5 dark:bg-primary/10" : "border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50"}`}
                    >
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5">
                        Rs {note.toLocaleString()}
                      </p>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={currencyQuantities[note]}
                        onChange={(e) =>
                          setCurrencyQty(
                            note,
                            e.target.value.replace(/\D/g, ""),
                          )
                        }
                        placeholder="0"
                        disabled={!isCurrencyEditable}
                        className={`w-full text-center text-sm font-bold rounded-lg px-1 py-1 border-0 outline-none focus:ring-2 focus:ring-primary/20 bg-transparent ${qty > 0 ? "text-primary" : "text-gray-900 dark:text-white"} ${!isCurrencyEditable ? "cursor-not-allowed opacity-50" : ""}`}
                      />
                      {amount > 0 && (
                        <p className="text-[9px] font-medium text-primary/70 mt-1">
                          {(amount / 1000).toFixed(amount < 1000 ? 0 : 1)}
                          {amount >= 1000 ? "k" : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* End Day Confirmation Modal */}
      {showEndDayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !endingDay)
              setShowEndDayModal(false);
          }}
        >
          <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Power className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    End Business Day
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!endingDay) setShowEndDayModal(false);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Session summary */}
            <div className="px-5 py-4">
              {loadingSession ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : currentSession ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-neutral-400">
                    Are you sure you want to end today&apos;s session?
                    Here&apos;s the current summary:
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-semibold mb-0.5">
                        Revenue
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        Rs {(currentSession.totalSales || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-wide font-semibold mb-0.5">
                        Orders
                      </p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        {currentSession.totalOrders || 0}
                      </p>
                    </div>
                  </div>
                  {currentSession.startAt && (
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500">
                      Session started{" "}
                      {new Date(currentSession.startAt).toLocaleString(
                        "en-PK",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        },
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-neutral-400 py-2">
                  Are you sure you want to end the current business day? All
                  open orders will remain, but new orders will start a new
                  session.
                </p>
              )}
            </div>

            {/* Manual end boundary selection */}
            <div className="px-5 pb-3">
              <div className="text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-2">
                End day at
              </div>
              <select
                value={endMode}
                onChange={(e) => setEndMode(e.target.value)}
                disabled={endingDay}
                className="w-full h-9 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-3 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="cutoff">Business cutoff time</option>
                <option value="selectedOrder">Selected order</option>
              </select>

              {endMode === "selectedOrder" && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-neutral-400 mb-1">
                    Select the order where the day should end
                  </div>
                  {loadingEndOrders ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : endOrderOptions.length === 0 ? (
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 py-1">
                      No orders found in this session. Falling back to cutoff.
                    </p>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={endOrderSearch}
                        onChange={(e) => {
                          setEndOrderSearch(e.target.value);
                          setShowEndOrderMenu(true);
                          setSelectedOrderId(null);
                        }}
                        onFocus={() => setShowEndOrderMenu(true)}
                        disabled={endingDay}
                        placeholder="Search order number..."
                        className="w-full h-9 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs rounded-lg px-3 text-gray-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                      {showEndOrderMenu && (
                        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                          {endOrderOptions
                            .filter((o) => {
                              const dt = o?.createdAt
                                ? new Date(o.createdAt).toLocaleString("en-PK", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : "";
                              const label = `${(o.orderNumber || o.id || "").toString()} ${dt}`.toLowerCase();
                              return label.includes((endOrderSearch || "").toLowerCase());
                            })
                            .map((o) => {
                              const dt = o?.createdAt
                                ? new Date(o.createdAt).toLocaleString("en-PK", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : "";
                              const label = `${(o.orderNumber || o.id || "").toString()} · ${dt}`;
                              return (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderId(o.id);
                                    setEndOrderSearch(label);
                                    setShowEndOrderMenu(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
                                >
                                  {label}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-1">
                    This affects <b>manual</b> closing only. Orders after the selected time will be moved to a new OPEN session so today counts correctly.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  if (!endingDay) setShowEndDayModal(false);
                }}
                disabled={endingDay}
                className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndDay}
                disabled={endingDay || (endMode === "selectedOrder" && !selectedOrderId)}
                className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {endingDay ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                {endingDay ? "Ending…" : "End Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
