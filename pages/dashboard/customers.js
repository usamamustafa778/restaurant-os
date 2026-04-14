import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  SlidersHorizontal,
  X,
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

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailHistory, setDetailHistory] = useState(null);
  const [detailNotes, setDetailNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);

  const { confirm } = useConfirmDialog();

  const canCreate = !!currentBranch;
  const fetchAllBranches = !currentBranch || allBranches;

  useEffect(() => {
    if (!filtersOpen) return;
    function handleDown(e) {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [filtersOpen]);

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

  async function openCustomerDetail(c) {
    setDetailCustomer(c);
    setDetailNotes(c.notes || "");
    setDetailOpen(true);
    setDetailHistory(null);
    setDetailLoading(true);
    try {
      const data = await getCustomerOrderHistory(c.id);
      setDetailHistory(data);
    } catch (err) {
      toast.error(err.message || "Failed to load order history");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveCustomerNotes() {
    if (!detailCustomer || detailCustomer.recordType === "website") return;
    const trimmed = detailNotes.trim();
    setNotesSaving(true);
    const toastId = toast.loading("Saving notes…");
    try {
      await updateCustomer(detailCustomer.id, {
        name: detailCustomer.name,
        phone: detailCustomer.phone,
        email: detailCustomer.email || undefined,
        address: detailCustomer.address || undefined,
        notes: trimmed || undefined,
      });
      setDetailCustomer((prev) => (prev ? { ...prev, notes: trimmed } : prev));
      await loadCustomerPage();
      toast.success("Notes saved", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save notes", { id: toastId });
    } finally {
      setNotesSaving(false);
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
        <div className="flex items-end gap-2 overflow-x-auto pb-1">
          <div className="flex-1 min-w-[320px]">
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
          <div className="w-36 flex-shrink-0">
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
          <div className="w-40 flex-shrink-0">
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

          <div className="relative flex-shrink-0" ref={filtersRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold transition-all ${
                filtersOpen
                  ? "border-primary bg-primary/5 text-primary dark:border-primary dark:bg-primary/10"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              Filters
              {(allBranches ||
                verifiedOnly ||
                hasPhone ||
                hasEmail ||
                minOrders ||
                minSpent ||
                pageSize !== 25) && (
                <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white leading-none">
                  •
                </span>
              )}
            </button>
            {filtersOpen && (
              <div className="absolute left-0 top-full z-[100] mt-1.5 w-80 overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                    More filters
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedOnly(false);
                      setHasPhone(false);
                      setHasEmail(false);
                      setMinOrders("");
                      setMinSpent("");
                      setPageSize(25);
                      setPage(1);
                    }}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400"
                  >
                    Reset
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
                      Page size
                    </label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="w-full h-9 px-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
                        Min orders
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={minOrders}
                        onChange={(e) => setMinOrders(e.target.value)}
                        placeholder="—"
                        className="w-full h-9 px-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
                        Min spent ({sym})
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={minSpent}
                        onChange={(e) => setMinSpent(e.target.value)}
                        placeholder="—"
                        className="w-full h-9 px-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {currentBranch && (
                      <label className="flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
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
                    <label className="flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
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
                    <label className="flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
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
                    <label className="flex items-center gap-2 font-medium text-gray-700 dark:text-neutral-300 cursor-pointer">
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
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalError("");
              setIsModalOpen(true);
            }}
            disabled={!canCreate}
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none whitespace-nowrap flex-shrink-0 ml-auto"
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
                      onClick={() => openCustomerDetail(c)}
                      className="p-1.5 rounded-lg text-gray-500 dark:text-neutral-500 hover:bg-primary/10 hover:text-primary transition-colors"
                      title="View customer"
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

      {/* Customer detail slide-over */}
      {detailOpen && detailCustomer && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close panel"
            onClick={() => {
              setDetailOpen(false);
              setDetailHistory(null);
            }}
          />
          <div className="relative w-full max-w-lg h-full bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Customer</h2>
              <button
                type="button"
                onClick={() => {
                  setDetailOpen(false);
                  setDetailHistory(null);
                }}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{detailCustomer.name}</p>
                <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">
                  {detailCustomer.recordType === "website" ? "Website" : "POS / branch"}
                </p>
              </div>
              <div className="grid gap-3 text-sm">
                {detailCustomer.phone ? (
                  <div className="flex items-center gap-2 text-gray-800 dark:text-neutral-200">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{detailCustomer.phone}</span>
                  </div>
                ) : null}
                {detailCustomer.email ? (
                  <div className="flex items-center gap-2 text-gray-800 dark:text-neutral-200">
                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{detailCustomer.email}</span>
                  </div>
                ) : null}
                {detailCustomer.address ? (
                  <div className="flex items-start gap-2 text-gray-800 dark:text-neutral-200">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>{detailCustomer.address}</span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Total orders</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{detailCustomer.totalOrders ?? 0}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Total spent</p>
                  <p className="text-lg font-bold text-primary">
                    {sym} {(detailCustomer.totalSpent ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Avg order</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {sym}{" "}
                    {(detailCustomer.totalOrders > 0
                      ? Math.round((Number(detailCustomer.totalSpent) || 0) / detailCustomer.totalOrders)
                      : 0
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-3">
                  <p className="text-[10px] font-bold uppercase text-gray-400">Last order</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {detailCustomer.lastOrderAt
                      ? new Date(detailCustomer.lastOrderAt).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })
                      : "—"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Recent orders</h3>
                {detailLoading ? (
                  <div className="flex items-center gap-2 py-8 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    Loading…
                  </div>
                ) : !detailHistory?.orders?.length ? (
                  <p className="text-sm text-gray-500 dark:text-neutral-400">No linked orders yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {detailHistory.orders.slice(0, 5).map((o) => (
                      <li
                        key={o.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-neutral-800 px-3 py-2 text-sm"
                      >
                        <div>
                          <Link
                            href={`/dashboard/orders?editOrder=${encodeURIComponent(o.id)}`}
                            className="font-mono font-semibold text-primary hover:underline"
                          >
                            {o.orderNumber || o.id}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-neutral-400">
                            {o.createdAt
                              ? new Date(o.createdAt).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {sym} {(o.total ?? 0).toLocaleString()}
                          </span>
                          <span
                            className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              o.status === "DELIVERED" || o.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : o.status === "CANCELLED"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                  : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                            }`}
                          >
                            {o.status || "—"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900 dark:text-white">Notes</label>
                <textarea
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  disabled={detailCustomer.recordType === "website"}
                  rows={3}
                  placeholder={
                    detailCustomer.recordType === "website"
                      ? "Notes for website accounts are managed on the storefront."
                      : "Internal notes"
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm disabled:opacity-60"
                />
                {detailCustomer.recordType !== "website" && (
                  <button
                    type="button"
                    onClick={() => void saveCustomerNotes()}
                    disabled={notesSaving}
                    className="mt-2 inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {notesSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save notes
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => {
              resetForm();
              setIsModalOpen(false);
            }}
          />
          <div className="relative w-full max-w-md h-full bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {form.id ? "Edit Customer" : "Add Customer"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {form.id ? "Update customer details" : `Assign to ${currentBranch?.name || "current branch"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsModalOpen(false);
                }}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
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
        </div>
      )}
    </AdminLayout>
  );
}
