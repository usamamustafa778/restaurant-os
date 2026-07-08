import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getTenantSubscriptionSummary } from "../../lib/apiClient";
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, ReceiptText } from "lucide-react";

function formatMoney(amount, currency = "PKR") {
  const code = String(currency || "PKR").toUpperCase();
  const value = Number(amount) || 0;
  if (code === "PKR") return `Rs ${value.toLocaleString()}`;
  return `${code} ${value.toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function subscriptionStatusTone(code) {
  const key = String(code || "").toUpperCase();
  if (key === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (key === "TRIAL") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
  }
  if (key === "PAST_DUE") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
  }
  return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
}

function invoiceStatusTone(status) {
  const key = String(status || "").toUpperCase();
  if (key === "PAID") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (key === "SENT") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
  }
  if (key === "OVERDUE") {
    return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  }
  return "bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-neutral-200";
}

function invoiceStatusLabel(status) {
  const key = String(status || "").toUpperCase();
  if (key === "PAID") return "Paid";
  if (key === "SENT") return "Sent";
  if (key === "OVERDUE") return "Overdue";
  return key || "—";
}

function statusLabel(code) {
  const key = String(code || "").toUpperCase();
  if (key === "PAST_DUE") return "Past Due";
  return key || "Unknown";
}

function cycleLabel(cycle) {
  const key = String(cycle || "").toLowerCase();
  if (key === "monthly") return "Monthly";
  if (key === "quarterly") return "Quarterly";
  if (key === "biannual") return "Biannual";
  if (key === "annual") return "Annual";
  return "Monthly";
}

function isOutstandingInvoice(invoice) {
  const key = String(invoice?.status || "").toUpperCase();
  return key === "SENT" || key === "OVERDUE";
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const response = await getTenantSubscriptionSummary();
        if (!cancelled) {
          setSummary(response?.summary || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load subscription summary");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const status = summary?.status || {};
  const billing = summary?.billing || {};
  const invoices = Array.isArray(summary?.invoices) ? summary.invoices : [];
  const activeModules = Array.isArray(billing?.activeModules)
    ? billing.activeModules
    : [];
  const lineItems = Array.isArray(billing?.lineItems) ? billing.lineItems : [];
  const currency = invoices[0]?.currency || "PKR";

  const outstandingInvoice = useMemo(() => {
    const list = invoices.filter(isOutstandingInvoice);
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => {
      const aOverdue = String(a.status || "").toUpperCase() === "OVERDUE";
      const bOverdue = String(b.status || "").toUpperCase() === "OVERDUE";
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      const aDue = a?.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b?.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
    return sorted[0];
  }, [invoices]);

  if (loading) {
    return (
      <AdminLayout title="Subscription">
        <div className="min-h-[50vh] flex items-center justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading subscription...
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Subscription">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Subscription">
      <div className="space-y-6">
        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Subscription Status
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {summary?.restaurant?.name || "Restaurant"}
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${subscriptionStatusTone(
                    status?.code
                  )}`}
                >
                  {statusLabel(status?.code)}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                Billing cycle: {cycleLabel(status?.billingCycle)}
              </p>
            </div>
            <div className="text-sm text-gray-600 dark:text-neutral-400">
              <p className="font-medium">
                Subscription end date: {formatDate(status?.subscriptionEndDate)}
              </p>
              {String(status?.code || "").toUpperCase() === "PAST_DUE" ? (
                <>
                  <p className="mt-1">
                    Grace until: {formatDate(status?.graceUntilDate)}
                  </p>
                  <p className="text-xs mt-1">
                    {Number(status?.graceDaysRemaining || 0)} day(s) of grace remaining
                  </p>
                </>
              ) : (
                <p className="text-xs mt-1">
                  {Number(status?.daysRemaining || 0)} day(s) remaining
                </p>
              )}
            </div>
          </div>
        </section>

        {outstandingInvoice ? (
          <section className="rounded-2xl border-2 border-amber-200 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 mt-0.5" />
              <div>
                <p className="text-base font-semibold text-amber-800 dark:text-amber-200">
                  Invoice due — {formatMoney(outstandingInvoice.amount, outstandingInvoice.currency)}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {outstandingInvoice.invoiceNumber || "Invoice"} is {invoiceStatusLabel(outstandingInvoice.status).toLowerCase()}.
                  Due on {formatDate(outstandingInvoice.dueDate)}. Please contact EatsDesk billing after payment.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Monthly Billing
          </p>
          <div className="mt-2 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatMoney(billing?.net, currency)}
                <span className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                  {" "}
                  / month
                </span>
              </p>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                Billable branches: {Number(billing?.branchCount || 1)}
              </p>
            </div>
            <div className="text-sm text-gray-600 dark:text-neutral-400">
              <p>Gross: {formatMoney(billing?.gross, currency)}</p>
              <p>
                Discount:{" "}
                {billing?.discountLine
                  ? `${billing.discountLine.label || "Subscription discount"} (${formatMoney(
                      billing.discountAmount,
                      currency
                    )})`
                  : formatMoney(0, currency)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-neutral-800 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              Billing breakdown
            </div>
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {lineItems.map((line, idx) => {
                const kind = String(line?.kind || "");
                const amount = Number(line?.amount || 0);
                const isDiscount = kind === "discount";
                const isTotal = kind === "total";
                return (
                  <div
                    key={`line-${idx}`}
                    className="px-4 py-2 flex items-center justify-between text-sm"
                  >
                    <span
                      className={`${
                        isTotal
                          ? "font-bold text-gray-900 dark:text-white"
                          : isDiscount
                          ? "font-semibold text-emerald-700 dark:text-emerald-300"
                          : "text-gray-700 dark:text-neutral-200"
                      }`}
                    >
                      {line?.label || "Line item"}
                    </span>
                    <span
                      className={`${
                        isTotal
                          ? "font-bold text-primary"
                          : isDiscount
                          ? "font-semibold text-emerald-700 dark:text-emerald-300"
                          : "text-gray-700 dark:text-neutral-200"
                      }`}
                    >
                      {amount < 0 ? "-" : ""}
                      {formatMoney(Math.abs(amount), currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Active Modules
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            Your enabled modules and their current monthly rates.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeModules.map((module) => (
              <div
                key={module.key}
                className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {module.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                      {module.perBranch
                        ? `${formatMoney(module.rate, currency)}/branch/mo`
                        : `${formatMoney(module.rate, currency)}/mo`}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-neutral-200 mt-2">
                  Monthly charge: {formatMoney(module.amount, currency)}
                </p>
              </div>
            ))}
            {!activeModules.length ? (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-neutral-700 p-3 text-sm text-gray-500 dark:text-neutral-400">
                No active modules found for this subscription.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-primary" />
            Invoice History
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            Official platform invoices from EatsDesk billing.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2">Invoice</th>
                  <th className="py-2">Period</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Due</th>
                  <th className="py-2">Paid</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-t border-gray-100 dark:border-neutral-800"
                  >
                    <td className="py-2 font-semibold text-gray-900 dark:text-white">
                      {invoice.invoiceNumber || "—"}
                    </td>
                    <td className="py-2">{invoice.billingPeriod?.label || "—"}</td>
                    <td className="py-2">
                      {formatMoney(invoice.paidAmount ?? invoice.amount, invoice.currency)}
                    </td>
                    <td className="py-2">{formatDate(invoice.dueDate)}</td>
                    <td className="py-2">{formatDate(invoice.paidAt)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${invoiceStatusTone(
                          invoice.status
                        )}`}
                      >
                        {invoiceStatusLabel(invoice.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!invoices.length ? (
                  <tr>
                    <td colSpan={6} className="py-5 text-center text-gray-500">
                      No invoices yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Billing Notes
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-neutral-300">
            Module access and pricing are managed by the platform team. For billing
            support or module changes, contact EatsDesk support.
          </p>
        </section>
      </div>
    </AdminLayout>
  );
}

