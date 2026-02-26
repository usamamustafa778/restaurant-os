import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import {
  getBranches,
  getDeletedBranches,
  createBranch,
  deleteBranch,
  restoreBranch,
  updateBranch,
  getRestaurantSettings,
  updateRestaurantSettings,
  uploadImage,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import { MapPin, Loader2, Check, Trash2, X, Edit2, Plus, Image as ImageIcon, Upload, Link as LinkIcon } from "lucide-react";
import toast from "react-hot-toast";

export default function BranchesPage() {
  const { branches: contextBranches, currentBranch, setCurrentBranch, loading: contextLoading } = useBranch() || {};
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchModalError, setBranchModalError] = useState("");
  const [branchForm, setBranchForm] = useState({
    id: null,
    name: "",
    code: "",
    address: "",
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletedBranches, setDeletedBranches] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);

  // Restaurant logo (shared across all branches)
  const [restaurantSettings, setRestaurantSettings] = useState(null);
  const [logoLoading, setLogoLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoTab, setLogoTab] = useState("link");
  const logoInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBranches()
      .then((data) => {
        if (cancelled) return;
        const list = data?.branches ?? (Array.isArray(data) ? data : []);
        setBranches(list);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message || "Failed to load branches");
          setBranches([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
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

  // Load restaurant settings (for restaurant logo used on bills)
  useEffect(() => {
    let cancelled = false;
    setLogoLoading(true);
    getRestaurantSettings()
      .then((data) => {
        if (cancelled) return;
        setRestaurantSettings(data || {});
      })
      .catch(() => {
        if (!cancelled) setRestaurantSettings({});
      })
      .finally(() => {
        if (!cancelled) setLogoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayList = branches.length > 0 ? branches : (contextBranches ?? []);
  const isLoading = loading || contextLoading;

  function resetBranchForm() {
    setBranchForm({ id: null, name: "", code: "", address: "" });
  }

  function openCreateBranch() {
    resetBranchForm();
    setBranchModalError("");
    setBranchModalOpen(true);
  }

  function openEditBranch(branch) {
    setBranchForm({
      id: branch.id,
      name: branch.name || "",
      code: branch.code || "",
      address: branch.address || "",
    });
    setBranchModalError("");
    setBranchModalOpen(true);
  }

  async function handleBranchSubmit(e) {
    e.preventDefault();
    const name = branchForm.name.trim();
    const code = branchForm.code.trim();
    const address = branchForm.address.trim();
    if (!name) {
      setBranchModalError("Branch name is required");
      toast.error("Branch name is required");
      return;
    }

    setBranchSaving(true);
    setBranchModalError("");
    const isEdit = !!branchForm.id;
    const toastId = toast.loading(isEdit ? "Saving changes..." : "Creating branch...");
    try {
      const payload = {
        name,
        code: code || undefined,
        address: address || undefined,
      };

      let createdBranch = null;
      if (isEdit) {
        await updateBranch(branchForm.id, payload);
      } else {
        const created = await createBranch(payload);
        createdBranch = created?.branch || created;
      }

      const data = await getBranches();
      const list = data?.branches ?? (Array.isArray(data) ? data : []);
      setBranches(list);

      if (!isEdit) {
        if (createdBranch?.id) {
          setCurrentBranch(createdBranch);
        }
        toast.success(`Branch "${createdBranch?.name || name}" created successfully!`, { id: toastId });
      } else {
        // Keep current branch selection up to date if it was edited
        if (currentBranch?.id) {
          const updated = list.find((b) => b.id === currentBranch.id);
          if (updated) {
            setCurrentBranch(updated);
          }
        }
        toast.success(`Branch "${name}" updated successfully!`, { id: toastId });
      }

      resetBranchForm();
      setBranchModalOpen(false);
    } catch (err) {
      setBranchModalError(err.message || (isEdit ? "Failed to update branch" : "Failed to create branch"));
      toast.error(err.message || "Failed to save branch", { id: toastId });
    } finally {
      setBranchSaving(false);
    }
  }

  const restaurantLogoUrl = restaurantSettings?.restaurantLogoUrl || "";

  async function handleLogoUrlSave(e) {
    e.preventDefault();
    if (!restaurantSettings) return;
    setLogoSaving(true);
    const toastId = toast.loading("Saving restaurant logo...");
    try {
      const updated = await updateRestaurantSettings({
        ...restaurantSettings,
        restaurantLogoUrl,
      });
      setRestaurantSettings(updated);
      toast.success("Restaurant logo saved", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save restaurant logo", { id: toastId });
    } finally {
      setLogoSaving(false);
    }
  }

  async function handleLogoUploadChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { url } = await uploadImage(file);
      setRestaurantSettings((prev) => ({ ...(prev || {}), restaurantLogoUrl: url }));
    } catch (err) {
      toast.error(err.message || "Logo upload failed");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  return (
    <AdminLayout title="Branches">
      {/* Restaurant logo shared across all branches */}
      <div className="mb-6 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
            <ImageIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Restaurant logo
            </h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Used on printed bills and receipts for all branches.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" />
            Logo
          </label>

          <div className="flex rounded-lg border-2 border-gray-300 dark:border-neutral-700 overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => setLogoTab("link")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                logoTab === "link"
                  ? "bg-primary text-white"
                  : "bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Paste URL
            </button>
            <button
              type="button"
              onClick={() => setLogoTab("upload")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-l-2 border-gray-300 dark:border-neutral-700 transition-colors ${
                logoTab === "upload"
                  ? "bg-primary text-white"
                  : "bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload from PC
            </button>
          </div>

          {logoTab === "link" && (
            <form onSubmit={handleLogoUrlSave} className="space-y-2">
              <input
                type="text"
                value={restaurantLogoUrl}
                onChange={(e) =>
                  setRestaurantSettings((prev) => ({
                    ...(prev || {}),
                    restaurantLogoUrl: e.target.value,
                  }))
                }
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                disabled={logoLoading}
              />
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5"
                  disabled={logoSaving || logoLoading}
                >
                  {logoSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>Save logo</>
                  )}
                </Button>
              </div>
            </form>
          )}

          {logoTab === "upload" && (
            <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:border-primary/60 cursor-pointer transition-colors">
              {logoUploading ? (
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-xs font-medium text-primary">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-neutral-400">
                    Click to browse or drag &amp; drop
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                    JPG, PNG, WEBP up to 5 MB
                  </span>
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUploadChange}
                disabled={logoUploading}
              />
            </label>
          )}

          <div className="flex items-center gap-3 mt-1">
            {restaurantLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurantLogoUrl}
                alt="Restaurant logo preview"
                className="h-10 w-10 rounded-lg object-cover border border-gray-200 dark:border-neutral-700"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700 flex items-center justify-center text-[10px] text-gray-400">
                No logo
              </div>
            )}
            <p className="text-[11px] text-gray-500 dark:text-neutral-400">
              Recommended square logo. Key name: <span className="font-mono">restuarnt logo</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Branches List */}
      <div className="relative bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {/* Loading Overlay for Refresh */}
        {isLoading && displayList.length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-neutral-950/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-lg">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">Refreshing...</span>
            </div>
          </div>
        )}

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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openCreateBranch}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Branch
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
                                  const toastId = toast.loading(`Restoring "${branch.name}"...`);
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
                                    toast.success(`Branch "${branch.name}" restored successfully!`, { id: toastId });
                                  } catch (err) {
                                    toast.error(err.message || "Failed to restore branch", { id: toastId });
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
                    <button
                      type="button"
                      onClick={() => openEditBranch(branch)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Edit2 className="w-4 h-4 inline-block mr-1 align-middle" />
                      Edit
                    </button>
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

      {/* Create / Edit Branch Modal */}
      {branchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-5 shadow-xl text-xs">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {branchForm.id ? "Edit branch" : "Add new branch"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              Manage your restaurant locations. Each branch can have its own POS, menu and reports.
            </p>
            {branchModalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {branchModalError}
              </div>
            )}
            <form onSubmit={handleBranchSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Branch name
                </label>
                <input
                  type="text"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. DHA Phase 5"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Branch code <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={branchForm.code}
                  onChange={(e) => setBranchForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. dha5"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Address <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Street, area, city"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    resetBranchForm();
                    setBranchModalOpen(false);
                  }}
                  disabled={branchSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-1.5" disabled={branchSaving}>
                  {branchSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {branchForm.id ? "Saving..." : "Creating..."}
                    </>
                  ) : (
                    <>{branchForm.id ? "Save changes" : "Create branch"}</>
                  )}
                </Button>
              </div>
            </form>
          </div>
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
                  const toastId = toast.loading(`Deleting "${deleteTarget.name}"...`);
                  try {
                    await deleteBranch(deleteTarget.id);
                    // Refresh list after soft delete
                    const data = await getBranches();
                    const list = data?.branches ?? (Array.isArray(data) ? data : []);
                    setBranches(list);
                    // Refresh deleted branches list
                    const deletedData = await getDeletedBranches();
                    const delList = deletedData?.branches ?? (Array.isArray(deletedData) ? deletedData : []);
                    setDeletedBranches(delList);
                    setDeleteTarget(null);
                    setDeleteConfirmName("");
                    toast.success(`Branch "${deleteTarget.name}" deleted successfully!`, { id: toastId });
                  } catch (err) {
                    toast.error(err.message || "Failed to delete branch", { id: toastId });
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
