import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  Loader2, BookOpen, Banknote, RefreshCw, ArrowRight,
  TrendingUp, TrendingDown, DollarSign, Receipt,
  ArrowUpCircle, ArrowDownCircle, Building2, FileX,
  BarChart3, BookMarked,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../lib/apiClient";
import toast from "react-hot-toast";
import { localToday, localMonthStart, fmtMoneyPK } from "../../../lib/accountingFormat";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function buildHeaders() {
  const auth = getStoredAuth();
  const h = { "Content-Type": "application/json" };
  if (auth?.token) h["Authorization"] = `Bearer ${auth.token}`;
  const slug = auth?.user?.tenantSlug || auth?.tenantSlug;
  if (slug) h["x-tenant-slug"] = slug;
  return h;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...buildHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function fmtAmt(n) {
  if (n === null || n === undefined) return "0.00";
  return fmtMoneyPK(n);
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function fmtDisplayRange() {
  const from = localMonthStart();
  const to   = localToday();
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  return `${fd}/${fm}/${fy} – ${td}/${tm}/${ty}`;
}

const VOUCHER_TYPE_LABELS = {
  cash_payment:  "Cash Payment",
  cash_receipt:  "Cash Receipt",
  bank_payment:  "Bank Payment",
  bank_receipt:  "Bank Receipt",
  journal:       "Journal Entry",
  card_transfer: "Card Transfer",
};

const VOUCHER_TYPE_COLORS = {
  cash_payment:  "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400",
  cash_receipt:  "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  bank_payment:  "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
  bank_receipt:  "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  journal:       "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
  card_transfer: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
};

const VOUCHER_STATUS_STYLE = {
  posted:    "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  draft:     "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  cancelled: "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500",
};

function Skeleton({ className = "" }) {
  return <div className={`bg-gray-200 dark:bg-neutral-800 animate-pulse rounded-lg ${className}`} />;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, loading, sub = "" }) {
  const sym = getCurrencySymbol();
  return (
    <div className={`bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col gap-3`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${color.strip}`} />
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider leading-tight">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color.bg}`}>
          {icon}
        </div>
      </div>
      {loading
        ? <Skeleton className="h-8 w-36" />
        : <p className={`text-2xl font-black tabular-nums leading-none ${color.text}`}>
            {value !== null && Number(value) < 0
              ? `(${sym} ${fmtAmt(Math.abs(value))})`
              : `${sym} ${fmtAmt(value ?? 0)}`}
          </p>
      }
      {sub && <p className="text-[10px] text-gray-400 dark:text-neutral-600 -mt-1">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountingHome() {
  const sym = getCurrencySymbol();
  const [checking, setChecking]         = useState(true);
  const [isSetup, setIsSetup]           = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [syncing, setSyncing]           = useState(false);

  const [todayRevenue, setTodayRevenue]     = useState(null);
  const [totalPayable, setTotalPayable]     = useState(null);
  const [cashInHand, setCashInHand]         = useState(null);
  const [recentVouchers, setRecentVouchers] = useState(null);
  const [monthPL, setMonthPL]               = useState(null);
  const [cashAccId, setCashAccId]           = useState(null);

  useEffect(() => {
    apiFetch("/api/accounting/accounts?limit=1")
      .then((d) => setIsSetup(!d.isEmpty))
      .catch(() => setIsSetup(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!isSetup) return;
    const t  = localToday();
    const ms = localMonthStart();

    async function fetchAll() {
      setTodayRevenue(null);
      setTotalPayable(null);
      setCashInHand(null);

      let cashId = null;
      try {
        const d = await apiFetch("/api/accounting/accounts?q=Cash+in+Hand");
        const acc = (d.accounts || []).find((a) => a.code === "30101");
        if (acc) { cashId = acc._id; setCashAccId(acc._id); }
      } catch { /* ignore */ }

      const results = await Promise.allSettled([
        apiFetch(`/api/accounting/reports/profit-loss?dateFrom=${encodeURIComponent(t)}&dateTo=${encodeURIComponent(t)}`),
        apiFetch("/api/accounting/parties/totals"),
        apiFetch("/api/accounting/vouchers?limit=5&page=1"),
        apiFetch(`/api/accounting/reports/profit-loss?dateFrom=${encodeURIComponent(ms)}&dateTo=${encodeURIComponent(t)}`),
        cashId
          ? apiFetch(`/api/accounting/reports/cash-statement?accountId=${cashId}&dateFrom=${encodeURIComponent(ms)}&dateTo=${encodeURIComponent(t)}`)
          : Promise.resolve(null),
      ]);

      if (results[0].status === "fulfilled") {
        const pl = results[0].value;
        setTodayRevenue(pl?.netProfit != null ? pl.netProfit : pl?.grossRevenue ?? 0);
      } else setTodayRevenue(0);

      if (results[1].status === "fulfilled") {
        setTotalPayable(Number(results[1].value?.totalPayable) || 0);
      } else setTotalPayable(0);

      if (results[2].status === "fulfilled") {
        setRecentVouchers(results[2].value?.vouchers ?? []);
      } else setRecentVouchers([]);

      if (results[3].status === "fulfilled") setMonthPL(results[3].value);
      else setMonthPL(null);

      if (results[4].status === "fulfilled" && results[4].value) {
        setCashInHand(Number(results[4].value?.closingBalance) || 0);
      } else setCashInHand(0);
    }
    fetchAll();
  }, [isSetup]);

  async function handleSetup() {
    setSetupLoading(true);
    try {
      await apiFetch("/api/accounting/setup", { method: "POST" });
      toast.success("Accounting set up successfully!");
      setIsSetup(true);
    } catch (err) {
      toast.error(err.message || "Setup failed");
    } finally { setSetupLoading(false); }
  }

  async function syncToday() {
    setSyncing(true);
    try {
      const data = await apiFetch("/api/accounting/sync-sales", { method: "POST", body: JSON.stringify({ date: localToday() }) });
      toast.success(`Synced ${data.synced} orders, skipped ${data.skipped}`);
    } catch (err) {
      toast.error(err.message || "Sync failed");
    } finally { setSyncing(false); }
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <AdminLayout title="Accounts Board">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      </AdminLayout>
    );
  }

  // ── Not set up ───────────────────────────────────────────────────────────────
  if (!isSetup) {
    return (
      <AdminLayout title="Accounts Board">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-sm w-full bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-500/25">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Set Up Accounting</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mb-7 leading-relaxed">
              Initialize your Chart of Accounts with 50+ pre-built accounts tailored for restaurant operations.
            </p>
            <button type="button" onClick={handleSetup} disabled={setupLoading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors disabled:opacity-50 shadow-sm shadow-orange-500/20">
              {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              {setupLoading ? "Setting up…" : "Setup Accounting"}
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const netColor = (v) =>
    v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  const QUICK_ACTIONS = [
    { label: "Cash Payment", href: "/accounting/vouchers/cash-payment", icon: <ArrowUpCircle className="w-3.5 h-3.5" /> },
    { label: "Cash Receipt", href: "/accounting/vouchers/cash-receipt", icon: <ArrowDownCircle className="w-3.5 h-3.5" /> },
    { label: "Bank Payment", href: "/accounting/vouchers/bank-payment", icon: <Building2 className="w-3.5 h-3.5" /> },
    { label: "All Vouchers", href: "/accounting/vouchers",              icon: <Receipt className="w-3.5 h-3.5" /> },
  ];

  const REPORT_SHORTCUTS = [
    { label: "P&L Statement",  href: "/accounting/reports/profit-loss",    icon: <TrendingDown className="w-4 h-4 text-orange-500 dark:text-orange-400" />,  bg: "bg-orange-50 dark:bg-orange-500/10" },
    { label: "Ledger",         href: "/accounting/reports/ledger",          icon: <BookMarked    className="w-4 h-4 text-violet-500 dark:text-violet-400" />,  bg: "bg-violet-50 dark:bg-violet-500/10" },
    { label: "Day Book",       href: "/accounting/reports/day-book",        icon: <BarChart3     className="w-4 h-4 text-blue-500 dark:text-blue-400" />,      bg: "bg-blue-50 dark:bg-blue-500/10"     },
    { label: "Payables",       href: "/accounting/reports/payables",        icon: <TrendingDown  className="w-4 h-4 text-red-500 dark:text-red-400" />,        bg: "bg-red-50 dark:bg-red-500/10"       },
    { label: "Cash Statement", href: "/accounting/reports/cash-statement",  icon: <Banknote      className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />, bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Balance Sheet",  href: "/accounting/reports/balance-sheet",   icon: <DollarSign    className="w-4 h-4 text-gray-500 dark:text-neutral-400" />,    bg: "bg-gray-50 dark:bg-neutral-800"     },
  ];

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Accounts Board">
      <div className="space-y-5">

        {/* ── Header banner ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-400 px-6 py-5 shadow-lg shadow-orange-500/20">
          {/* subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-200 mb-1">Accounting</p>
              <h1 className="text-2xl font-black text-white tracking-tight leading-none">Accounts Board</h1>
              <p className="text-sm text-orange-100 mt-2 font-medium">{fmtDisplayRange()}</p>
            </div>
            <button type="button" onClick={syncToday} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/15 border border-white/20 text-sm font-semibold text-white transition-colors backdrop-blur-sm disabled:opacity-60 flex-shrink-0">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync Today&apos;s Sales
            </button>
          </div>

          {/* Quick new-voucher links */}
          <div className="relative flex flex-wrap gap-2 mt-4">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.label} href={a.href}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white transition-colors backdrop-blur-sm">
                {a.icon} {a.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={<TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            label="Today's Revenue"
            value={todayRevenue}
            color={{ strip: "bg-gradient-to-r from-emerald-400 to-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" }}
            loading={todayRevenue === null}
            sub="Net result for today"
          />
          <MetricCard
            icon={<TrendingDown className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
            label="Total Payables"
            value={totalPayable}
            color={{ strip: "bg-gradient-to-r from-orange-400 to-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" }}
            loading={totalPayable === null}
            sub="Supplier balances outstanding"
          />
          <MetricCard
            icon={<Banknote className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            label="Cash in Hand"
            value={cashInHand}
            color={{
              strip: "bg-gradient-to-r from-blue-400 to-blue-500",
              bg: "bg-blue-50 dark:bg-blue-500/10",
              text: cashInHand !== null
                ? (cashInHand >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400")
                : "text-blue-600 dark:text-blue-400",
            }}
            loading={cashInHand === null}
            sub="Month-to-date closing balance"
          />
        </div>

        {/* ── P&L + Reports grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* P&L card (2/3) */}
          <div className="lg:col-span-2 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">This Month — P&amp;L</span>
                  <p className="text-[10px] text-gray-400 dark:text-neutral-600 leading-none mt-0.5">{fmtDisplayRange()}</p>
                </div>
              </div>
              <Link href="/accounting/reports/profit-loss"
                className="flex items-center gap-1 text-xs font-semibold text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors">
                Full Report <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {monthPL === null ? (
              <div className="grid grid-cols-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-5 py-5 border-r last:border-r-0 border-gray-100 dark:border-neutral-800 flex flex-col gap-2.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              (() => {
                const total = monthPL.grossRevenue || 1;
                const bars = [
                  { label: "Revenue",  value: monthPL.grossRevenue,  color: "text-emerald-600 dark:text-emerald-400", barColor: "bg-emerald-500", bg: "" },
                  { label: "COGS",     value: monthPL.totalCOGS,     color: "text-orange-600 dark:text-orange-400",   barColor: "bg-orange-400",  bg: "" },
                  { label: "Expenses", value: monthPL.totalExpenses,  color: "text-red-600 dark:text-red-400",         barColor: "bg-red-400",     bg: "" },
                  {
                    label: monthPL.netProfit >= 0 ? "Net Profit" : "Net Loss",
                    value: monthPL.netProfit,
                    color: netColor(monthPL.netProfit),
                    barColor: monthPL.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500",
                    bg: monthPL.netProfit >= 0 ? "bg-emerald-50/60 dark:bg-emerald-500/5" : "bg-red-50/60 dark:bg-red-500/5",
                  },
                ];
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-neutral-800">
                    {bars.map((c) => {
                      const pct = Math.min(100, Math.round((Math.abs(c.value) / Math.abs(total)) * 100));
                      return (
                        <div key={c.label} className={`px-5 py-5 flex flex-col gap-1.5 ${c.bg}`}>
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">{c.label}</p>
                          <p className={`text-base font-bold tabular-nums leading-snug ${c.color}`}>
                            {c.value < 0 ? `(${sym} ${fmtAmt(Math.abs(c.value))})` : `${sym} ${fmtAmt(c.value)}`}
                          </p>
                          <div className="h-1 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden mt-0.5">
                            <div className={`h-full rounded-full ${c.barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          {/* Reports shortcuts (1/3) */}
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
              <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Reports</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {REPORT_SHORTCUTS.map((r) => (
                <Link key={r.label} href={r.href}
                  className="flex flex-col items-start gap-2 p-3 rounded-xl border border-gray-100 dark:border-neutral-800 hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all group">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.bg}`}>
                    {r.icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-neutral-300 leading-tight group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{r.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Vouchers ────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-3.5 h-3.5 text-gray-500 dark:text-neutral-400" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Recent Vouchers</span>
            </div>
            <Link href="/accounting/vouchers"
              className="flex items-center gap-1 text-xs font-semibold text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentVouchers === null ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : recentVouchers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                <FileX className="w-6 h-6 text-gray-400 dark:text-neutral-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">No vouchers yet</p>
                <p className="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">Create your first voucher to get started</p>
              </div>
              <Link href="/accounting/vouchers/cash-payment"
                className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors">
                <ArrowUpCircle className="w-3.5 h-3.5" /> New Cash Payment
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-800">
                    <th className="pl-5 pr-3 py-3 text-left text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">Voucher No.</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">Type</th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:table-cell">Date</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">Amount</th>
                    <th className="pl-3 pr-5 py-3 text-left text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                  {recentVouchers.map((v) => (
                    <Link key={v._id} href="/accounting/vouchers" legacyBehavior>
                      <tr className="hover:bg-gray-50/80 dark:hover:bg-neutral-900/40 transition-colors cursor-pointer">
                        <td className="pl-5 pr-3 py-3.5">
                          <span className="font-mono text-[11px] font-bold text-orange-500 dark:text-orange-400">{v.voucherNumber}</span>
                          {v.autoPosted && (
                            <span className="ml-1.5 text-[9px] font-semibold text-gray-400 dark:text-neutral-600 bg-gray-100 dark:bg-neutral-800 rounded px-1 py-0.5">AUTO</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${VOUCHER_TYPE_COLORS[v.type] || "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"}`}>
                            {VOUCHER_TYPE_LABELS[v.type] || v.type}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-xs text-gray-500 dark:text-neutral-500 tabular-nums hidden sm:table-cell">{fmtDate(v.date)}</td>
                        <td className="px-3 py-3.5 text-right">
                          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{sym} {fmtAmt(v.totalAmount || 0)}</span>
                        </td>
                        <td className="pl-3 pr-5 py-3.5">
                          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${VOUCHER_STATUS_STYLE[v.status] || ""}`}>
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between bg-gray-50/40 dark:bg-neutral-900/30">
                <span className="text-xs text-gray-400 dark:text-neutral-600">Showing last 5 vouchers</span>
                <Link href="/accounting/vouchers"
                  className="flex items-center gap-1 text-xs font-semibold text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors">
                  See all vouchers <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
