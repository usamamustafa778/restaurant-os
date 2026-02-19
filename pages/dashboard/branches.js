import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getBranches, getDeletedBranches, createBranch, deleteBranch, restoreBranch } from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import { MapPin, Loader2, RefreshCw, Check, Trash2, X } from "lucide-react";

export default function BranchesPage() {
  const { branches: contextBranches, currentBranch, setCurrentBranch, loading: contextLoading } = useBranch() || {};
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletedBranches, setDeletedBranches] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getBranches()
      .then((data) => {
        if (cancelled) return;
        const list = data?.branches ?? (Array.isArray(data) ? data : []);
        setBranches(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load branches");
          setBranches([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Load recently deleted branches (owner/admin only; ignore 403 errors)
    setDeletedLoading(true);
    getDeletedBranches()
      .then((data) => {
        if (cancelled) return;
        const list = data?.branches ?? (Array.isArray(data) ? data : []);
        setDeletedBranches(list);
      })
      .catch(() => {
        if (!cancelled) setDeletedBranches([]);
      })
      .finally(() => {
        if (!cancelled) setDeletedLoading(false);
      });
    return () => { cancelled = true; };
  }, [contextBranches?.length]); // Refetch when context branches change (e.g. after backend adds one)

  const displayList = branches.length > 0 ? branches : (contextBranches ?? []);
  const isLoading = loading || contextLoading;

  return (
    <AdminLayout title="Branches">
      {/* Create Form */}
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Add New Branch</h3>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            setCreating(true);
            setError("");
            try {
              const payload = {
                name: newName.trim(),
                code: newCode.trim() || undefined,
                address: newAddress.trim() || undefined,
              };
              const created = await createBranch(payload);
              const createdBranch = created?.branch || created;
              setNewName("");
              setNewCode("");
              setNewAddress("");
              // Refresh list
              const data = await getBranches();
              const list = data?.branches ?? (Array.isArray(data) ? data : []);
              setBranches(list);
              if (createdBranch?.id) {
                setCurrentBranch(createdBranch);
              }
            } catch (err) {
              setError(err.message || "Failed to create branch");
            } finally {
              setCreating(false);
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
                Branch Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. DHA Phase 5"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
                Branch Code <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. dha5"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
                Address <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Street, area, city"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Branch…
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  Add Branch
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-sm">
          <p className="text-amber-800 dark:text-amber-200 font-semibold">{error}</p>
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Ensure your backend exposes <code className="bg-amber-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">GET /api/admin/branches</code>.
            See <code className="bg-amber-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">BRANCH_DESIGN.md</code> for API requirements.
          </p>
        </div>
      )}

      {/* Branches List */}
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">

        {isLoading && displayList.length === 0 ? (
          <div className="flex items-center justify-center gap-3 py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-gray-500 dark:text-neutral-400">Loading branches…</span>
          </div>
        ) : displayList.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
              No branches yet
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-neutral-500 max-w-md mx-auto">
              Create your first branch using the form above to manage multiple restaurant locations
            </p>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Branches</h3>
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
                    <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-neutral-950 border border-amber-200 dark:border-amber-700 shadow-lg z-10">
                      <div className="px-3 py-2 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                          Restore branches (48h)
                        </span>
                        {deletedLoading && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {deletedBranches.map((branch) => (
                          <div
                            key={branch.id}
                            className="px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-amber-900 dark:text-amber-100 truncate">
                                {branch.name}
                              </p>
                              {branch.code && (
                                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-mono truncate">
                                  {branch.code}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md bg-emerald-600 text-[10px] text-white font-semibold hover:bg-emerald-700"
                              onClick={async () => {
                                try {
                                  await restoreBranch(branch.id);
                                  const [activeData, deletedData] = await Promise.all([
                                    getBranches(),
                                    getDeletedBranches(),
                                  ]);
                                  const act = activeData?.branches ?? (Array.isArray(activeData) ? activeData : []);
                                  const del = deletedData?.branches ?? (Array.isArray(deletedData) ? deletedData : []);
                                  setBranches(act);
                                  setDeletedBranches(del);
                                  setDeletedDropdownOpen(false);
                                } catch (err) {
                                  setError(err.message || "Failed to restore branch");
                                }
                              }}
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                        {deletedBranches.length === 0 && (
                          <p className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                            No branches available to restore.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {displayList.map((branch) => (
                <div
                  key={branch.id}
                  className={`relative p-5 rounded-xl border-2 transition-all hover:shadow-lg ${
                    currentBranch?.id === branch.id
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      currentBranch?.id === branch.id
                        ? "bg-gradient-to-br from-primary to-secondary"
                        : "bg-gray-100 dark:bg-neutral-800"
                    }`}>
                      <MapPin className={`w-6 h-6 ${
                        currentBranch?.id === branch.id ? "text-white" : "text-gray-600 dark:text-neutral-400"
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">{branch.name}</h4>
                      {branch.code && (
                        <p className="text-xs text-gray-500 dark:text-neutral-500 font-mono mt-0.5">{branch.code}</p>
                      )}
                    </div>
                    {currentBranch?.id === branch.id && (
                      <div className="flex-shrink-0">
                        <Check className="w-5 h-5 text-primary" />
                      </div>
                    )}
                  </div>
                  {branch.address && (
                    <p className="text-xs text-gray-600 dark:text-neutral-400 mb-4 line-clamp-2">{branch.address}</p>
                  )}
                  <div className="flex gap-2">
                    {currentBranch?.id !== branch.id && (
                      <button
                        onClick={() => setCurrentBranch(branch)}
                        className="flex-1 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
                      >
                        Switch to Branch
                      </button>
                    )}
                    {/* Delete (soft delete) – require name confirmation in modal */}
                    <button
                      type="button"
                      onClick={() => { setDeleteTarget(branch); setDeleteConfirmName(""); }}
                      className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 inline-block mr-1 align-middle" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {displayList.length > 0 && (
        <div className="mt-6 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            💡 Selecting a branch scopes dashboard data (orders, inventory, POS) to that specific location when the backend supports <code className="bg-blue-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">x-branch-id</code> header.
          </p>
        </div>
      )}


      {/* Delete branch confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Delete branch</h2>
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
                This will <span className="font-semibold">soft delete</span> the branch{" "}
                <span className="font-semibold">"{deleteTarget.name}"</span>. It can be recovered within{" "}
                <span className="font-semibold">48 hours</span>. To confirm, type the branch name exactly.
              </p>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Type <span className="font-mono">{deleteTarget.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  placeholder={deleteTarget.name}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-800">
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
                  deleteConfirmName.trim() !== (deleteTarget.name || "").trim()
                }
                onClick={async () => {
                  setDeleteLoading(true);
                  try {
                    await deleteBranch(deleteTarget.id);
                    // Refresh list after soft delete
                    const data = await getBranches();
                    const list = data?.branches ?? (Array.isArray(data) ? data : []);
                    setBranches(list);
                    setDeleteTarget(null);
                    setDeleteConfirmName("");
                  } catch (err) {
                    setError(err.message || "Failed to delete branch");
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
              >
                {deleteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Delete branch"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
