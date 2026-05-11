import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getOrders,
  getDaySessions,
  getCurrencySymbol,
  getRiderPayouts,
  postRiderPayout,
  getRiders,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import {
  Truck,
  Loader2,
  RefreshCw,
  ChevronDown,
  Circle,
  PanelRight,
  AlertTriangle,
  Check,
  X,
  Clock,
  MapPin,
} from "lucide-react";
import toast from "react-hot-toast";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "custom", label: "Custom" },
];

const DEFAULT_RIDER_EXPENSE_ACCOUNT_CODE = "602";

function buildCashPaymentHref({ amount, riderName, periodLabel }) {
  const params = new URLSearchParams();
  params.set("expenseAccountCode", DEFAULT_RIDER_EXPENSE_ACCOUNT_CODE);
  const n = amount != null ? Math.round(Number(amount)) : 0;
  if (n > 0) params.set("suggestedAmount", String(n));
  if (riderName) params.set("riderName", String(riderName));
  const note = riderName
    ? `Rider payout — ${riderName}${periodLabel ? ` (${periodLabel})` : ""}`
    : periodLabel
      ? `Rider payouts — ${periodLabel}`
      : "Rider allowances";
  params.set("notes", note);
  return `/accounting/vouchers/cash-payment?${params.toString()}`;
}

function getCalendarDates(preset) {
  const today = new Date();
  switch (preset) {
    case "today": {
      const s = new Date(today);
      s.setHours(0, 0, 0, 0);
      const e = new Date(today);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    case "yesterday": {
      const s = new Date(today);
      s.setDate(s.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setHours(23, 59, 59, 999);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    case "this_week": {
      const dow = today.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const e = new Date(today);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      return { from: monday.toISOString(), to: e.toISOString() };
    }
    case "this_month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      first.setHours(0, 0, 0, 0);
      const e = new Date(today);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      return { from: first.toISOString(), to: e.toISOString() };
    }
    default:
      return null;
  }
}

function getSmartDates(preset, sessions) {
  const now = new Date();
  if (preset === "today" && Array.isArray(sessions) && sessions.length > 0) {
    const openSessions = sessions
      .filter((s) => s?.status === "OPEN" && s?.startAt)
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
    if (openSessions[0]?.startAt) {
      const openDate = new Date(openSessions[0].startAt).toDateString();
      const sameDaySessions = sessions.filter(
        (s) => s?.startAt && new Date(s.startAt).toDateString() === openDate,
      );
      const earliestStartMs = sameDaySessions.reduce(
        (min, s) => Math.min(min, new Date(s.startAt).getTime()),
        new Date(openSessions[0].startAt).getTime(),
      );
      return {
        from: new Date(earliestStartMs).toISOString(),
        to: now.toISOString(),
      };
    }

    const latestClosed = sessions
      .filter((s) => s?.status === "CLOSED" && s?.startAt && s?.endAt)
      .sort((a, b) => new Date(b.endAt) - new Date(a.endAt))[0];
    if (latestClosed?.startAt && latestClosed?.endAt) {
      return {
        from: new Date(latestClosed.startAt).toISOString(),
        to: new Date(latestClosed.endAt).toISOString(),
      };
    }
  }
  return getCalendarDates(preset);
}

function getOrdersQuery(preset, sessions) {
  return getSmartDates(preset, sessions) || getCalendarDates(preset);
}

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function downloadCSV(filename, rows) {
  const content = rows.map(toCSVRow).join("\n");
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtRs(v) {
  const sym = getCurrencySymbol();
  const amt = Math.round(Number(v) || 0).toLocaleString();
  return sym === "Rs" ? `Rs. ${amt}` : `${sym} ${amt}`;
}

function getOrderDisplayFields(o) {
  const mongoId =
    o._id ||
    (typeof o.id === "string" && /^[a-f0-9]{24}$/i.test(o.id) ? o.id : null);
  const label =
    o.orderNumber ||
    (mongoId
      ? `ORD-${String(mongoId).slice(-6).toUpperCase()}`
      : o.id
        ? String(o.id)
        : "—");
  return { mongoId, label };
}

function buildPeriodLabel(preset, customFrom, customTo) {
  if (preset === "custom") {
    if (customFrom && customTo) return `${customFrom} — ${customTo}`;
    return "Custom range";
  }
  return PRESETS.find((p) => p.id === preset)?.label || "";
}

function isDelivery(o) {
  return String(o.type || "").toLowerCase() === "delivery";
}

function isDelivered(st) {
  const s = String(st || "").toUpperCase();
  return s === "DELIVERED" || s === "COMPLETED";
}

function isCancelled(st) {
  return String(st || "").toUpperCase() === "CANCELLED";
}

function parseOrderDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function lastStatusAtFromHistory(history, status) {
  if (!Array.isArray(history)) return null;
  const up = String(status).toUpperCase();
  let last = null;
  for (const row of history) {
    if (String(row?.status || "").toUpperCase() === up && row.at) {
      const t = parseOrderDate(row.at);
      if (t) last = t;
    }
  }
  return last;
}

function deliveryDurationMinutes(o) {
  if (!isDelivered(o.status)) return null;
  const start =
    lastStatusAtFromHistory(o.statusHistory, "OUT_FOR_DELIVERY") ||
    parseOrderDate(o.createdAt);
  const st = String(o.status || "").toUpperCase();
  const end =
    lastStatusAtFromHistory(o.statusHistory, "DELIVERED") ||
    lastStatusAtFromHistory(o.statusHistory, "COMPLETED") ||
    ((st === "DELIVERED" || st === "COMPLETED") && o.updatedAt
      ? parseOrderDate(o.updatedAt)
      : null);
  if (!start || !end) return null;
  const mins = (end.getTime() - start.getTime()) / 60000;
  return Number.isFinite(mins) && mins > 0 ? mins : null;
}

function hoursSpan(from, to) {
  if (!from || !to) return 1;
  const h = (to.getTime() - from.getTime()) / (3600000 * 24);
  return Math.max(h * 24, 0.25);
}

export default function RidersPage() {
  const router = useRouter();
  const { currentBranch } = useBranch();
  const [preset, setPreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sessions, setSessions] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [staffRiders, setStaffRiders] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sidebarRiderKey, setSidebarRiderKey] = useState(null);
  const [detailTab, setDetailTab] = useState("orders");
  const [pipelineFilter, setPipelineFilter] = useState(null);
  const [codExpandId, setCodExpandId] = useState(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [modalRiderId, setModalRiderId] = useState("");
  const [modalAmount, setModalAmount] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalPayMethod, setModalPayMethod] = useState("Cash");
  const [modalPostCpv, setModalPostCpv] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const autoRef = useRef(null);

  const loadOrders = useCallback(async (dates) => {
    try {
      const params = { limit: 2000 };
      if (dates?.from) params.from = dates.from;
      if (dates?.to) params.to = dates.to;
      const data = await getOrders(params);
      if (data && typeof data === "object" && Array.isArray(data.orders)) {
        let all = data.orders;
        let pg = 1;
        while (all.length < data.total && pg < 20) {
          pg += 1;
          const next = await getOrders({ ...params, page: pg });
          if (!next?.orders?.length) break;
          all = all.concat(next.orders);
        }
        setAllOrders(all);
      } else {
        setAllOrders(Array.isArray(data) ? data : []);
      }
    } catch {
      setAllOrders([]);
    }
  }, []);

  const loadPayouts = useCallback(async (fromIso, toIso) => {
    if (!fromIso || !toIso) {
      setPayouts([]);
      return;
    }
    try {
      const data = await getRiderPayouts({
        from: fromIso,
        to: toIso,
        status: "paid",
      });
      setPayouts(Array.isArray(data?.payouts) ? data.payouts : []);
    } catch {
      setPayouts([]);
    }
  }, []);

  const loadStaffRiders = useCallback(async () => {
    try {
      const list = await getRiders();
      setStaffRiders(Array.isArray(list) ? list : []);
    } catch {
      setStaffRiders([]);
    }
  }, []);

  const loadAll = useCallback(
    async (presetId, customRange) => {
      setRefreshing(true);
      try {
        let loadedSessions = [];
        try {
          const res = await getDaySessions(currentBranch?.id, { limit: 30 });
          loadedSessions = Array.isArray(res?.sessions) ? res.sessions : [];
          setSessions(loadedSessions);
        } catch {
          setSessions([]);
        }
        let q;
        if (presetId === "custom" && customRange?.from && customRange?.to) {
          q = {
            from: new Date(customRange.from + "T00:00:00").toISOString(),
            to: new Date(customRange.to + "T23:59:59.999").toISOString(),
          };
        } else {
          q = getOrdersQuery(presetId, loadedSessions);
        }
        await Promise.all([
          loadOrders(q),
          loadStaffRiders(),
          q?.from && q?.to ? loadPayouts(q.from, q.to) : Promise.resolve(),
        ]);
        if (!q?.from || !q?.to) setPayouts([]);
        setLastUpdated(new Date());
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [currentBranch?.id, loadOrders, loadPayouts, loadStaffRiders],
  );

  useEffect(() => {
    if (preset === "custom") {
      setAllOrders([]);
      setPayouts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAll(preset, null);
  }, [currentBranch?.id, preset, loadAll]);

  useEffect(() => {
    autoRef.current = setInterval(() => {
      if (preset === "custom") return;
      loadAll(preset, null);
    }, 60000);
    return () => clearInterval(autoRef.current);
  }, [preset, loadAll]);

  const activeDateRange = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59.999") : null,
      };
    }
    const d = getSmartDates(preset, sessions);
    return {
      from: d?.from ? new Date(d.from) : null,
      to: d?.to ? new Date(d.to) : null,
    };
  }, [preset, customFrom, customTo, sessions]);

  const dateFilteredOrders = useMemo(() => {
    const { from, to } = activeDateRange;
    return allOrders.filter((o) => {
      const t = new Date(o.createdAt);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [allOrders, activeDateRange]);

  const deliveryOrders = useMemo(
    () =>
      dateFilteredOrders.filter(
        (o) =>
          isDelivery(o) &&
          (o.assignedRiderId ||
            (o.assignedRiderName && String(o.assignedRiderName).trim())),
      ),
    [dateFilteredOrders],
  );

  /** Live pipeline: active delivery orders (any date in loaded batch — best-effort from same fetch). */
  const livePipelineOrders = useMemo(() => {
    return allOrders.filter((o) => {
      if (!isDelivery(o)) return false;
      const s = String(o.status || "").toUpperCase();
      return [
        "NEW_ORDER",
        "PROCESSING",
        "PREPARING",
        "READY",
        "OUT_FOR_DELIVERY",
      ].includes(s);
    });
  }, [allOrders]);

  const pipelineCounts = useMemo(() => {
    let k = 0;
    let r = 0;
    let o = 0;
    for (const x of livePipelineOrders) {
      const s = String(x.status || "").toUpperCase();
      if (s === "READY") r += 1;
      else if (s === "OUT_FOR_DELIVERY") o += 1;
      else if (["NEW_ORDER", "PROCESSING", "PREPARING"].includes(s)) k += 1;
    }
    return { kitchen: k, ready: r, out: o, total: k + r + o };
  }, [livePipelineOrders]);

  const fleetStats = useMemo(() => {
    const deliveredOrders = deliveryOrders.filter((o) => isDelivered(o.status));
    const revenue = deliveredOrders.reduce(
      (s, o) => s + Math.round(Number(o.grandTotal ?? o.total) || 0),
      0,
    );
    const delFees = deliveredOrders.reduce(
      (s, o) => s + Math.round(Number(o.deliveryCharges) || 0),
      0,
    );
    const cod = deliveredOrders.filter((o) => !o.isPaid);
    const codOwed = cod.reduce(
      (s, o) => s + Math.round(Number(o.grandTotal ?? o.total) || 0),
      0,
    );
    const riderKeys = new Set();
    for (const o of deliveryOrders) {
      const id = o.assignedRiderId ? String(o.assignedRiderId) : "";
      const nm = String(o.assignedRiderName || "")
        .trim()
        .toLowerCase();
      riderKeys.add(id || `name:${nm}`);
    }
    return {
      riderCount: riderKeys.size,
      deliveries: deliveredOrders.length,
      revenue,
      delFees,
      codOwed,
      codOrders: cod.length,
    };
  }, [deliveryOrders]);

  const mergedRiders = useMemo(() => {
    const byKey = new Map();
    const addBucket = (key, riderId, riderName, phone) => {
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          riderId,
          riderName: riderName || "Unknown",
          phone: phone || "",
          orders: [],
        });
      }
      return byKey.get(key);
    };
    for (const u of staffRiders) {
      const id = String(u.id || u._id || "");
      addBucket(id || `staff:${u.name}`, id || null, u.name, u.phone);
    }
    for (const o of deliveryOrders) {
      const id = o.assignedRiderId ? String(o.assignedRiderId) : "";
      const name = String(o.assignedRiderName || "").trim() || "Unknown";
      const phone = String(o.assignedRiderPhone || "").trim();
      const key = id || `name:${name.toLowerCase()}`;
      const b = addBucket(key, id || null, name, phone);
      b.orders.push(o);
    }
    const list = [...byKey.values()].map((b) => {
      const { orders } = b;
      const assigned = orders.length;
      const delivered = orders.filter((o) => isDelivered(o.status)).length;
      const cancelled = orders.filter((o) => isCancelled(o.status)).length;
      const out = orders.filter(
        (o) => String(o.status) === "OUT_FOR_DELIVERY",
      ).length;
      const ready = orders.filter((o) => String(o.status) === "READY").length;
      const kitchen = orders.filter((o) =>
        ["NEW_ORDER", "PROCESSING", "PREPARING"].includes(
          String(o.status || "").toUpperCase(),
        ),
      ).length;
      const delFeesEarned = orders
        .filter((o) => isDelivered(o.status))
        .reduce((s, o) => s + Math.round(Number(o.deliveryCharges) || 0), 0);
      const orderValue = orders
        .filter((o) => !isCancelled(o.status))
        .reduce(
          (s, o) => s + Math.round(Number(o.grandTotal ?? o.total) || 0),
          0,
        );
      const codList = orders.filter((o) => isDelivered(o.status) && !o.isPaid);
      const codOwed = codList.reduce(
        (s, o) => s + Math.round(Number(o.grandTotal ?? o.total) || 0),
        0,
      );
      const durs = orders.map(deliveryDurationMinutes).filter((x) => x != null);
      const n = durs.length;
      const perf =
        n >= 3
          ? {
              n,
              avg: durs.reduce((a, c) => a + c, 0) / n,
              min: Math.min(...durs),
              max: Math.max(...durs),
            }
          : { n, avg: null, min: null, max: null };
      let status = "off";
      if (assigned === 0) status = "off";
      else if (out > 0) status = "active";
      else status = "idle";
      const riderPayouts = payouts.filter((p) =>
        b.riderId
          ? String(p.rider) === b.riderId
          : String(p.riderName || "").trim() === b.riderName.trim(),
      );
      const lastPayout = riderPayouts.sort(
        (a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0),
      )[0];
      const paidThisMonth = riderPayouts.reduce(
        (s, p) => s + Math.round(Number(p.amountPaid) || 0),
        0,
      );
      return {
        ...b,
        assigned,
        delivered,
        cancelled,
        out,
        ready,
        kitchen,
        delFeesEarned,
        orderValue,
        codList,
        codOwed,
        perf,
        status,
        lastPayout,
        paidThisMonth,
      };
    });
    list.sort((a, b) => {
      const rank = { active: 0, idle: 1, off: 2 };
      if (rank[a.status] !== rank[b.status])
        return rank[a.status] - rank[b.status];
      return b.delivered - a.delivered;
    });
    return list;
  }, [deliveryOrders, staffRiders, payouts]);

  const sidebarRider = useMemo(
    () =>
      sidebarRiderKey
        ? (mergedRiders.find((r) => r.key === sidebarRiderKey) ?? null)
        : null,
    [mergedRiders, sidebarRiderKey],
  );

  const fleetAvgTrip = useMemo(() => {
    const durs = deliveryOrders
      .filter((o) => isDelivered(o.status))
      .map(deliveryDurationMinutes)
      .filter((x) => x != null);
    const n = durs.length;
    if (n < 3) return null;
    return durs.reduce((a, c) => a + c, 0) / n;
  }, [deliveryOrders]);

  const periodLabel = buildPeriodLabel(preset, customFrom, customTo);
  const fromIso = activeDateRange.from?.toISOString?.() || null;
  const toIso = activeDateRange.to?.toISOString?.() || null;

  const openPayoutModal = (riderId) => {
    setModalRiderId(riderId || (mergedRiders[0]?.riderId ?? ""));
    setModalNotes("");
    setModalPayMethod("Cash");
    setModalPostCpv(false);
    setPayoutModalOpen(true);
  };

  useEffect(() => {
    if (!payoutModalOpen || !mergedRiders.length) return;
    const r =
      mergedRiders.find((x) => x.riderId === modalRiderId) || mergedRiders[0];
    if (r) setModalAmount(String(r.delFeesEarned || 0));
  }, [payoutModalOpen, modalRiderId, mergedRiders]);

  async function submitPayoutModal() {
    const r = mergedRiders.find((x) => x.riderId === modalRiderId);
    if (!r?.riderId) {
      toast.error(
        "Select a rider with a staff account (rider ID required to record payout)",
      );
      return;
    }
    if (!fromIso || !toIso) {
      toast.error("Invalid period");
      return;
    }
    const amt = Math.round(Number(modalAmount));
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const noteParts = [
      modalNotes.trim(),
      `Pay method: ${modalPayMethod}`,
    ].filter(Boolean);
    setModalSaving(true);
    try {
      await postRiderPayout({
        riderId: r.riderId,
        from: fromIso,
        to: toIso,
        amountPaid: amt,
        notes: noteParts.join(" · "),
      });
      toast.success("Payout recorded");
      setPayoutModalOpen(false);
      await loadPayouts(fromIso, toIso);
      if (modalPostCpv && amt > 0) {
        router.push(
          buildCashPaymentHref({
            amount: amt,
            riderName: r.riderName,
            periodLabel,
          }),
        );
      }
    } catch (e) {
      toast.error(e.message || "Failed to record payout");
    } finally {
      setModalSaving(false);
    }
  }

  function exportFleetCsv() {
    downloadCSV(
      `riders-fleet-${preset}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        [
          "Rider",
          "Rider ID",
          "Status",
          "Assigned",
          "Delivered",
          "Cancelled",
          "Del fees (delivered)",
          "Order value",
          "COD owed",
          "Avg trip min",
        ],
        ...mergedRiders.map((r) => [
          r.riderName,
          r.riderId || "",
          r.status,
          r.assigned,
          r.delivered,
          r.cancelled,
          r.delFeesEarned,
          r.orderValue,
          r.codOwed,
          r.perf.n >= 3 && r.perf.avg != null ? Math.round(r.perf.avg) : "",
        ]),
      ],
    );
    toast.success("CSV exported");
  }

  const filteredPipelineTable = useMemo(() => {
    let list = livePipelineOrders;
    if (pipelineFilter === "kitchen")
      list = list.filter((o) =>
        ["NEW_ORDER", "PROCESSING", "PREPARING"].includes(
          String(o.status || "").toUpperCase(),
        ),
      );
    else if (pipelineFilter === "ready")
      list = list.filter((o) => String(o.status) === "READY");
    else if (pipelineFilter === "out")
      list = list.filter((o) => String(o.status) === "OUT_FOR_DELIVERY");
    return list;
  }, [livePipelineOrders, pipelineFilter]);

  const hoursDelivered = useMemo(() => {
    const buckets = Array(24).fill(0);
    if (!sidebarRider) return buckets;
    for (const o of sidebarRider.orders) {
      if (!isDelivered(o.status)) continue;
      const end =
        lastStatusAtFromHistory(o.statusHistory, "DELIVERED") ||
        lastStatusAtFromHistory(o.statusHistory, "COMPLETED") ||
        parseOrderDate(o.updatedAt) ||
        parseOrderDate(o.createdAt);
      if (!end) continue;
      buckets[end.getHours()] += 1;
    }
    return buckets;
  }, [sidebarRider]);

  const selectCls =
    "h-9 px-3 pr-8 rounded-lg text-xs font-semibold appearance-none cursor-pointer border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-gray-800 dark:text-neutral-200";

  const secAgo =
    lastUpdated != null
      ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
      : "—";

  return (
    <AdminLayout title="Riders">
      <div
        className={`space-y-6 pb-16 text-gray-900 dark:text-white ${
          sidebarRiderKey
            ? "lg:mr-[min(28rem,calc(100vw-2rem))] transition-[margin] duration-200 ease-out"
            : ""
        }`}
      >
        {/* Section 1 — Header */}
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 dark:border-neutral-800">
          <div>
            <p className="text-sm text-gray-700 dark:text-neutral-400 font-medium">
              Live tracking · Performance · Payouts
            </p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Last updated: {secAgo === "—" ? "—" : `${secAgo}s ago`} · Auto-refresh every 60s
              </span>
              {refreshing && !loading && (
                <span className="inline-flex items-center gap-1.5 text-primary font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                  Updating…
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {["today", "yesterday", "this_week", "this_month"].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSidebarRiderKey(null);
                    setPreset(id);
                  }}
                  className={`h-9 px-3 rounded-lg text-xs font-bold border transition-colors ${
                    preset === id
                      ? "border-primary bg-primary text-white shadow-sm shadow-primary/25"
                      : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {PRESETS.find((p) => p.id === id)?.label}
                </button>
              ))}
              <div className="relative">
                <select
                  value={preset}
                  onChange={(e) => {
                    setSidebarRiderKey(null);
                    setPreset(e.target.value);
                  }}
                  className={selectCls}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => openPayoutModal("")}
              className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/25 hover:opacity-95"
            >
              Record payout
            </button>
            <button
              type="button"
              onClick={exportFleetCsv}
              className="h-10 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              Export CSV
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setLoading(true);
                if (preset === "custom" && customFrom && customTo) {
                  loadAll("custom", { from: customFrom, to: customTo });
                } else if (preset !== "custom") loadAll(preset, null);
                else toast.error("Pick custom dates and Apply");
              }}
              className="h-10 w-10 rounded-xl border border-gray-200 dark:border-neutral-700 flex items-center justify-center disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {preset === "custom" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customFrom || !customTo) {
                toast.error("Choose both dates");
                return;
              }
              setLoading(true);
              loadAll("custom", { from: customFrom, to: customTo });
            }}
            className="flex flex-wrap items-end gap-2 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
          >
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                To
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-bold"
            >
              Apply
            </button>
          </form>
        )}

        <div
          className="relative min-h-[min(50vh,24rem)]"
          aria-busy={loading || refreshing}
        >
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200/90 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm">
              <Loader2
                className="w-10 h-10 animate-spin text-primary"
                aria-hidden
              />
              <p className="text-sm font-bold text-gray-800 dark:text-neutral-200">
                {allOrders.length > 0 || staffRiders.length > 0
                  ? "Updating…"
                  : "Loading riders…"}
              </p>
            </div>
          )}
          <>
            {/* Section 2 — Fleet */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
              {[
                {
                  label: "Riders",
                  sub: "With orders in period",
                  val: fleetStats.riderCount,
                  tone: "neutral",
                },
                {
                  label: "Deliveries",
                  sub: "Completed",
                  val: fleetStats.deliveries,
                  tone: "neutral",
                },
                {
                  label: "Revenue",
                  sub: "Delivered orders",
                  val: fmtRs(fleetStats.revenue),
                  tone: "emerald",
                },
                {
                  label: "Del fees",
                  sub: "On delivered",
                  val: fmtRs(fleetStats.delFees),
                  tone: "primary",
                },
                {
                  label: "COD owed",
                  sub: `${fleetStats.codOrders} unpaid`,
                  val: fmtRs(fleetStats.codOwed),
                  tone: "amber",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  className={`rounded-xl border p-3 md:p-4 ${
                    c.tone === "amber"
                      ? "border-amber-300/60 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30"
                      : c.tone === "emerald"
                        ? "border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/25"
                        : c.tone === "primary"
                          ? "border-primary/25 bg-primary/5 dark:bg-primary/10"
                          : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                    {c.label}
                  </p>
                  <p
                    className={`text-lg md:text-xl font-black tabular-nums mt-1 ${
                      c.tone === "amber"
                        ? "text-amber-800 dark:text-amber-200"
                        : c.tone === "emerald"
                          ? "text-emerald-800 dark:text-emerald-200"
                          : c.tone === "primary"
                            ? "text-primary"
                            : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {c.val}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-0.5">
                    {c.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* Section 3 — Riders table */}
            <div>
              <h2 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                Rider roster
              </h2>
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                {mergedRiders.length === 0 ? (
                  <p className="p-8 text-center text-sm text-gray-500 dark:text-neutral-400">
                    No riders or delivery assignments in this period.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-400 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
                          <th className="px-3 py-3 font-bold">Status</th>
                          <th className="px-3 py-3 font-bold text-right w-[1%] whitespace-nowrap">
                            Actions
                          </th>
                          <th className="px-3 py-3 font-bold">Rider</th>
                          <th className="px-3 py-3 font-bold hidden md:table-cell">
                            Phone
                          </th>
                          <th className="px-3 py-3 font-bold text-right">
                            Delivered
                          </th>
                          <th className="px-3 py-3 font-bold text-right">
                            Del fees
                          </th>
                          <th className="px-3 py-3 font-bold text-right hidden sm:table-cell">
                            Order value
                          </th>
                          <th className="px-3 py-3 font-bold text-right">
                            COD owed
                          </th>
                          <th className="px-3 py-3 font-bold text-center hidden lg:table-cell">
                            Pipeline
                          </th>
                          <th className="px-3 py-3 font-bold hidden xl:table-cell">
                            Payout
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {mergedRiders.map((r) => (
                          <tr
                            key={r.key}
                            className={`border-b border-gray-100 dark:border-neutral-800/80 transition-colors ${
                              sidebarRiderKey === r.key
                                ? "bg-primary/[0.07] dark:bg-primary/10"
                                : "hover:bg-gray-50/80 dark:hover:bg-neutral-900/40"
                            }`}
                          >
                            <td className="px-3 py-3 align-middle">
                              {r.status === "active" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                  <Circle className="w-2 h-2 fill-current" />
                                  Active
                                </span>
                              )}
                              {r.status === "idle" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                                  <Circle className="w-2 h-2 fill-current opacity-70" />
                                  Idle
                                </span>
                              )}
                              {r.status === "off" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-gray-400">
                                  <Circle className="w-2 h-2 fill-current" />
                                  Off
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 align-middle text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSidebarRiderKey((k) =>
                                    k === r.key ? null : r.key,
                                  );
                                  setDetailTab("orders");
                                  setCodExpandId(null);
                                }}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-bold text-gray-800 dark:text-neutral-200 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                              >
                                <PanelRight className="w-3.5 h-3.5" />
                                {sidebarRiderKey === r.key ? "Close" : "View"}
                              </button>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <div className="flex items-center gap-2 min-w-0">
                                <Truck className="w-4 h-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-900 dark:text-white truncate">
                                    {r.riderName}
                                  </p>
                                  <p className="text-[11px] text-gray-500 dark:text-neutral-500 md:hidden truncate">
                                    {r.phone || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 align-middle text-gray-600 dark:text-neutral-400 hidden md:table-cell whitespace-nowrap">
                              {r.phone || "—"}
                            </td>
                            <td className="px-3 py-3 align-middle text-right font-bold tabular-nums">
                              {r.delivered}
                            </td>
                            <td className="px-3 py-3 align-middle text-right font-bold tabular-nums text-primary">
                              {fmtRs(r.delFeesEarned)}
                            </td>
                            <td className="px-3 py-3 align-middle text-right font-semibold tabular-nums hidden sm:table-cell">
                              {fmtRs(r.orderValue)}
                            </td>
                            <td className="px-3 py-3 align-middle text-right">
                              {r.codOwed <= 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                  —
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums text-xs">
                                  {fmtRs(r.codOwed)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 align-middle text-center text-xs text-gray-600 dark:text-neutral-400 hidden lg:table-cell tabular-nums whitespace-nowrap">
                              {r.kitchen}/{r.ready}/{r.out}
                            </td>
                            <td className="px-3 py-3 align-middle hidden xl:table-cell max-w-[140px]">
                              {r.lastPayout ? (
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                                  Paid {fmtRs(r.lastPayout.amountPaid)}
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-500 dark:text-neutral-400 truncate block">
                                  Unpaid · {fmtRs(r.delFeesEarned)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Rider detail sidebar */}
            {sidebarRider && (
              <>
                <button
                  type="button"
                  aria-label="Close rider details"
                  className="fixed inset-0 z-[40] -top-6 bg-black/50 backdrop-blur-[1px] cursor-default border-0 p-0 m-0 appearance-none"
                  onClick={() => setSidebarRiderKey(null)}
                />
                <aside className="fixed inset-y-0 -top-6 right-0 z-[45] w-full max-w-2xl flex flex-col border-l border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl">
                  <div className="shrink-0 flex items-start justify-between gap-3 p-4 border-b border-gray-100 dark:border-neutral-800">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                        Rider breakdown
                      </p>
                      <h2 className="text-lg font-black text-gray-900 dark:text-white truncate flex items-center gap-2 mt-0.5">
                        <Truck className="w-5 h-5 text-primary shrink-0" />
                        {sidebarRider.riderName}
                      </h2>
                      {sidebarRider.phone ? (
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                          {sidebarRider.phone}
                        </p>
                      ) : null}
                      <div className="mt-2">
                        {sidebarRider.status === "active" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                            <Circle className="w-2 h-2 fill-current" />
                            Active — out on delivery
                          </span>
                        )}
                        {sidebarRider.status === "idle" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                            <Circle className="w-2 h-2 fill-current opacity-70" />
                            Idle — no live orders
                          </span>
                        )}
                        {sidebarRider.status === "off" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-gray-400">
                            <Circle className="w-2 h-2 fill-current" />
                            Off — no assignments this period
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSidebarRiderKey(null)}
                      className="shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="shrink-0 grid grid-cols-3 gap-2 px-4 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/30">
                    <div className="text-center rounded-lg bg-white dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 py-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">
                        Delivered
                      </p>
                      <p className="text-lg font-black tabular-nums">
                        {sidebarRider.delivered}
                      </p>
                    </div>
                    <div className="text-center rounded-lg bg-white dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 py-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">
                        Del fees
                      </p>
                      <p className="text-lg font-black tabular-nums text-primary">
                        {fmtRs(sidebarRider.delFeesEarned)}
                      </p>
                    </div>
                    <div className="text-center rounded-lg bg-white dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 py-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">
                        Order value
                      </p>
                      <p className="text-lg font-black tabular-nums">
                        {fmtRs(sidebarRider.orderValue)}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 px-4 py-3 space-y-2 text-xs border-b border-gray-100 dark:border-neutral-800">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500 dark:text-neutral-400">
                        Performance (period)
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-neutral-200 text-right">
                        {sidebarRider.perf.n >= 3 &&
                        sidebarRider.perf.avg != null
                          ? `Avg ${Math.round(sidebarRider.perf.avg)}m · ${Math.round(sidebarRider.perf.min)}–${Math.round(sidebarRider.perf.max)}m`
                          : "Avg — (need 3+ trips)"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500 dark:text-neutral-400">
                        Pipeline now
                      </span>
                      <span className="font-semibold tabular-nums">
                        Kitchen {sidebarRider.kitchen} · Ready{" "}
                        {sidebarRider.ready} · Out {sidebarRider.out}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-neutral-400">
                        COD owed
                      </span>
                      <div className="mt-1">
                        {sidebarRider.codOwed <= 0 ? (
                          <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4" /> All clear
                          </p>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setCodExpandId((id) =>
                                  id === sidebarRider.key
                                    ? null
                                    : sidebarRider.key,
                                )
                              }
                              className="text-left w-full"
                            >
                              <p className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {fmtRs(sidebarRider.codOwed)} ·{" "}
                                {sidebarRider.codList.length} unpaid
                              </p>
                            </button>
                            {codExpandId === sidebarRider.key &&
                              sidebarRider.codList.length > 0 && (
                                <ul className="mt-2 space-y-1 text-[11px] border border-amber-200/60 dark:border-amber-500/20 rounded-lg p-2 bg-amber-50/50 dark:bg-amber-950/20 max-h-40 overflow-y-auto">
                                  {sidebarRider.codList.map((o) => {
                                    const { label, mongoId } =
                                      getOrderDisplayFields(o);
                                    return (
                                      <li
                                        key={String(mongoId || label)}
                                        className="flex justify-between gap-2"
                                      >
                                        <Link
                                          href={`/dashboard/orders?editOrder=${encodeURIComponent(mongoId)}`}
                                          className="text-primary font-semibold hover:underline truncate"
                                        >
                                          {label}
                                        </Link>
                                        <span className="tabular-nums shrink-0">
                                          {fmtRs(o.grandTotal ?? o.total)}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-neutral-900/80 p-2.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
                        Payout status
                      </p>
                      {sidebarRider.lastPayout ? (
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          Paid {fmtRs(sidebarRider.lastPayout.amountPaid)} at{" "}
                          {sidebarRider.lastPayout.paidAt
                            ? new Date(
                                sidebarRider.lastPayout.paidAt,
                              ).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "—"}{" "}
                          ✓
                        </p>
                      ) : (
                        <p className="text-xs text-gray-700 dark:text-neutral-300">
                          {fmtRs(sidebarRider.delFeesEarned)} earned — not paid
                          yet
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex gap-1 p-2 mx-3 mt-2 rounded-xl bg-gray-200/60 dark:bg-neutral-800">
                    {[
                      { id: "orders", label: "Orders" },
                      { id: "performance", label: "Performance" },
                      { id: "payouts", label: "Payouts" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDetailTab(t.id)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                          detailTab === t.id
                            ? "bg-white dark:bg-neutral-950 text-primary shadow-sm"
                            : "text-gray-600 dark:text-neutral-400"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 pb-24">
                    {detailTab === "orders" && (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                        <table className="w-full text-xs min-w-[640px]">
                          <thead>
                            <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100 dark:border-neutral-800">
                              <th className="p-2">Order</th>
                              <th className="p-2">Time</th>
                              <th className="p-2">Customer</th>
                              <th className="p-2">Area</th>
                              <th className="p-2 text-right">Amount</th>
                              <th className="p-2 text-right">Del fee</th>
                              <th className="p-2">Status</th>
                              <th className="p-2">Payment</th>
                              <th className="p-2">COD collected</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sidebarRider.orders
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(b.createdAt) - new Date(a.createdAt),
                              )
                              .map((o) => {
                                const { label, mongoId } =
                                  getOrderDisplayFields(o);
                                const unpaidDel =
                                  isDelivered(o.status) && !o.isPaid;
                                return (
                                  <tr
                                    key={String(mongoId || label)}
                                    className={`border-b border-gray-50 dark:border-neutral-800/80 ${
                                      unpaidDel
                                        ? "bg-amber-50/60 dark:bg-amber-950/15"
                                        : ""
                                    }`}
                                  >
                                    <td className="p-2 font-mono">
                                      <Link
                                        href={`/dashboard/orders?editOrder=${encodeURIComponent(mongoId)}`}
                                        className="text-primary font-semibold hover:underline"
                                      >
                                        {label}
                                      </Link>
                                    </td>
                                    <td className="p-2 whitespace-nowrap text-gray-600 dark:text-neutral-400">
                                      {o.createdAt
                                        ? new Date(o.createdAt).toLocaleString(
                                            undefined,
                                            {
                                              month: "short",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                            },
                                          )
                                        : "—"}
                                    </td>
                                    <td className="p-2 max-w-[100px] truncate">
                                      {o.customerName || "—"}
                                    </td>
                                    <td className="p-2 max-w-[120px] truncate text-gray-600 dark:text-neutral-400">
                                      <span className="inline-flex items-start gap-0.5">
                                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                        {o.deliveryAddress || "—"}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right font-semibold tabular-nums">
                                      {fmtRs(o.grandTotal ?? o.total)}
                                    </td>
                                    <td className="p-2 text-right tabular-nums text-primary font-medium">
                                      {fmtRs(o.deliveryCharges)}
                                    </td>
                                    <td className="p-2">{o.status}</td>
                                    <td className="p-2 max-w-[100px] truncate">
                                      {o.paymentMethod || "—"}
                                    </td>
                                    <td className="p-2">
                                      {o.deliveryPaymentCollected ? (
                                        <span className="text-emerald-600 font-semibold">
                                          Yes
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 font-semibold">
                                          Collect
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {detailTab === "performance" && (
                      <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-1 gap-3">
                          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-950">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              Trip times
                            </p>
                            <p className="mt-1 font-semibold">
                              {sidebarRider.perf.n >= 3 &&
                              sidebarRider.perf.avg != null
                                ? `Avg ${Math.round(sidebarRider.perf.avg)} min · Fastest ${Math.round(sidebarRider.perf.min)} · Longest ${Math.round(sidebarRider.perf.max)}`
                                : "— (need 3+ delivered trips with timestamps)"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-950">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              Throughput
                            </p>
                            <p className="mt-1 font-semibold">
                              {(() => {
                                const h = hoursSpan(
                                  activeDateRange.from,
                                  activeDateRange.to,
                                );
                                const oph = sidebarRider.delivered / h;
                                return `${oph.toFixed(1)} deliveries / hour (${sidebarRider.delivered} in period)`;
                              })()}
                            </p>
                          </div>
                          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-950">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              Cancellation rate
                            </p>
                            <p className="mt-1 font-semibold">
                              {sidebarRider.assigned > 0
                                ? `${((sidebarRider.cancelled / sidebarRider.assigned) * 100).toFixed(1)}% (${sidebarRider.cancelled}/${sidebarRider.assigned})`
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-950">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                              vs fleet
                            </p>
                            <p className="mt-1 font-semibold text-gray-600 dark:text-neutral-400">
                              Fleet avg trip:{" "}
                              {fleetAvgTrip != null
                                ? `${Math.round(fleetAvgTrip)} min`
                                : "—"}
                              {sidebarRider.perf.n >= 3 &&
                              sidebarRider.perf.avg != null &&
                              fleetAvgTrip != null
                                ? ` · This rider: ${Math.round(sidebarRider.perf.avg)} min`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                            Deliveries by hour (completed)
                          </p>
                          <div className="flex items-end gap-0.5 h-24">
                            {(() => {
                              const H = hoursDelivered;
                              const mx = Math.max(1, ...H);
                              return H.map((v, i) => (
                                <div
                                  key={i}
                                  className="flex-1 flex flex-col items-center justify-end group"
                                >
                                  <div
                                    className="w-full max-w-[10px] mx-auto rounded-t bg-primary/80 group-hover:bg-primary"
                                    style={{
                                      height: `${(v / mx) * 100}%`,
                                      minHeight: v ? 4 : 0,
                                    }}
                                    title={`${i}:00 — ${v}`}
                                  />
                                  <span className="text-[8px] text-gray-400 mt-0.5">
                                    {i % 4 === 0 ? i : ""}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === "payouts" && (
                      <div className="space-y-4 text-sm">
                        <div className="rounded-xl border border-dashed border-gray-300 dark:border-neutral-600 p-3 bg-white dark:bg-neutral-950">
                          <p className="text-xs font-bold text-gray-700 dark:text-neutral-200">
                            Pay settings
                          </p>
                          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 leading-relaxed">
                            Daily / monthly schedules, fixed salary, and
                            per-stop rates are{" "}
                            <strong>not stored on the rider profile yet</strong>
                            . Use payout records + your HR process. Inline
                            editing will attach here when the API supports it.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-gray-600 dark:text-neutral-400">
                            Running total (payouts in range):{" "}
                            <strong className="text-gray-900 dark:text-white">
                              {fmtRs(sidebarRider.paidThisMonth)}
                            </strong>{" "}
                            paid ·{" "}
                            <strong>{fmtRs(sidebarRider.delFeesEarned)}</strong>{" "}
                            delivery fees earned
                          </p>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                          <table className="w-full text-xs min-w-[520px]">
                            <thead>
                              <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100 dark:border-neutral-800">
                                <th className="p-2">Date</th>
                                <th className="p-2">Period</th>
                                <th className="p-2 text-right">Deliveries</th>
                                <th className="p-2 text-right">Amount</th>
                                <th className="p-2">Voucher</th>
                                <th className="p-2">Paid by</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payouts
                                .filter((p) =>
                                  sidebarRider.riderId
                                    ? String(p.rider) === sidebarRider.riderId
                                    : String(p.riderName || "").trim() ===
                                      sidebarRider.riderName.trim(),
                                )
                                .sort(
                                  (a, b) =>
                                    new Date(b.paidAt) - new Date(a.paidAt),
                                )
                                .map((p) => (
                                  <tr
                                    key={p.id || p._id}
                                    className="border-b border-gray-50 dark:border-neutral-800"
                                  >
                                    <td className="p-2 whitespace-nowrap">
                                      {p.paidAt
                                        ? new Date(
                                            p.paidAt,
                                          ).toLocaleDateString()
                                        : "—"}
                                    </td>
                                    <td className="p-2">
                                      {p.period?.label || "—"}
                                    </td>
                                    <td className="p-2 text-right tabular-nums">
                                      {p.deliveryCount ?? "—"}
                                    </td>
                                    <td className="p-2 text-right font-bold tabular-nums">
                                      {fmtRs(p.amountPaid)}
                                    </td>
                                    <td className="p-2">
                                      {p.voucherNumber ? (
                                        <Link
                                          href="/accounting/vouchers"
                                          className="text-primary font-semibold hover:underline"
                                        >
                                          {p.voucherNumber}
                                        </Link>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td className="p-2">
                                      {p.paidByName || "—"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-gray-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-950 space-y-2">
                    {sidebarRider.riderId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setModalRiderId(sidebarRider.riderId);
                          openPayoutModal(sidebarRider.riderId);
                        }}
                        className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/20"
                      >
                        Record payout
                      </button>
                    ) : (
                      <p className="text-center text-[11px] text-gray-500 dark:text-neutral-400 px-2">
                        Link this rider to a staff account to record payouts
                        (rider ID required).
                      </p>
                    )}
                  </div>
                </aside>
              </>
            )}

            {/* Section 6 — Pipeline */}
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 md:p-5">
              <h2 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
                Live pipeline (all riders)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    key: "kitchen",
                    label: "In kitchen",
                    n: pipelineCounts.kitchen,
                  },
                  {
                    key: "ready",
                    label: "Ready to pick",
                    n: pipelineCounts.ready,
                  },
                  {
                    key: "out",
                    label: "Out for delivery",
                    n: pipelineCounts.out,
                  },
                  {
                    key: "active",
                    label: "Total active",
                    n: pipelineCounts.total,
                  },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      setPipelineFilter((f) =>
                        f === c.key
                          ? null
                          : c.key === "active"
                            ? "active"
                            : c.key,
                      )
                    }
                    className={`rounded-xl border p-4 text-center transition-colors ${
                      (c.key === "active" && pipelineFilter === "active") ||
                      (c.key !== "active" && pipelineFilter === c.key)
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-gray-200 dark:border-neutral-800 hover:border-primary/40"
                    }`}
                  >
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      {c.label}
                    </p>
                    <p className="text-2xl font-black text-primary mt-1 tabular-nums">
                      {c.n}
                    </p>
                  </button>
                ))}
              </div>
              {pipelineFilter != null && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
                        <th className="p-2">Order</th>
                        <th className="p-2">Rider</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(pipelineFilter === "active"
                        ? livePipelineOrders
                        : filteredPipelineTable
                      ).map((o) => {
                        const { label, mongoId } = getOrderDisplayFields(o);
                        return (
                          <tr
                            key={String(mongoId || label)}
                            className="border-b border-gray-50 dark:border-neutral-800"
                          >
                            <td className="p-2">
                              <Link
                                href={`/dashboard/orders?editOrder=${encodeURIComponent(mongoId)}`}
                                className="text-primary font-semibold hover:underline font-mono"
                              >
                                {label}
                              </Link>
                            </td>
                            <td className="p-2">
                              {o.assignedRiderName || "—"}
                            </td>
                            <td className="p-2">{o.status}</td>
                            <td className="p-2 text-right tabular-nums">
                              {fmtRs(o.grandTotal ?? o.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={() => setPipelineFilter(null)}
                    className="w-full py-2 text-xs font-bold text-gray-500 hover:text-primary"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>
          </>
        </div>

        {/* Payout modal */}
        {payoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              {modalSaving && (
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/90 dark:bg-neutral-950/92 backdrop-blur-sm"
                  aria-live="polite"
                >
                  <Loader2 className="w-10 h-10 animate-spin text-primary" aria-hidden />
                  <p className="text-sm font-bold text-gray-800 dark:text-neutral-200">
                    Processing…
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-black">Record rider payout</h3>
                <button
                  type="button"
                  disabled={modalSaving}
                  onClick={() => setPayoutModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Rider
                </label>
                <select
                  value={modalRiderId}
                  onChange={(e) => setModalRiderId(e.target.value)}
                  disabled={modalSaving}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm disabled:opacity-50"
                >
                  {mergedRiders
                    .filter((x) => x.riderId)
                    .map((x) => (
                      <option key={x.riderId} value={x.riderId}>
                        {x.riderName}
                      </option>
                    ))}
                </select>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                Period: <strong>{periodLabel}</strong>
                {fromIso && (
                  <span className="text-xs text-gray-400">
                    ({new Date(fromIso).toLocaleDateString()} –{" "}
                    {new Date(toIso).toLocaleDateString()})
                  </span>
                )}
              </p>
              {(() => {
                const mr = mergedRiders.find((x) => x.riderId === modalRiderId);
                if (!mr) return null;
                return (
                  <div className="rounded-xl bg-gray-50 dark:bg-neutral-900/80 p-3 text-sm space-y-1">
                    <p>
                      Deliveries (completed): <strong>{mr.delivered}</strong>
                    </p>
                    <p>
                      Delivery fees earned:{" "}
                      <strong>{fmtRs(mr.delFeesEarned)}</strong>
                    </p>
                  </div>
                );
              })()}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Amount to pay
                </label>
                <input
                  type="number"
                  min={0}
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  disabled={modalSaving}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-bold tabular-nums disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Pay method
                </label>
                <select
                  value={modalPayMethod}
                  onChange={(e) => setModalPayMethod(e.target.value)}
                  disabled={modalSaving}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm disabled:opacity-50"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  placeholder="Rider daily payout…"
                  disabled={modalSaving}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm disabled:opacity-50"
                />
              </div>
              <label className={`flex items-start gap-2 text-sm ${modalSaving ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={modalPostCpv}
                  onChange={(e) => setModalPostCpv(e.target.checked)}
                  disabled={modalSaving}
                  className="mt-1 rounded border-gray-300"
                />
                <span>
                  Also post to accounting (opens pre-filled Cash Payment voucher
                  after saving)
                </span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={modalSaving}
                  onClick={() => setPayoutModalOpen(false)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-neutral-700 font-bold text-sm disabled:opacity-40 disabled:pointer-events-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={modalSaving}
                  onClick={submitPayoutModal}
                  className="flex-1 h-11 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-90 inline-flex items-center justify-center gap-2"
                >
                  {modalSaving && (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                  )}
                  {modalSaving ? "Saving…" : "Record payout"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
