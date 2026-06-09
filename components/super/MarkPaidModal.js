import { useState } from "react";
import { Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { updateSuperInvoiceStatus } from "../../lib/apiClient";

export default function MarkPaidModal({ invoice, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);
  const [paidAmount, setPaidAmount] = useState(
    String(invoice?.amount ?? ""),
  );
  const [paidAt, setPaidAt] = useState(today);
  const [paymentNote, setPaymentNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!invoice?.id) return;
    setLoading(true);
    try {
      const updated = await updateSuperInvoiceStatus(invoice.id, {
        status: "PAID",
        paidAt,
        paidAmount: Number(paidAmount),
        paymentNote: paymentNote.trim() || undefined,
      });
      toast.success(`${invoice.invoiceNumber} marked as paid`);
      onSuccess?.(updated);
      onClose?.();
    } catch (err) {
      toast.error(err.message || "Failed to update invoice");
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
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Mark as Paid
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{invoice?.invoiceNumber}</p>
          </div>
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
            <label className="text-xs font-semibold text-gray-500">
              Amount Received (Rs)
            </label>
            <input
              type="number"
              min="0"
              required
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">
              Date Paid
            </label>
            <input
              type="date"
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">
              Payment Note (optional)
            </label>
            <input
              type="text"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Bank transfer ref, etc."
              className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
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
              className="flex-1 h-10 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm Payment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
