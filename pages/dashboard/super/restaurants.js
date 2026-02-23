import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import {
  getRestaurantsForSuperAdmin,
  getDeletedRestaurantsForSuperAdmin,
  updateRestaurantSubscription,
  setActingAsRestaurant,
  deleteRestaurantForSuperAdmin,
  restoreRestaurantForSuperAdmin,
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import { Search, ChevronDown, Trash2, X, Loader2, FileDown } from "lucide-react";
import toast from "react-hot-toast";

function escapeCsvCell(value) {
  if (value == null || value === "") return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadRestaurantsExcel(rows) {
  const headers = [
    "S.No",
    "Restaurant",
    "Subdomain",
    "Owner Phone",
    "Owner Email",
    "Plan",
    "Status",
    "Trial Ends",
    "Expires",
    "Created",
  ];
  const csvRows = [
    headers.join(","),
    ...rows.map((r, i) => {
      const sub = r.subscription || {};
      const website = r.website || {};
      return [
        i + 1,
        escapeCsvCell(website.name || "Untitled"),
        escapeCsvCell(website.subdomain || ""),
        escapeCsvCell(website.contactPhone || ""),
        escapeCsvCell(website.contactEmail || ""),
        escapeCsvCell(sub.plan || "ESSENTIAL"),
        escapeCsvCell(sub.status || "TRIAL"),
        sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : "",
        sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : "",
        r.createdAt
          ? new Date(r.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
          : "",
      ].join(",");
    }),
  ];
  const csv = csvRows.join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `restaurants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_CONFIRM = {
  TRIAL: {
    title: "Reset to Trial",
    message: "This will reset the restaurant's subscription status to Trial. Are you sure?",
    confirmLabel: "Set Trial",
  },
  ACTIVE: {
    title: "Activate Subscription",
    message: "This will activate the restaurant's subscription, granting full access. Continue?",
    confirmLabel: "Activate",
  },
  SUSPENDED: {
    title: "Suspend Restaurant",
    message: "This will suspend the restaurant. All dashboard and public website access will be blocked until reactivated. Are you sure?",
    confirmLabel: "Suspend",
  },
};

export default function SuperRestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [deletedRestaurants, setDeletedRestaurants] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { confirm } = useConfirmDialog();

  function loadRestaurants() {
    getRestaurantsForSuperAdmin().then(setRestaurants);
  }
  function loadDeleted() {
    getDeletedRestaurantsForSuperAdmin()
      .then(setDeletedRestaurants)
      .catch(() => setDeletedRestaurants([]));
  }

  useEffect(() => {
    loadRestaurants();
    loadDeleted();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setStatusDropdownId(null);
      }
    };
    if (statusDropdownId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [statusDropdownId]);

  const filtered = searchQuery.trim()
    ? restaurants.filter((r) => {
        const name = (r.website?.name || "").toLowerCase();
        const sub = (r.website?.subdomain || "").toLowerCase();
        const phone = (r.website?.contactPhone || "").toLowerCase();
        const email = (r.website?.contactEmail || "").toLowerCase();
        const plan = (r.subscription?.plan || "").toLowerCase();
        const status = (r.subscription?.status || "").toLowerCase();
        const q = searchQuery.trim().toLowerCase();
        return name.includes(q) || sub.includes(q) || phone.includes(q) || email.includes(q) || plan.includes(q) || status.includes(q);
      })
    : restaurants;

  async function handleStatusChange(id, status) {
    const cfg = STATUS_CONFIRM[status] || {};
    const ok = await confirm({
      title: cfg.title || "Change Status",
      message: cfg.message || `Change subscription status to ${status}?`,
      confirmLabel: cfg.confirmLabel || "Confirm",
    });
    if (!ok) return;
    setStatusDropdownId(null);
    setUpdatingId(id);
    try {
      const updated = await updateRestaurantSubscription(id, { status });
      setRestaurants(prev =>
        prev.map(r => (r.id === updated.id ? { ...r, subscription: updated.subscription } : r))
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AdminLayout title="Restaurants & Subscriptions">
      <div className="flex flex-col min-h-[calc(100vh-14rem)]">
        <Card
          title="All restaurants"
          description="Manage tenant status: Trial, Active or Suspended."
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by name, subdomain, phone, email, plan or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              {searchQuery && (
                <span className="text-xs text-neutral-500">
                  {filtered.length} of {restaurants.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (filtered.length === 0) {
                    toast.error("No data to export");
                    return;
                  }
                  downloadRestaurantsExcel(filtered);
                  toast.success(`Exported ${filtered.length} restaurant(s) to Excel`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                title="Download table as Excel (CSV)"
              >
                <FileDown className="w-4 h-4" />
                Download Excel
              </button>
              {deletedRestaurants.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDeletedDropdownOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/60 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                  >
                    Recently deleted
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-700 text-[10px] text-white">
                      {deletedRestaurants.length}
                    </span>
                  </button>
                  {deletedDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-neutral-950 border border-amber-200 dark:border-amber-700 shadow-lg z-20">
                      <div className="px-3 py-2 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                          Restore restaurants (48h)
                        </span>
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {deletedRestaurants.map((r) => (
                          <div
                            key={r.id}
                            className="px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-amber-900 dark:text-amber-100 truncate">
                                {r.website?.name || "Untitled"}
                              </p>
                              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-mono truncate">
                                {r.website?.subdomain || "—"}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md bg-emerald-600 text-[10px] text-white font-semibold hover:bg-emerald-700 flex-shrink-0"
                              onClick={async () => {
                                const name = r.website?.name || "Restaurant";
                                const toastId = toast.loading(`Restoring "${name}"...`);
                                try {
                                  await restoreRestaurantForSuperAdmin(r.id);
                                  loadRestaurants();
                                  loadDeleted();
                                  setDeletedDropdownOpen(false);
                                  toast.success(`"${name}" restored.`, { id: toastId });
                                } catch (err) {
                                  toast.error(err.message || "Failed to restore", { id: toastId });
                                }
                              }}
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="min-h-[60vh] overflow-auto text-xs border border-gray-200 dark:border-neutral-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="text-[11px] uppercase text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 sticky top-0 z-[1]">
                  <tr>
                    <th className="py-2 text-left px-3 w-12">S.No</th>
                    <th className="py-2 text-left px-3">Restaurant</th>
                    <th className="py-2 text-left px-3">Subdomain</th>
                    <th className="py-2 text-left px-3">Owner phone</th>
                    <th className="py-2 text-left px-3">Owner email</th>
                    <th className="py-2 text-left px-3">Plan</th>
                    <th className="py-2 text-left px-3">Status</th>
                    <th className="py-2 text-left px-3">Trial ends</th>
                    <th className="py-2 text-left px-3">Expires</th>
                    <th className="py-2 text-left px-3">Created</th>
                    <th className="py-2 text-right px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {filtered.map((r, index) => {
                    const sub = r.subscription || {};
                    const website = r.website || {};
                    const isDropdownOpen = statusDropdownId === r.id;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                        <td className="py-3 px-3 text-neutral-500 dark:text-neutral-400 font-medium">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {website.name || "Untitled restaurant"}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-neutral-300">
                          {website.subdomain || "—"}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                          {website.contactPhone || "—"}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-neutral-300 truncate max-w-[180px]" title={website.contactEmail || ""}>
                          {website.contactEmail || "—"}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-neutral-300">
                          {sub.plan || "ESSENTIAL"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`badge text-[10px] ${
                              sub.status === "ACTIVE"
                                ? "badge-success"
                                : sub.status === "TRIAL"
                                  ? "badge-warning"
                                  : "badge-danger"
                            }`}
                          >
                            {sub.status || "TRIAL"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-neutral-400">
                          {sub.trialEndsAt
                            ? new Date(sub.trialEndsAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 px-3 text-neutral-400">
                          {sub.expiresAt
                            ? new Date(sub.expiresAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-3 px-3 text-neutral-400 whitespace-nowrap">
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              onClick={() => {
                                const slug = website.subdomain || null;
                                if (slug) {
                                  setActingAsRestaurant(slug);
                                  window.open("/dashboard/overview", "_blank");
                                }
                              }}
                              className="px-3 text-[11px] font-semibold"
                              title="Open this restaurant's dashboard in a new tab"
                            >
                              Login
                            </Button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/40"
                              title="Soft-delete (recoverable 48h)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                            <div className="relative" ref={isDropdownOpen ? dropdownRef : null}>
                              <button
                                type="button"
                                disabled={updatingId === r.id}
                                onClick={() =>
                                  setStatusDropdownId(isDropdownOpen ? null : r.id)
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 text-[11px] font-medium hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Status
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                                />
                              </button>
                              {isDropdownOpen && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 z-20">
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(r.id, "TRIAL")}
                                    className="w-full text-left px-4 py-2 text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                                  >
                                    Trial
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(r.id, "ACTIVE")}
                                    className="w-full text-left px-4 py-2 text-[11px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                  >
                                    Active
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(r.id, "SUSPENDED")}
                                    className="w-full text-left px-4 py-2 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                  >
                                    Suspend
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-8 text-center text-xs text-neutral-500"
                      >
                        {restaurants.length === 0
                          ? "No restaurants yet. Onboard tenants via the API."
                          : "No restaurants match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Delete restaurant confirmation modal */}
            {deleteTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60">
                <div className="bg-white dark:bg-neutral-900 rounded-xl border-2 border-gray-200 dark:border-neutral-700 shadow-2xl w-full max-w-md">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-700">
                    <h3 className="font-bold text-gray-900 dark:text-white">Delete restaurant</h3>
                    <button
                      type="button"
                      onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <p className="text-xs text-gray-600 dark:text-neutral-400">
                      This will <span className="font-semibold">soft delete</span> the restaurant{" "}
                      <span className="font-semibold">&quot;{deleteTarget.website?.name || "Untitled"}&quot;</span>. It can be recovered within{" "}
                      <span className="font-semibold">48 hours</span> from &quot;Recently deleted&quot;. To confirm, type the restaurant name exactly.
                    </p>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 dark:text-neutral-300 mb-1">
                        Type <span className="font-mono">{deleteTarget.website?.name || "Untitled"}</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        placeholder={deleteTarget.website?.name || "Untitled"}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-700">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
                      className="px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="px-4 bg-red-600 hover:bg-red-700 text-white"
                      disabled={
                        deleteLoading ||
                        deleteConfirmName.trim() !== (deleteTarget.website?.name || "Untitled").trim()
                      }
                      onClick={async () => {
                        setDeleteLoading(true);
                        const name = deleteTarget.website?.name || "Restaurant";
                        const toastId = toast.loading(`Deleting "${name}"...`);
                        try {
                          await deleteRestaurantForSuperAdmin(deleteTarget.id);
                          loadRestaurants();
                          loadDeleted();
                          setDeleteTarget(null);
                          setDeleteConfirmName("");
                          toast.success(`"${name}" deleted. Recover within 48h from Recently deleted.`, { id: toastId });
                        } catch (err) {
                          toast.error(err.message || "Failed to delete restaurant", { id: toastId });
                        } finally {
                          setDeleteLoading(false);
                        }
                      }}
                    >
                      {deleteLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Delete restaurant"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

