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
  updateUser,
  checkRiderModuleAccess,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import { getDefaultReportPreset } from "../../lib/reportPresetDefault";
import { getBusinessDate, getBusinessDayRange, formatBusinessDate } from "../../lib/businessDay";
import RidersLockedPresentation from "../../components/riders/RidersLockedPresentation";
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
  FileDown,
  Printer,
  FileText,
  ToggleLeft,
  ToggleRight,
  Search,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "custom", label: "Custom" },
];

const ROSTER_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "On delivery" },
  { id: "idle", label: "Idle" },
  { id: "blocked", label: "Take orders off" },
  { id: "cod", label: "COD owed" },
];

const ROSTER_SORTS = [
  { id: "status", label: "Live status" },
  { id: "delivered", label: "Most delivered" },
  { id: "fees", label: "Highest fees" },
  { id: "cod", label: "COD owed" },
  { id: "name", label: "Name A–Z" },
];

const DEFAULT_RIDER_EXPENSE_ACCOUNT_CODE = "602";

function shiftBusinessDateStr(dateStr, deltaDays) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

function filterPayoutsForRider(payoutList, riderId, riderName) {
  return payoutList.filter((p) =>
    riderId
      ? String(p.rider) === riderId
      : String(p.riderName || "").trim() === String(riderName || "").trim(),
  );
}

function getLatestPayout(payoutList) {
  if (!payoutList.length) return null;
  return [...payoutList].sort(
    (a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0),
  )[0];
}

function getTodayPayoutForRider(payoutList, businessDateStr, cutoffHour) {
  const { from, to } = getBusinessDayRange(businessDateStr, cutoffHour);
  return (
    [...payoutList]
      .filter((p) => {
        if (!p?.paidAt) return false;
        const t = new Date(p.paidAt);
        return t >= from && t < to;
      })
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0] || null
  );
}

/** Same inclusive/exclusive window as dateFilteredOrders (createdAt). */
function isTimestampInActiveRange(ts, from, to) {
  if (!ts) return false;
  const t = new Date(ts);
  if (from && t < from) return false;
  if (to && t > to) return false;
  return true;
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
  const [moduleLocked, setModuleLocked] = useState(null); // null = checking
  const [preset, setPreset] = useState(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sessions, setSessions] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [staffRiders, setStaffRiders] = useState([]);
  const [togglingTakeOrdersId, setTogglingTakeOrdersId] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [recentPayouts, setRecentPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sidebarRiderKey, setSidebarRiderKey] = useState(null);
  const [detailTab, setDetailTab] = useState("orders");
  const [pipelineFilter, setPipelineFilter] = useState(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState("all");
  const [rosterSort, setRosterSort] = useState("status");
  const [codExpandId, setCodExpandId] = useState(null);
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [modalRiderId, setModalRiderId] = useState("");
  const [modalAmount, setModalAmount] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalPayMethod, setModalPayMethod] = useState("Cash");
  const [modalPostCpv, setModalPostCpv] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const autoRef = useRef(null);
  const cutoffHour = currentBranch?.businessDayCutoffHour ?? 4;
  const businessDateStr = getBusinessDate(new Date(), cutoffHour);

  const resolveRidersDateRange = useCallback(
    (presetId) => {
      if (presetId === "today") {
        return getBusinessDayRange(businessDateStr, cutoffHour);
      }
      if (presetId === "yesterday") {
        return getBusinessDayRange(
          shiftBusinessDateStr(businessDateStr, -1),
          cutoffHour,
        );
      }
      if (presetId === "this_week") {
        const fromStr = shiftBusinessDateStr(businessDateStr, -6);
        return {
          from: getBusinessDayRange(fromStr, cutoffHour).from,
          to: getBusinessDayRange(businessDateStr, cutoffHour).to,
        };
      }
      if (presetId === "this_month") {
        const fromStr = shiftBusinessDateStr(businessDateStr, -29);
        return {
          from: getBusinessDayRange(fromStr, cutoffHour).from,
          to: getBusinessDayRange(businessDateStr, cutoffHour).to,
        };
      }
      return getBusinessDayRange(businessDateStr, cutoffHour);
    },
    [businessDateStr, cutoffHour],
  );

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

  const loadRecentPayouts = useCallback(async () => {
    try {
      const fromStr = shiftBusinessDateStr(businessDateStr, -90);
      const { from } = getBusinessDayRange(fromStr, cutoffHour);
      const { to } = getBusinessDayRange(businessDateStr, cutoffHour);
      const data = await getRiderPayouts({
        from: from.toISOString(),
        to: to.toISOString(),
        status: "paid",
      });
      setRecentPayouts(Array.isArray(data?.payouts) ? data.payouts : []);
    } catch {
      setRecentPayouts([]);
    }
  }, [businessDateStr, cutoffHour]);

  const loadStaffRiders = useCallback(async () => {
    try {
      const list = await getRiders();
      setStaffRiders(Array.isArray(list) ? list : []);
    } catch {
      setStaffRiders([]);
    }
  }, []);

  async function handleToggleCanTakeOrders(rider) {
    const riderId = rider?.riderId;
    if (!riderId) {
      toast.error("This rider has no staff account to update.");
      return;
    }
    const next = !(rider.canTakeOrders !== false);
    setTogglingTakeOrdersId(riderId);
    try {
      await updateUser(riderId, { canTakeOrders: next });
      setStaffRiders((prev) =>
        prev.map((u) =>
          String(u.id || u._id) === String(riderId)
            ? { ...u, canTakeOrders: next }
            : u,
        ),
      );
      toast.success(
        next
          ? `${rider.riderName} can take new orders`
          : `${rider.riderName} cannot take new orders`,
      );
    } catch (err) {
      toast.error(err?.message || "Failed to update rider");
    } finally {
      setTogglingTakeOrdersId(null);
    }
  }

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
          const range = resolveRidersDateRange(presetId);
          q = {
            from: new Date(range.from).toISOString(),
            to: new Date(range.to).toISOString(),
          };
        }
        await Promise.all([
          loadOrders(q),
          loadStaffRiders(),
          q?.from && q?.to ? loadPayouts(q.from, q.to) : Promise.resolve(),
          loadRecentPayouts(),
        ]);
        if (!q?.from || !q?.to) setPayouts([]);
        setLastUpdated(new Date());
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [
      currentBranch?.id,
      cutoffHour,
      loadOrders,
      loadPayouts,
      loadRecentPayouts,
      loadStaffRiders,
      resolveRidersDateRange,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        await checkRiderModuleAccess();
        if (!cancelled) setModuleLocked(false);
      } catch (e) {
        if (cancelled) return;
        const locked =
          e?.details?.code === "MODULE_NOT_ACTIVE" ||
          e?.details?.module === "rider" ||
          e?.code === 403;
        setModuleLocked(locked);
        if (locked) setLoading(false);
      }
    }
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (moduleLocked !== false) return undefined;
    let cancelled = false;
    (async () => {
      let loadedSessions = [];
      try {
        const res = await getDaySessions(currentBranch?.id, { limit: 30 });
        loadedSessions = Array.isArray(res?.sessions) ? res.sessions : [];
      } catch {
        loadedSessions = [];
      }
      if (cancelled) return;
      setSessions(loadedSessions);
      setPreset(getDefaultReportPreset(loadedSessions));
    })();
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id, moduleLocked]);

  useEffect(() => {
    if (moduleLocked !== false) return;
    if (preset == null) return;
    if (preset === "custom") {
      setAllOrders([]);
      setPayouts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAll(preset, null);
  }, [currentBranch?.id, preset, loadAll, moduleLocked]);

  useEffect(() => {
    if (moduleLocked !== false) return undefined;
    autoRef.current = setInterval(() => {
      if (preset === "custom" || preset == null) return;
      loadAll(preset, null);
    }, 60000);
    return () => clearInterval(autoRef.current);
  }, [preset, loadAll, moduleLocked]);

  const activeDateRange = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to: customTo ? new Date(customTo + "T23:59:59.999") : null,
      };
    }
    if (!preset) return { from: null, to: null };
    const d = resolveRidersDateRange(preset);
    return {
      from: d?.from ? new Date(d.from) : null,
      to: d?.to ? new Date(d.to) : null,
    };
  }, [
    cutoffHour,
    customFrom,
    customTo,
    preset,
    resolveRidersDateRange,
  ]);

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
    const { from: rangeFrom, to: rangeTo } = activeDateRange;
    const byKey = new Map();
    const addBucket = (key, riderId, riderName, phone, canTakeOrders = true) => {
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          riderId,
          riderName: riderName || "Unknown",
          phone: phone || "",
          canTakeOrders: canTakeOrders !== false,
          orders: [],
        });
      } else if (riderId) {
        const existing = byKey.get(key);
        if (existing.canTakeOrders === undefined) {
          existing.canTakeOrders = canTakeOrders !== false;
        }
      }
      return byKey.get(key);
    };
    for (const u of staffRiders) {
      const id = String(u.id || u._id || "");
      addBucket(
        id || `staff:${u.name}`,
        id || null,
        u.name,
        u.phone,
        u.canTakeOrders !== false,
      );
    }
    for (const o of deliveryOrders) {
      const id = o.assignedRiderId ? String(o.assignedRiderId) : "";
      const name = String(o.assignedRiderName || "").trim() || "Unknown";
      const phone = String(o.assignedRiderPhone || "").trim();
      const key = id || `name:${name.toLowerCase()}`;
      const b = addBucket(key, id || null, name, phone, true);
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
        .filter((o) => isDelivered(o.status))
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
      const riderPayouts = filterPayoutsForRider(
        payouts,
        b.riderId,
        b.riderName,
      );
      const payoutsInPeriod = riderPayouts.filter((p) =>
        isTimestampInActiveRange(p.paidAt, rangeFrom, rangeTo),
      );
      const periodPayout = getLatestPayout(payoutsInPeriod);
      const riderRecentPayouts = filterPayoutsForRider(
        recentPayouts,
        b.riderId,
        b.riderName,
      );
      const lastPayoutOverall = getLatestPayout(riderRecentPayouts);
      const todayPayout = getTodayPayoutForRider(
        riderRecentPayouts,
        businessDateStr,
        cutoffHour,
      );
      const paidThisMonth = payoutsInPeriod.reduce(
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
        periodPayout,
        lastPayoutOverall,
        todayPayout,
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
  }, [
    deliveryOrders,
    staffRiders,
    payouts,
    recentPayouts,
    activeDateRange,
    businessDateStr,
    cutoffHour,
  ]);

  const rosterFilterCounts = useMemo(() => {
    const counts = { all: mergedRiders.length, active: 0, idle: 0, blocked: 0, cod: 0 };
    for (const r of mergedRiders) {
      if (r.status === "active") counts.active += 1;
      if (r.status === "idle") counts.idle += 1;
      if (r.riderId && r.canTakeOrders === false) counts.blocked += 1;
      if (r.codOwed > 0) counts.cod += 1;
    }
    return counts;
  }, [mergedRiders]);

  const filteredRiders = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    let list = mergedRiders.filter((r) => {
      if (rosterFilter === "active" && r.status !== "active") return false;
      if (rosterFilter === "idle" && r.status !== "idle") return false;
      if (rosterFilter === "blocked" && !(r.riderId && r.canTakeOrders === false))
        return false;
      if (rosterFilter === "cod" && !(r.codOwed > 0)) return false;
      if (!q) return true;
      const hay = `${r.riderName || ""} ${r.phone || ""}`.toLowerCase();
      return hay.includes(q);
    });
    list = [...list];
    list.sort((a, b) => {
      if (rosterSort === "delivered") return b.delivered - a.delivered;
      if (rosterSort === "fees") return b.delFeesEarned - a.delFeesEarned;
      if (rosterSort === "cod") return b.codOwed - a.codOwed;
      if (rosterSort === "name")
        return String(a.riderName || "").localeCompare(String(b.riderName || ""));
      const rank = { active: 0, idle: 1, off: 2 };
      if (rank[a.status] !== rank[b.status])
        return rank[a.status] - rank[b.status];
      return b.delivered - a.delivered;
    });
    return list;
  }, [mergedRiders, rosterSearch, rosterFilter, rosterSort]);

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
      await loadRecentPayouts();
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
          "Live status",
          "Take orders",
          "Assigned",
          "Delivered",
          "Cancelled",
          "Del fees (delivered)",
          "Delivered value",
          "COD owed",
          "Avg trip min",
        ],
        ...mergedRiders.map((r) => [
          r.riderName,
          r.riderId || "",
          r.status,
          r.canTakeOrders === false ? "Off" : "On",
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

  function exportRiderCsv(rider) {
    const rows = [
      ["Rider", "Period", rider.riderName, periodLabel],
      [],
      ["Order", "Time", "Customer", "Area", "Amount", "Del Fee", "Status", "Payment", "COD Collected"],
      ...rider.orders
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((o) => {
          const { label } = getOrderDisplayFields(o);
          return [
            label,
            o.createdAt ? new Date(o.createdAt).toLocaleString() : "",
            o.customerName || "",
            o.deliveryAddress || "",
            Math.round(Number(o.grandTotal ?? o.total) || 0),
            Math.round(Number(o.deliveryCharges) || 0),
            o.status || "",
            o.paymentMethod || "",
            o.deliveryPaymentCollected ? "Yes" : "Collect",
          ];
        }),
      [],
      ["Summary"],
      ["Delivered", rider.delivered],
      ["Delivery fees earned", rider.delFeesEarned],
      ["Delivered value", rider.orderValue],
      ["COD owed", rider.codOwed],
    ];
    const safeName = rider.riderName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    downloadCSV(`rider-${safeName}-${preset}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("CSV exported");
  }

  function openRiderPrintWindow(rider, mode) {
    const sym = getCurrencySymbol();
    const rs = (v) => `${sym === "Rs" ? "Rs." : sym} ${Math.round(Number(v) || 0).toLocaleString()}`;
    const sortedOrders = rider.orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const rows = sortedOrders.map((o) => {
      const { label, mongoId } = getOrderDisplayFields(o);
      const unpaid = isDelivered(o.status) && !o.isPaid;
      return `<tr style="background:${unpaid ? "#fffbeb" : ""}">
        <td>${label}</td>
        <td>${o.createdAt ? new Date(o.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
        <td>${o.customerName || "—"}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis">${o.deliveryAddress || "—"}</td>
        <td style="text-align:right">${rs(o.grandTotal ?? o.total)}</td>
        <td style="text-align:right;color:#FF5400">${rs(o.deliveryCharges)}</td>
        <td>${o.status || "—"}</td>
        <td>${o.paymentMethod || "—"}</td>
        <td style="color:${o.deliveryPaymentCollected ? "#059669" : "#d97706"}">${o.deliveryPaymentCollected ? "Collected" : "Collect"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><title>Rider Report — ${rider.riderName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
  h1 { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
  .meta { font-size: 11px; color: #555; margin-bottom: 16px; }
  .stats { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 16px; min-width: 100px; }
  .stat-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
  .stat-val { font-size: 16px; font-weight: 800; margin-top: 2px; }
  .stat-val.primary { color: #FF5400; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 6px 8px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; font-weight: 700; }
  td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; border-top: 1px dashed #e5e7eb; padding-top: 10px; }
  @media print { @page { size: A4 landscape; margin: 12mm; } body { padding: 0; } }
</style></head><body>
<h1>🚚 ${rider.riderName}</h1>
<div class="meta">${rider.phone ? rider.phone + " · " : ""}Period: ${periodLabel} · Printed ${new Date().toLocaleString()}</div>
<div class="stats">
  <div class="stat"><div class="stat-label">Delivered</div><div class="stat-val">${rider.delivered}</div></div>
  <div class="stat"><div class="stat-label">Del Fees</div><div class="stat-val primary">${rs(rider.delFeesEarned)}</div></div>
  <div class="stat"><div class="stat-label">Order Value</div><div class="stat-val">${rs(rider.orderValue)}</div></div>
  <div class="stat"><div class="stat-label">COD Owed</div><div class="stat-val" style="color:${rider.codOwed > 0 ? "#d97706" : "#059669"}">${rider.codOwed > 0 ? rs(rider.codOwed) : "All clear"}</div></div>
  <div class="stat"><div class="stat-label">Payout Status</div><div class="stat-val" style="font-size:12px">${rider.periodPayout ? "Paid " + rs(rider.periodPayout.amountPaid) : rider.codOwed > 0 ? rs(rider.codOwed) + " to collect" : "—"}</div></div>
</div>
<table>
  <thead><tr>
    <th>Order</th><th>Time</th><th>Customer</th><th>Area</th>
    <th style="text-align:right">Amount</th><th style="text-align:right">Del Fee</th>
    <th>Status</th><th>Payment</th><th>COD</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">EatsDesk Rider Report · ${rider.riderName} · ${periodLabel}</div>
</body></html>`;

    const win = window.open("", "_blank", "width=1100,height=750");
    if (!win) { toast.error("Pop-up blocked. Allow pop-ups and try again."); return; }
    win.document.write(html);
    win.document.close();
    if (mode === "print") {
      win.onload = () => { win.focus(); win.print(); };
    } else {
      win.onload = () => { win.focus(); win.print(); };
      toast("Print dialog opened — choose 'Save as PDF' to export.", { icon: "📄" });
    }
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

  if (moduleLocked === true) {
    return (
      <AdminLayout title="Riders Portal" subtitle="">
        <div className="-mx-4 -mt-4 mb-[-6rem] min-h-[calc(100vh-3.5rem)] md:-mx-6 md:mb-[-1.5rem] md:min-h-[calc(100vh-4rem)]">
          <RidersLockedPresentation />
        </div>
      </AdminLayout>
    );
  }

  if (moduleLocked === null) {
    return (
      <AdminLayout title="Riders Portal" subtitle="">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-orange-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500">Checking Riders Portal access…</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Riders Portal">
      <div
        className={`space-y-5 pb-16 text-gray-900 dark:text-white ${
          sidebarRiderKey
            ? "lg:mr-[min(28rem,calc(100vw-2rem))] transition-[margin] duration-200 ease-out"
            : ""
        }`}
      >
        {/* Toolbar */}
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 md:p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Fleet overview
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  {periodLabel || "Select a period"}
                  {secAgo !== "—" ? ` · Updated ${secAgo}s ago` : ""}
                </span>
                {refreshing && !loading && (
                  <span className="inline-flex items-center gap-1 text-primary font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden />
                    Updating…
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openPayoutModal("")}
                className="h-9 px-3.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm shadow-primary/25 hover:opacity-95 inline-flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5" />
                Record payout
              </button>
              <button
                type="button"
                onClick={exportFleetCsv}
                className="h-9 px-3.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
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
                className="h-9 w-9 rounded-xl border border-gray-200 dark:border-neutral-700 flex items-center justify-center disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSidebarRiderKey(null);
                  setPreset(p.id);
                }}
                className={`h-8 px-3 rounded-full text-xs font-bold transition-colors ${
                  preset === p.id
                    ? "bg-primary text-white shadow-sm shadow-primary/25"
                    : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 hover:bg-gray-200/80 dark:hover:bg-neutral-800"
                }`}
              >
                {p.label}
              </button>
            ))}
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
              className="flex flex-wrap items-end gap-2 pt-1 border-t border-gray-100 dark:border-neutral-800"
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
        </div>

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
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-5">
              {[
                {
                  label: "Riders",
                  sub: "In roster",
                  val: fleetStats.riderCount,
                  tone: "neutral",
                  filter: "all",
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
                  filter: "cod",
                },
              ].map((c) => {
                const clickable = !!c.filter;
                const Comp = clickable ? "button" : "div";
                return (
                  <Comp
                    key={c.label}
                    type={clickable ? "button" : undefined}
                    onClick={
                      clickable
                        ? () => {
                            setRosterFilter(c.filter);
                            setSidebarRiderKey(null);
                          }
                        : undefined
                    }
                    className={`rounded-xl border p-3 md:p-4 text-left transition-colors ${
                      c.tone === "amber"
                        ? "border-amber-300/60 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30"
                        : c.tone === "emerald"
                          ? "border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/25"
                          : c.tone === "primary"
                            ? "border-primary/25 bg-primary/5 dark:bg-primary/10"
                            : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                    } ${clickable ? "hover:ring-1 hover:ring-primary/30 cursor-pointer" : ""} ${
                      clickable && rosterFilter === c.filter
                        ? "ring-1 ring-primary/40"
                        : ""
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
                  </Comp>
                );
              })}
            </div>

            {/* Roster */}
            <div className="mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  Rider roster
                  <span className="ml-2 text-[11px] font-semibold normal-case tracking-normal text-gray-400">
                    {filteredRiders.length}
                    {filteredRiders.length !== mergedRiders.length
                      ? ` of ${mergedRiders.length}`
                      : ""}
                  </span>
                </h2>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                <div className="p-3 border-b border-gray-100 dark:border-neutral-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="search"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Search rider name or phone…"
                        className="w-full h-9 pl-9 pr-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm font-medium placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                      />
                      {rosterSearch ? (
                        <button
                          type="button"
                          onClick={() => setRosterSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200/80 dark:hover:bg-neutral-800"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="relative shrink-0">
                      <select
                        value={rosterSort}
                        onChange={(e) => setRosterSort(e.target.value)}
                        className={selectCls}
                        aria-label="Sort roster"
                      >
                        {ROSTER_SORTS.map((s) => (
                          <option key={s.id} value={s.id}>
                            Sort: {s.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {ROSTER_FILTERS.map((f) => {
                      const count = rosterFilterCounts[f.id] ?? 0;
                      const active = rosterFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setRosterFilter(f.id)}
                          className={`flex-shrink-0 h-8 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                            active
                              ? "bg-primary text-white shadow-sm shadow-primary/20"
                              : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 hover:bg-gray-200/80 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {f.label}
                          <span
                            className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${
                              active
                                ? "bg-white/20"
                                : "bg-white dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mergedRiders.length === 0 ? (
                  <p className="p-8 text-center text-sm text-gray-500 dark:text-neutral-400">
                    No riders or delivery assignments in this period.
                  </p>
                ) : filteredRiders.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-bold text-gray-600 dark:text-neutral-300">
                      No riders match these filters
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRosterSearch("");
                        setRosterFilter("all");
                      }}
                      className="mt-2 text-xs font-bold text-primary hover:underline"
                    >
                      Clear search & filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[920px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-neutral-400 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
                          <th className="px-3 py-3 font-bold">Rider</th>
                          <th className="px-3 py-3 font-bold hidden md:table-cell">
                            Phone
                          </th>
                          <th className="px-3 py-3 font-bold">Live</th>
                          <th
                            className="px-3 py-3 font-bold"
                            title="Allow this rider to place new orders in the rider app"
                          >
                            Take orders
                          </th>
                          <th className="px-3 py-3 font-bold text-right">
                            Delivered
                          </th>
                          <th className="px-3 py-3 font-bold text-right">
                            Del fees
                          </th>
                          <th className="px-3 py-3 font-bold text-right hidden sm:table-cell">
                            Value
                          </th>
                          <th className="px-3 py-3 font-bold text-right">
                            COD owed
                          </th>
                          <th
                            className="px-3 py-3 font-bold text-center hidden lg:table-cell"
                            title="Kitchen · Ready · Out for delivery"
                          >
                            Pipeline
                          </th>
                          <th className="px-3 py-3 font-bold hidden xl:table-cell">
                            Payout
                          </th>
                          <th className="px-3 py-3 font-bold text-right w-[1%] whitespace-nowrap">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRiders.map((r) => (
                          <tr
                            key={r.key}
                            className={`border-b border-gray-100 dark:border-neutral-800/80 transition-colors ${
                              sidebarRiderKey === r.key
                                ? "bg-primary/[0.07] dark:bg-primary/10"
                                : "hover:bg-gray-50/80 dark:hover:bg-neutral-900/40"
                            }`}
                          >
                            <td className="px-3 py-3 align-middle">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                  <Truck className="w-4 h-4 text-primary" />
                                </div>
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
                            <td className="px-3 py-3 align-middle">
                              {r.status === "active" && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                                  <Circle className="w-2 h-2 fill-current" />
                                  On delivery
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
                            <td className="px-3 py-3 align-middle">
                              {r.riderId ? (
                                <button
                                  type="button"
                                  disabled={togglingTakeOrdersId === r.riderId}
                                  onClick={() => handleToggleCanTakeOrders(r)}
                                  className="inline-flex items-center gap-1.5 disabled:opacity-50"
                                  title={
                                    r.canTakeOrders !== false
                                      ? "New orders enabled — click to disable"
                                      : "New orders disabled — click to enable"
                                  }
                                  aria-label={`Toggle take orders for ${r.riderName}`}
                                >
                                  {togglingTakeOrdersId === r.riderId ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                  ) : r.canTakeOrders !== false ? (
                                    <ToggleRight className="w-7 h-7 text-emerald-500" />
                                  ) : (
                                    <ToggleLeft className="w-7 h-7 text-gray-400" />
                                  )}
                                  <span
                                    className={`text-[10px] font-black uppercase ${
                                      r.canTakeOrders !== false
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {r.canTakeOrders !== false ? "On" : "Off"}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-400">
                                  —
                                </span>
                              )}
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
                            <td className="px-3 py-3 align-middle text-center hidden lg:table-cell">
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums text-gray-600 dark:text-neutral-400"
                                title="Kitchen · Ready · Out"
                              >
                                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300">
                                  {r.kitchen}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                  {r.ready}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300">
                                  {r.out}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 py-3 align-middle hidden xl:table-cell max-w-[140px]">
                              {r.periodPayout ? (
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                                  Paid {fmtRs(r.periodPayout.amountPaid)}
                                </span>
                              ) : r.codOwed > 0 ? (
                                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate block">
                                  {fmtRs(r.codOwed)} to collect
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400 dark:text-neutral-500">
                                  —
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
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {sidebarRider.riderId ? (
                          <button
                            type="button"
                            disabled={togglingTakeOrdersId === sidebarRider.riderId}
                            onClick={() => handleToggleCanTakeOrders(sidebarRider)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 px-2 py-1 disabled:opacity-50"
                          >
                            {togglingTakeOrdersId === sidebarRider.riderId ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            ) : sidebarRider.canTakeOrders !== false ? (
                              <ToggleRight className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-gray-400" />
                            )}
                            <span className="text-[10px] font-black uppercase text-gray-600 dark:text-neutral-300">
                              Take orders{" "}
                              {sidebarRider.canTakeOrders !== false ? "On" : "Off"}
                            </span>
                          </button>
                        ) : null}
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
                        Delivered value
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
                                          href={`/pos?editOrder=${encodeURIComponent(mongoId)}`}
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
                      {sidebarRider.todayPayout ? (
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          Paid {fmtRs(sidebarRider.todayPayout.amountPaid)} at{" "}
                          {sidebarRider.todayPayout.paidAt
                            ? new Date(
                                sidebarRider.todayPayout.paidAt,
                              ).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "—"}{" "}
                          today ✓
                        </p>
                      ) : (
                        <p className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                          Not paid today
                        </p>
                      )}
                      {sidebarRider.lastPayoutOverall &&
                        !sidebarRider.todayPayout && (
                          <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-1 leading-snug">
                            Last payout:{" "}
                            {fmtRs(sidebarRider.lastPayoutOverall.amountPaid)} ·{" "}
                            {sidebarRider.lastPayoutOverall.paidAt
                              ? formatBusinessDate(
                                  getBusinessDate(
                                    sidebarRider.lastPayoutOverall.paidAt,
                                    cutoffHour,
                                  ),
                                )
                              : "—"}
                          </p>
                        )}
                      {sidebarRider.codOwed > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200/80 dark:border-neutral-700/80">
                          <p className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                            {fmtRs(sidebarRider.codOwed)} pending submission
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5">
                            {sidebarRider.codList.length} delivered order
                            {sidebarRider.codList.length !== 1 ? "s" : ""} not
                            handed in
                          </p>
                        </div>
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
                      <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
                          {sidebarRider.orders.length} order{sidebarRider.orders.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => exportRiderCsv(sidebarRider)}
                            title="Download CSV"
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:border-primary/40 transition-colors"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => openRiderPrintWindow(sidebarRider, "pdf")}
                            title="Export as PDF"
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:border-primary/40 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => openRiderPrintWindow(sidebarRider, "print")}
                            title="Print"
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-[11px] font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:border-primary/40 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                          </button>
                        </div>
                      </div>
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
                                        href={`/pos?editOrder=${encodeURIComponent(mongoId)}`}
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

            {/* Live pipeline */}
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  Live pipeline
                </h2>
                {pipelineFilter != null && (
                  <button
                    type="button"
                    onClick={() => setPipelineFilter(null)}
                    className="text-xs font-bold text-primary hover:underline self-start sm:self-auto"
                  >
                    Clear pipeline filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    key: "kitchen",
                    label: "In kitchen",
                    n: pipelineCounts.kitchen,
                    tone: "blue",
                  },
                  {
                    key: "ready",
                    label: "Ready to pick",
                    n: pipelineCounts.ready,
                    tone: "emerald",
                  },
                  {
                    key: "out",
                    label: "Out for delivery",
                    n: pipelineCounts.out,
                    tone: "violet",
                  },
                  {
                    key: "active",
                    label: "Total active",
                    n: pipelineCounts.total,
                    tone: "primary",
                  },
                ].map((c) => {
                  const selected =
                    (c.key === "active" && pipelineFilter === "active") ||
                    (c.key !== "active" && pipelineFilter === c.key);
                  const toneCls =
                    c.tone === "blue"
                      ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20"
                      : c.tone === "emerald"
                        ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : c.tone === "violet"
                          ? "border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-950/20"
                          : "border-primary/25 bg-primary/5 dark:bg-primary/10";
                  return (
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
                      selected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : `${toneCls} hover:border-primary/40`
                    }`}
                  >
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      {c.label}
                    </p>
                    <p className="text-2xl font-black text-primary mt-1 tabular-nums">
                      {c.n}
                    </p>
                  </button>
                  );
                })}
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
                                href={`/pos?editOrder=${encodeURIComponent(mongoId)}`}
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
