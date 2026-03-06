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
import SuperAdminTable from "../../../components/ui/SuperAdminTable";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CreditCard,
  Eye,
  AlertTriangle,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Wallet,
  Search,
  FileDown,
} from "lucide-react";
import toast from "react-hot-toast";

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
  const [searchQuery, setSearchQuery] = useState("");

  function escapeCsvCell(value) {
    if (value == null || value === "") return "";
    const s = String(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const filteredRequests = searchQuery.trim()
    ? requests.filter((r) => {
        const q = searchQuery.trim().toLowerCase();
        const name = (r.restaurant?.name || "").toLowerCase();
        const sub = (r.restaurant?.subdomain || "").toLowerCase();
        const plan = (r.planType || "").toLowerCase();
        const status = (r.status || "").toLowerCase();
        const pm = (r.paymentMethodName || "").toLowerCase();
        return name.includes(q) || sub.includes(q) || plan.includes(q) || status.includes(q) || pm.includes(q);
      })
    : requests;

  const filteredHistory = searchQuery.trim()
    ? history.filter((r) => {
        const q = searchQuery.trim().toLowerCase();
        const name = (r.name || "").toLowerCase();
        const sub = (r.subdomain || "").toLowerCase();
        const status = (r.status || "").toLowerCase();
        return name.includes(q) || sub.includes(q) || status.includes(q);
      })
    : history;

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
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            {/* Filter + Search + Download */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by restaurant, plan, status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {searchQuery && (
                <span className="text-xs text-neutral-500">{filteredRequests.length} of {requests.length}</span>
              )}
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
              <button
                type="button"
                onClick={() => {
                  if (filteredRequests.length === 0) { toast.error("No data to export"); return; }
                  const headers = ["Restaurant", "Subdomain", "Plan", "Days", "Via", "Status", "Requested"];
                  const csvRows = [
                    headers.join(","),
                    ...filteredRequests.map((r) =>
                      [
                        escapeCsvCell(r.restaurant?.name),
                        escapeCsvCell(r.restaurant?.subdomain),
                        escapeCsvCell(r.planType?.replace("_", " ")),
                        r.durationInDays ?? "",
                        escapeCsvCell(r.paymentMethodName),
                        escapeCsvCell(r.status),
                        r.createdAt ? formatDate(r.createdAt) : "",
                      ].join(",")
                    ),
                  ];
                  const csv = csvRows.join("\r\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `subscription-requests-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  toast.success(`Exported ${filteredRequests.length} request(s) to Excel`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                title="Download table as Excel (CSV)"
              >
                <FileDown className="w-4 h-4" />
                Download Excel
              </button>
            </div>

            <div className="p-4">
            <SuperAdminTable
              data={filteredRequests}
              loading={loading}
              emptyMessage={`No ${statusFilter === "all" ? "" : statusFilter} requests found.`}
              columns={[
                  {
                    key: "restaurant",
                    header: "Restaurant",
                    render: (_, r) => (
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {r.restaurant?.name || "Unknown"}
                        </div>
                        <div className="text-[10px] text-gray-400">{r.restaurant?.subdomain}</div>
                      </div>
                    ),
                  },
                  {
                    key: "plan",
                    header: "Plan",
                    render: (_, r) => (
                      <div>
                        <span className="capitalize text-gray-700 dark:text-neutral-300">
                          {r.planType?.replace("_", " ")}
                        </span>
                        <span className="block text-[10px] text-gray-400">{r.durationInDays} days</span>
                      </div>
                    ),
                  },
                  {
                    key: "via",
                    header: "Via",
                    render: (_, r) => r.paymentMethodName || "—",
                    cellClassName: "text-gray-500 dark:text-neutral-400",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (_, r) => <RequestStatusBadge status={r.status} />,
                  },
                  {
                    key: "requested",
                    header: "Requested",
                    render: (_, r) => formatDate(r.createdAt),
                    cellClassName: "text-gray-500 dark:text-neutral-400",
                  },
                  {
                    key: "screenshot",
                    header: "Screenshot",
                    render: (_, r) =>
                      r.paymentScreenshot ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImg(r.paymentScreenshot)}
                          className="text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Eye size={14} /> View
                        </button>
                      ) : (
                        "—"
                      ),
                  },
                  ...(statusFilter === "pending"
                    ? [
                        {
                          key: "actions",
                          header: "Actions",
                          align: "right",
                          render: (_, r) => (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
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
                                type="button"
                                onClick={() => handleReject(r.id)}
                                disabled={actionLoading === r.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </div>
        )}

        {/* History Tab – All Restaurants */}
        {tab === "history" && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by restaurant or subdomain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {searchQuery && (
                <span className="text-xs text-neutral-500">{filteredHistory.length} of {history.length}</span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (filteredHistory.length === 0) { toast.error("No data to export"); return; }
                  const headers = ["Restaurant", "Subdomain", "Status", "Trial Start", "Trial End", "Sub Start", "Sub End", "Registered"];
                  const csvRows = [
                    headers.join(","),
                    ...filteredHistory.map((r) =>
                      [
                        escapeCsvCell(r.name),
                        escapeCsvCell(r.subdomain),
                        escapeCsvCell(r.status),
                        r.freeTrialStartDate ? formatDate(r.freeTrialStartDate) : "",
                        r.freeTrialEndDate ? formatDate(r.freeTrialEndDate) : "",
                        r.subscriptionStartDate ? formatDate(r.subscriptionStartDate) : "",
                        r.subscriptionEndDate ? formatDate(r.subscriptionEndDate) : "",
                        r.createdAt ? formatDate(r.createdAt) : "",
                      ].join(",")
                    ),
                  ];
                  const csv = csvRows.join("\r\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `subscription-history-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                  toast.success(`Exported ${filteredHistory.length} restaurant(s) to Excel`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                title="Download table as Excel (CSV)"
              >
                <FileDown className="w-4 h-4" />
                Download Excel
              </button>
            </div>
            <div className="p-4">
            <SuperAdminTable
              data={filteredHistory}
              loading={loading}
              emptyMessage="No restaurants found."
                columns={[
                  {
                    key: "restaurant",
                    header: "Restaurant",
                    render: (_, r) => (
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{r.name || "Unknown"}</div>
                        <div className="text-[10px] text-gray-400">{r.subdomain}</div>
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (_, r) => <SubStatusBadge status={r.status} readonly={r.readonly} />,
                  },
                  {
                    key: "trial",
                    header: "Trial Period",
                    render: (_, r) =>
                      r.freeTrialStartDate ? (
                        <>
                          {formatDate(r.freeTrialStartDate)} → {formatDate(r.freeTrialEndDate)}
                        </>
                      ) : (
                        "—"
                      ),
                    cellClassName: "text-gray-500 dark:text-neutral-400",
                  },
                  {
                    key: "subscription",
                    header: "Subscription Period",
                    render: (_, r) =>
                      r.subscriptionStartDate ? (
                        <>
                          {formatDate(r.subscriptionStartDate)} → {formatDate(r.subscriptionEndDate)}
                        </>
                      ) : (
                        "—"
                      ),
                    cellClassName: "text-gray-500 dark:text-neutral-400",
                  },
                  {
                    key: "registered",
                    header: "Registered",
                    render: (_, r) => formatDate(r.createdAt),
                    cellClassName: "text-gray-400",
                  },
                ]}
              />
            </div>
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
