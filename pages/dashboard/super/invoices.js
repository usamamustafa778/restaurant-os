import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import DataTable from "../../../components/ui/DataTable";
import MarkPaidModal from "../../../components/super/MarkPaidModal";
import { viewInvoicePDF } from "../../../components/super/InvoicePDF";
import {
  deleteSuperInvoice,
  getRestaurantsForSuperAdmin,
  getSuperInvoice,
  getSuperInvoices,
  sendSuperInvoiceEmail,
  updateSuperInvoiceStatus,
} from "../../../lib/apiClient";
import {
  FileText,
  Loader2,
  Mail,
  Search,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

const MONTHS = [
  { value: "", label: "All months" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString("en", { month: "long" }),
  })),
];

const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
];

function StatusPill({ status }) {
  const map = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300",
    SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] || map.DRAFT}`}
    >
      {status}
    </span>
  );
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SuperInvoicesPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.invoices.view");
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [restaurantFilter, setRestaurantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()));
  const [search, setSearch] = useState("");

  const [markPaidInvoice, setMarkPaidInvoice] = useState(null);
  const [actionId, setActionId] = useState(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSuperInvoices({
        restaurantId: restaurantFilter || undefined,
        status: statusFilter || undefined,
        month: monthFilter || undefined,
        year: yearFilter || undefined,
        search: search.trim() || undefined,
        page,
        limit: 20,
      });
      setInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 1);
    } catch (err) {
      toast.error(err.message || "Failed to load invoices");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantFilter, statusFilter, monthFilter, yearFilter, search, page]);

  useEffect(() => {
    if (!hasAccess) return;
    getRestaurantsForSuperAdmin()
      .then((list) => setRestaurants(Array.isArray(list) ? list : []))
      .catch(() => setRestaurants([]));
  }, [hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    loadInvoices();
  }, [loadInvoices, hasAccess]);

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "PAID");
    const pending = invoices.filter((i) =>
      ["DRAFT", "SENT"].includes(i.status),
    );
    const overdue = invoices.filter((i) => i.status === "OVERDUE");
    const totalAmount = invoices.reduce(
      (sum, i) => sum + (Number(i.amount) || 0),
      0,
    );
    const paidAmount = paid.reduce(
      (sum, i) => sum + (Number(i.paidAmount ?? i.amount) || 0),
      0,
    );
    return {
      totalAmount,
      paidAmount,
      paidCount: paid.length,
      pendingCount: pending.length,
      overdueCount: overdue.length,
    };
  }, [invoices]);

  const yearOptions = useMemo(() => {
    const ys = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 3; y -= 1) {
      ys.push(y);
    }
    return ys;
  }, [now]);

  async function handleViewPdf(invoice) {
    try {
      setActionId(invoice.id);
      const full =
        invoice.snapshot && invoice.bankDetails
          ? invoice
          : await getSuperInvoice(invoice.id);
      await viewInvoicePDF(full);
    } catch (err) {
      toast.error(err.message || "Could not open PDF");
    } finally {
      setActionId(null);
    }
  }

  async function handleSendEmail(invoice) {
    try {
      setActionId(invoice.id);
      await sendSuperInvoiceEmail(invoice.id);
      toast.success(
        invoice.status === "DRAFT"
          ? "Invoice sent"
          : "Invoice email resent",
      );
      loadInvoices();
    } catch (err) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setActionId(null);
    }
  }

  async function handleMarkOverdue(invoice) {
    try {
      setActionId(invoice.id);
      await updateSuperInvoiceStatus(invoice.id, { status: "OVERDUE" });
      toast.success(`${invoice.invoiceNumber} marked overdue`);
      loadInvoices();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(invoice) {
    if (!window.confirm(`Delete draft ${invoice.invoiceNumber}?`)) return;
    try {
      setActionId(invoice.id);
      await deleteSuperInvoice(invoice.id);
      toast.success("Draft invoice deleted");
      loadInvoices();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setActionId(null);
    }
  }

  return (
    <AdminLayout title="Invoices">
      <SuperPageGate permission="platform.invoices.view">
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Generate and track restaurant invoices
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="px-3 py-2 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
              <span className="text-gray-500 text-xs block">Page total</span>
              <span className="font-bold tabular-nums">
                Rs {Math.round(stats.totalAmount).toLocaleString("en-PK")}
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-emerald-700 dark:text-emerald-400 text-xs block">
                Paid ({stats.paidCount})
              </span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                Rs {Math.round(stats.paidAmount).toLocaleString("en-PK")}
              </span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <span className="text-blue-700 dark:text-blue-400 text-xs block">
                Pending
              </span>
              <span className="font-bold text-blue-800 dark:text-blue-300">
                {stats.pendingCount}
              </span>
            </div>
            <div
              className={`px-3 py-2 rounded-xl border ${
                stats.overdueCount > 0
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                  : "bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800"
              }`}
            >
              <span
                className={`text-xs block ${
                  stats.overdueCount > 0
                    ? "text-red-700 dark:text-red-400"
                    : "text-gray-500"
                }`}
              >
                Overdue
              </span>
              <span
                className={`font-bold ${
                  stats.overdueCount > 0
                    ? "text-red-800 dark:text-red-300"
                    : ""
                }`}
              >
                {stats.overdueCount}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
          <select
            value={restaurantFilter}
            onChange={(e) => {
              setRestaurantFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm min-w-[160px]"
          >
            <option value="">All Restaurants</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.website?.name || r.id}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m.value || "all"} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          >
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search invoice #…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <DataTable
              variant="card"
              showSno
              data={invoices}
              emptyMessage="No invoices yet. Generate one from the Restaurants page."
              columns={[
                {
                  key: "invoiceNumber",
                  header: "Invoice #",
                  render: (v) => (
                    <span className="font-mono text-xs font-bold">{v}</span>
                  ),
                },
                {
                  key: "restaurantName",
                  header: "Restaurant",
                  render: (_, row) =>
                    row.restaurantName ||
                    row.snapshot?.restaurantName ||
                    "—",
                },
                {
                  key: "period",
                  header: "Period",
                  render: (_, row) => row.billingPeriod?.label || "—",
                },
                {
                  key: "amount",
                  header: "Amount",
                  render: (v) => (
                    <span className="font-semibold tabular-nums">
                      Rs {Math.round(Number(v) || 0).toLocaleString("en-PK")}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (v) => <StatusPill status={v} />,
                },
                {
                  key: "emailSentAt",
                  header: "Sent",
                  render: (v) => formatDate(v),
                },
                {
                  key: "dueDate",
                  header: "Due Date",
                  render: (v) => formatDate(v),
                },
                {
                  key: "actions",
                  header: "Actions",
                  cellClassName: "whitespace-nowrap",
                  render: (_, row) => {
                    const busy = actionId === row.id;
                    const canMarkPaid = ["SENT", "OVERDUE"].includes(
                      row.status,
                    );
                    const canDelete = row.status === "DRAFT";
                    return (
                      <div className="inline-flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleViewPdf(row)}
                          title="View PDF"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {canMarkPaid && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setMarkPaidInvoice(row)}
                            title="Mark paid"
                            className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSendEmail(row)}
                          title={
                            row.status === "DRAFT" ? "Send email" : "Resend email"
                          }
                          className="p-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        {row.status === "SENT" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleMarkOverdue(row)}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Overdue
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDelete(row)}
                            title="Delete draft"
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  },
                },
              ]}
            />

            {pages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {total} invoice{total !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-2 py-1">
                    Page {page} / {pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {markPaidInvoice && (
        <MarkPaidModal
          invoice={markPaidInvoice}
          onClose={() => setMarkPaidInvoice(null)}
          onSuccess={() => {
            setMarkPaidInvoice(null);
            loadInvoices();
          }}
        />
      )}
      </SuperPageGate>
    </AdminLayout>
  );
}
