import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import SuperAdminTable from "../../../components/ui/SuperAdminTable";
import { Search, FileDown } from "lucide-react";
import {
  getSuperBranches,
  getDeletedBranchesForSuperAdmin,
  deleteBranchForSuperAdmin,
  restoreBranchForSuperAdmin,
  permanentlyDeleteBranchForSuperAdmin,
  setActingAsRestaurant,
} from "../../../lib/apiClient";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import toast from "react-hot-toast";

export default function SuperBranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletedBranches, setDeletedBranches] = useState([]);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { confirm } = useConfirmDialog();

  function escapeCsvCell(value) {
    if (value == null || value === "") return "";
    const s = String(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadBranchesExcel(rows) {
    const headers = ["S.No", "Restaurant", "Subdomain", "Branch", "Code", "Address", "Status"];
    const csvRows = [
      headers.join(","),
      ...rows.map((b, i) =>
        [
          i + 1,
          escapeCsvCell(b.restaurantName),
          escapeCsvCell(b.subdomain),
          escapeCsvCell(b.name),
          escapeCsvCell(b.code),
          escapeCsvCell(b.address),
          escapeCsvCell(b.status),
        ].join(",")
      ),
    ];
    const csv = csvRows.join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `branches-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const filteredBranches = searchQuery.trim()
    ? branches.filter((b) => {
        const q = searchQuery.trim().toLowerCase();
        const name = (b.name || "").toLowerCase();
        const rest = (b.restaurantName || "").toLowerCase();
        const sub = (b.subdomain || "").toLowerCase();
        const code = (b.code || "").toLowerCase();
        const addr = (b.address || "").toLowerCase();
        return name.includes(q) || rest.includes(q) || sub.includes(q) || code.includes(q) || addr.includes(q);
      })
    : branches;

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
          <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
              <input
                type="text"
                placeholder="Search by restaurant, branch, subdomain, code or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            {searchQuery && (
              <span className="text-xs text-neutral-500">
                {filteredBranches.length} of {branches.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (filteredBranches.length === 0) {
                  toast.error("No data to export");
                  return;
                }
                downloadBranchesExcel(filteredBranches);
                toast.success(`Exported ${filteredBranches.length} branch(es) to Excel`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              title="Download table as Excel (CSV)"
            >
              <FileDown className="w-4 h-4" />
              Download Excel
            </button>
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

          <SuperAdminTable
            data={filteredBranches}
            loading={loading}
            emptyMessage="No branches found. Branches are created per restaurant in their dashboard."
            columns={[
              {
                key: "restaurant",
                header: "Restaurant",
                render: (_, b) => (
                  <span className="font-medium text-gray-900 dark:text-white">
                    {b.restaurantName || "—"}
                  </span>
                ),
              },
              {
                key: "subdomain",
                header: "Subdomain",
                render: (_, b) => b.subdomain || "—",
                cellClassName: "text-gray-700 dark:text-neutral-300",
              },
              {
                key: "branch",
                header: "Branch",
                render: (_, b) => (
                  <span className="font-medium text-gray-900 dark:text-white">
                    {b.name || "—"}
                  </span>
                ),
              },
              {
                key: "code",
                header: "Code",
                render: (_, b) => b.code || "—",
                cellClassName: "text-gray-600 dark:text-neutral-400",
              },
              {
                key: "address",
                header: "Address",
                render: (_, b) => b.address || "—",
                cellClassName: "text-gray-600 dark:text-neutral-400 max-w-[220px] truncate",
              },
              {
                key: "status",
                header: "Status",
                render: (_, b) => (
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
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (_, b) => (
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
                ),
              },
            ]}
          />
        </div>
      </Card>
    </AdminLayout>
  );
}
