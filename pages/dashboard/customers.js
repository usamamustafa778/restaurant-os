import { useCallback, useEffect, useRef, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getCustomers,
  getCustomerOrderHistory,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  SubscriptionInactiveError,
  getCurrencySymbol,
} from "../../lib/apiClient";
import {
  UserPlus,
  Trash2,
  Edit3,
  User,
  Phone,
  Mail,
  MapPin,
  UserCheck,
  Loader2,
  Users,
  Eye,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import DataTable from "../../components/ui/DataTable";
import toast from "react-hot-toast";

const SEARCH_DEBOUNCE_MS = 400;

/** Maps dashboard filter state to GET /api/admin/customers query params. */
function buildCustomerListParams({
  fetchAllBranches,
  page,
  pageSize,
  debouncedQ,
  sourceFilter,
  verifiedOnly,
  hasPhone,
  hasEmail,
  sortBy,
  minOrders,
  minSpent,
}) {
  const mo = minOrders.trim() ? parseInt(minOrders, 10) : undefined;
  const ms = minSpent.trim() ? parseFloat(minSpent) : undefined;
  return {
    allBranches: fetchAllBranches,
    page,
    pageSize,
    q: debouncedQ,
    source: sourceFilter,
    verifiedOnly,
    hasPhone,
    hasEmail,
    sort: sortBy,
    minOrders: Number.isFinite(mo) && mo > 0 ? mo : undefined,
    minSpent: Number.isFinite(ms) && ms > 0 ? ms : undefined,
  };
}

function parseCustomerListResponse(res) {
  return {
    customers: Array.isArray(res?.customers) ? res.customers : [],
    total: typeof res?.total === "number" ? res.total : 0,
    totalPages: typeof res?.totalPages === "number" ? res.totalPages : 1,
    capped: !!res?.capped,
  };
}

export default function CustomersPage() {
  const sym = getCurrencySymbol();
  const { currentBranch } = useBranch() || {};
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listTruncated, setListTruncated] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [minOrders, setMinOrders] = useState("");
  const [minSpent, setMinSpent] = useState("");

  const [form, setForm] = useState({
    id: null,
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [allBranches, setAllBranches] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const { confirm } = useConfirmDialog();

  const canCreate = !!currentBranch;
  const fetchAllBranches = !currentBranch || allBranches;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filterKeyRef = useRef(null);

  useEffect(() => {
    const filterKey = JSON.stringify({
      debouncedQ,
      sourceFilter,
      sortBy,
      verifiedOnly,
      hasPhone,
      hasEmail,
      minOrders,
      minSpent,
      pageSize,
      fetchAllBranches,
      branchId: currentBranch?.id ?? "",
    });

    const prevKey = filterKeyRef.current;
    const filtersBumped = prevKey !== null && prevKey !== filterKey;
    filterKeyRef.current = filterKey;

    if (filtersBumped && page !== 1) {
      setPage(1);
      return;
    }

    let cancelled = false;
    (async () => {
      setPageLoading(true);
      try {
        const effPage = filtersBumped ? 1 : page;
        const res = await getCustomers(
          buildCustomerListParams({
            fetchAllBranches,
            page: effPage,
            pageSize,
            debouncedQ,
            sourceFilter,
            verifiedOnly,
            hasPhone,
            hasEmail,
            sortBy,
            minOrders,
            minSpent,
          })
        );
        if (cancelled) return;
        const parsed = parseCustomerListResponse(res);
        setCustomers(parsed.customers);
        setTotal(parsed.total);
        setTotalPages(parsed.totalPages);
        setListTruncated(parsed.capped);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else toast.error(err.message || "Failed to load customers");
        setCustomers([]);
        setTotal(0);
        setTotalPages(1);
        setListTruncated(false);
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    page,
    pageSize,
    debouncedQ,
    sourceFilter,
    sortBy,
    verifiedOnly,
    hasPhone,
    hasEmail,
    minOrders,
    minSpent,
    fetchAllBranches,
    currentBranch?.id,
  ]);

  const loadCustomerPage = useCallback(async () => {
    try {
      const res = await getCustomers(
        buildCustomerListParams({
          fetchAllBranches,
          page,
          pageSize,
          debouncedQ,
          sourceFilter,
          verifiedOnly,
          hasPhone,
          hasEmail,
          sortBy,
          minOrders,
          minSpent,
        })
      );
      const parsed = parseCustomerListResponse(res);
      setCustomers(parsed.customers);
      setTotal(parsed.total);
      setTotalPages(parsed.totalPages);
      setListTruncated(parsed.capped);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) setSuspended(true);
      else throw err;
    }
  }, [
    fetchAllBranches,
    page,
    pageSize,
    debouncedQ,
    sourceFilter,
    verifiedOnly,
    hasPhone,
    hasEmail,
    sortBy,
    minOrders,
    minSpent,
  ]);

  function resetForm() {
    setForm({ id: null, name: "", phone: "", email: "", address: "", notes: "" });
  }

  function startEdit(customer) {
    if (customer.recordType === "website") {
      toast.error("Website sign-in accounts are managed by the customer on your storefront.");
      return;
    }
    setForm({
      id: customer.id,
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setModalError("");
    setIsModalOpen(true);
  }

  async function openOrderHistory(c) {
    setHistoryCustomer(c);
    setHistoryOpen(true);
    setHistoryData(null);
    setExpandedOrderId(null);
    setHistoryLoading(true);
    try {
      const data = await getCustomerOrderHistory(c.id);
      setHistoryData(data);
    } catch (err) {
      toast.error(err.message || "Failed to load order history");
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Name is required");
      return;
    }
    if (!form.phone.trim()) {
      setModalError("Phone is required");
      return;
    }
    setModalError("");
    setLoading(true);
    const toastId = toast.loading(form.id ? "Updating customer..." : "Creating customer...");
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (form.id) {
        await updateCustomer(form.id, payload);
        toast.success("Customer updated successfully!", { id: toastId });
      } else {
        await createCustomer(payload);
        toast.success("Customer created successfully!", { id: toastId });
      }
      resetForm();
      setIsModalOpen(false);
      await loadCustomerPage();
    } catch (err) {
      setModalError(err.message || "Failed to save customer");
      toast.error(err.message || "Failed to save customer", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete customer",
      message: "Delete this customer? This cannot be undone.",
    });
    if (!ok) return;
    const toastId = toast.loading("Deleting customer...");
    try {
      await deleteCustomer(id);
      if (form.id === id) resetForm();
      toast.success("Customer deleted successfully!", { id: toastId });
      await loadCustomerPage();
    } catch (err) {
      toast.error(err.message || "Failed to delete customer", { id: toastId });
    }
  }

  const empty = !pageLoading && customers.length === 0;

  return (
    <AdminLayout title="Customers" suspended={suspended}>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col xl:flex-row flex-wrap gap-3 items-stretch xl:items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, phone, email…"
              className="w-full h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
              Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary"
            >
              <option value="all">All</option>
              <option value="pos">POS / branch</option>
              <option value="website">Website</option>
            </select>
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary"
            >
              <option value="recent">Most recent</option>
              <option value="name">Name (A–Z)</option>
              <option value="spent">Total spent</option>
            </select>
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
              Page size
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-24">
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
              Min orders
            </label>
            <input
              type="number"
              min={0}
              value={minOrders}
              onChange={(e) => setMinOrders(e.target.value)}
              placeholder="—"
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary"
            />
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
              Min spent (Rs)
            </label>
            <input
              type="number"
              min={0}
              step="1"
              value={minSpent}
              onChange={(e) => setMinSpent(e.target.value)}
              placeholder="—"
              className="w-full h-10 px-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {currentBranch && (
            <label className="inline-flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={allBranches}
                onChange={(e) => {
                  setAllBranches(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-gray-300 dark:border-neutral-600 text-primary focus:ring-primary/20"
              />
              All branches (POS)
            </label>
          )}
          <label className="inline-flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => {
                setVerifiedOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 dark:border-neutral-600 text-primary focus:ring-primary/20"
            />
            Website: verified only
          </label>
          <label className="inline-flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPhone}
              onChange={(e) => {
                setHasPhone(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 dark:border-neutral-600 text-primary focus:ring-primary/20"
            />
            Has phone
          </label>
          <label className="inline-flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={hasEmail}
              onChange={(e) => {
                setHasEmail(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 dark:border-neutral-600 text-primary focus:ring-primary/20"
            />
            Has email
          </label>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setDebouncedQ("");
              setSourceFilter("all");
              setSortBy("recent");
              setVerifiedOnly(false);
              setHasPhone(false);
              setHasEmail(false);
              setMinOrders("");
              setMinSpent("");
              setPage(1);
            }}
            className="text-primary font-semibold hover:underline"
          >
            Clear filters
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalError("");
              setIsModalOpen(true);
            }}
            disabled={!canCreate}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none whitespace-nowrap flex-shrink-0 sm:ml-auto"
            title={!canCreate ? "Select a branch to add customers" : ""}
          >
            <UserPlus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {listTruncated && (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
          List is capped at a large internal limit. Narrow your search or filters to see everyone.
        </div>
      )}

      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all">
        {pageLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                Loading customers…
              </p>
            </div>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <UserCheck className="w-10 h-10 text-primary" />
            </div>
            <p className="text-base font-bold text-gray-700 dark:text-neutral-300">
              {total === 0 ? "No customers match" : "No results"}
            </p>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
              Adjust filters or search. Customers come from POS, deliveries, and website sign-ups.
            </p>
            {total === 0 && canCreate && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setModalError("");
                  setIsModalOpen(true);
                }}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add your first customer
              </button>
            )}
          </div>
        ) : (
          <>
            <DataTable
              rows={customers}
              emptyMessage="No customers found."
              columns={[
                {
                  key: "name",
                  header: "Customer",
                  render: (val) => (
                    <span className="font-semibold text-gray-900 dark:text-white">{val}</span>
                  ),
                },
                {
                  key: "source",
                  header: "Source",
                  render: (val, c) => {
                    const isWeb = c.recordType === "website";
                    return (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-bold ${
                          isWeb
                            ? "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200"
                            : "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                        }`}
                      >
                        {val || (isWeb ? "Website" : "POS / branch")}
                      </span>
                    );
                  },
                },
                {
                  key: "phone",
                  header: "Phone",
                  render: (val) => (
                    <div className="flex items-center gap-1.5 text-gray-700 dark:text-neutral-300">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="font-medium">{val || "—"}</span>
                    </div>
                  ),
                },
                {
                  key: "email",
                  header: "Email",
                  hideOnMobile: true,
                  render: (val) =>
                    val ? (
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-neutral-400">
                        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{val}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-neutral-600">—</span>
                    ),
                },
                {
                  key: "totalOrders",
                  header: "Orders",
                  align: "center",
                  render: (val) => (
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {val ?? 0}
                    </span>
                  ),
                },
                {
                  key: "totalSpent",
                  header: "Total spent",
                  align: "right",
                  render: (val) => (
                    <span className="font-semibold text-primary">
                      {sym} {(val ?? 0).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: "address",
                  header: "Address",
                  hideOnTablet: true,
                  render: (val) =>
                    val ? (
                      <div className="flex items-center gap-1 text-gray-600 dark:text-neutral-400">
                        <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400" />
                        <span>{val}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-neutral-600">—</span>
                    ),
                },
                {
                  key: "history",
                  header: "",
                  align: "center",
                  render: (_, c) => (
                    <button
                      type="button"
                      onClick={() => openOrderHistory(c)}
                      className="p-1.5 rounded-lg text-gray-500 dark:text-neutral-500 hover:bg-primary/10 hover:text-primary transition-colors"
                      title="Order history"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (_, c) =>
                    c.recordType === "website" ? (
                      <span className="text-xs text-gray-400 dark:text-neutral-600">—</span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ),
                },
              ]}
            />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/40">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                {total === 0
                  ? "No rows"
                  : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-white dark:hover:bg-neutral-800"
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300 px-2">
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-white dark:hover:bg-neutral-800"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 py-6">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 shadow-2xl rounded-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Order history</h2>
                <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
                  {historyCustomer?.name || "Customer"}{" "}
                  <span className="text-gray-400">
                    · {historyCustomer?.recordType === "website" ? "Website" : "POS / branch"}
                  </span>
                </p>
                {historyCustomer?.phone ? (
                  <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">{historyCustomer.phone}</p>
                ) : null}
                {historyCustomer?.email ? (
                  <p className="text-xs text-gray-500 dark:text-neutral-500">{historyCustomer.email}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryOpen(false);
                  setHistoryData(null);
                }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white px-2 py-1"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-gray-600 dark:text-neutral-400">Loading orders…</p>
                </div>
              ) : !historyData?.orders?.length ? (
                <p className="text-center text-sm text-gray-500 dark:text-neutral-500 py-12">
                  No linked orders found for this profile.
                </p>
              ) : (
                <ul className="space-y-2">
                  {historyData.orders.map((o) => {
                    const open = expandedOrderId === o.id;
                    return (
                      <li
                        key={o.id}
                        className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/40 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedOrderId(open ? null : o.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100/80 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          {open ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div>
                              <div className="text-xs text-gray-500 dark:text-neutral-500">Order</div>
                              <div className="font-bold text-gray-900 dark:text-white">{o.orderNumber}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 dark:text-neutral-500">Date</div>
                              <div className="font-medium text-gray-800 dark:text-neutral-200">
                                {o.createdAt
                                  ? new Date(o.createdAt).toLocaleString(undefined, {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 dark:text-neutral-500">Source</div>
                              <div className="font-medium text-gray-800 dark:text-neutral-200">
                                {o.source === "WEBSITE" ? "Website" : o.source || "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 dark:text-neutral-500">Total</div>
                              <div className="font-bold text-primary">{sym} {(o.total ?? 0).toLocaleString()}</div>
                            </div>
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${
                              o.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : o.status === "CANCELLED"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                  : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                            }`}
                          >
                            {o.status || "—"}
                          </span>
                        </button>
                        {open && (
                          <div className="px-4 pb-4 pt-0 border-t border-gray-200 dark:border-neutral-800 text-sm space-y-2">
                            {o.branchName ? (
                              <p className="text-gray-600 dark:text-neutral-400">
                                <span className="font-semibold">Branch:</span> {o.branchName}
                              </p>
                            ) : null}
                            {o.deliveryAddress ? (
                              <p className="text-gray-600 dark:text-neutral-400">
                                <span className="font-semibold">Address:</span> {o.deliveryAddress}
                              </p>
                            ) : null}
                            <p className="text-gray-600 dark:text-neutral-400">
                              <span className="font-semibold">Payment:</span> {o.paymentMethod || "—"} ·{" "}
                              <span className="font-semibold">Type:</span> {o.orderType || "—"}
                            </p>
                            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden mt-2">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100 dark:bg-neutral-800">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-semibold">Item</th>
                                    <th className="text-right px-3 py-2 font-semibold">Qty</th>
                                    <th className="text-right px-3 py-2 font-semibold">Line</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(o.items || []).map((it, idx) => (
                                    <tr key={idx} className="border-t border-gray-200 dark:border-neutral-700">
                                      <td className="px-3 py-2 text-gray-800 dark:text-neutral-200">{it.name}</td>
                                      <td className="px-3 py-2 text-right text-gray-600 dark:text-neutral-400">
                                        {it.quantity}
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                                        {sym} {(it.lineTotal ?? 0).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 shadow-2xl rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {form.id ? "Edit Customer" : "Add Customer"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {form.id ? "Update customer details" : `Assign to ${currentBranch?.name || "current branch"}`}
                </p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Customer name"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  Phone *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="03XX-XXXXXXX"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Delivery address"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {form.id ? "Saving…" : "Creating…"}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {form.id ? "Save changes" : "Add customer"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
