import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import {
  getRestaurantsForSuperAdmin,
  updateRestaurantSubscription
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";

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
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    getRestaurantsForSuperAdmin().then(setRestaurants);
  }, []);

  async function handleStatusChange(id, status) {
    const cfg = STATUS_CONFIRM[status] || {};
    const ok = await confirm({
      title: cfg.title || "Change Status",
      message: cfg.message || `Change subscription status to ${status}?`,
      confirmLabel: cfg.confirmLabel || "Confirm",
    });
    if (!ok) return;

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
      <Card
        title="All restaurants"
        description="Manage tenant status: Trial, Active or Suspended."
      >
        <div className="max-h-[28rem] overflow-y-auto text-xs">
            <table className="w-full text-xs">
            <thead className="text-[11px] uppercase text-gray-800 border-b border-gray-300">
              <tr>
                <th className="py-2 text-left">Restaurant</th>
                <th className="py-2 text-left">Subdomain</th>
                <th className="py-2 text-left">Plan</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Trial ends</th>
                <th className="py-2 text-left">Expires</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {restaurants.map(r => {
                const sub = r.subscription || {};
                const website = r.website || {};
                return (
                  <tr key={r.id} className="hover:bg-bg-primary">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-gray-900">
                        {website.name || "Untitled restaurant"}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-gray-700">
                      {website.subdomain || "—"}
                    </td>
                    <td className="py-3 pr-3 text-gray-700">
                      {sub.plan || "ESSENTIAL"}
                    </td>
                    <td className="py-3 pr-3">
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
                    <td className="py-3 pr-3 text-neutral-400">
                      {sub.trialEndsAt
                        ? new Date(sub.trialEndsAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-3 pr-3 text-neutral-400">
                      {sub.expiresAt
                        ? new Date(sub.expiresAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={updatingId === r.id}
                          onClick={() => handleStatusChange(r.id, "TRIAL")}
                          className="px-2 text-[11px]"
                        >
                          Trial
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={updatingId === r.id}
                          onClick={() => handleStatusChange(r.id, "ACTIVE")}
                          className="px-2 text-[11px] text-emerald-300"
                        >
                          Active
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={updatingId === r.id}
                          onClick={() => handleStatusChange(r.id, "SUSPENDED")}
                          className="px-2 text-[11px] text-red-500"
                        >
                          Suspend
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {restaurants.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-xs text-neutral-500"
                  >
                    No restaurants yet. Onboard tenants via the API.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminLayout>
  );
}

