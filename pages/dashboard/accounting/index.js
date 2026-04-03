import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  Loader2, BookOpen, Banknote, RefreshCw, ArrowRight,
  TrendingUp, TrendingDown, DollarSign, Receipt, AlertCircle,
} from "lucide-react";
import { getStoredAuth } from "../../../lib/apiClient";
import toast from "react-hot-toast";

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

const todayStr = () => new Date().toISOString().split("T")[0];
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; }

function fmtAmt(n, compact = false) {
  if (n === null || n === undefined) return "—";
  if (compact && Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const VOUCHER_TYPE_LABELS = {
  cash_payment: "CPV", cash_receipt: "CRV",
  bank_payment: "BPV", bank_receipt: "BRV",
  journal: "JV", card_transfer: "CT",
};

const VOUCHER_STATUS_STYLE = {
  posted:    "bg-emerald-500/10 text-emerald-400",
  draft:     "bg-yellow-500/10 text-yellow-400",
  cancelled: "bg-neutral-800 text-neutral-500",
};

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton({ className = "" }) {
  return <div className={`bg-neutral-800 animate-pulse rounded-lg ${className}`} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountingHome() {
  const router = useRouter();

  const [checking, setChecking]     = useState(true);
  const [isSetup, setIsSetup]       = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  // Metric state
  const [todayRevenue, setTodayRevenue]   = useState(null);
  const [totalPayable, setTotalPayable]   = useState(null);
  const [cashInHand, setCashInHand]       = useState(null);
  const [recentVouchers, setRecentVouchers] = useState(null);
  const [monthPL, setMonthPL]             = useState(null);
  const [cashAccId, setCashAccId]         = useState(null);

  // Check if accounting is set up
  useEffect(() => {
    async function check() {
      try {
        const data = await apiFetch("/api/accounting/accounts?limit=1");
        setIsSetup(!data.isEmpty);
      } catch { setIsSetup(false); }
      finally { setChecking(false); }
    }
    check();
  }, []);

  // Fetch all dashboard data once we know accounting is set up
  useEffect(() => {
    if (!isSetup) return;
    const t = todayStr();
    const ms = monthStart();

    async function fetchCashAccId() {
      try {
        const data = await apiFetch("/api/accounting/accounts?q=Cash+in+Hand");
        const acc = (data.accounts || []).find((a) => a.code === "30101");
        if (acc) setCashAccId(acc._id);
        return acc?._id;
      } catch { return null; }
    }

    async function fetchAll() {
      const cashId = await fetchCashAccId();

      const [rev, pay, vouchers, pl] = await Promise.allSettled([
        apiFetch(`/api/accounting/reports/profit-loss?dateFrom=${t}&dateTo=${t}`),
        apiFetch(`/api/accounting/reports/payables?asOfDate=${t}`),
        apiFetch(`/api/accounting/vouchers?limit=5&page=1`),
        apiFetch(`/api/accounting/reports/profit-loss?dateFrom=${ms}&dateTo=${t}`),
        cashId
          ? apiFetch(`/api/accounting/reports/cash-statement?accountId=${cashId}&dateFrom=${ms}&dateTo=${t}`)
          : Promise.resolve(null),
      ]);

      if (rev.status === "fulfilled")      setTodayRevenue(rev.value?.grossRevenue ?? 0);
      if (pay.status === "fulfilled")      setTotalPayable(pay.value?.totalPayable ?? 0);
      if (vouchers.status === "fulfilled") setRecentVouchers(vouchers.value?.vouchers ?? []);
      if (pl.status === "fulfilled")       setMonthPL(pl.value);
    }
    fetchAll();
  }, [isSetup]);

  // Also load cash-in-hand separately when we get the ID
  useEffect(() => {
    if (!cashAccId) return;
    const t  = todayStr();
    const ms = monthStart();
    apiFetch(`/api/accounting/reports/cash-statement?accountId=${cashAccId}&dateFrom=${ms}&dateTo=${t}`)
      .then((d) => setCashInHand(d?.closingBalance ?? 0))
      .catch(() => {});
  }, [cashAccId]);

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
    try {
      const data = await apiFetch("/api/accounting/sync-sales", { method: "POST", body: JSON.stringify({ date: todayStr() }) });
      toast.success(`Synced ${data.synced} orders, skipped ${data.skipped}`);
    } catch (err) {
      toast.error(err.message || "Sync failed");
    }
  }

  if (checking) {
    return (
      <AdminLayout title="Accounting">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
        </div>
      </AdminLayout>
    );
  }

  if (!isSetup) {
    return (
      <AdminLayout title="Accounting">
        <div className="flex items-center justify-center min-h-[70vh] px-4">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Set Up Accounting</h2>
            <p className="text-sm text-neutral-500 mb-8 leading-relaxed">
              Initialize your Chart of Accounts with a pre-built set of accounts tailored for restaurant operations.
            </p>
            <button type="button" onClick={handleSetup} disabled={setupLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              {setupLoading ? "Setting up…" : "Setup Accounting"}
            </button>
            <p className="text-xs text-neutral-600 mt-4">This creates 50+ accounts and initializes all voucher sequences.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const netProfitColor = (v) => {
    if (v === null || v === undefined) return "text-neutral-400";
    return v >= 0 ? "text-emerald-400" : "text-red-400";
  };

  return (
    <AdminLayout title="Accounting">
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-xl font-bold text-white">Accounting</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Overview of your financial health</p>
        </div>

        {/* ─── Row 1: Quick Actions ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Cash Payment",  href: "/accounting/vouchers/cash-payment",  icon: <Banknote className="w-4 h-4" />,  color: "border-neutral-700 text-neutral-300 hover:bg-neutral-800" },
            { label: "New Cash Receipt",  href: "/accounting/vouchers/cash-receipt",  icon: <Banknote className="w-4 h-4" />,  color: "border-emerald-700/50 text-emerald-300 hover:bg-emerald-500/10" },
            { label: "New Bank Payment",  href: "/accounting/vouchers/bank-payment",  icon: <DollarSign className="w-4 h-4" />, color: "border-blue-700/50 text-blue-300 hover:bg-blue-500/10" },
          ].map((a) => (
            <Link key={a.label} href={a.href}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${a.color}`}>
              {a.icon} {a.label}
            </Link>
          ))}
          <button type="button" onClick={syncToday}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-orange-700/50 text-orange-300 text-sm font-medium hover:bg-orange-500/10 transition-colors">
            <RefreshCw className="w-4 h-4" /> Sync Today&apos;s Sales
          </button>
        </div>

        {/* ─── Row 2: Live Metric Cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Today's Revenue */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-neutral-400">Today's Revenue</p>
            </div>
            {todayRevenue === null
              ? <Skeleton className="h-8 w-28" />
              : <p className="text-2xl font-black text-emerald-400 tabular-nums">Rs {fmtAmt(todayRevenue)}</p>
            }
          </div>

          {/* Total Payables */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-orange-400" />
              </div>
              <p className="text-sm font-semibold text-neutral-400">Total Payables</p>
            </div>
            {totalPayable === null
              ? <Skeleton className="h-8 w-28" />
              : <p className="text-2xl font-black text-orange-400 tabular-nums">Rs {fmtAmt(totalPayable)}</p>
            }
          </div>

          {/* Cash in Hand */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Banknote className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-neutral-400">Cash in Hand (MTD)</p>
            </div>
            {cashInHand === null
              ? <Skeleton className="h-8 w-28" />
              : <p className={`text-2xl font-black tabular-nums ${cashInHand >= 0 ? "text-blue-400" : "text-red-400"}`}>
                  {cashInHand < 0 ? "(Rs " + fmtAmt(cashInHand) + ")" : "Rs " + fmtAmt(cashInHand)}
                </p>
            }
          </div>
        </div>

        {/* ─── Row 3: Recent Vouchers ───────────────────────────────────── */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <Receipt className="w-4 h-4 text-neutral-500" />
              <h3 className="text-sm font-bold text-white">Recent Vouchers</h3>
            </div>
            <Link href="/accounting/vouchers" className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentVouchers === null ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentVouchers.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-10">No vouchers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  {["Voucher No","Type","Date","Amount","Status"].map((h) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {recentVouchers.map((v) => (
                  <tr key={v._id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-orange-400 text-xs">{v.voucherNumber}</td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">
                        {VOUCHER_TYPE_LABELS[v.type] || v.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-neutral-400 text-xs">{fmtDate(v.date)}</td>
                    <td className="px-5 py-3 text-right text-neutral-300 tabular-nums">Rs {(v.totalAmount||0).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${VOUCHER_STATUS_STYLE[v.status] || ""}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Row 4: This Month P&L ────────────────────────────────────── */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-neutral-500" />
              <h3 className="text-sm font-bold text-white">This Month — P&L</h3>
            </div>
            <Link href="/accounting/reports/profit-loss" className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium">
              View Full Report <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            {monthPL === null ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1,2,3,4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Revenue",        value: monthPL.grossRevenue,  color: "text-emerald-400" },
                  { label: "COGS",           value: monthPL.totalCOGS,     color: "text-orange-400" },
                  { label: "Expenses",       value: monthPL.totalExpenses,  color: "text-red-400" },
                  { label: "Net Profit",     value: monthPL.netProfit,      color: netProfitColor(monthPL.netProfit) },
                ].map((c) => (
                  <div key={c.label} className="bg-neutral-800/50 border border-neutral-800 rounded-xl p-4">
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">{c.label}</p>
                    <p className={`text-base font-black tabular-nums ${c.color}`}>
                      {c.value < 0 ? "(Rs " + fmtAmt(Math.abs(c.value)) + ")" : "Rs " + fmtAmt(c.value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
