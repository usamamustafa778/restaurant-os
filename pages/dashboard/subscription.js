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
    key: "starter_monthly",
    label: "Starter",
    days: 30,
    price: "$39",
    monthlyEquivalent: "$39",
    icon: Zap,
    badge: null,
    features: ["Single Branch", "Basic POS", "Order Management", "Customer Database", "Email Support"],
  },
  {
    key: "professional_monthly",
    label: "Professional",
    days: 30,
    price: "$79",
    monthlyEquivalent: "$79",
    icon: Crown,
    badge: "Popular",
    features: ["Up to 5 Branches", "Full POS + KDS", "Inventory Management", "Analytics & Reports", "Integrations (Foodpanda)", "Custom Website", "Priority Support"],
  },
  {
    key: "enterprise_quarterly",
    label: "Enterprise",
    days: 90,
    price: "$399",
    monthlyEquivalent: "$133",
    icon: Shield,
    badge: "Best Value",
    features: ["Unlimited Branches", "Advanced Analytics", "Multi-user Management", "API Access", "White-label Options", "Dedicated Support", "Custom Features"],
    savings: "Save $138 vs monthly",
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
      bg: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-500/30",
      icon: Clock,
    },
    active: {
      label: "Active",
      bg: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-500/30",
      icon: CheckCircle2,
    },
    expired: {
      label: "Expired (Read-only)",
      bg: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-2 border-red-200 dark:border-red-500/30",
      icon: AlertTriangle,
    },
  };
  const s = map[status] || map.expired;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base font-bold shadow-sm ${s.bg}`}>
      <Icon className="w-5 h-5" />
      {s.label}
    </span>
  );
}

function RequestStatusBadge({ status }) {
  const map = {
    pending: "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/30",
    approved: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30",
    rejected: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold capitalize ${map[status] || map.pending}`}>
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
    <AdminLayout title="Subscription">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* Current Status Card */}
        <div className="bg-gradient-to-br from-primary/5 via-white to-secondary/5 dark:from-primary/10 dark:via-neutral-950 dark:to-secondary/10 rounded-2xl border-2 border-gray-200 dark:border-neutral-800 p-6 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-wider text-gray-600 dark:text-neutral-400 font-bold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Current Status
              </p>
              <StatusBadge status={subStatus?.currentStatus} />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-neutral-400">Current Plan</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{subStatus?.plan || "Essential"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
            {/* Trial Info */}
            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-5 border-2 border-primary/20 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Free Trial Period
                </span>
              </div>
              <div className="text-base text-gray-700 dark:text-neutral-300 space-y-2">
                <p className="flex justify-between">
                  <span>Start:</span>
                  <strong>{formatDate(subStatus?.freeTrialStartDate)}</strong>
                </p>
                <p className="flex justify-between">
                  <span>End:</span>
                  <strong>{formatDate(subStatus?.freeTrialEndDate)}</strong>
                </p>
                {trialDays > 0 && subStatus?.currentStatus === "trial_active" && (
                  <div className="mt-3 pt-3 border-t-2 border-blue-200 dark:border-blue-500/20">
                    <p className="text-blue-700 dark:text-blue-400 font-bold text-lg">
                      {trialDays} day{trialDays !== 1 ? "s" : ""} remaining
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Info */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 rounded-xl p-5 border-2 border-emerald-200 dark:border-emerald-500/20 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Active Subscription
                </span>
              </div>
              <div className="text-base text-gray-700 dark:text-neutral-300 space-y-2">
                <p className="flex justify-between">
                  <span>Start:</span>
                  <strong>{formatDate(subStatus?.subscriptionStartDate)}</strong>
                </p>
                <p className="flex justify-between">
                  <span>End:</span>
                  <strong>{formatDate(subStatus?.subscriptionEndDate)}</strong>
                </p>
                {subDays > 0 && subStatus?.currentStatus === "active" && (
                  <div className="mt-3 pt-3 border-t-2 border-emerald-200 dark:border-emerald-500/20">
                    <p className="text-emerald-700 dark:text-emerald-400 font-bold text-lg">
                      {subDays} day{subDays !== 1 ? "s" : ""} remaining
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Read-only warning */}
          {subStatus?.readonly && (
            <div className="mt-5 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-500/10 dark:to-red-500/5 rounded-xl p-5 border-2 border-red-200 dark:border-red-500/30 flex items-start gap-4 shadow-lg">
              <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="font-bold text-base mb-1">Account in Read-Only Mode</p>
                <p>You can view your data but cannot create, edit, or delete anything. Please subscribe to restore full access.</p>
              </div>
            </div>
          )}
        </div>

        {/* Plan Cards */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Choose Your Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    relative text-left rounded-2xl border-2 p-6 transition-all group
                    ${isSelected
                      ? "border-primary shadow-2xl shadow-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 scale-105"
                      : "border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 hover:border-primary/50 hover:shadow-xl hover:scale-105"
                    }
                    ${hasPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 right-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                      {plan.badge}
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                      isSelected ? "bg-gradient-to-br from-primary to-secondary" : "bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-primary group-hover:to-secondary"
                    }`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Selected
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.label}</div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <div className="text-4xl font-bold text-primary">{plan.price}</div>
                    {plan.days > 30 && (
                      <div className="text-sm text-gray-500 dark:text-neutral-400">/{plan.days === 90 ? '3 months' : plan.days === 180 ? '6 months' : `${plan.days}d`}</div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-neutral-400 mb-4">
                    {plan.monthlyEquivalent}/month {plan.savings && <span className="text-emerald-600 dark:text-emerald-400">• {plan.savings}</span>}
                  </div>
                  
                  {/* Features list */}
                  {plan.features && (
                    <ul className="space-y-2 mt-4 pt-4 border-t-2 border-gray-100 dark:border-neutral-800">
                      {plan.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                      {plan.features.length > 4 && (
                        <li className="text-xs text-gray-500 dark:text-neutral-500 pl-6">
                          +{plan.features.length - 4} more features
                        </li>
                      )}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
          {hasPending && (
            <div className="mt-5 flex items-center gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 border-2 border-yellow-200 dark:border-yellow-500/20">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                You have a pending request. Please wait for approval before submitting a new one.
              </p>
            </div>
          )}
        </div>

        {/* Payment Method Tabs + Upload & Submit */}
        {selectedPlan && !hasPending && (
          <div className="bg-white dark:bg-neutral-950 rounded-2xl border-2 border-gray-200 dark:border-neutral-800 p-6 space-y-6 shadow-lg">
            {/* Payment Method Tabs */}
            {paymentMethods.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Wallet className="w-6 h-6" /> Select Payment Method
                </h3>
                {/* Tabs */}
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setSelectedPaymentMethod(pm.id)}
                      className={`
                        px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex-shrink-0
                        ${selectedPaymentMethod === pm.id
                          ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30"
                          : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
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
                    <div className="mt-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl p-5 border-2 border-primary/20 shadow-inner">
                      <p className="text-sm font-bold uppercase tracking-wider text-primary mb-4 flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        {activePm.name} Account Details
                      </p>
                      <div className="space-y-3">
                        {activePm.fields.map((f, i) => {
                          const fKey = `${activePm.id}-${i}`;
                          return (
                            <div key={i} className="flex items-center justify-between gap-3 bg-white dark:bg-neutral-900 rounded-xl px-4 py-3.5 border-2 border-gray-200 dark:border-neutral-700 shadow-sm">
                              <div className="min-w-0">
                                <span className="text-xs text-gray-500 dark:text-neutral-500 block font-semibold mb-1">{f.label}</span>
                                <span className="text-base font-bold text-gray-900 dark:text-white break-all">{f.value}</span>
                              </div>
                              <button
                                onClick={() => handleCopy(f.value, fKey)}
                                className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                                title="Copy"
                              >
                                {copiedField === fKey ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                          💰 Transfer <strong className="text-lg">{PLANS.find((p) => p.key === selectedPlan)?.price}</strong> to the account above
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Then upload payment screenshot below to activate your subscription</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Upload Section */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Payment Screenshot
              </h3>
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                {paymentMethods.length > 0
                  ? "After transferring, upload a screenshot of the payment confirmation"
                  : `Transfer the amount for ${PLANS.find((p) => p.key === selectedPlan)?.label} and upload a screenshot`}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="w-full cursor-pointer">
                <div className={`
                  border-2 border-dashed rounded-2xl p-8 text-center transition-all hover:shadow-lg
                  ${screenshotPreview
                    ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10"
                    : "border-gray-300 dark:border-neutral-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-neutral-900"
                  }
                `}>
                  {screenshotPreview ? (
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshotPreview} alt="Screenshot preview" className="max-h-64 mx-auto rounded-xl shadow-xl border-2 border-emerald-200 dark:border-emerald-500/30" />
                      <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Screenshot uploaded · Click to change
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                          Click to upload or drag & drop
                        </p>
                        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">PNG, JPG up to 5MB</p>
                      </div>
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
              <div className={`rounded-xl p-4 text-sm font-medium border-2 ${
                submitMsg.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                  : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30"
              }`}>
                {submitMsg.text}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!screenshotFile || submitting}
              className={`
                w-full px-6 py-4 rounded-2xl font-bold text-base text-white transition-all flex items-center justify-center gap-2 shadow-xl
                ${!screenshotFile || submitting
                  ? "bg-gray-300 dark:bg-neutral-700 cursor-not-allowed opacity-50"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-2xl hover:shadow-emerald-500/40 hover:-translate-y-1 shadow-emerald-500/30"
                }
              `}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Submitting Payment...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" /> Submit Payment Request
                </>
              )}
            </button>
          </div>
        )}

        {/* History Toggle */}
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-all"
          >
            <History className="w-5 h-5" />
            Subscription History
            <ChevronRight className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`} />
          </button>

          {showHistory && history?.requests && (
            <div className="mt-4 bg-white dark:bg-neutral-950 rounded-2xl border-2 border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
              {history.requests.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-3">
                    <History className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No subscription requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-neutral-900/50 dark:to-neutral-900/30">
                      <tr>
                        <th className="px-5 py-4 text-left font-bold text-gray-700 dark:text-neutral-300">Plan</th>
                        <th className="px-5 py-4 text-left font-bold text-gray-700 dark:text-neutral-300">Method</th>
                        <th className="px-5 py-4 text-center font-bold text-gray-700 dark:text-neutral-300">Status</th>
                        <th className="px-5 py-4 text-left font-bold text-gray-700 dark:text-neutral-300">Requested</th>
                        <th className="px-5 py-4 text-left font-bold text-gray-700 dark:text-neutral-300">Approved</th>
                        <th className="px-5 py-4 text-center font-bold text-gray-700 dark:text-neutral-300">Screenshot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-gray-100 dark:divide-neutral-800">
                      {history.requests.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-gray-900 dark:text-white capitalize">
                              {r.planType.replace("_", " ")}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-neutral-500">{r.durationInDays} days</span>
                          </td>
                          <td className="px-5 py-4 text-gray-600 dark:text-neutral-400">{r.paymentMethodName || "—"}</td>
                          <td className="px-5 py-4 text-center"><RequestStatusBadge status={r.status} /></td>
                          <td className="px-5 py-4 text-gray-600 dark:text-neutral-400">{formatDate(r.createdAt)}</td>
                          <td className="px-5 py-4 text-gray-600 dark:text-neutral-400">{formatDate(r.approvedAt)}</td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {r.paymentScreenshot ? (
                                <a
                                  href={r.paymentScreenshot}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-semibold"
                                >
                                  <ImageIcon className="w-4 h-4" /> View
                                </a>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                              {r.status === "pending" && (
                                <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 font-semibold flex items-center gap-1 transition-colors">
                                  {reuploadingId === r.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5" />
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
