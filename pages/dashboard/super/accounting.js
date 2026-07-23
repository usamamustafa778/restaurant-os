import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePermissions } from "../../../contexts/PermissionContext";
import {
  createPlatformExpense,
  deletePlatformExpense,
  getPlatformAccountingSummary,
  getPlatformExpenses,
  updatePlatformAccountingSettings,
  updatePlatformExpense,
} from "../../../lib/apiClient";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
} from "lucide-react";
import toast from "react-hot-toast";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2000, i, 1).toLocaleString("en", { month: "long" }),
}));

const CATEGORIES = [
  { value: "hosting", label: "Hosting" },
  { value: "database", label: "Database" },
  { value: "email", label: "Email" },
  { value: "devtools", label: "Dev tools" },
  { value: "ai", label: "AI" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  name: "",
  vendor: "",
  category: "other",
  amount: "",
  currency: "USD",
  recurring: true,
  applyMonth: new Date().getMonth() + 1,
  applyYear: new Date().getFullYear(),
  isActive: true,
  notes: "",
};

function formatPkr(n) {
  const v = Number(n) || 0;
  return `Rs ${Math.round(v).toLocaleString("en-PK")}`;
}

function formatUsd(n) {
  const v = Number(n) || 0;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatCard({ label, value, sub, tone = "neutral" }) {
  const tones = {
    neutral:
      "bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800",
    good: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    bad: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    warn: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    info: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800",
  };
  const valueTones = {
    neutral: "text-gray-900 dark:text-white",
    good: "text-emerald-800 dark:text-emerald-300",
    bad: "text-red-800 dark:text-red-300",
    warn: "text-amber-800 dark:text-amber-300",
    info: "text-sky-800 dark:text-sky-300",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs text-gray-500 dark:text-neutral-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-0.5 ${valueTones[tone]}`}>
        {value}
      </p>
      {sub ? (
        <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function TrendBars({ trend }) {
  const max = Math.max(
    ...trend.map((t) => Math.max(t.revenuePkr, t.costsPkr, 1)),
    1,
  );
  return (
    <div className="flex items-end gap-1.5 h-28">
      {trend.map((t) => (
        <div
          key={`${t.year}-${t.month}`}
          className="flex-1 flex flex-col items-center gap-1 min-w-0"
          title={`${t.label}: rev ${formatPkr(t.revenuePkr)}, cost ${formatPkr(t.costsPkr)}`}
        >
          <div className="w-full flex items-end gap-0.5 h-20 justify-center">
            <div
              className="w-[40%] max-w-[10px] rounded-t bg-emerald-500/80"
              style={{ height: `${Math.max(4, (t.revenuePkr / max) * 100)}%` }}
            />
            <div
              className="w-[40%] max-w-[10px] rounded-t bg-red-400/70"
              style={{ height: `${Math.max(4, (t.costsPkr / max) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-400 dark:text-neutral-500 truncate w-full text-center">
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SuperAccountingPage() {
  const { permissions } = usePermissions();
  const isOwner = permissions.includes("*");
  const canManage = isOwner;

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [fxDraft, setFxDraft] = useState("280");
  const [investedDraft, setInvestedDraft] = useState("6000");
  const [savingFx, setSavingFx] = useState(false);
  const [savingInvested, setSavingInvested] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savingExpense, setSavingExpense] = useState(false);

  const yearOptions = useMemo(() => {
    const ys = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 3; y -= 1) {
      ys.push(y);
    }
    return ys;
  }, [now]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPlatformAccountingSummary({ month, year });
      setSummary(data);
      setFxDraft(String(data?.settings?.usdToPkrRate ?? 280));
      setInvestedDraft(String(data?.settings?.totalInvestedUsd ?? 6000));
    } catch (err) {
      toast.error(err.message || "Failed to load accounting");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (!isOwner) return;
    load();
  }, [isOwner, load]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      applyMonth: month,
      applyYear: year,
    });
    setShowForm(true);
  }

  function openEdit(expense) {
    setEditingId(expense.id);
    setForm({
      name: expense.name || "",
      vendor: expense.vendor || "",
      category: expense.category || "other",
      amount: String(expense.amount ?? ""),
      currency: expense.currency || "USD",
      recurring: expense.recurring !== false,
      applyMonth: expense.applyMonth || month,
      applyYear: expense.applyYear || year,
      isActive: expense.isActive !== false,
      notes: expense.notes || "",
    });
    setShowForm(true);
  }

  async function handleSaveExpense(e) {
    e.preventDefault();
    if (!canManage) return;
    try {
      setSavingExpense(true);
      const body = {
        name: form.name.trim(),
        vendor: form.vendor.trim(),
        category: form.category,
        amount: Number(form.amount),
        currency: form.currency,
        recurring: form.recurring,
        applyMonth: form.recurring ? null : Number(form.applyMonth),
        applyYear: form.recurring ? null : Number(form.applyYear),
        isActive: form.isActive,
        notes: form.notes.trim(),
      };
      if (editingId) {
        await updatePlatformExpense(editingId, body);
        toast.success("Expense updated");
      } else {
        await createPlatformExpense(body);
        toast.success("Expense added");
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Failed to save expense");
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleDeleteExpense(expense) {
    if (!canManage) return;
    if (!window.confirm(`Delete “${expense.name}”?`)) return;
    try {
      await deletePlatformExpense(expense.id);
      toast.success("Expense deleted");
      await load();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  }

  async function handleToggleActive(expense) {
    if (!canManage) return;
    try {
      await updatePlatformExpense(expense.id, { isActive: !expense.isActive });
      await load();
    } catch (err) {
      toast.error(err.message || "Failed to update");
    }
  }

  async function handleSaveFx() {
    if (!canManage) return;
    const rate = Number(fxDraft);
    if (!Number.isFinite(rate) || rate < 1) {
      toast.error("Enter a valid USD→PKR rate");
      return;
    }
    try {
      setSavingFx(true);
      await updatePlatformAccountingSettings({ usdToPkrRate: rate });
      toast.success("Exchange rate saved");
      await load();
    } catch (err) {
      toast.error(err.message || "Failed to save rate");
    } finally {
      setSavingFx(false);
    }
  }

  async function handleSaveInvested() {
    if (!canManage) return;
    const amount = Number(investedDraft);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid total invested amount");
      return;
    }
    try {
      setSavingInvested(true);
      await updatePlatformAccountingSettings({ totalInvestedUsd: amount });
      toast.success("Total invested saved");
      await load();
    } catch (err) {
      toast.error(err.message || "Failed to save investment");
    } finally {
      setSavingInvested(false);
    }
  }

  const netTone =
    (summary?.net?.pkr || 0) > 0
      ? "good"
      : (summary?.net?.pkr || 0) < 0
        ? "bad"
        : "neutral";

  return (
    <AdminLayout title="Accounting">
      <SuperPageGate ownerOnly>
        <div className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                Platform owner P&amp;L — paid SaaS invoices minus operating costs
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-2"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-2"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[#FF5400] text-white hover:bg-[#e64c00]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add cost
                </button>
              ) : null}
            </div>
          </div>

          {loading && !summary ? (
            <div className="flex items-center justify-center py-24 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading accounting…
            </div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <StatCard
                  label={`Revenue · ${summary.period.label}`}
                  value={formatPkr(summary.revenue.pkr)}
                  sub={`${summary.revenue.invoiceCount} paid invoice${summary.revenue.invoiceCount === 1 ? "" : "s"} · ${formatUsd(summary.revenue.usd)}`}
                  tone="good"
                />
                <StatCard
                  label="Operating costs"
                  value={formatUsd(summary.costs.usd)}
                  sub={`${formatPkr(summary.costs.pkr)} · ${summary.costs.expenseCount} line${summary.costs.expenseCount === 1 ? "" : "s"}`}
                  tone="bad"
                />
                <StatCard
                  label="Net earnings"
                  value={formatPkr(summary.net.pkr)}
                  sub={formatUsd(summary.net.usd)}
                  tone={netTone}
                />
                <StatCard
                  label={`YTD ${summary.ytd.year}`}
                  value={formatPkr(summary.ytd.revenuePkr)}
                  sub={`${summary.ytd.invoiceCount} paid · outstanding ${formatPkr(summary.outstanding.totalPkr)}`}
                  tone="info"
                />
                <StatCard
                  label="Project invested"
                  value={formatUsd(summary.investment?.totalUsd ?? 6000)}
                  sub={
                    summary.investment?.recovered
                      ? `Payback complete · ${formatUsd(summary.investment.lifetimeRevenueUsd)} lifetime revenue`
                      : `${summary.investment?.paybackPct ?? 0}% recovered · ${formatUsd(summary.investment?.remainingUsd ?? 0)} left`
                  }
                  tone={summary.investment?.recovered ? "good" : "warn"}
                />
              </div>

              {summary.investment ? (
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Investment payback
                      </h2>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Lifetime paid invoices vs total spent building this
                        project
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatUsd(summary.investment.lifetimeRevenueUsd)}
                      <span className="text-gray-400 font-normal">
                        {" "}
                        / {formatUsd(summary.investment.totalUsd)}
                      </span>
                    </p>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        summary.investment.recovered
                          ? "bg-emerald-500"
                          : "bg-[#FF5400]"
                      }`}
                      style={{
                        width: `${Math.max(2, summary.investment.paybackPct || 0)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span>
                      Recovered{" "}
                      <span className="font-medium text-gray-700 dark:text-neutral-300">
                        {formatUsd(summary.investment.recoveredUsd)}
                      </span>
                    </span>
                    <span>
                      Remaining{" "}
                      <span className="font-medium text-gray-700 dark:text-neutral-300">
                        {formatUsd(summary.investment.remainingUsd)}
                      </span>
                    </span>
                    <span>
                      {summary.investment.lifetimeInvoiceCount} paid invoice
                      {summary.investment.lifetimeInvoiceCount === 1 ? "" : "s"}{" "}
                      all-time ({formatPkr(summary.investment.lifetimeRevenuePkr)})
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                        12-month trend
                      </h2>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1 align-middle" />
                        Revenue
                        <span className="inline-block w-2 h-2 rounded-sm bg-red-400 ml-3 mr-1 align-middle" />
                        Costs
                      </p>
                    </div>
                    {(summary.net.pkr || 0) >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <TrendBars trend={summary.trend || []} />
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      USD → PKR rate
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                      Used to convert dollar costs and investment into rupees.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="number"
                        min={1}
                        step="0.01"
                        value={fxDraft}
                        disabled={!canManage}
                        onChange={(e) => setFxDraft(e.target.value)}
                        className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 tabular-nums"
                      />
                      {canManage ? (
                        <button
                          type="button"
                          disabled={savingFx}
                          onClick={handleSaveFx}
                          className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 disabled:opacity-50"
                        >
                          {savingFx ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 dark:border-neutral-800">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Total invested (USD)
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                      Rough total spent on this project so far (~$6K).
                    </p>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={investedDraft}
                        disabled={!canManage}
                        onChange={(e) => setInvestedDraft(e.target.value)}
                        className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 tabular-nums"
                      />
                      {canManage ? (
                        <button
                          type="button"
                          disabled={savingInvested}
                          onClick={handleSaveInvested}
                          className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 disabled:opacity-50"
                        >
                          {savingInvested ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 space-y-1 pt-3 border-t border-gray-100 dark:border-neutral-800">
                    <p>
                      Sent invoices:{" "}
                      <span className="font-medium text-gray-700 dark:text-neutral-300">
                        {summary.outstanding.sent.count} ·{" "}
                        {formatPkr(summary.outstanding.sent.amount)}
                      </span>
                    </p>
                    <p>
                      Overdue:{" "}
                      <span className="font-medium text-gray-700 dark:text-neutral-300">
                        {summary.outstanding.overdue.count} ·{" "}
                        {formatPkr(summary.outstanding.overdue.amount)}
                      </span>
                    </p>
                    <Link
                      href="/super/invoices"
                      className="inline-flex items-center gap-1 text-[#FF5400] hover:underline mt-1"
                    >
                      <Receipt className="w-3 h-3" />
                      Open invoices
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-red-500" />
                    <h2 className="text-sm font-semibold">Monthly costs</h2>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {(summary.costs.expenses || []).length === 0 ? (
                      <p className="px-4 py-8 text-sm text-gray-500 text-center">
                        No active costs for this month
                      </p>
                    ) : (
                      summary.costs.expenses.map((exp) => (
                        <div
                          key={exp.id}
                          className="px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {exp.name}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {[exp.vendor, exp.category]
                                .filter(Boolean)
                                .join(" · ")}
                              {!exp.recurring ? " · one-time" : ""}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold tabular-nums">
                              {exp.currency === "USD"
                                ? formatUsd(exp.amount)
                                : formatPkr(exp.amount)}
                            </p>
                            <p className="text-[11px] text-gray-400 tabular-nums">
                              {formatPkr(exp.amountPkr)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-sm font-semibold">
                      Paid this month
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-neutral-800 max-h-[360px] overflow-y-auto">
                    {(summary.revenue.invoices || []).length === 0 ? (
                      <p className="px-4 py-8 text-sm text-gray-500 text-center">
                        No paid invoices in {summary.period.label}
                      </p>
                    ) : (
                      summary.revenue.invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {inv.restaurantName}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {inv.invoiceNumber} · paid {formatDate(inv.paidAt)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums flex-shrink-0 text-emerald-700 dark:text-emerald-400">
                            {formatPkr(inv.amount)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {canManage ? (
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Manage all costs</h2>
                    <button
                      type="button"
                      onClick={openCreate}
                      className="text-xs text-[#FF5400] hover:underline"
                    >
                      Add cost
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100 dark:border-neutral-800">
                          <th className="px-4 py-2 font-medium">Name</th>
                          <th className="px-4 py-2 font-medium">Category</th>
                          <th className="px-4 py-2 font-medium">Amount</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <AllExpensesTable
                    onEdit={openEdit}
                    onDelete={handleDeleteExpense}
                    onToggle={handleToggleActive}
                    refreshKey={`${month}-${year}-${summary?.costs?.expenseCount}-${loading}-${showForm}`}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-gray-500 py-12 text-center">
              Could not load accounting.
            </p>
          )}

          {showForm ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <form
                onSubmit={handleSaveExpense}
                className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-5 space-y-3"
              >
                <h3 className="text-base font-semibold">
                  {editingId ? "Edit cost" : "Add operating cost"}
                </h3>
                <label className="block text-xs text-gray-500">
                  Name
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-gray-500">
                    Vendor
                    <input
                      value={form.vendor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, vendor: e.target.value }))
                      }
                      className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                    />
                  </label>
                  <label className="block text-xs text-gray-500">
                    Category
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-gray-500">
                    Amount
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount: e.target.value }))
                      }
                      className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                    />
                  </label>
                  <label className="block text-xs text-gray-500">
                    Currency
                    <select
                      value={form.currency}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, currency: e.target.value }))
                      }
                      className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                    >
                      <option value="USD">USD</option>
                      <option value="PKR">PKR</option>
                    </select>
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={form.recurring}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, recurring: e.target.checked }))
                    }
                  />
                  Recurring monthly
                </label>
                {!form.recurring ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs text-gray-500">
                      Month
                      <select
                        value={form.applyMonth}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            applyMonth: Number(e.target.value),
                          }))
                        }
                        className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                      >
                        {MONTHS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs text-gray-500">
                      Year
                      <input
                        type="number"
                        value={form.applyYear}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            applyYear: Number(e.target.value),
                          }))
                        }
                        className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                      />
                    </label>
                  </div>
                ) : null}
                <label className="block text-xs text-gray-500">
                  Notes
                  <input
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    className="mt-1 w-full text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-transparent px-3 py-2"
                  />
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingExpense}
                    className="text-sm px-3 py-2 rounded-lg bg-[#FF5400] text-white disabled:opacity-50"
                  >
                    {savingExpense ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </SuperPageGate>
    </AdminLayout>
  );
}

function AllExpensesTable({ onEdit, onDelete, onToggle, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getPlatformExpenses();
        if (!cancelled) {
          setRows(Array.isArray(data?.expenses) ? data.expenses : []);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="px-4 py-6 text-sm text-gray-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading costs…
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mt-px">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                No expenses configured
              </td>
            </tr>
          ) : (
            rows.map((exp) => (
              <tr
                key={exp.id}
                className={!exp.isActive ? "opacity-50" : undefined}
              >
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {exp.name}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {exp.vendor || "—"}
                    {!exp.recurring
                      ? ` · ${exp.applyMonth}/${exp.applyYear}`
                      : " · monthly"}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-gray-500 capitalize">
                  {exp.category}
                </td>
                <td className="px-4 py-2.5 tabular-nums font-medium">
                  {exp.currency === "USD"
                    ? `$${Number(exp.amount).toLocaleString()}`
                    : `Rs ${Math.round(exp.amount).toLocaleString("en-PK")}`}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => onToggle(exp)}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      exp.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {exp.isActive ? "Active" : "Off"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(exp)}
                    className="inline-flex p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(exp)}
                    className="inline-flex p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
