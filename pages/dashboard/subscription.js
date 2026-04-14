import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getSubscriptionStatus,
  getSubscriptionHistory,
  getDaySessions,
  getRestaurantSettings,
} from "../../lib/apiClient";
import { PLAN_DEFINITIONS, PRICING_COUNTRIES, formatMoney } from "../../lib/pricingConfig";
import {
  Crown,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ArrowUpRight,
  Mail,
  MessageCircle,
} from "lucide-react";

const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/923166222269";

function daysRemaining(endDate) {
  if (!endDate) return 0;
  const diff = new Date(endDate) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function fmtDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusTone(status) {
  if (status === "paid" || status === "approved") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (status === "trial" || status === "trial_active") return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
  return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [country, setCountry] = useState("PK");
  const [err, setErr] = useState("");
  const [openPlanSections, setOpenPlanSections] = useState({
    "Point of Sale": true,
    "Kitchen & Delivery": true,
    "Inventory Management": true,
    Accounting: true,
    "Website & Online Ordering": true,
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setErr("");
        const [statusRes, historyRes, daySessionRes, settingsRes] = await Promise.all([
          getSubscriptionStatus(),
          getSubscriptionHistory(),
          getDaySessions(undefined, { limit: 200, offset: 0 }),
          getRestaurantSettings(),
        ]);
        setSubStatus(statusRes || null);
        setHistory(historyRes?.requests || []);
        setSessions(daySessionRes?.sessions || []);

        const currencyCode = String(settingsRes?.currencyCode || "").toUpperCase();
        if (currencyCode === "PKR") setCountry("PK");
        else setCountry("US");
      } catch (e) {
        setErr(e?.message || "Failed to load subscription details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const growthDaily = PLAN_DEFINITIONS.growth.daily[country];

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
  const firstDayJs = new Date(thisYear, thisMonth, 1).getDay(); // 0=Sun
  const firstDayMonOffset = (firstDayJs + 6) % 7; // 0=Mon
  const calendarCells = [
    ...Array.from({ length: firstDayMonOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const billableDaysSet = useMemo(() => {
    const set = new Set();
    (sessions || []).forEach((s) => {
      if (!s?.startAt) return;
      const d = new Date(s.startAt);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        if ((Number(s.totalOrders) || 0) > 0 || (Number(s.totalSales) || 0) > 0 || (Number(s.orderCount) || 0) > 0) {
          set.add(d.getDate());
        }
      }
    });
    return set;
  }, [sessions, thisMonth, thisYear]);

  const billableDays = billableDaysSet.size;
  const estimatedBill = billableDays * growthDaily;
  const trialDays = daysRemaining(subStatus?.freeTrialEndDate);
  const onTrial = subStatus?.currentStatus === "trial_active";
  const onGrowth =
    String(subStatus?.plan || "").toUpperCase().includes("PROFESSIONAL") ||
    String(subStatus?.plan || "").toUpperCase().includes("GROWTH");
  const planFeatureGroups = useMemo(() => {
    if (onTrial || onGrowth) return PLAN_DEFINITIONS.growth.sections;
    return [
      {
        title: "Point of Sale",
        items: PLAN_DEFINITIONS.starter.included.slice(0, 8),
      },
      { title: "Menu", items: PLAN_DEFINITIONS.starter.included.slice(8, 12) },
      { title: "Customers", items: PLAN_DEFINITIONS.starter.included.slice(12, 15) },
      { title: "Reports", items: PLAN_DEFINITIONS.starter.included.slice(15, 20) },
      { title: "Website & Support", items: PLAN_DEFINITIONS.starter.included.slice(20) },
    ];
  }, [onGrowth, onTrial]);

  if (loading) {
    return (
      <AdminLayout title="Subscription">
        <div className="min-h-[50vh] flex items-center justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading subscription...
        </div>
      </AdminLayout>
    );
  }

  if (err) {
    return (
      <AdminLayout title="Subscription">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">{err}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Subscription">
      <div className="space-y-6">
        {/* SECTION 1 — CURRENT STATUS */}
        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Current plan</p>
              <div className="mt-1 flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {onTrial ? "Growth (Trial)" : onGrowth ? "Growth" : "Starter"}
                </p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusTone(subStatus?.currentStatus)}`}>
                  {onTrial ? "Trial Active" : subStatus?.currentStatus === "active" ? "Active" : "Pending"}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-neutral-400">
              {onTrial ? (
                <>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Trial Active — {trialDays} days remaining</p>
                  <p>Trial ends on {fmtDate(subStatus?.freeTrialEndDate)}</p>
                  <p className="text-xs mt-1">Your trial includes full Growth access.</p>
                </>
              ) : (
                <p>Subscription ends on {fmtDate(subStatus?.subscriptionEndDate)}</p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2 — THIS MONTH'S USAGE */}
        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">This Month's Usage</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
              <p className="text-xs text-gray-500">Business days this month</p>
              <p className="text-lg font-bold">{billableDays}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
              <p className="text-xs text-gray-500">Daily rate</p>
              <p className="text-lg font-bold">{formatMoney(country, growthDaily, true)}/day</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
              <p className="text-xs text-gray-500">Estimated bill</p>
              <p className="text-lg font-bold">{formatMoney(country, estimatedBill)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
              <p className="text-xs text-gray-500">Billing note</p>
              <p className="text-sm font-medium">Only days with active orders are billed</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Billable days calendar</p>
            <div className="grid grid-cols-7 gap-2 text-center">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                <div key={w} className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400 py-1">
                  {w}
                </div>
              ))}
              {calendarCells.map((d, idx) => {
                if (!d) {
                  return <div key={`blank-${idx}`} className="h-10 rounded-md bg-transparent" />;
                }
                const billable = billableDaysSet.has(d);
                return (
                  <div
                    key={d}
                    className={`h-10 rounded-md border flex flex-col items-center justify-center ${
                      billable
                        ? "border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10"
                        : "border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${billable ? "bg-orange-500" : "bg-gray-300 dark:bg-neutral-600"}`} />
                    <span className="text-[10px] text-gray-600 dark:text-neutral-400 mt-0.5">{d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 3 — YOUR PLAN */}
        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Your Plan</h2>
          <div className="mt-3 space-y-2">
            {planFeatureGroups.map((group) => {
              const isOpen = Boolean(openPlanSections[group.title]);
              return (
                <div key={group.title} className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenPlanSections((prev) => ({
                        ...prev,
                        [group.title]: !prev[group.title],
                      }))
                    }
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 text-left"
                  >
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {group.title} ({group.items.length} features)
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen ? (
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.items.map((f) => (
                        <div key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 4 — UPGRADE / CHANGE PLAN */}
        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Upgrade / Change Plan</h2>
          <div className="mt-3">
            {onTrial ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-neutral-400">Choose your plan before trial ends.</p>
                <div className="flex gap-2 flex-wrap">
                  <button className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold">Choose Starter</button>
                  <button className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold">Choose Growth</button>
                </div>
              </div>
            ) : onGrowth ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">You're on our best plan 🎉</p>
                <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90">Locked in at launch pricing forever.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-4">
                <p className="font-semibold text-orange-700 dark:text-orange-300">Unlock everything for {formatMoney(country, 100, true)}/day more</p>
                <p className="text-sm text-orange-700/90 dark:text-orange-300/90">Upgrade to Growth for KDS, riders, inventory, accounting, website, and advanced reports.</p>
                <button className="mt-3 h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold inline-flex items-center gap-1">
                  Upgrade to Growth <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 5 — BILLING HISTORY */}
        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Billing History</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2">Month</th>
                  <th className="py-2">Active Days</th>
                  <th className="py-2">Rate</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(history || []).slice(0, 8).map((r) => {
                  const created = new Date(r.createdAt);
                  const monthLabel = created.toLocaleString("en-US", { month: "short", year: "numeric" });
                  const status = r.status === "approved" ? "paid" : r.status === "pending" ? "pending" : "trial";
                  const amount = onGrowth ? PLAN_DEFINITIONS.growth.monthlyApprox[country] : PLAN_DEFINITIONS.starter.monthlyApprox[country];
                  return (
                    <tr key={r.id} className="border-t border-gray-100 dark:border-neutral-800">
                      <td className="py-2">{monthLabel}</td>
                      <td className="py-2">{r.durationInDays || "—"}</td>
                      <td className="py-2">{formatMoney(country, growthDaily, true)}/day</td>
                      <td className="py-2">{formatMoney(country, amount)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusTone(status)}`}>
                          {status === "paid" ? "Paid" : status === "pending" ? "Pending" : "Trial"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!history || history.length === 0) && (
                  <tr><td colSpan={5} className="py-5 text-center text-gray-500">No billing history yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 6 — PAYMENT INFO */}
        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Payment Info — How to pay</h2>
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 p-1">
              {Object.values(PRICING_COUNTRIES).map((c) => (
                <button key={c.code} onClick={() => setCountry(c.code)} className={`h-7 px-2 rounded text-xs ${country === c.code ? "bg-primary text-white" : "text-gray-600 dark:text-neutral-400"}`}>
                  {c.flag} {c.label}
                </button>
              ))}
            </div>
          </div>

          {country === "PK" ? (
            <div className="mt-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-4">
              <p className="text-sm font-semibold">Pakistan</p>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">Bank transfer or Easypaisa/JazzCash.</p>
              <p className="text-sm text-gray-600 dark:text-neutral-400">Contact us to complete payment.</p>
              <div className="mt-3 flex gap-2">
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold inline-flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" /> WhatsApp Us
                </a>
                <a href="mailto:support@eatsdesk.com" className="h-9 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-semibold inline-flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> Email Us
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-4">
              <p className="text-sm font-semibold">USA</p>
              <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">Online payment coming soon.</p>
              <p className="text-sm text-gray-600 dark:text-neutral-400">Contact us to arrange payment.</p>
              <a href="mailto:support@eatsdesk.com" className="mt-3 h-9 px-3 rounded-lg border border-gray-300 dark:border-neutral-700 text-sm font-semibold inline-flex items-center gap-1.5">
                <Mail className="w-4 h-4" /> Email Us
              </a>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

