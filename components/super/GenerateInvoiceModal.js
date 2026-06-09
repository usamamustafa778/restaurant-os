import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Mail, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  createSuperInvoice,
  sendSuperInvoiceEmail,
} from "../../lib/apiClient";
import {
  downloadInvoicePDF,
  getInvoicePDFBlobUrl,
  resolveInvoiceBankDetails,
  viewInvoicePDF,
} from "./InvoicePDF";

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

const LABEL_CLASS =
  "block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1";
const INPUT_CLASS =
  "w-full border border-gray-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500";

function defaultDueDate(year, month) {
  const d = new Date(year, month - 1, 10);
  return d.toISOString().slice(0, 10);
}

function formatAmountDisplay(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "";
  return Math.round(num).toLocaleString("en-PK");
}

function parseAmountInput(raw) {
  const cleaned = String(raw || "").replace(/,/g, "").replace(/\D/g, "");
  if (!cleaned) return 0;
  return Number(cleaned);
}

function formatDueDateLong(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDueDateShort(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatInvoiceDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function GenerateInvoiceModal({ restaurant, onClose, onSuccess }) {
  const now = new Date();
  const initialMonth = now.getMonth() + 1;
  const initialYear = now.getFullYear();
  const plan = restaurant?.subscription?.plan || "ESSENTIAL";

  const [step, setStep] = useState("form");
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [amount, setAmount] = useState(
    PLAN_AMOUNTS[plan] || PLAN_AMOUNTS.ESSENTIAL,
  );
  const [dueDate, setDueDate] = useState(defaultDueDate(initialYear, initialMonth));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

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

  const billingPeriodLabel = useMemo(() => {
    const monthLabel =
      MONTHS.find((m) => m.value === month)?.label || String(month);
    return `${monthLabel} ${year}`;
  }, [month, year]);

  const dueDateLong = formatDueDateLong(dueDate);
  const dueDateShort = formatDueDateShort(dueDate);
  const amountDisplay = formatAmountDisplay(amount);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleMonthYearChange(nextMonth, nextYear) {
    setMonth(nextMonth);
    setYear(nextYear);
    setDueDate(defaultDueDate(nextYear, nextMonth));
  }

  function handleAmountChange(e) {
    setAmount(parseAmountInput(e.target.value));
  }

  async function loadPreview(invoice) {
    setPreviewLoading(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = await getInvoicePDFBlobUrl(invoice);
      setPreviewUrl(url);
    } catch (err) {
      console.error(err);
      toast.error("Could not render invoice preview");
    } finally {
      setPreviewLoading(false);
    }
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
        sendEmail: false,
      });
      setGeneratedInvoice(invoice);
      setStep("review");
      toast.success(`Invoice ${invoice.invoiceNumber} created as draft.`);
      await loadPreview(invoice);
    } catch (err) {
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenPdf() {
    if (!generatedInvoice) return;
    setDownloading(true);
    try {
      await viewInvoicePDF(generatedInvoice);
    } catch (err) {
      toast.error(err.message || "Could not open PDF");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!generatedInvoice) return;
    setDownloading(true);
    try {
      await downloadInvoicePDF(generatedInvoice);
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error(err.message || "PDF download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSendEmail() {
    if (!generatedInvoice?.id) return;
    setSendingEmail(true);
    try {
      await sendSuperInvoiceEmail(generatedInvoice.id);
      setGeneratedInvoice((prev) =>
        prev ? { ...prev, status: "SENT" } : prev,
      );
      toast.success(`Invoice emailed to ${ownerEmail}`);
    } catch (err) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  }

  function handleDone() {
    onSuccess?.(generatedInvoice);
    onClose?.();
  }

  const bank = resolveInvoiceBankDetails(generatedInvoice?.bankDetails);
  const snap = generatedInvoice?.snapshot || {};
  const isSent = generatedInvoice?.status === "SENT";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          !loading &&
          !sendingEmail &&
          !downloading
        ) {
          if (step === "review") handleDone();
          else onClose?.();
        }
      }}
    >
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-950 z-10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {step === "form" ? "Generate Invoice" : "Review Invoice"}
          </h2>
          <button
            type="button"
            onClick={step === "review" ? handleDone : onClose}
            disabled={loading || sendingEmail}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "form" ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {restaurantName} — {ownerName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 truncate mt-0.5">
                    {ownerEmail}
                  </p>
                </div>
                <span className="shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                  {plan}
                </span>
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Billing Period</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={month}
                  onChange={(e) =>
                    handleMonthYearChange(Number(e.target.value), year)
                  }
                  className={INPUT_CLASS}
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
                  className={INPUT_CLASS}
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
              <label className={LABEL_CLASS} htmlFor="invoice-amount">
                Amount
              </label>
              <div className="flex items-center rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500">
                <span className="pl-3 text-sm text-gray-500 dark:text-neutral-400 shrink-0">
                  Rs
                </span>
                <input
                  id="invoice-amount"
                  type="text"
                  inputMode="numeric"
                  required
                  value={amountDisplay}
                  onChange={handleAmountChange}
                  className="flex-1 min-w-0 border-0 bg-transparent py-2 pr-3 text-sm text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="invoice-due-date">
                Due Date
              </label>
              <input
                id="invoice-due-date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={INPUT_CLASS}
              />
              {dueDateLong ? (
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  Due on {dueDateLong}
                </p>
              ) : null}
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="invoice-notes">
                Notes (optional)
              </label>
              <textarea
                id="invoice-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${INPUT_CLASS} resize-none`}
              />
            </div>

            <div className="rounded-lg border border-dashed border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/20 p-3">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">
                Invoice Preview
              </p>
              <p className="text-sm text-gray-700 dark:text-neutral-300">
                <span className="font-medium">{restaurantName}</span>
                {" · "}
                {billingPeriodLabel}
                {" · "}
                <span className="font-bold">Rs {amountDisplay || "0"}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                Due: {dueDateShort || "—"}
                {" · "}
                Invoice #EDS-XXX
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Invoice will be saved as a draft. You can review it, then download
              or email it to the owner.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full sm:flex-1 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !amount}
                className="w-full sm:flex-1 py-2 rounded-lg bg-[#FF5400] hover:bg-[#e64d00] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
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
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                  #{generatedInvoice?.invoiceNumber}
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                  {snap.restaurantName || restaurantName}
                  {" · "}
                  {generatedInvoice?.billingPeriod?.label || billingPeriodLabel}
                </p>
              </div>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isSent
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300"
                }`}
              >
                {generatedInvoice?.status || "DRAFT"}
              </span>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 overflow-hidden">
              {previewLoading ? (
                <div className="flex items-center justify-center h-[420px] gap-2 text-sm text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  Loading preview…
                </div>
              ) : previewUrl ? (
                <iframe
                  title="Invoice preview"
                  src={previewUrl}
                  className="w-full h-[420px] bg-white"
                />
              ) : (
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-bold text-primary">
                      Rs {formatAmountDisplay(generatedInvoice?.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due date</span>
                    <span>{formatInvoiceDate(generatedInvoice?.dueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bill to</span>
                    <span className="text-right">{ownerEmail}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-3 text-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Payment details
              </p>
              <p className="text-gray-800 dark:text-neutral-200">
                <span className="text-gray-500">Account:</span>{" "}
                {bank.accountTitle}
              </p>
              <p className="text-gray-800 dark:text-neutral-200 mt-1">
                <span className="text-gray-500">Bank:</span> {bank.bankName}
              </p>
              <p className="text-gray-800 dark:text-neutral-200 mt-1 font-mono text-xs font-semibold">
                <span className="text-gray-500 font-sans font-normal">IBAN:</span>{" "}
                {bank.iban}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenPdf}
                disabled={downloading}
                className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm font-semibold text-gray-800 dark:text-neutral-200 inline-flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Open PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm font-semibold text-gray-700 dark:text-neutral-300 inline-flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail || isSent}
                className="w-full py-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-sm font-semibold text-blue-700 dark:text-blue-300 inline-flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-950/50 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {isSent ? "Email sent" : `Send via Email to ${ownerEmail}`}
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="w-full py-2.5 rounded-lg bg-[#FF5400] hover:bg-[#e64d00] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
