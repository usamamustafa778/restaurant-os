import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import {
  getRestaurantsForSuperAdmin,
  updateRestaurantSubscription,
  setActingAsRestaurant,
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import { Search, ChevronDown } from "lucide-react";

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
  const [updatingId, setUpdatingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusDropdownId, setStatusDropdownId] = useState(null);
  const dropdownRef = useRef(null);
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    getRestaurantsForSuperAdmin().then(setRestaurants);
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
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
              <div className="relative flex-1 max-w-sm">
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
                          <div className="inline-flex items-center gap-1 justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              onClick={() => {
                                const slug = website.subdomain || null;
                                if (slug) {
                                  setActingAsRestaurant(slug);
                                  window.location.href = "/dashboard/overview";
                                }
                              }}
                              className="px-3 text-[11px] font-semibold"
                              title="Open this restaurant's dashboard"
                            >
                              Login
                            </Button>
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
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

