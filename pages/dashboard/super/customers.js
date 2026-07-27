import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import DataTable from "../../../components/ui/DataTable";
import {
  downloadCustomersCsvForSuperAdmin,
  getCustomersForSuperAdmin,
  getCustomerStatsForSuperAdmin,
  getRestaurantsForSuperAdmin,
} from "../../../lib/apiClient";
import { usePermissions } from "../../../contexts/PermissionContext";
import {
  ChevronDown,
  FileDown,
  Globe2,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

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

function formatCurrency(value) {
  const n = Number(value) || 0;
  return `Rs ${n.toLocaleString()}`;
}

const SORT_OPTIONS = [
  ["recent", "Most recent"],
  ["name", "Name A–Z"],
  ["spent_desc", "Most spent"],
  ["spent_asc", "Least spent"],
  ["orders_desc", "Most orders"],
  ["orders_asc", "Least orders"],
];

function RestaurantBreakdownCell({ customer, uniqueView }) {
  const [open, setOpen] = useState(false);
  const breakdown = customer.restaurantBreakdown || [];

  if (!uniqueView || breakdown.length <= 1) {
    return customer.restaurantName || breakdown[0]?.restaurantName || "—";
  }

  return (
    <div className="min-w-[150px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
        aria-expanded={open}
      >
        {breakdown.length} restaurants
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 min-w-[220px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900">
          {breakdown.map((item) => (
            <div
              key={item.restaurantId}
              className="flex items-center justify-between gap-4 border-b border-gray-200 px-2.5 py-2 last:border-b-0 dark:border-neutral-700"
            >
              <span className="max-w-[150px] truncate font-medium text-gray-700 dark:text-neutral-200">
                {item.restaurantName}
              </span>
              <span className="shrink-0 tabular-nums text-gray-500 dark:text-neutral-400">
                {item.orders.toLocaleString()} order{item.orders === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperCustomersPage() {
  const { hasPermission } = usePermissions();
  const canExport = hasPermission("platform.customers.export");

  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [hasEmail, setHasEmail] = useState("");
  const [hasWebsite, setHasWebsite] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("unique");
  const [audience, setAudience] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    function onClickOutside(e) {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    getCustomerStatsForSuperAdmin()
      .then(setStats)
      .catch(() => {});
    getRestaurantsForSuperAdmin()
      .then((list) => setRestaurants(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomersForSuperAdmin({
        search: search || undefined,
        restaurantId: restaurantId || undefined,
        hasEmail: hasEmail || undefined,
        hasWebsite: hasWebsite || undefined,
        view,
        audience: view === "unique" ? audience || undefined : undefined,
        sort,
        page,
        pageSize,
      });
      setCustomers(res?.customers || []);
      setTotal(res?.total || 0);
      setTotalPages(res?.totalPages || 1);
    } catch (err) {
      toast.error(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [
    search,
    restaurantId,
    hasEmail,
    hasWebsite,
    view,
    audience,
    sort,
    page,
    pageSize,
  ]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const restaurantOptions = useMemo(
    () =>
      restaurants
        .map((r) => [r.id, r.website?.name || r.website?.subdomain || "Unnamed"])
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
    [restaurants],
  );

  const hasActiveFilters =
    !!search ||
    !!restaurantId ||
    !!hasEmail ||
    !!hasWebsite ||
    !!audience ||
    sort !== "recent";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setRestaurantId("");
    setHasEmail("");
    setHasWebsite("");
    setAudience("");
    setSort("recent");
    setPage(1);
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadCustomersCsvForSuperAdmin({
        search: search || undefined,
        restaurantId: restaurantId || undefined,
        hasEmail: hasEmail || undefined,
        hasWebsite: hasWebsite || undefined,
        view,
        audience: view === "unique" ? audience || undefined : undefined,
        sort,
      });
      toast.success("Export started");
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout
      title="Customers"
      subtitle="Cross-tenant customer directory for marketing & analytics"
    >
      <SuperPageGate permission="platform.customers.view">
        <div className="flex flex-col gap-4">
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: "Restaurant entries",
                value: stats?.totalRecords ?? "—",
                tone: "text-gray-900 dark:text-white",
              },
              {
                label: "Unique customers",
                value: stats?.uniqueCustomers ?? "—",
                tone: "text-sky-700 dark:text-sky-300",
              },
              {
                label: "With email",
                value: stats?.withEmail ?? "—",
                tone: "text-blue-700 dark:text-blue-300",
              },
              {
                label: "Multi-restaurant",
                value: stats?.multiRestaurantCustomers ?? "—",
                tone: "text-emerald-700 dark:text-emerald-300",
              },
              {
                label: "Repeated numbers",
                value: stats?.repeatedNumbers ?? "—",
                tone: "text-violet-700 dark:text-violet-300",
              },
              {
                label: "Restaurants covered",
                value: stats?.restaurantsWithCustomers ?? "—",
                tone: "text-orange-700 dark:text-orange-300",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                  {card.label}
                </p>
                <p className={`mt-0.5 text-xl font-black tabular-nums ${card.tone}`}>
                  {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-9 rounded-lg bg-gray-100 p-1 dark:bg-neutral-800">
              {[
                ["unique", "Unique customers"],
                ["records", "Restaurant entries"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setView(value);
                    setAudience("");
                    setPage(1);
                  }}
                  className={`rounded-md px-3 text-xs font-semibold transition-colors ${
                    view === value
                      ? "bg-white text-gray-900 shadow-sm dark:bg-neutral-950 dark:text-white"
                      : "text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-xs sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, phone..."
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              />
            </div>

            <select
              value={restaurantId}
              onChange={(e) => {
                setRestaurantId(e.target.value);
                setPage(1);
              }}
              className="h-9 min-w-[160px] max-w-[220px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              <option value="">All restaurants</option>
              {restaurantOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>

            {view === "unique" && (
              <select
                value={audience}
                onChange={(e) => {
                  setAudience(e.target.value);
                  setPage(1);
                }}
                className="h-9 min-w-[150px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                <option value="">All audiences</option>
                <option value="multi_restaurant">Multiple restaurants</option>
                <option value="repeated_number">Repeated numbers</option>
              </select>
            )}

            <div className="relative" ref={filtersRef}>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                  hasActiveFilters
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {filtersOpen && (
                <div className="absolute right-0 top-full z-[100] mt-1.5 w-72 overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="space-y-4 p-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">
                        Sort by
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SORT_OPTIONS.map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setSort(val);
                              setPage(1);
                            }}
                            className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                              sort === val
                                ? "bg-primary text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">
                        Email
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          ["", "Any"],
                          ["true", "Has email"],
                          ["false", "No email"],
                        ].map(([val, label]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              setHasEmail(val);
                              setPage(1);
                            }}
                            className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                              hasEmail === val
                                ? "bg-primary text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-neutral-400">
                        Website account
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          ["", "Any"],
                          ["true", "Yes"],
                          ["false", "No"],
                        ].map(([val, label]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              setHasWebsite(val);
                              setPage(1);
                            }}
                            className={`h-8 rounded-lg text-xs font-semibold transition-all ${
                              hasWebsite === val
                                ? "bg-primary text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-neutral-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <span className="text-xs text-gray-500 dark:text-neutral-500">
              {total.toLocaleString()}{" "}
              {view === "unique" ? "unique customer" : "restaurant entry"}
              {total === 1 ? "" : "s"}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={loadCustomers}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              {canExport && (
                <button
                  type="button"
                  disabled={exporting}
                  onClick={handleExport}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  Export {view === "unique" ? "unique" : "records"} CSV
                </button>
              )}
            </div>
          </div>

          <DataTable
            showSno
            data={customers}
            loading={loading}
            emptyMessage={
              hasActiveFilters
                ? "No customers match your search or filters."
                : "No customers found."
            }
            columns={[
              {
                key: "name",
                header: "Name",
                render: (_, c) => (
                  <div className="font-medium text-gray-900 dark:text-white">
                    {c.name || "Unnamed"}
                  </div>
                ),
              },
              {
                key: "phone",
                header: "Phone",
                render: (_, c) =>
                  c.phone ? (
                    <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-neutral-300">
                      <Phone className="h-3 w-3 text-gray-400" />
                      {c.phone}
                    </span>
                  ) : (
                    "—"
                  ),
                cellClassName: "whitespace-nowrap text-xs",
              },
              {
                key: "email",
                header: "Email",
                render: (_, c) =>
                  c.email ? (
                    <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-neutral-300">
                      <Mail className="h-3 w-3 text-gray-400" />
                      {c.email}
                    </span>
                  ) : (
                    "—"
                  ),
                cellClassName: "truncate max-w-[200px] text-xs",
              },
              {
                key: "restaurant",
                header: view === "unique" ? "Restaurants" : "Restaurant",
                render: (_, c) => (
                  <RestaurantBreakdownCell
                    customer={c}
                    uniqueView={view === "unique"}
                  />
                ),
                cellClassName:
                  "text-gray-600 dark:text-neutral-400 text-xs align-top",
              },
              ...(view === "unique"
                ? [
                    {
                      key: "records",
                      header: "Records",
                      align: "right",
                      render: (_, c) => (
                        <span
                          title={
                            c.recordCount > 1
                              ? `${c.recordCount} restaurant entries share this contact identity`
                              : "One restaurant entry"
                          }
                          className={
                            c.recordCount > 1
                              ? "font-bold text-violet-700 dark:text-violet-300"
                              : ""
                          }
                        >
                          {c.recordCount || 1}
                        </span>
                      ),
                      cellClassName: "text-right tabular-nums text-xs",
                    },
                  ]
                : []),
              {
                key: "orders",
                header: "Orders",
                align: "right",
                render: (_, c) => c.totalOrders ?? 0,
                cellClassName: "text-right tabular-nums text-xs font-semibold",
              },
              {
                key: "spent",
                header: "Spent",
                align: "right",
                render: (_, c) => formatCurrency(c.totalSpent),
                cellClassName: "text-right tabular-nums text-xs font-semibold",
              },
              {
                key: "website",
                header: "Website",
                align: "center",
                render: (_, c) =>
                  c.hasWebsiteAccount ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Globe2 className="h-3 w-3" />
                      Yes
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-neutral-500">
                      No
                    </span>
                  ),
              },
              {
                key: "createdAt",
                header: "Last order",
                render: (_, c) => formatDateTime(c.lastOrderAt),
                cellClassName:
                  "text-gray-500 dark:text-neutral-400 whitespace-nowrap text-xs",
              },
            ]}
          />

          {/* Pagination footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-gray-500 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              <span>
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </SuperPageGate>
    </AdminLayout>
  );
}
