import { useEffect, useState, useCallback } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  getSuperSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  getSuperSubscriptionHistory,
  getSuperPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Image as ImageIcon,
  CreditCard,
  Eye,
  AlertTriangle,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Wallet,
} from "lucide-react";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RequestStatusBadge({ status }) {
  const map = {
    pending: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", icon: Clock },
    approved: { bg: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: CheckCircle2 },
    rejected: { bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", icon: XCircle },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${s.bg}`}>
      <Icon size={12} />
      {status}
    </span>
  );
}

function SubStatusBadge({ status, readonly }) {
  if (readonly) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <AlertTriangle size={11} /> Read-only
      </span>
    );
  }
  const map = {
    TRIAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    EXPIRED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    SUSPENDED: "bg-bg-primary text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.EXPIRED}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

export default function SuperSubscriptionsPage() {
  const [tab, setTab] = useState("requests"); // requests | history | payment_methods
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const { confirm } = useConfirmDialog();

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [showPmForm, setShowPmForm] = useState(false);
  const [editingPm, setEditingPm] = useState(null);
  const [pmForm, setPmForm] = useState({ name: "", fields: [{ label: "", value: "" }] });
  const [pmSaving, setPmSaving] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperSubscriptionRequests(statusFilter);
      setRequests(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperSubscriptionHistory();
      setHistory(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPaymentMethods = useCallback(async () => {
    setPmLoading(true);
    try {
      const data = await getSuperPaymentMethods();
      setPaymentMethods(data);
    } catch {
      /* ignore */
    } finally {
      setPmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "requests") loadRequests();
    else if (tab === "history") loadHistory();
    else if (tab === "payment_methods") loadPaymentMethods();
  }, [tab, loadRequests, loadHistory, loadPaymentMethods]);

  const handleApprove = async (id) => {
    const ok = await confirm({
      title: "Approve Subscription",
      message: "This will activate the restaurant's subscription and restore full access. Continue?",
      confirmLabel: "Approve",
    });
    if (!ok) return;

    setActionLoading(id);
    try {
      await approveSubscriptionRequest(id);
      loadRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    const ok = await confirm({
      title: "Reject Request",
      message: "Are you sure you want to reject this subscription request?",
      confirmLabel: "Reject",
    });
    if (!ok) return;

    setActionLoading(id);
    try {
      await rejectSubscriptionRequest(id);
      loadRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const resetPmForm = () => {
    setPmForm({ name: "", fields: [{ label: "", value: "" }] });
    setEditingPm(null);
    setShowPmForm(false);
  };

  const openEditPm = (pm) => {
    setEditingPm(pm.id);
    setPmForm({ name: pm.name, fields: pm.fields.map((f) => ({ label: f.label, value: f.value })) });
    setShowPmForm(true);
  };

  const handleSavePm = async () => {
    if (!pmForm.name.trim()) return;
    const validFields = pmForm.fields.filter((f) => f.label.trim() && f.value.trim());
    if (validFields.length === 0) return;

    setPmSaving(true);
    try {
      if (editingPm) {
        await updatePaymentMethod(editingPm, { name: pmForm.name, fields: validFields });
      } else {
        await createPaymentMethod({ name: pmForm.name, fields: validFields });
      }
      resetPmForm();
      loadPaymentMethods();
    } catch {
      /* ignore */
    } finally {
      setPmSaving(false);
    }
  };

  const handleDeletePm = async (id) => {
    const ok = await confirm({
      title: "Delete Payment Method",
      message: "Are you sure you want to delete this payment method?",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deletePaymentMethod(id);
      loadPaymentMethods();
    } catch {
      /* ignore */
    }
  };

  const handleTogglePm = async (pm) => {
    try {
      await updatePaymentMethod(pm.id, { isActive: !pm.isActive });
      loadPaymentMethods();
    } catch {
      /* ignore */
    }
  };

  const addPmField = () => {
    setPmForm((prev) => ({ ...prev, fields: [...prev.fields, { label: "", value: "" }] }));
  };

  const removePmField = (idx) => {
    setPmForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }));
  };

  const updatePmField = (idx, key, val) => {
    setPmForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === idx ? { ...f, [key]: val } : f)),
    }));
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard size={24} /> Subscription Management
          </h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm mt-1">
            Review payment requests and manage restaurant subscriptions.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-1 bg-bg-primary dark:bg-neutral-800 rounded-lg p-1 w-fit">
          {[
            { key: "requests", label: "Payment Requests" },
            { key: "history", label: "All Restaurants" },
            { key: "payment_methods", label: "Payment Methods" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-bg-secondary dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Requests Tab */}
        {tab === "requests" && (
          <div className="bg-bg-secondary dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            {/* Filter */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-neutral-400">Filter:</span>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm bg-bg-primary dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 pr-8 appearance-none cursor-pointer text-gray-700 dark:text-neutral-300"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All</option>
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : requests.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500 dark:text-neutral-400">
                No {statusFilter === "all" ? "" : statusFilter} requests found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-primary dark:bg-neutral-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                      <th className="px-4 py-3">Restaurant</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Via</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Requested</th>
                      <th className="px-4 py-3">Screenshot</th>
                      {statusFilter === "pending" && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {requests.map((r) => (
                      <tr key={r.id} className="hover:bg-bg-primary dark:hover:bg-neutral-800/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {r.restaurant?.name || "Unknown"}
                          </div>
                          <div className="text-xs text-gray-400">{r.restaurant?.subdomain}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-700 dark:text-neutral-300">
                          {r.planType?.replace("_", " ")}
                          <span className="block text-xs text-gray-400">{r.durationInDays} days</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">{r.paymentMethodName || "—"}</td>
                        <td className="px-4 py-3"><RequestStatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-gray-500 dark:text-neutral-400">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          {r.paymentScreenshot ? (
                            <button
                              onClick={() => setPreviewImg(r.paymentScreenshot)}
                              className="text-primary hover:text-red-500 flex items-center gap-1 text-xs"
                            >
                              <Eye size={14} /> View
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        {statusFilter === "pending" && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApprove(r.id)}
                                disabled={actionLoading === r.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                              >
                                {actionLoading === r.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={12} />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(r.id)}
                                disabled={actionLoading === r.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* History Tab – All Restaurants */}
        {tab === "history" && (
          <div className="bg-bg-secondary dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : history.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500 dark:text-neutral-400">
                No restaurants found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-primary dark:bg-neutral-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                      <th className="px-4 py-3">Restaurant</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Trial Period</th>
                      <th className="px-4 py-3">Subscription Period</th>
                      <th className="px-4 py-3">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {history.map((r) => (
                      <tr key={r.id} className="hover:bg-bg-primary dark:hover:bg-neutral-800/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{r.name || "Unknown"}</div>
                          <div className="text-xs text-gray-400">{r.subdomain}</div>
                        </td>
                        <td className="px-4 py-3">
                          <SubStatusBadge status={r.status} readonly={r.readonly} />
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">
                          {r.freeTrialStartDate ? (
                            <>
                              {formatDate(r.freeTrialStartDate)} → {formatDate(r.freeTrialEndDate)}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">
                          {r.subscriptionStartDate ? (
                            <>
                              {formatDate(r.subscriptionStartDate)} → {formatDate(r.subscriptionEndDate)}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payment Methods Tab */}
        {tab === "payment_methods" && (
          <div className="space-y-4">
            {/* Add new button */}
            {!showPmForm && (
              <button
                onClick={() => { resetPmForm(); setShowPmForm(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-secondary text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} /> Add Payment Method
              </button>
            )}

            {/* Form */}
            {showPmForm && (
              <div className="bg-bg-secondary dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {editingPm ? "Edit Payment Method" : "New Payment Method"}
                  </h3>
                  <button onClick={resetPmForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300">
                    <X size={18} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">
                    Method Name (e.g. Easypaisa, JazzCash, Bank Account)
                  </label>
                  <input
                    type="text"
                    value={pmForm.name}
                    onChange={(e) => setPmForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Easypaisa"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-bg-primary dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/60 outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400">
                    Account Details
                  </label>
                  {pmForm.fields.map((field, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updatePmField(idx, "label", e.target.value)}
                        placeholder="Label (e.g. Account Number)"
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-bg-primary dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/60 outline-none"
                      />
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => updatePmField(idx, "value", e.target.value)}
                        placeholder="Value (e.g. 03001234567)"
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-neutral-700 rounded-lg bg-bg-primary dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/60 outline-none"
                      />
                      {pmForm.fields.length > 1 && (
                        <button
                          onClick={() => removePmField(idx)}
                          className="mt-1.5 text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addPmField}
                    className="text-xs text-primary hover:text-red-500 font-medium flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSavePm}
                    disabled={pmSaving || !pmForm.name.trim()}
                    className="px-5 py-2 bg-primary hover:bg-secondary text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {pmSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {editingPm ? "Update" : "Create"}
                  </button>
                  <button
                    onClick={resetPmForm}
                    className="px-5 py-2 bg-bg-primary dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300 rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Payment Methods List */}
            <div className="bg-bg-secondary dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              {pmLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : paymentMethods.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500 dark:text-neutral-400">
                  No payment methods added yet.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                  {paymentMethods.map((pm) => (
                    <div key={pm.id} className="p-4 hover:bg-bg-primary dark:hover:bg-neutral-800/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Wallet size={16} className="text-primary flex-shrink-0" />
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{pm.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              pm.isActive
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-bg-primary text-gray-500 dark:bg-neutral-800 dark:text-neutral-500"
                            }`}>
                              {pm.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-6">
                            {pm.fields.map((f, i) => (
                              <div key={i} className="text-xs text-gray-500 dark:text-neutral-400">
                                <span className="font-medium text-gray-700 dark:text-neutral-300">{f.label}:</span>{" "}
                                {f.value}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleTogglePm(pm)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                              pm.isActive
                                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                            }`}
                          >
                            {pm.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => openEditPm(pm)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePm(pm.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewImg && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setPreviewImg(null)}
          >
            <div className="relative max-w-2xl max-h-[80vh] bg-bg-secondary dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewImg(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
              >
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImg} alt="Payment Screenshot" className="max-h-[75vh] w-full object-contain" />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
