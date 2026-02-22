import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { getSuperBranches, setActingAsRestaurant } from "../../../lib/apiClient";

export default function SuperBranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSuperBranches()
      .then((data) => setBranches(data?.branches ?? []))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="All Branches">
      <Card
        title="Branches across all restaurants"
        description="View every branch from every restaurant. Use Login to open that restaurant's dashboard."
      >
        <div className="max-h-[32rem] overflow-y-auto text-xs">
          <table className="w-full text-xs">
            <thead className="text-[11px] uppercase text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-neutral-700">
              <tr>
                <th className="py-2 text-left">Restaurant</th>
                <th className="py-2 text-left">Subdomain</th>
                <th className="py-2 text-left">Branch</th>
                <th className="py-2 text-left">Code</th>
                <th className="py-2 text-left">Address</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    Loading…
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                  >
                    <td className="py-3 pr-3 font-medium text-gray-900 dark:text-white">
                      {b.restaurantName || "—"}
                    </td>
                    <td className="py-3 pr-3 text-gray-700 dark:text-neutral-300">
                      {b.subdomain || "—"}
                    </td>
                    <td className="py-3 pr-3 font-medium text-gray-900 dark:text-white">
                      {b.name || "—"}
                    </td>
                    <td className="py-3 pr-3 text-gray-600 dark:text-neutral-400">
                      {b.code || "—"}
                    </td>
                    <td className="py-3 pr-3 text-gray-600 dark:text-neutral-400 max-w-[180px] truncate">
                      {b.address || "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`badge text-[10px] ${
                          b.status === "active"
                            ? "badge-success"
                            : b.status === "inactive"
                              ? "badge-warning"
                              : "badge-danger"
                        }`}
                      >
                        {b.status || "active"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {b.subdomain && (
                        <Button
                          type="button"
                          variant="primary"
                          className="px-3 text-[11px] font-semibold"
                          onClick={() => {
                            setActingAsRestaurant(b.subdomain);
                            window.location.href = "/dashboard/overview";
                          }}
                        >
                          Login
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {!loading && branches.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-neutral-500"
                  >
                    No branches found. Branches are created per restaurant in their dashboard.
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
