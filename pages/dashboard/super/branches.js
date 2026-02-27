import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import {
  getSuperBranches,
  getDeletedBranchesForSuperAdmin,
  deleteBranchForSuperAdmin,
  restoreBranchForSuperAdmin,
  permanentlyDeleteBranchForSuperAdmin,
  setActingAsRestaurant,
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function SuperBranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletedBranches, setDeletedBranches] = useState([]);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);
  const { confirm } = useConfirmDialog();

  function loadBranches() {
    getSuperBranches()
      .then((data) => setBranches(data?.branches ?? []))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }

  function loadDeletedBranches() {
    getDeletedBranchesForSuperAdmin()
      .then((data) => setDeletedBranches(data?.branches ?? []))
      .catch(() => setDeletedBranches([]));
  }

  useEffect(() => {
    loadBranches();
    loadDeletedBranches();
  }, []);

  return (
    <AdminLayout title="All Branches">
      <Card
        title="Branches across all restaurants"
        description="View every branch from every restaurant. Use Login to open that restaurant's dashboard."
      >
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <p className="text-xs text-neutral-500">
              Total branches:{" "}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {branches.length}
              </span>
            </p>
            {deletedBranches.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDeletedDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/60 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                >
                  Recently deleted
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-amber-700 text-[10px] text-white">
                    {deletedBranches.length}
                  </span>
                </button>
                {deletedDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-neutral-950 border border-amber-200 dark:border-amber-700 shadow-lg z-20">
                    <div className="px-3 py-2 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                        Restore branches (48h)
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {deletedBranches.map((b) => (
                        <div
                          key={b.id}
                          className="px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-amber-900 dark:text-amber-100 truncate">
                              {b.name || "Untitled"}
                            </p>
                            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-mono truncate">
                              {b.restaurantName || "—"} · {b.subdomain || "—"}
                            </p>
                            {b.deletedAt && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-300/80 mt-0.5">
                                {(() => {
                                  const deletedAt = new Date(b.deletedAt);
                                  const totalMs = 48 * 60 * 60 * 1000;
                                  const elapsed = Date.now() - deletedAt.getTime();
                                  const remaining = Math.max(0, totalMs - elapsed);
                                  const hrs = Math.floor(remaining / (60 * 60 * 1000));
                                  const mins = Math.floor(
                                    (remaining % (60 * 60 * 1000)) / (60 * 1000),
                                  );
                                  if (remaining <= 0) return "Restore window expired";
                                  if (hrs === 0) return `${mins} min remaining`;
                                  return `${hrs}h ${mins}m remaining`;
                                })()}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md bg-emerald-600 text-[10px] text-white font-semibold hover:bg-emerald-700"
                              onClick={async () => {
                                const name = b.name || "Branch";
                                const toastId = toast.loading(`Restoring "${name}"...`);
                                try {
                                  await restoreBranchForSuperAdmin(b.id);
                                  loadBranches();
                                  loadDeletedBranches();
                                  setDeletedDropdownOpen(false);
                                  toast.success(`"${name}" restored.`, { id: toastId });
                                } catch (err) {
                                  toast.error(err.message || "Failed to restore", { id: toastId });
                                }
                              }}
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md border border-red-300 bg-red-50 text-[10px] text-red-700 font-semibold hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
                              onClick={async () => {
                                const name = b.name || "Branch";
                                const ok = await confirm({
                                  title: "Permanently delete branch",
                                  message:
                                    `This will permanently delete the branch "${name}" and cannot be undone. ` +
                                    "This action will remove it from the restaurant.",
                                  confirmLabel: "Delete permanently",
                                });
                                if (!ok) return;
                                const toastId = toast.loading(
                                  `Deleting "${name}" permanently...`,
                                );
                                try {
                                  await permanentlyDeleteBranchForSuperAdmin(b.id);
                                  loadBranches();
                                  loadDeletedBranches();
                                  toast.success(`"${name}" deleted permanently.`, {
                                    id: toastId,
                                  });
                                } catch (err) {
                                  toast.error(
                                    err.message || "Failed to delete permanently",
                                    { id: toastId },
                                  );
                                }
                              }}
                            >
                              Delete forever
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="min-h-[60vh] overflow-auto text-xs">
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 sticky top-0 z-[1]">
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
                  <tr
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                  >
                    <td colSpan={7} className="py-8 text-center text-neutral-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        Loading branches…
                      </span>
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
                      <td className="py-3 pr-3 text-gray-600 dark:text-neutral-400 max-w-[220px] truncate">
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
                        <div className="inline-flex items-center gap-2 justify-end">
                          {b.subdomain && (
                            <Button
                              type="button"
                              variant="primary"
                              className="px-3 text-[11px] font-semibold"
                              onClick={() => {
                                setActingAsRestaurant(b.subdomain);
                                window.location.href = "/overview";
                              }}
                            >
                              Login
                            </Button>
                          )}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/40"
                            onClick={async () => {
                              const name = b.name || "Branch";
                              const ok = await confirm({
                                title: "Delete branch",
                                message:
                                  `This will soft delete the branch "${name}". ` +
                                  "It can be recovered within 48 hours from \"Recently deleted\".",
                                confirmLabel: "Delete branch",
                              });
                              if (!ok) return;
                              const toastId = toast.loading(`Deleting "${name}"...`);
                              try {
                                await deleteBranchForSuperAdmin(b.id);
                                loadBranches();
                                loadDeletedBranches();
                                toast.success(`"${name}" deleted.`, { id: toastId });
                              } catch (err) {
                                toast.error(err.message || "Failed to delete branch", {
                                  id: toastId,
                                });
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
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
        </div>
      </Card>
    </AdminLayout>
  );
}
