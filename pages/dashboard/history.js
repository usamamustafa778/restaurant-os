import { useEffect, useState, useMemo } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getSalesReport, getOrders, SubscriptionInactiveError } from "../../lib/apiClient";
import {
  BarChart3, DollarSign, ShoppingBag, TrendingUp,
  HelpCircle, Loader2, Award, FileDown, Printer,
  ClipboardList, Search, ChevronLeft, ChevronRight,
  ChevronDown, Download, FileText, Calendar, Bike,
} from "lucide-react";
import toast from "react-hot-toast";

const PRESETS = [
  { id: "today",      label: "Today" },
  { id: "yesterday",  label: "Yesterday" },
  { id: "this_week",  label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "all",        label: "All Time" },
  { id: "custom",     label: "Custom" },
];

const TABS = [
  { id: "overview",     label: "Overview",      icon: BarChart3 },
  { id: "orders",       label: "Orders List",   icon: ClipboardList },
];

const FILTER_ALL = "ALL";

const STATUS_FILTERS = { ALL: "ALL", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED" };

const TYPE_FILTERS = { ALL: "ALL", DINE_IN: "DINE_IN", DELIVERY: "DELIVERY", TAKEAWAY: "TAKEAWAY" };
const TYPE_API_MAP = { [TYPE_FILTERS.DINE_IN]: "dine-in", [TYPE_FILTERS.DELIVERY]: "delivery", [TYPE_FILTERS.TAKEAWAY]: "takeaway" };
const TYPE_LABEL_MAP = { "dine-in": "Dine-in", delivery: "Delivery", takeaway: "Takeaway" };

const PAID_FILTERS = { ALL: "ALL", PAID: "PAID", UNPAID: "UNPAID" };

const STATUS_LABELS = {
  DELIVERED: "Delivered", COMPLETED: "Completed", CANCELLED: "Cancelled",
  NEW_ORDER: "New", PROCESSING: "Processing", READY: "Ready", OUT_FOR_DELIVERY: "Out for Delivery",
};
const STATUS_COLORS = {
  DELIVERED: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  COMPLETED: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CANCELLED: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400",
  NEW_ORDER: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PROCESSING: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  READY: "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
  OUT_FOR_DELIVERY: "bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const ORDER_TYPE_CARD_COLORS = {
  "Dine In": "border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/10 hover:border-orange-400 dark:hover:border-orange-500/50",
  Delivery: "border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 hover:border-blue-400 dark:hover:border-blue-500/50",
  Takeaway: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 hover:border-emerald-400 dark:hover:border-emerald-500/50",
};
const ORDER_TYPE_FILTER_MAP = { "Dine In": TYPE_FILTERS.DINE_IN, Delivery: TYPE_FILTERS.DELIVERY, Takeaway: TYPE_FILTERS.TAKEAWAY };

const TH_CLS = "py-2.5 px-3 text-left font-semibold text-gray-500 dark:text-neutral-400 whitespace-nowrap";
const TD_CLS = "py-2.5 px-3 text-gray-600 dark:text-neutral-400 whitespace-nowrap";

function selectCls(active) {
  return `h-8 px-2.5 pr-7 rounded-lg text-[11px] font-semibold appearance-none cursor-pointer outline-none transition-all border hover:border-primary/40 ${
    active
      ? "bg-primary/10 dark:bg-primary/20 text-primary border-primary/30 dark:border-primary/40"
      : "bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700"
  }`;
}

function FilterSelect({ value, onChange, active, children, small }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange}
        className={`${selectCls(active)}${small ? " !h-7 !text-[10px] !px-2 !pr-6" : ""}`}>
        {children}
      </select>
      <ChevronDown className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${small ? "w-3 h-3" : "w-3.5 h-3.5"} ${active ? "text-primary" : "text-gray-400 dark:text-neutral-500"}`} />
    </div>
  );
}

const DEFAULT_REPORT = {
  totalRevenue: 0, totalOrders: 0, topItems: [],
  paymentRows: [], paymentAccountRows: [], orderTypeRows: [],
  tableBreakdown: [], cancelledSummary: { count: 0, amount: 0, orders: [] },
  typeDetails: {}, reservationSummary: { total: 0, totalGuests: 0, byStatus: {}, reservations: [] },
  completedSummary: { count: 0, amount: 0, orders: [] },
};

// Use local-timezone ISO strings so the backend receives correct date ranges
function getPresetDates(preset) {
  const today = new Date();
  switch (preset) {
    case "today": {
      const s = new Date(today); s.setHours(0, 0, 0, 0);
      const e = new Date(today); e.setDate(e.getDate() + 1); e.setHours(0, 0, 0, 0);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    case "yesterday": {
      const s = new Date(today); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setHours(23, 59, 59, 999);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    case "this_week": {
      const dow = today.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(today); monday.setDate(today.getDate() + diff); monday.setHours(0, 0, 0, 0);
      const e = new Date(today); e.setDate(e.getDate() + 1); e.setHours(0, 0, 0, 0);
      return { from: monday.toISOString(), to: e.toISOString() };
    }
    case "this_month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1); first.setHours(0, 0, 0, 0);
      const e = new Date(today); e.setDate(e.getDate() + 1); e.setHours(0, 0, 0, 0);
      return { from: first.toISOString(), to: e.toISOString() };
    }
    case "last_month": {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1); firstThis.setHours(0, 0, 0, 0);
      const firstLast = new Date(today.getFullYear(), today.getMonth() - 1, 1); firstLast.setHours(0, 0, 0, 0);
      return { from: firstLast.toISOString(), to: firstThis.toISOString() };
    }
    case "all": {
      const s = new Date(2020, 0, 1); s.setHours(0, 0, 0, 0);
      const e = new Date(today); e.setDate(e.getDate() + 1); e.setHours(0, 0, 0, 0);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    default:
      return null;
  }
}

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function downloadCSV(filename, rows) {
  const content = rows.map(toCSVRow).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function buildPeriodLabel(preset, customFrom, customTo) {
  if (preset === "custom") {
    if (customFrom && customTo)
      return `${new Date(customFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(customTo).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    if (customFrom) return `From ${new Date(customFrom).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    if (customTo) return `Up to ${new Date(customTo).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
    return "Custom range";
  }
  return PRESETS.find(p => p.id === preset)?.label || "All Time";
}

function fmtRs(v) { return `Rs ${Math.round(Number(v) || 0).toLocaleString()}`; }
function fmtDate(d) { return new Date(d).toLocaleString("en-PK", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }); }
function fmtShortDate(d) { return new Date(d).toLocaleDateString("en-PK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }); }

function KpiCard({ label, value, sub, icon: Icon, gradient, shadow }) {
  return (
    <div className="group relative bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 hover:shadow-xl transition-all overflow-hidden">
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">{sub}</p>}
        </div>
        <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${shadow} flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-3">
        <Icon className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
      </div>
      <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400">{message}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">{sub}</p>}
    </div>
  );
}

function TopItemsList({ items, title, subtitle, onItemClick }) {
  if (!items || items.length === 0) return <EmptyState icon={Award} message="No item data" sub="Try a different period" />;
  const topRevenue = items[0]?.revenue || 1;
  const totalRevenue = items.reduce((s, i) => s + (i.revenue || 0), 0) || 1;
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  return (
    <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
            <Award className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title || "Top Selling Items"}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-neutral-400">{subtitle}</p>}
          </div>
        </div>
        <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
          {items.length} items
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-neutral-800">
        {items.map((item, index) => {
          const barPct = Math.round((item.revenue / topRevenue) * 100);
          const sharePct = Math.round((item.revenue / totalRevenue) * 100);
          return (
            <button key={item.name + index} type="button"
              onClick={() => onItemClick?.(item.name)}
              className="w-full text-left px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-7 text-center flex-shrink-0">
                  {index < 3 ? <span className="text-lg leading-none">{medals[index]}</span>
                    : <span className="text-xs font-bold text-gray-400 dark:text-neutral-500">#{index + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{item.name}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                        <ShoppingBag className="w-3 h-3" />{item.quantity} sold
                      </span>
                      <span className="text-xs text-gray-400 dark:text-neutral-500 font-medium hidden sm:block">{sharePct}% share</span>
                      <span className="text-sm font-bold text-primary min-w-[72px] text-right">{fmtRs(item.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700" style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [preset, setPreset] = useState("yesterday");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState(DEFAULT_REPORT);
  const [suspended, setSuspended] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // Orders tab state
  const [allOrders, setAllOrders] = useState([]);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState(FILTER_ALL);
  const [ordersTypeFilter, setOrdersTypeFilter] = useState(FILTER_ALL);
  const [ordersPaymentFilter, setOrdersPaymentFilter] = useState(FILTER_ALL);
  const [ordersSourceFilter, setOrdersSourceFilter] = useState(FILTER_ALL);
  const [ordersPaidFilter, setOrdersPaidFilter] = useState(FILTER_ALL);
  const [ordersRiderFilter, setOrdersRiderFilter] = useState(FILTER_ALL);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersPage, setOrdersPage] = useState(0);
  const [itemsDropdownId, setItemsDropdownId] = useState(null);
  const [ordersPerPage, setOrdersPerPage] = useState(25);

  async function loadReport(input) {
    try {
      const data = await getSalesReport(input);
      setReport(Object.fromEntries(
        Object.entries(DEFAULT_REPORT).map(([key, fallback]) => [key, data[key] ?? fallback])
      ));
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) setSuspended(true);
      else toast.error(err.message || "Failed to load sales report");
    } finally {
      setPageLoading(false);
      setLoading(false);
    }
  }

  async function loadOrders() {
    try {
      const data = await getOrders();
      setAllOrders(Array.isArray(data) ? data : []);
    } catch {
      // silently ignore — orders API might not be available
    }
  }

  useEffect(() => {
    const dates = getPresetDates("yesterday");
    loadReport(dates);
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(id) {
    setPreset(id);
    if (id === "custom") return;
    const dates = getPresetDates(id);
    setLoading(true);
    setOrdersPage(0);
    loadReport(dates);
  }

  function applyCustom(e) {
    e.preventDefault();
    setLoading(true);
    setOrdersPage(0);
    const from = customFrom ? new Date(customFrom + "T00:00:00").toISOString() : "";
    const to = customTo ? new Date(customTo + "T23:59:59.999").toISOString() : "";
    loadReport({ from, to });
  }

  function resetFilters() {
    setOrdersStatusFilter(FILTER_ALL);
    setOrdersTypeFilter(FILTER_ALL);
    setOrdersPaymentFilter(FILTER_ALL);
    setOrdersSourceFilter(FILTER_ALL);
    setOrdersPaidFilter(FILTER_ALL);
    setOrdersRiderFilter(FILTER_ALL);
    setOrdersSearch("");
    setOrdersPage(0);
  }

  function goToOrders({ type, payment, search, rider } = {}) {
    resetFilters();
    if (type) setOrdersTypeFilter(type);
    if (payment) setOrdersPaymentFilter(payment);
    if (search) setOrdersSearch(search);
    if (rider) { setOrdersTypeFilter(TYPE_FILTERS.DELIVERY); setOrdersRiderFilter(rider); }
    setActiveTab("orders");
  }

  const avgTicket = report.totalOrders ? Math.round(report.totalRevenue / report.totalOrders) : 0;
  const periodLabel = buildPeriodLabel(preset, customFrom, customTo);

  const activeDateRange = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59.999") : null,
      };
    }
    const d = getPresetDates(preset);
    return { from: d?.from ? new Date(d.from) : null, to: d?.to ? new Date(d.to) : null };
  }, [preset, customFrom, customTo]);

  const dateFilteredOrders = useMemo(() => {
    const { from, to } = activeDateRange;
    return allOrders.filter(o => {
      const t = new Date(o.createdAt);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [allOrders, activeDateRange]);

  const dateFilteredOrdersCount = dateFilteredOrders.length;

  const paymentRows = (report.paymentRows || []).filter(r => r && r.method && r.method !== "Total");
  const paymentAccountRows = report.paymentAccountRows || [];
  const orderTypeRows = report.orderTypeRows || [];

  const paymentTotals = useMemo(() => paymentRows.reduce((acc, row) => {
    const key = (row.method || "").toUpperCase();
    if (!key) return acc;
    if (!acc[key]) acc[key] = { amount: 0, orders: 0 };
    acc[key].amount += Number(row.amount || 0);
    acc[key].orders += Number(row.orders || 0);
    return acc;
  }, {}), [paymentRows]);

  const riderStats = useMemo(() => {
    const map = {};
    for (const o of dateFilteredOrders) {
      if (o.type !== "delivery" || !o.assignedRiderName) continue;
      const name = o.assignedRiderName;
      if (!map[name]) map[name] = { name, deliveries: 0, revenue: 0, cancelled: 0 };
      map[name].deliveries += 1;
      if (o.status === "CANCELLED") map[name].cancelled += 1;
      else map[name].revenue += Math.round(Number(o.grandTotal ?? o.total) || 0);
    }
    return Object.values(map).sort((a, b) => b.deliveries - a.deliveries);
  }, [dateFilteredOrders]);

  // Export CSV for current tab
  function handleExportCSV() {
    const rows = [
      ["Eats Desk Reports — " + TABS.find(t => t.id === activeTab)?.label],
      ["Period", periodLabel],
      ["Generated", new Date().toLocaleString("en-PK")],
      [],
    ];
    if (activeTab === "overview") {
      rows.push(["SUMMARY"], ["Metric", "Value"],
        ["Total Revenue", fmtRs(report.totalRevenue)], ["Total Orders", report.totalOrders], ["Avg Ticket Size", fmtRs(avgTicket)], [],
        ...(paymentRows.length > 0 ? [["PAYMENT WISE SALES"], ["Method", "Orders", "Amount", "%"], ...paymentRows.map(r => [r.method, r.orders, r.amount, r.percent])] : []), [],
        ["TOP SELLING ITEMS"], ["Rank", "Item", "Qty", "Revenue"],
        ...report.topItems.map((item, i) => [i + 1, item.name, item.quantity ?? 0, Math.round(item.revenue || 0)]));
    } else if (activeTab === "orders") {
      rows.push(["ALL ORDERS"], ["Order #", "Status", "Amount", "Type", "Payment", "Customer", "Table", "Date"],
        ...allOrders.map(o => [o.id, o.status, Math.round(o.grandTotal ?? o.total ?? 0), o.type, o.paymentMethod || "", o.customerName || "", o.tableName || "", new Date(o.createdAt).toLocaleString()]));
    }
    downloadCSV(`report-${activeTab}-${periodLabel.replace(/[\s/]/g, "-")}.csv`, rows);
    toast.success("CSV exported");
  }

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked"); return; }
    const generated = new Date().toLocaleString("en-PK");
    const tabLabel = TABS.find(t => t.id === activeTab)?.label || "Report";
    let bodyContent = `<div class="kpis">
      <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value">${fmtRs(report.totalRevenue)}</div></div>
      <div class="kpi"><div class="kpi-label">Orders</div><div class="kpi-value">${report.totalOrders}</div></div>
      <div class="kpi"><div class="kpi-label">Avg Ticket</div><div class="kpi-value">${fmtRs(avgTicket)}</div></div>
    </div>`;
    if (report.topItems.length > 0) {
      bodyContent += `<h2>Top Selling Items</h2><table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>` +
        report.topItems.map((item, i) => `<tr><td>${i + 1}</td><td>${item.name}</td><td>${item.quantity ?? 0}</td><td>${fmtRs(item.revenue)}</td></tr>`).join("") + `</tbody></table>`;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>${tabLabel} — ${periodLabel}</title>
    <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:900px;margin:0 auto}h1{font-size:22px;font-weight:800;margin-bottom:4px}.meta{font-size:12px;color:#6b7280;margin-bottom:28px}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px}.kpi{border:1px solid #e5e7eb;border-radius:12px;padding:16px}.kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px}.kpi-value{font-size:24px;font-weight:800;color:#111}h2{font-size:14px;font-weight:700;margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;padding:8px 12px;border-bottom:2px solid #e5e7eb}td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}@media print{body{padding:0}}</style></head><body>
    <h1>Eats Desk — ${tabLabel}</h1>
    <p class="meta">Period: <strong>${periodLabel}</strong> · Generated: ${generated}</p>
    ${bodyContent}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  // ── Tab renderers ────────────────────────────────────────────────────────

  function renderOverview() {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Total Revenue" value={fmtRs(report.totalRevenue)} sub="from completed orders" icon={DollarSign} gradient="from-primary to-secondary" shadow="shadow-primary/30" />
          <KpiCard label="Total Orders" value={report.totalOrders.toLocaleString()} sub="completed & delivered" icon={ShoppingBag} gradient="from-violet-500 to-violet-600" shadow="shadow-violet-500/30" />
          <KpiCard label="Avg. Ticket Size" value={fmtRs(avgTicket)} sub="revenue per order" icon={TrendingUp} gradient="from-emerald-500 to-emerald-600" shadow="shadow-emerald-500/30" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Payment Summary */}
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Payment Summary</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400">How customers paid in this period</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["CASH", "CARD", "ONLINE"].map(method => {
                const d = paymentTotals[method] || { amount: 0, orders: 0 };
                const label = method === "CASH" ? "Cash" : method === "CARD" ? "Card" : "Online";
                return (
                  <button key={method} type="button"
                    onClick={() => goToOrders({ payment: label })}
                    className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-900/60 px-3 py-3 text-left cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">{label}</p>
                    <p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white">{fmtRs(d.amount)}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-neutral-500">{d.orders.toLocaleString()} orders</p>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Online Accounts */}
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Online Payment Accounts</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Breakdown by JazzCash, bank, etc.</p>
            </div>
            {paymentAccountRows.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 dark:text-neutral-500">No online payments in this period.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800 text-xs">
                {paymentAccountRows.map(row => (
                  <div key={row.accountName} className="flex items-center justify-between py-2.5">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{row.accountName}</p>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{fmtRs(row.amount)}</p>
                      <p className="text-[11px] text-gray-400 dark:text-neutral-500">{row.orders} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Order Type Breakdown */}
        {orderTypeRows.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Order Type Breakdown</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {orderTypeRows.map(row => (
                  <button key={row.type} type="button"
                    onClick={() => goToOrders({ type: ORDER_TYPE_FILTER_MAP[row.type] || FILTER_ALL })}
                    className={`rounded-xl border px-4 py-3 text-left cursor-pointer transition-all ${ORDER_TYPE_CARD_COLORS[row.type] || "border-gray-200 dark:border-neutral-800 bg-gray-50/60 hover:border-gray-400"}`}>
                    <p className="text-xs font-semibold text-gray-600 dark:text-neutral-300">{row.type}</p>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white mt-1">{fmtRs(row.amount)}</p>
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500">{row.orders} orders · {row.percent}</p>
                  </button>
              ))}
            </div>
          </div>
        )}
        <TopItemsList items={report.topItems} title="Top Selling Items" subtitle="Best performers in selected period"
          onItemClick={(itemName) => goToOrders({ search: itemName })} />

        {/* Riders Overview */}
        {riderStats.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/25">
                  <Bike className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Riders Overview</h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">Delivery performance in selected period</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
                  {riderStats.length} rider{riderStats.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs font-bold text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-1 rounded-lg">
                  {fmtRs(riderStats.reduce((s, r) => s + r.revenue, 0))}
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {riderStats.map((rider, idx) => {
                const topDeliveries = riderStats[0]?.deliveries || 1;
                const barPct = Math.round((rider.deliveries / topDeliveries) * 100);
                return (
                  <button key={rider.name} type="button"
                    onClick={() => goToOrders({ rider: rider.name })}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-sky-600 dark:text-sky-400">{rider.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{rider.name}</span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                              <Bike className="w-3 h-3" />{rider.deliveries} deliveries
                            </span>
                            {rider.cancelled > 0 && (
                              <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded">
                                {rider.cancelled} cancelled
                              </span>
                            )}
                            <span className="text-sm font-bold text-primary min-w-[72px] text-right">{fmtRs(rider.revenue)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-700" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderOrders() {
    const dateFiltered = dateFilteredOrders;

    const totalAll = dateFiltered.length;
    const totalCompleted = dateFiltered.filter(o => o.status !== STATUS_FILTERS.CANCELLED).length;
    const totalCancelled = dateFiltered.filter(o => o.status === STATUS_FILTERS.CANCELLED).length;

    let filtered = dateFiltered;
    if (ordersStatusFilter === STATUS_FILTERS.COMPLETED) filtered = filtered.filter(o => o.status !== STATUS_FILTERS.CANCELLED);
    else if (ordersStatusFilter === STATUS_FILTERS.CANCELLED) filtered = filtered.filter(o => o.status === STATUS_FILTERS.CANCELLED);

    if (ordersTypeFilter !== FILTER_ALL) {
      filtered = filtered.filter(o => o.type === (TYPE_API_MAP[ordersTypeFilter] || ordersTypeFilter.toLowerCase()));
    }

    if (ordersPaymentFilter !== FILTER_ALL) {
      filtered = filtered.filter(o => (o.paymentMethod || "").toLowerCase() === ordersPaymentFilter.toLowerCase());
    }

    if (ordersSourceFilter !== FILTER_ALL) {
      filtered = filtered.filter(o => (o.source || "").toUpperCase() === ordersSourceFilter);
    }

    if (ordersPaidFilter !== FILTER_ALL) {
      filtered = filtered.filter(o => ordersPaidFilter === PAID_FILTERS.PAID ? o.isPaid : !o.isPaid);
    }

    if (ordersRiderFilter !== FILTER_ALL) {
      filtered = filtered.filter(o => (o.assignedRiderName || "") === ordersRiderFilter);
    }

    const availableRiders = [...new Set(
      dateFiltered
        .filter(o => o.type === "delivery" && o.assignedRiderName)
        .map(o => o.assignedRiderName)
    )].sort();

    if (ordersSearch.trim()) {
      const q = ordersSearch.trim().toLowerCase();
      filtered = filtered.filter(o =>
        (o.id || "").toString().toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.tableName || "").toLowerCase().includes(q) ||
        (o.customerPhone || "").includes(q) ||
        (o.assignedRiderName || "").toLowerCase().includes(q) ||
        (o.items || []).some(item => (item.name || "").toLowerCase().includes(q))
      );
    }

    const hasActiveFilters = ordersStatusFilter !== FILTER_ALL || ordersTypeFilter !== FILTER_ALL || ordersPaymentFilter !== FILTER_ALL || ordersSourceFilter !== FILTER_ALL || ordersPaidFilter !== FILTER_ALL || ordersRiderFilter !== FILTER_ALL || ordersSearch.trim();

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / ordersPerPage);
    const safePage = Math.min(ordersPage, Math.max(0, totalPages - 1));
    const paged = filtered.slice(safePage * ordersPerPage, (safePage + 1) * ordersPerPage);


    return (
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Row 1: Status tabs + search */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
          {[
            { value: "ALL", label: "All", count: totalAll },
            { value: "COMPLETED", label: "Completed", count: totalCompleted },
            { value: "CANCELLED", label: "Cancelled", count: totalCancelled },
          ].map(f => (
            <button key={f.value} type="button" onClick={() => { setOrdersStatusFilter(f.value); setOrdersPage(0); }}
              className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-semibold transition-all ${
                ordersStatusFilter === f.value
                  ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                  : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
              }`}>
              {f.label}
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ordersStatusFilter === f.value ? "bg-white/20" : "bg-gray-200 dark:bg-neutral-700"}`}>{f.count}</span>
            </button>
          ))}

          <div className="flex-1 min-w-[180px] ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
            <input type="text" value={ordersSearch} onChange={e => { setOrdersSearch(e.target.value); setOrdersPage(0); }}
              placeholder="Search order #, customer, table, phone, rider..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
          </div>
        </div>

        {/* Row 2: Dropdown filters */}
        <div className="px-5 py-2.5 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mr-1">Filters</span>

          <FilterSelect value={ordersTypeFilter} active={ordersTypeFilter !== FILTER_ALL}
            onChange={e => { setOrdersTypeFilter(e.target.value); if (e.target.value !== TYPE_FILTERS.DELIVERY) setOrdersRiderFilter(FILTER_ALL); setOrdersPage(0); }}>
            <option value="ALL">All Types</option>
            <option value="DINE_IN">Dine-in</option>
            <option value="DELIVERY">Delivery</option>
            <option value="TAKEAWAY">Takeaway</option>
          </FilterSelect>

          <FilterSelect value={ordersPaymentFilter} active={ordersPaymentFilter !== FILTER_ALL}
            onChange={e => { setOrdersPaymentFilter(e.target.value); setOrdersPage(0); }}>
            <option value="ALL">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Online">Online</option>
            <option value="To be paid">Unpaid</option>
          </FilterSelect>

          <FilterSelect value={ordersSourceFilter} active={ordersSourceFilter !== FILTER_ALL}
            onChange={e => { setOrdersSourceFilter(e.target.value); setOrdersPage(0); }}>
            <option value="ALL">All Sources</option>
            <option value="POS">POS</option>
            <option value="ONLINE">Online</option>
          </FilterSelect>

          <FilterSelect value={ordersPaidFilter} active={ordersPaidFilter !== FILTER_ALL}
            onChange={e => { setOrdersPaidFilter(e.target.value); setOrdersPage(0); }}>
            <option value="ALL">Paid & Unpaid</option>
            <option value="PAID">Paid Only</option>
            <option value="UNPAID">Unpaid Only</option>
          </FilterSelect>

          {ordersTypeFilter === TYPE_FILTERS.DELIVERY && availableRiders.length > 0 && (
            <FilterSelect value={ordersRiderFilter} active={ordersRiderFilter !== FILTER_ALL}
              onChange={e => { setOrdersRiderFilter(e.target.value); setOrdersPage(0); }}>
              <option value="ALL">All Riders</option>
              {availableRiders.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </FilterSelect>
          )}

          <div className="flex-1" />

          <span className="text-[11px] font-medium text-gray-400 dark:text-neutral-500">{totalFiltered} result{totalFiltered !== 1 ? "s" : ""}</span>

          {hasActiveFilters && (
            <button type="button" onClick={resetFilters}
              className="h-7 px-3 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
              Reset All
            </button>
          )}
        </div>

        {paged.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-8 h-8 text-gray-300 dark:text-neutral-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400">No orders found</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Try adjusting the filters or date range</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="text-xs min-w-[1600px]">
                <thead className="bg-gray-50 dark:bg-neutral-900/80 sticky top-0">
                  <tr>
                    <th className={TH_CLS}>Order #</th>
                    <th className={TH_CLS}>Status</th>
                    <th className={`${TH_CLS} text-right`}>Grand Total</th>
                    <th className={`${TH_CLS} text-right`}>Subtotal</th>
                    <th className={`${TH_CLS} text-right`}>Discount</th>
                    <th className={TH_CLS}>Items</th>
                    <th className={TH_CLS}>Type</th>
                    <th className={TH_CLS}>Payment</th>
                    <th className={TH_CLS}>Paid</th>
                    <th className={TH_CLS}>Received</th>
                    <th className={TH_CLS}>Change</th>
                    <th className={TH_CLS}>Provider</th>
                    <th className={TH_CLS}>Customer</th>
                    <th className={TH_CLS}>Phone</th>
                    <th className={TH_CLS}>Table</th>
                    <th className={TH_CLS}>Source</th>
                    <th className={TH_CLS}>Order Taker</th>
                    <th className={TH_CLS}>Rider</th>
                    <th className={TH_CLS}>Delivery Address</th>
                    <th className={TH_CLS}>Del. Charges</th>
                    <th className={TH_CLS}>Cancel Reason</th>
                    <th className={TH_CLS}>Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                  {paged.map((o, i) => (
                    <tr key={o._id || i} className="hover:bg-gray-50/70 dark:hover:bg-neutral-900/40 transition-colors">
                      <td className={`${TD_CLS} font-semibold text-gray-900 dark:text-white`}>#{o.id}</td>
                      <td className={TD_CLS}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className={`${TD_CLS} text-right font-bold text-gray-900 dark:text-white`}>{fmtRs(o.grandTotal ?? o.total)}</td>
                      <td className={`${TD_CLS} text-right`}>{fmtRs(o.subtotal)}</td>
                      <td className={`${TD_CLS} text-right`}>{o.discountAmount > 0 ? fmtRs(o.discountAmount) : "—"}</td>
                      <td className={`${TD_CLS} relative`}>
                        {(o.items || []).length > 0 ? (
                          <div className="relative">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setItemsDropdownId(itemsDropdownId === o._id ? null : o._id); }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${itemsDropdownId === o._id ? "bg-primary/10 text-primary" : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"}`}>
                              {o.items.length} item{o.items.length > 1 ? "s" : ""}
                              <ChevronDown className={`w-3 h-3 transition-transform ${itemsDropdownId === o._id ? "rotate-180" : ""}`} />
                            </button>
                            {itemsDropdownId === o._id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setItemsDropdownId(null)} />
                                <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden">
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="bg-gray-50 dark:bg-neutral-900/80">
                                        <th className="py-1.5 px-3 text-left font-semibold text-gray-500 dark:text-neutral-400">Item</th>
                                        <th className="py-1.5 px-3 text-center font-semibold text-gray-500 dark:text-neutral-400">Qty</th>
                                        <th className="py-1.5 px-3 text-right font-semibold text-gray-500 dark:text-neutral-400">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                      {o.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                          <td className="py-1.5 px-3 text-center text-gray-600 dark:text-neutral-400">x{item.qty}</td>
                                          <td className="py-1.5 px-3 text-right font-semibold text-gray-900 dark:text-white">{fmtRs(item.lineTotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                      <td className={TD_CLS}>{TYPE_LABEL_MAP[o.type] || o.type}</td>
                      <td className={TD_CLS}>{o.paymentMethod || "—"}</td>
                      <td className={TD_CLS}>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.isPaid ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                          {o.isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className={`${TD_CLS} text-right`}>{o.paymentAmountReceived != null ? fmtRs(o.paymentAmountReceived) : "—"}</td>
                      <td className={`${TD_CLS} text-right`}>{o.paymentAmountReturned > 0 ? fmtRs(o.paymentAmountReturned) : "—"}</td>
                      <td className={TD_CLS}>{o.paymentProvider || "—"}</td>
                      <td className={TD_CLS}>{o.customerName || "—"}</td>
                      <td className={TD_CLS}>{o.customerPhone || "—"}</td>
                      <td className={TD_CLS}>{o.tableName || "—"}</td>
                      <td className={TD_CLS}>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${o.source === "POS" ? "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" : "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                          {o.source}
                        </span>
                      </td>
                      <td className={TD_CLS}>{o.orderTakerName || "—"}</td>
                      <td className={TD_CLS}>{o.assignedRiderName || "—"}</td>
                      <td className={`${TD_CLS} max-w-[200px] truncate`} title={o.deliveryAddress || ""}>{o.deliveryAddress || "—"}</td>
                      <td className={`${TD_CLS} text-right`}>{o.deliveryCharges > 0 ? fmtRs(o.deliveryCharges) : "—"}</td>
                      <td className={`${TD_CLS} max-w-[150px] truncate`} title={o.cancelReason || ""}>{o.cancelReason || "—"}</td>
                      <td className={TD_CLS}>{fmtShortDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalFiltered > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                    Showing {safePage * ordersPerPage + 1}–{Math.min((safePage + 1) * ordersPerPage, totalFiltered)} of {totalFiltered}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 dark:text-neutral-500">Per page</span>
                    <FilterSelect value={ordersPerPage} active={ordersPerPage !== 25} small
                      onChange={e => { setOrdersPerPage(Number(e.target.value)); setOrdersPage(0); }}>
                      {[10, 25, 50, 100].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </FilterSelect>
                  </div>
                </div>
                {totalPages > 1 && <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setOrdersPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page = i;
                    if (totalPages > 5) {
                      const start = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                      page = start + i;
                    }
                    return (
                      <button key={page} type="button" onClick={() => setOrdersPage(page)}
                        className={`w-7 h-7 rounded-lg text-[11px] font-semibold transition-all ${
                          page === safePage
                            ? "bg-primary text-white"
                            : "text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                        }`}>
                        {page + 1}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setOrdersPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderActiveTab() {
    switch (activeTab) {
      case "orders": return renderOrders();
      default: return renderOverview();
    }
  }

  return (
    <AdminLayout title="Sales & Reports" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <BarChart3 className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">Loading sales report...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Toolbar: Tabs (left) + Date & Export (right) ── */}
          <div className="flex items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-1 gap-0.5">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                let badge = null;
                if (tab.id === "orders") badge = dateFilteredOrdersCount || null;
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                        : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                    }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {badge != null && (
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300"}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: Date + Export + Help */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Date dropdown */}
              <div className="relative">
                <button type="button" onClick={() => { setShowDateDropdown(v => !v); setShowExportDropdown(false); }}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-900 dark:text-white hover:border-primary/40 transition-all">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {periodLabel}
                  {loading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showDateDropdown ? "rotate-180" : ""}`} />
                </button>
                {showDateDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-2 space-y-0.5">
                        {PRESETS.filter(p => p.id !== "custom").map(p => (
                          <button key={p.id} type="button"
                            onClick={() => { applyPreset(p.id); setShowDateDropdown(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                              preset === p.id
                                ? "bg-gradient-to-r from-primary to-secondary text-white"
                                : "text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            }`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 dark:border-neutral-800 p-3">
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 mb-2">Custom Range</p>
                        <form onSubmit={(e) => { applyCustom(e); setShowDateDropdown(false); }} className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPreset("custom"); }}
                              className="h-8 px-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary transition-all" />
                            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPreset("custom"); }}
                              className="h-8 px-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary transition-all" />
                          </div>
                          <button type="submit" disabled={loading || (!customFrom && !customTo)}
                            className="w-full h-8 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-md hover:shadow-primary/25 transition-all disabled:opacity-50">
                            {loading ? "Loading..." : "Apply Range"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Export dropdown */}
              <div className="relative">
                <button type="button" onClick={() => { setShowExportDropdown(v => !v); setShowDateDropdown(false); }}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:border-primary/40 transition-all">
                  <Download className="w-3.5 h-3.5" />
                  Export
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showExportDropdown ? "rotate-180" : ""}`} />
                </button>
                {showExportDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-44 bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden p-1.5">
                      <button type="button" onClick={() => { handleExportCSV(); setShowExportDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                        <FileDown className="w-3.5 h-3.5 text-emerald-600" />CSV
                      </button>
                      <button type="button" onClick={() => { handlePrint(); setShowExportDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />PDF
                      </button>
                      <button type="button" onClick={() => { handlePrint(); setShowExportDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                        <Printer className="w-3.5 h-3.5 text-violet-600" />Print
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Help */}
              <button type="button" onClick={() => setShowHelpModal(true)}
                className="h-9 w-9 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/40 transition-all"
                title="How does date filtering work?">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Active tab content ── */}
          {renderActiveTab()}

        </div>
      )}

      {/* ── Help modal ── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowHelpModal(false)}>
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">How date filtering works</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-neutral-300">
              <p>All date presets use your <strong>local timezone</strong> so reports match what you see in Overview.</p>
              <p><strong>Yesterday</strong> covers midnight to 11:59 PM of the previous day.</p>
              <p><strong>Custom range</strong>: "From" includes from the start of that day, "To" includes up to the end of that day.</p>
              <p className="text-gray-500 dark:text-neutral-400">Only <strong>delivered</strong> orders count towards revenue. Cancelled orders are tracked separately.</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
