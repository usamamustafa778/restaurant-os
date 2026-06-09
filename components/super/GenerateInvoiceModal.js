import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { createSuperInvoice } from "../../lib/apiClient";
import { downloadInvoicePDF } from "./InvoicePDF";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const PLAN_AMOUNTS = {
  ESSENTIAL: 10000,
  PROFESSIONAL: 15000,
  ENTERPRISE: 25000,
};

function defaultDueDate(year, month) {
  const d = new Date(year, month - 1, 10);
  return d.toISOString().slice(0, 10);
}

export default function GenerateInvoiceModal({ restaurant, onClose, onSuccess }) {
  const now = new Date();
  const initialMonth = now.getMonth() + 1;
  const initialYear = now.getFullYear();
  const plan = restaurant?.subscription?.plan || "ESSENTIAL";

  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [amount, setAmount] = useState(
    PLAN_AMOUNTS[plan] || PLAN_AMOUNTS.ESSENTIAL,
  );
  const [dueDate, setDueDate] = useState(defaultDueDate(initialYear, initialMonth));
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const restaurantName = restaurant?.website?.name || "Restaurant";
  const ownerName = restaurant?.ownerAccount?.displayName || "—";
  const ownerEmail =
    restaurant?.ownerAccount?.loginEmail ||
    restaurant?.website?.contactEmail ||
    "—";

  const yearOptions = useMemo(() => {
    const ys = [];
    for (let y = initialYear - 1; y <= initialYear + 2; y += 1) ys.push(y);
    return ys;
  }, [initialYear]);

  function handleMonthYearChange(nextMonth, nextYear) {
    setMonth(nextMonth);
    setYear(nextYear);
    setDueDate(defaultDueDate(nextYear, nextMonth));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!restaurant?.id) return;
    setLoading(true);
    try {
      const invoice = await createSuperInvoice({
        restaurantId: restaurant.id,
        billingPeriod: { month, year },
        amount: Number(amount),
        dueDate,
        notes: notes.trim() || undefined,
        sendEmail,
      });
      try {
        await downloadInvoicePDF(invoice);
      } catch (pdfErr) {
        console.error(pdfErr);
        toast.error("Invoice saved but PDF download failed");
      }
      const emailNote =
        sendEmail && invoice.status === "SENT"
          ? " Email sent to owner."
          : sendEmail && invoice.status === "DRAFT"
            ? " Email could not be sent — invoice saved as draft."
            : "";
      toast.success(`Invoice ${invoice.invoiceNumber} generated.${emailNote}`);
      onSuccess?.(invoice);
      onClose?.();
    } catch (err) {
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose?.();
      }}
    >
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Generate Invoice
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              Restaurant
            </label>
            <div className="mt-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm">
              {restaurantName} — {ownerName}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              Email
            </label>
            <div className="mt-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm font-mono truncate">
              {ownerEmail}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              Plan
            </label>
            <div className="mt-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm">
              {plan}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              Billing Period
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <select
                value={month}
                onChange={(e) =>
                  handleMonthYearChange(Number(e.target.value), year)
                }
                className="h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) =>
                  handleMonthYearChange(month, Number(e.target.value))
                }
                className="h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              Amount (Rs)
            </label>
            <input
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              Due Date
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-gray-300"
            />
            Send email to owner
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-10 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate Invoice →"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
