import { useEffect, useState, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getSubscriptionStatus,
  submitSubscriptionRequest,
  updateSubscriptionScreenshot,
  getSubscriptionHistory,
  getPaymentMethods,
  uploadImage,
} from "../../lib/apiClient";
import {
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Loader2,
  Crown,
  Shield,
  Zap,
  ChevronRight,
  History,
  Image as ImageIcon,
  Wallet,
  Copy,
  Check,
} from "lucide-react";

const PLANS = [
  {
    key: "1_month",
    label: "1 Month",
    days: 30,
    price: "PKR 2,999",
    icon: Zap,
    badge: null,
  },
  {
    key: "3_month",
    label: "3 Months",
    days: 90,
    price: "PKR 7,999",
    icon: Crown,
    badge: "Popular",
  },
  {
    key: "6_month",
    label: "6 Months",
    days: 180,
    price: "PKR 13,999",
    icon: Shield,
    badge: "Best Value",
  },
];

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysRemaining(endDate) {
  if (!endDate) return 0;
  const diff = new Date(endDate) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function StatusBadge({ status }) {
  const map = {
    trial_active: {
      label: "Trial Active",
      bg: "bg-primary/10 text-primary",
      icon: Clock,
    },
    active: {
      label: "Active",
      bg: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
      icon: CheckCircle2,
    },
    expired: {
      label: "Expired (Read-only)",
      bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      icon: AlertTriangle,
    },
  };
  const s = map[status] || map.expired;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${s.bg}`}>
      <Icon size={14} />
      {s.label}
    </span>
  );
}

function RequestStatusBadge({ status }) {
  const map = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] || map.pending}`}>
      {status}
    </span>
  );
}

export default function SubscriptionPage() {
  const [subStatus, setSubStatus] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [reuploadingId, setReuploadingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [status, hist, methods] = await Promise.all([
        getSubscriptionStatus(),
        getSubscriptionHistory(),
        getPaymentMethods(),
      ]);
      setSubStatus(status);
      setHistory(hist);
      setPaymentMethods(methods || []);
      // Auto-select first payment method
      if (methods && methods.length > 0) {
        setSelectedPaymentMethod(methods[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleCopy = (text, fieldKey) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleSubmit = async () => {
    if (!selectedPlan || !screenshotFile) return;
    try {
      setSubmitting(true);
      setSubmitMsg(null);

      // Upload screenshot first
      const { url } = await uploadImage(screenshotFile);

      // Submit subscription request
      const result = await submitSubscriptionRequest({
        planType: selectedPlan,
        paymentScreenshot: url,
        paymentMethodId: selectedPaymentMethod || undefined,
      });

      setSubmitMsg({ type: "success", text: result.message });
      setSelectedPlan(null);
      setScreenshotFile(null);
      setScreenshotPreview(null);
      loadData();
    } catch (err) {
      setSubmitMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReupload = async (requestId, file) => {
    if (!file) return;
    try {
      setReuploadingId(requestId);
      const { url } = await uploadImage(file);
      await updateSubscriptionScreenshot(requestId, url);
      loadData();
    } catch {
      /* ignore */
    } finally {
      setReuploadingId(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">
            {error}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const trialEnd = subStatus?.freeTrialEndDate;
  const subEnd = subStatus?.subscriptionEndDate;
  const trialDays = daysRemaining(trialEnd);
  const subDays = daysRemaining(subEnd);

  const hasPending = history?.requests?.some((r) => r.status === "pending");

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription</h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm mt-1">
            Manage your subscription plan and billing.
          </p>
        </div>

        {/* Current Status Card */}
        <div className="bg-bg-secondary dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500 font-medium mb-2">
                Current Status
              </p>
              <StatusBadge status={subStatus?.currentStatus} />
            </div>
            <div className="text-sm text-gray-500 dark:text-neutral-400">
              Plan: <span className="font-medium text-gray-900 dark:text-white">{subStatus?.plan || "Essential"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            {/* Trial Info */}
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-primary">
                  Free Trial
                </span>
              </div>
              <div className="text-sm text-gray-700 dark:text-neutral-300 space-y-1">
                <p>Start: <strong>{formatDate(subStatus?.freeTrialStartDate)}</strong></p>
                <p>End: <strong>{formatDate(subStatus?.freeTrialEndDate)}</strong></p>
                {trialDays > 0 && subStatus?.currentStatus === "trial_active" && (
                  <p className="text-primary font-medium mt-1">
                    {trialDays} day{trialDays !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </div>
            </div>

            {/* Subscription Info */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-800/40">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={16} className="text-green-500" />
                <span className="text-xs font-medium uppercase tracking-wider text-green-600 dark:text-green-400">
                  Subscription
                </span>
              </div>
              <div className="text-sm text-gray-700 dark:text-neutral-300 space-y-1">
                <p>Start: <strong>{formatDate(subStatus?.subscriptionStartDate)}</strong></p>
                <p>End: <strong>{formatDate(subStatus?.subscriptionEndDate)}</strong></p>
                {subDays > 0 && subStatus?.currentStatus === "active" && (
                  <p className="text-green-600 dark:text-green-400 font-medium mt-1">
                    {subDays} day{subDays !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Read-only warning */}
          {subStatus?.readonly && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800/40 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <strong>Your account is in read-only mode.</strong> You can view your data but cannot create, edit, or delete anything.
                Please subscribe to restore full access.
              </div>
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Choose a Plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.key;
              const Icon = plan.icon;
              return (
                <button
                  key={plan.key}
                  onClick={() => {
                    setSelectedPlan(isSelected ? null : plan.key);
                    setSubmitMsg(null);
                  }}
                  disabled={hasPending}
                  className={`
                    relative text-left rounded-xl border-2 p-5 transition-all
                    ${isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-gray-200 dark:border-neutral-700 bg-bg-secondary dark:bg-neutral-900 hover:border-gray-300 dark:hover:border-neutral-600"
                    }
                    ${hasPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 right-3 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center mb-3">
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{plan.label}</div>
                  <div className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">{plan.days} days</div>
                  <div className="text-xl font-bold mt-3 text-primary">{plan.price}</div>
                  {isSelected && (
                    <div className="mt-2 text-xs text-primary font-medium flex items-center gap-1">
                      <CheckCircle2 size={12} /> Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {hasPending && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-3 flex items-center gap-1.5">
              <Clock size={14} />
              You have a pending request. Please wait for approval before submitting a new one.
            </p>
          )}
        </div>

        {/* Payment Method Tabs + Upload & Submit */}
        {selectedPlan && !hasPending && (
          <div className="bg-bg-secondary dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-5 space-y-5">
            {/* Payment Method Tabs */}
            {paymentMethods.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Wallet size={18} /> Select Payment Method
                </h3>
                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setSelectedPaymentMethod(pm.id)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0
                        ${selectedPaymentMethod === pm.id
                          ? "bg-primary text-white shadow-sm"
                          : "bg-bg-primary dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
                        }
                      `}
                    >
                      {pm.name}
                    </button>
                  ))}
                </div>

                {/* Selected Payment Method Details */}
                {(() => {
                  const activePm = paymentMethods.find((pm) => pm.id === selectedPaymentMethod);
                  if (!activePm) return null;
                  return (
                    <div className="mt-3 bg-primary/5 rounded-lg p-4 border border-primary/10">
                      <p className="text-xs font-medium uppercase tracking-wider text-primary mb-3">
                        {activePm.name} Account Details
                      </p>
                      <div className="space-y-2">
                        {activePm.fields.map((f, i) => {
                          const fKey = `${activePm.id}-${i}`;
                          return (
                            <div key={i} className="flex items-center justify-between gap-3 bg-bg-secondary dark:bg-neutral-900 rounded-lg px-3 py-2.5 border border-primary/10">
                              <div className="min-w-0">
                                <span className="text-[11px] text-gray-500 dark:text-neutral-500 block">{f.label}</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white break-all">{f.value}</span>
                              </div>
                              <button
                                onClick={() => handleCopy(f.value, fKey)}
                                className="flex-shrink-0 p-1.5 rounded-md hover:bg-bg-primary dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                                title="Copy"
                              >
                                {copiedField === fKey ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-primary mt-3">
                        Transfer <strong>{PLANS.find((p) => p.key === selectedPlan)?.price}</strong> to the account above and upload the screenshot below.
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Upload Section */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Upload Payment Screenshot</h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                {paymentMethods.length > 0
                  ? "After transferring, upload a screenshot of the payment confirmation."
                  : `Transfer the amount for ${PLANS.find((p) => p.key === selectedPlan)?.label} and upload a screenshot.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <label className="flex-1 w-full">
                <div className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${screenshotPreview
                    ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
                    : "border-gray-300 dark:border-neutral-600 hover:border-gray-400 dark:hover:border-neutral-500"
                  }
                `}>
                  {screenshotPreview ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshotPreview} alt="Screenshot preview" className="max-h-48 mx-auto rounded-lg shadow" />
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={28} className="mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 dark:text-neutral-400">
                        Click to upload or drag & drop
                      </p>
                      <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {submitMsg && (
              <div className={`rounded-lg p-3 text-sm ${
                submitMsg.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
              }`}>
                {submitMsg.text}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!screenshotFile || submitting}
              className={`
                w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium text-sm text-white transition-colors flex items-center justify-center gap-2
                ${!screenshotFile || submitting
                  ? "bg-gray-300 dark:bg-neutral-700 cursor-not-allowed"
                  : "bg-primary hover:bg-secondary"
                }
              `}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CreditCard size={16} /> Submit Payment
                </>
              )}
            </button>
          </div>
        )}

        {/* History Toggle */}
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <History size={16} />
            Subscription History
            <ChevronRight size={14} className={`transition-transform ${showHistory ? "rotate-90" : ""}`} />
          </button>

          {showHistory && history?.requests && (
            <div className="mt-3 bg-bg-secondary dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              {history.requests.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-neutral-400 text-center">No subscription requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-primary dark:bg-neutral-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Requested</th>
                        <th className="px-4 py-3">Approved</th>
                        <th className="px-4 py-3">Screenshot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {history.requests.map((r) => (
                        <tr key={r.id} className="hover:bg-bg-primary dark:hover:bg-neutral-800/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white capitalize">
                            {r.planType.replace("_", " ")}
                            <span className="block text-xs text-gray-400 font-normal">{r.durationInDays} days</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-neutral-400 text-xs">{r.paymentMethodName || "—"}</td>
                          <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
                          <td className="px-4 py-3 text-gray-500 dark:text-neutral-400">{formatDate(r.createdAt)}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-neutral-400">{formatDate(r.approvedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {r.paymentScreenshot ? (
                                <a
                                  href={r.paymentScreenshot}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <ImageIcon size={14} /> View
                                </a>
                              ) : (
                                "—"
                              )}
                              {r.status === "pending" && (
                                <label className="cursor-pointer text-xs text-gray-500 hover:text-primary font-medium flex items-center gap-1">
                                  {reuploadingId === r.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Upload size={12} />
                                  )}
                                  Change
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleReupload(r.id, file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
