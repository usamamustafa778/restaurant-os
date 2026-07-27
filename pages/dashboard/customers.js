import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import {
  getCustomers,
  getCustomerOrderHistory,
  updateCustomer,
  SubscriptionInactiveError,
  getCurrencySymbol,
} from "../../lib/apiClient";
import {
  Edit3,
  User,
  Phone,
  Mail,
  MapPin,
  UserCheck,
  Loader2,
  SlidersHorizontal,
  X,
  Search,
  Globe2,
  Store,
  ChevronDown,
  Copy,
  History,
} from "lucide-react";
import { useBranch } from "../../contexts/BranchContext";
import DataTable from "../../components/ui/DataTable";
import toast from "react-hot-toast";

const SEARCH_DEBOUNCE_MS = 400;

const inputClass =
  "box-border w-full h-9 px-3 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors";

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return "—";
  }
}

function orderStatusTone(status) {
  if (status === "DELIVERED" || status === "COMPLETED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (status === "CANCELLED") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  }
  return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
}

/** Maps dashboard filter state to GET /api/admin/customers query params. */
function buildCustomerListParams({
  fetchAllBranches,
  page,
  pageSize,
  debouncedQ,
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
    source: "all",
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
  };
}

export default function CustomersPage() {
  const sym = getCurrencySymbol();
  const { currentBranch } = useBranch() || {};
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
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
    const t = setTimeout(
      () => setDebouncedQ(searchInput.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [searchInput]);

  const filterKeyRef = useRef(null);

  useEffect(() => {
    const filterKey = JSON.stringify({
      debouncedQ,
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
            verifiedOnly,
            hasPhone,
            hasEmail,
            sortBy,
            minOrders,
            minSpent,
          }),
        );
        if (cancelled) return;
        const parsed = parseCustomerListResponse(res);
        setCustomers(parsed.customers);
        setTotal(parsed.total);
        setTotalPages(parsed.totalPages);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else toast.error(err.message || "Failed to load customers");
        setCustomers([]);
        setTotal(0);
        setTotalPages(1);
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
          verifiedOnly,
          hasPhone,
          hasEmail,
          sortBy,
          minOrders,
          minSpent,
        }),
      );
      const parsed = parseCustomerListResponse(res);
      setCustomers(parsed.customers);
      setTotal(parsed.total);
      setTotalPages(parsed.totalPages);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) setSuspended(true);
      else throw err;
    }
  }, [
    fetchAllBranches,
    page,
    pageSize,
    debouncedQ,
    verifiedOnly,
    hasPhone,
    hasEmail,
    sortBy,
    minOrders,
    minSpent,
  ]);

  function resetForm() {
    setForm({
      id: null,
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
  }

  function startEdit(customer) {
    if (customer.recordType === "website") {
      toast.error(
        "Website sign-in accounts are managed by the customer on your storefront.",
      );
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
      if (data?.customer) {
        setDetailCustomer({
          ...c,
          ...data.customer,
          // Keep the stronger of list live-stats vs history (avoids flashing to 0)
          totalOrders: Math.max(
            Number(c.totalOrders) || 0,
            Number(data.customer.totalOrders) || 0,
          ),
          totalSpent: Math.max(
            Number(c.totalSpent) || 0,
            Number(data.customer.totalSpent) || 0,
          ),
          lastOrderAt:
            data.customer.lastOrderAt || c.lastOrderAt || null,
        });
        setDetailNotes(data.customer.notes || c.notes || "");
      }
      setDetailHistory(data);
    } catch (err) {
      toast.error(err.message || "Failed to load order history");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function copyDetailValue(label, value) {
    const text = String(value || "").trim();
    if (!text) return;
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Could not copy"));
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
    if (!form.id) {
      setModalError("Customer not found");
      return;
    }
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
    const toastId = toast.loading("Updating customer...");
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      await updateCustomer(form.id, payload);
      toast.success("Customer updated successfully!", { id: toastId });
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

  const empty = !pageLoading && customers.length === 0;

  const activeFilters = useMemo(() => {
    const chips = [];
    if (debouncedQ) chips.push({ key: "q", label: `Search: ${debouncedQ}` });
    if (sortBy !== "recent") {
      chips.push({
        key: "sort",
        label:
          sortBy === "name"
            ? "Sort: Name A–Z"
            : sortBy === "spent" || sortBy === "spent_desc"
              ? "Sort: Most spent"
              : sortBy === "spent_asc"
                ? "Sort: Least spent"
                : sortBy === "orders" || sortBy === "orders_desc"
                  ? "Sort: Most orders"
                  : sortBy === "orders_asc"
                    ? "Sort: Least orders"
                    : "Sort",
      });
    }
    if (allBranches && currentBranch)
      chips.push({ key: "allBranches", label: "All branches" });
    if (verifiedOnly) chips.push({ key: "verified", label: "Verified only" });
    if (hasPhone) chips.push({ key: "phone", label: "Has phone" });
    if (hasEmail) chips.push({ key: "email", label: "Has email" });
    if (minOrders.trim())
      chips.push({ key: "minOrders", label: `Min orders ≥ ${minOrders}` });
    if (minSpent.trim())
      chips.push({ key: "minSpent", label: `Min spent ≥ ${minSpent}` });
    return chips;
  }, [
    debouncedQ,
    sortBy,
    allBranches,
    currentBranch,
    verifiedOnly,
    hasPhone,
    hasEmail,
    minOrders,
    minSpent,
  ]);

  function clearFilterChip(key) {
    switch (key) {
      case "q":
        setSearchInput("");
        setDebouncedQ("");
        break;
      case "sort":
        setSortBy("recent");
        break;
      case "allBranches":
        setAllBranches(false);
        break;
      case "verified":
        setVerifiedOnly(false);
        break;
      case "phone":
        setHasPhone(false);
        break;
      case "email":
        setHasEmail(false);
        break;
      case "minOrders":
        setMinOrders("");
        break;
      case "minSpent":
        setMinSpent("");
        break;
      case "pageSize":
        setPageSize(50);
        break;
      default:
        break;
    }
    setPage(1);
  }

  function clearAllFilters() {
    setSearchInput("");
    setDebouncedQ("");
    setSortBy("recent");
    setAllBranches(false);
    setVerifiedOnly(false);
    setHasPhone(false);
    setHasEmail(false);
    setMinOrders("");
    setMinSpent("");
    setPageSize(50);
    setPage(1);
  }

  const pageWebsiteCount = customers.filter((c) => c.hasWebsiteAccount).length;
  const pagePosCount = customers.length - pageWebsiteCount;
  const advancedFilterCount = activeFilters.filter(
    (c) => !["q", "sort"].includes(c.key),
  ).length;

  const detailOrders = detailHistory?.orders || [];
  const detailStats = useMemo(() => {
    const orders = detailOrders;
    const spentFromOrders = orders.reduce(
      (s, o) => s + (Number(o.total) || 0),
      0,
    );
    const ordersFromApi =
      typeof detailHistory?.orderCount === "number"
        ? detailHistory.orderCount
        : orders.length;
    const ordersFromCustomer = Number(detailCustomer?.totalOrders) || 0;
    const spentFromCustomer = Number(detailCustomer?.totalSpent) || 0;
    const totalOrders = Math.max(
      ordersFromApi,
      ordersFromCustomer,
      orders.length,
    );
    const totalSpent = Math.max(spentFromOrders, spentFromCustomer);
    const websiteOrders = orders.filter(
      (o) => String(o.source || "").toUpperCase() === "WEBSITE",
    ).length;
    const posOrders = Math.max(0, orders.length - websiteOrders);
    const lastOrderAt =
      detailCustomer?.lastOrderAt || orders[0]?.createdAt || null;
    const avg = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
    let segment = "New guest";
    if (totalOrders >= 10 || totalSpent >= 20000) segment = "VIP guest";
    else if (totalOrders >= 3 || totalSpent >= 5000) segment = "Regular";
    else if (totalOrders >= 1 || totalSpent > 0) segment = "Returning guest";
    return {
      totalOrders,
      totalSpent,
      websiteOrders,
      posOrders,
      lastOrderAt,
      avg,
      segment,
    };
  }, [detailOrders, detailHistory, detailCustomer]);

  return (
    <AdminLayout title="Customers" suspended={suspended}>
      <PermissionGate permission="customers.view">
        <div className="mb-5 space-y-3">
          {!pageLoading && total > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Matching", value: total.toLocaleString() },
              { label: "On this page", value: customers.length },
              { label: "POS only", value: pagePosCount, icon: Store },
              { label: "With website", value: pageWebsiteCount, icon: Globe2 },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500 inline-flex items-center gap-1">
                  {card.icon ? <card.icon className="w-3 h-3" /> : null}
                  {card.label}
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="relative z-20">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex min-w-[12rem] flex-1 items-center">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, phone, or email…"
                className="h-9 w-full rounded-xl border-2 border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="relative ml-auto shrink-0" ref={filtersRef}>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold transition-all ${
                  filtersOpen || advancedFilterCount > 0
                    ? "border-primary bg-primary/5 text-primary dark:border-primary dark:bg-primary/10"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                Filters
                {advancedFilterCount > 0 ? (
                  <span className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white">
                    {advancedFilterCount}
                  </span>
                ) : null}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
                />
              </button>

              {filtersOpen ? (
                <div className="absolute right-0 left-auto top-full z-[100] mt-1.5 w-72 overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                      Filters &amp; Sort
                    </span>
                    {advancedFilterCount > 0 || sortBy !== "recent" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifiedOnly(false);
                          setHasPhone(false);
                          setHasEmail(false);
                          setMinOrders("");
                          setMinSpent("");
                          setAllBranches(false);
                          setSortBy("recent");
                          setPage(1);
                        }}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400"
                      >
                        Reset all
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">
                        Sort by
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          ["recent", "Most recent"],
                          ["name", "Name A–Z"],
                          ["spent_desc", "Most spent"],
                          ["spent_asc", "Least spent"],
                          ["orders_desc", "Most orders"],
                          ["orders_asc", "Least orders"],
                        ].map(([val, label]) => {
                          const active =
                            sortBy === val ||
                            (val === "spent_desc" && sortBy === "spent") ||
                            (val === "orders_desc" && sortBy === "orders");
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                setSortBy(val);
                                setPage(1);
                              }}
                              className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                                active
                                  ? "bg-primary text-white shadow-sm"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">
                        Minimums
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="mb-1 block text-[11px] text-gray-400 dark:text-neutral-500">
                            Orders
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={minOrders}
                            onChange={(e) => {
                              setMinOrders(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Any"
                            className="h-9 w-full rounded-xl border-2 border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-800 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                          />
                        </div>
                        <div>
                          <span className="mb-1 block text-[11px] text-gray-400 dark:text-neutral-500">
                            Spent ({sym})
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={minSpent}
                            onChange={(e) => {
                              setMinSpent(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Any"
                            className="h-9 w-full rounded-xl border-2 border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-800 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">
                        Contact
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          {
                            key: "phone",
                            label: "Has phone",
                            checked: hasPhone,
                            onChange: setHasPhone,
                          },
                          {
                            key: "email",
                            label: "Has email",
                            checked: hasEmail,
                            onChange: setHasEmail,
                          },
                          {
                            key: "verified",
                            label: "Verified",
                            checked: verifiedOnly,
                            onChange: setVerifiedOnly,
                          },
                          ...(currentBranch
                            ? [
                                {
                                  key: "branches",
                                  label: "All branches",
                                  checked: allBranches,
                                  onChange: setAllBranches,
                                },
                              ]
                            : []),
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              opt.onChange(!opt.checked);
                              setPage(1);
                            }}
                            className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                              opt.checked
                                ? "bg-primary text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(advancedFilterCount > 0 ||
                    sortBy !== "recent" ||
                    searchInput.trim()) && (
                    <div className="px-4 pb-3">
                      <button
                        type="button"
                        onClick={() => {
                          clearAllFilters();
                          setFiltersOpen(false);
                        }}
                        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl bg-red-50 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                      >
                        <X className="h-3.5 w-3.5" /> Clear all filters
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {activeFilters.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => clearFilterChip(chip.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-primary/40 hover:text-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                >
                  {chip.label}
                  <X className="w-3 h-3 opacity-60" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          {pageLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-7 h-7 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
                Loading customers…
              </p>
            </div>
          ) : empty ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                <UserCheck className="w-7 h-7 text-gray-400 dark:text-neutral-500" />
              </div>
              <p className="text-base font-semibold text-gray-800 dark:text-neutral-200">
                {activeFilters.length
                  ? "No customers match"
                  : "No customers yet"}
              </p>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 max-w-md">
                {activeFilters.length
                  ? "Try clearing filters or searching a different name, phone, or email."
                  : "Customers appear from POS orders, deliveries, and website sign-ups."}
              </p>
              {activeFilters.length ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <DataTable
                rows={customers}
                emptyMessage="No customers found."
                onRowClick={(c) => openCustomerDetail(c)}
                getRowClassName={() =>
                  "cursor-pointer hover:bg-gray-50/80 dark:hover:bg-neutral-900/50"
                }
                columns={[
                  {
                    key: "sno",
                    header: "#",
                    align: "center",
                    className: "w-[1%] whitespace-nowrap",
                    cellClassName:
                      "text-gray-500 dark:text-neutral-400 font-medium tabular-nums",
                    render: (_, __, rowIndex) =>
                      (page - 1) * pageSize + rowIndex + 1,
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    align: "left",
                    className: "w-[1%] whitespace-nowrap",
                    render: (_, c) => (
                      <div
                        className="inline-flex w-[5.75rem] items-center justify-start gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {c.recordType === "website" ? (
                          <span
                            className="inline-flex h-7 w-7 shrink-0"
                            aria-hidden
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-primary dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-secondary transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openCustomerDetail(c)}
                          className="inline-flex h-5 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-semibold text-white hover:bg-primary/90 transition-colors"
                        >
                          <History className="w-3 h-3" />
                          View
                        </button>
                      </div>
                    ),
                  },
                  {
                    key: "name",
                    header: "Customer",
                    render: (val) => (
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {val || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "phone",
                    header: "Phone",
                    hideOnMobile: true,
                    render: (val) =>
                      val ? (
                        <span className="font-medium text-gray-700 dark:text-neutral-300 tabular-nums">
                          {val}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-600">
                          —
                        </span>
                      ),
                  },
                  {
                    key: "email",
                    header: "Email",
                    hideOnMobile: true,
                    render: (val) =>
                      val ? (
                        <span className="text-gray-600 dark:text-neutral-400 truncate max-w-[14rem] inline-block align-bottom">
                          {val}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-600">
                          —
                        </span>
                      ),
                  },
                  {
                    key: "totalOrders",
                    header: "Orders",
                    align: "center",
                    render: (val) => (
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold tabular-nums">
                        {val ?? 0}
                      </span>
                    ),
                  },
                  {
                    key: "totalSpent",
                    header: "Spent",
                    align: "right",
                    render: (val) => (
                      <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                        {sym} {(val ?? 0).toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: "lastOrderAt",
                    header: "Last order",
                    hideOnMobile: true,
                    render: (val) =>
                      val ? (
                        <span className="text-sm text-gray-600 dark:text-neutral-400 tabular-nums">
                          {new Date(val).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-600">
                          —
                        </span>
                      ),
                  },
                  {
                    key: "address",
                    header: "Address",
                    hideOnTablet: true,
                    render: (val) =>
                      val ? (
                        <span className="text-gray-600 dark:text-neutral-400 line-clamp-1 max-w-[16rem]">
                          {val}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-600">
                          —
                        </span>
                      ),
                  },
                ]}
              />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/70 dark:bg-neutral-900/40">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-gray-600 dark:text-neutral-400">
                    {total === 0
                      ? "No rows"
                      : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
                  </p>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-neutral-400">
                    Rows
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-8 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-xs font-semibold text-gray-700 dark:text-neutral-200 outline-none focus:border-primary"
                      aria-label="Rows per page"
                    >
                      {[50, 100, 150, 200, 250, 300].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-300 disabled:opacity-40 hover:bg-white dark:hover:bg-neutral-800"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-neutral-300 px-2 tabular-nums">
                    {page} / {totalPages}
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
              className="absolute inset-0 bg-black/45"
              aria-label="Close panel"
              onClick={() => {
                setDetailOpen(false);
                setDetailHistory(null);
              }}
            />
            <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-neutral-950 animate-in slide-in-from-right duration-200">
              {/* Hero — one composition: person + value */}
              <div className="relative overflow-hidden border-b border-gray-200 dark:border-neutral-800">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
                <div className="relative px-5 pb-5 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide text-primary">
                      {detailStats.segment}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailOpen(false);
                        setDetailHistory(null);
                      }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <h2 className="mt-1 text-[1.75rem] font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
                    {detailCustomer.name || "Guest"}
                  </h2>
                  <p className="mt-1.5 text-sm text-gray-500 dark:text-neutral-400">
                    {[
                      detailCustomer.phone || null,
                      detailCustomer.hasWebsiteAccount
                        ? "Orders online too"
                        : null,
                      detailCustomer.branchName ||
                        (currentBranch?.id === detailCustomer.branchId
                          ? currentBranch?.name
                          : null),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No contact on file"}
                  </p>

                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Lifetime value
                      </p>
                      <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight text-primary">
                        {sym}{" "}
                        {Number(detailStats.totalSpent || 0).toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                        {detailStats.totalOrders} order
                        {detailStats.totalOrders === 1 ? "" : "s"}
                        {detailStats.avg > 0
                          ? ` · avg ${sym} ${detailStats.avg.toLocaleString()}`
                          : ""}
                        {detailStats.lastOrderAt
                          ? ` · last ${formatDate(detailStats.lastOrderAt)}`
                          : ""}
                      </p>
                    </div>
                    {detailCustomer.recordType !== "website" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDetailOpen(false);
                          startEdit(detailCustomer);
                        }}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Reach — dense, no cards */}
                <section className="border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Reach them
                  </p>
                  <div className="space-y-0 divide-y divide-gray-100 dark:divide-neutral-800">
                    {[
                      {
                        icon: Phone,
                        label: "Phone",
                        value: detailCustomer.phone,
                        copy: true,
                      },
                      {
                        icon: Mail,
                        label: "Email",
                        value: detailCustomer.email,
                        copy: true,
                      },
                      {
                        icon: MapPin,
                        label: "Address",
                        value: detailCustomer.address,
                        copy: true,
                      },
                    ].map((row) => {
                      const empty = !row.value || !String(row.value).trim();
                      const Icon = row.icon;
                      return (
                        <div
                          key={row.label}
                          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                              {row.label}
                            </p>
                            <p
                              className={`truncate text-sm font-medium ${
                                empty
                                  ? "text-gray-300 dark:text-neutral-600"
                                  : "text-gray-900 dark:text-white"
                              }`}
                            >
                              {empty ? "Not on file" : row.value}
                            </p>
                          </div>
                          {row.copy && !empty ? (
                            <button
                              type="button"
                              onClick={() =>
                                copyDetailValue(row.label, row.value)
                              }
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary dark:hover:bg-neutral-800"
                              title={`Copy ${row.label.toLowerCase()}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-neutral-500">
                    With you since {formatDate(detailCustomer.createdAt)}
                    {detailCustomer.hasWebsiteAccount
                      ? " · Has a website login"
                      : " · POS / walk-in only"}
                    {detailCustomer.verified ? " · Verified" : ""}
                  </p>
                </section>

                {/* Orders — the relationship story */}
                <section className="px-5 py-4">
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Their orders
                    </p>
                    {!detailLoading && detailOrders.length > 0 ? (
                      <span className="text-[11px] text-gray-400">
                        {detailStats.websiteOrders > 0
                          ? `${detailStats.websiteOrders} web · ${detailStats.posOrders} POS`
                          : `${detailOrders.length} recent`}
                      </span>
                    ) : null}
                  </div>

                  {detailLoading ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Loading orders…
                    </div>
                  ) : !detailOrders.length ? (
                    <p className="py-6 text-sm leading-relaxed text-gray-500 dark:text-neutral-400">
                      No order history linked yet. When they order again from
                      POS or the website, it will show up here.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {detailOrders.slice(0, 15).map((o) => {
                        const isWeb =
                          String(o.source || "").toUpperCase() === "WEBSITE";
                        const itemSummary = Array.isArray(o.items)
                          ? o.items
                              .slice(0, 3)
                              .map(
                                (it) =>
                                  `${it.quantity || 1}× ${it.name || "Item"}`,
                              )
                              .join(", ")
                          : "";
                        return (
                          <li key={o.id} className="py-3 first:pt-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <Link
                                    href={`/pos?editOrder=${encodeURIComponent(o.id)}`}
                                    className="font-mono text-sm font-semibold text-primary hover:underline"
                                  >
                                    {o.orderNumber || o.id}
                                  </Link>
                                  <span className="text-[10px] font-medium text-gray-400">
                                    {isWeb ? "Website" : "POS"}
                                    {o.orderType ? ` · ${o.orderType}` : ""}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">
                                  {formatDateTime(o.createdAt)}
                                  {o.paymentMethod
                                    ? ` · ${o.paymentMethod}`
                                    : ""}
                                </p>
                                {itemSummary ? (
                                  <p className="mt-1 truncate text-xs text-gray-600 dark:text-neutral-300">
                                    {itemSummary}
                                    {o.items.length > 3 ? "…" : ""}
                                  </p>
                                ) : null}
                                {o.deliveryAddress ? (
                                  <p className="mt-0.5 truncate text-xs text-gray-400">
                                    {o.deliveryAddress}
                                  </p>
                                ) : null}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                  {sym} {(o.total ?? 0).toLocaleString()}
                                </p>
                                <span
                                  className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${orderStatusTone(
                                    o.status,
                                  )}`}
                                >
                                  {o.status || "—"}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                {/* Notes */}
                <section className="border-t border-gray-100 px-5 py-4 dark:border-neutral-800">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Private notes
                  </p>
                  <textarea
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    disabled={detailCustomer.recordType === "website"}
                    rows={3}
                    placeholder="Preferences, allergies, how they like to be greeted…"
                    className="w-full resize-none rounded-lg border-0 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none ring-1 ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-primary/30 disabled:opacity-60 dark:bg-neutral-900 dark:text-white dark:ring-neutral-700"
                  />
                  {detailCustomer.recordType !== "website" ? (
                    <button
                      type="button"
                      onClick={() => void saveCustomerNotes()}
                      disabled={notesSaving}
                      className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {notesSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Save notes
                    </button>
                  ) : null}
                </section>
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
                    Edit Customer
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Update customer details
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

                <form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                  autoComplete="off"
                >
                  <div className="space-y-1.5">
                    <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      Name *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Customer name"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="03XX-XXXXXXX"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="email@example.com"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      Address
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      placeholder="Delivery address"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
                      Notes
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder="Optional notes"
                      rows={3}
                      className={`${inputClass} h-auto py-2.5 resize-none`}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      className="h-10 px-4 rounded-xl text-sm font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                      onClick={() => {
                        resetForm();
                        setIsModalOpen(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-4 h-4" />
                          Save changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </PermissionGate>
    </AdminLayout>
  );
}
