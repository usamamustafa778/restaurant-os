import { useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import PageLoader from "../../components/ui/PageLoader";
import ViewToggle from "../../components/ui/ViewToggle";
import ActionDropdown from "../../components/ui/ActionDropdown";
import {
  getMenu,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../lib/apiClient";
import { Plus, Trash2, Edit2, FolderOpen, Loader2 } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useDropdown } from "../../hooks/useDropdown";
import { handleAsyncAction } from "../../utils/toastActions";
import toast from "react-hot-toast";

export default function CategoriesPage() {
  const {
    data: menuData,
    loading: pageLoading,
    error,
    suspended,
    setData: setMenuData,
  } = usePageData(getMenu);
  const [form, setForm] = useState({ id: null, name: "", description: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const { viewMode, setViewMode } = useViewMode("grid");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const {
    toggle: toggleDropdown,
    close: closeDropdown,
    isOpen: isDropdownOpen,
  } = useDropdown();
  const { confirm } = useConfirmDialog();

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];

  function resetForm() {
    setForm({ id: null, name: "", description: "" });
  }

  function startEdit(cat) {
    setForm({ id: cat.id, name: cat.name, description: cat.description || "" });
    setModalError("");
    setIsModalOpen(true);
  }

  function startCreate() {
    resetForm();
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Category name is required");
      toast.error("Category name is required");
      return;
    }

    setModalError("");
    setIsLoading(true);

    const result = await handleAsyncAction(
      async () => {
        if (form.id) {
          const updated = await updateCategory(form.id, {
            name: form.name,
            description: form.description,
          });
          setMenuData((prev) => ({
            ...prev,
            categories: prev.categories.map((c) =>
              c.id === updated.id ? updated : c,
            ),
          }));
          return updated;
        } else {
          const created = await createCategory({
            name: form.name,
            description: form.description,
          });
          setMenuData((prev) => ({
            ...prev,
            categories: [...prev.categories, created],
          }));
          return created;
        }
      },
      {
        loading: form.id ? "Updating category..." : "Creating category...",
        success: form.id
          ? "Category updated successfully"
          : "Category created successfully",
        error: "Failed to save category",
      },
    );

    setIsLoading(false);

    if (result.success) {
      resetForm();
      setIsModalOpen(false);
    } else {
      setModalError(result.error);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete category",
      message:
        "Delete this category and all its menu items? This cannot be undone.",
    });
    if (!ok) return;

    setDeletingId(id);

    await handleAsyncAction(
      async () => {
        await deleteCategory(id);
        setMenuData((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => c.id !== id),
          items: prev.items.filter((i) => i.categoryId !== id),
        }));
      },
      {
        loading: "Deleting category...",
        success: "Category deleted successfully",
        error: "Failed to delete category",
      },
    );

    setDeletingId(null);
  }

  const filtered = categories.filter((cat) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      cat.name.toLowerCase().includes(term) ||
      (cat.description || "").toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout title="Categories" suspended={suspended}>
      {pageLoading ? (
        <PageLoader message="Loading categories..." />
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Search, View Toggle and Add Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories by name or description..."
                className="w-full px-5 py-3.5 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
              />
            </div>

            {/* View Toggle */}
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />

            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>

          {/* Categories Grid View */}
          {viewMode === "grid" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((cat) => {
                const itemCount = items.filter(
                  (i) => i.categoryId === cat.id,
                ).length;
                const isDeleting = deletingId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 hover:shadow-lg hover:border-primary/30 transition-all relative"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {cat.name}
                      </h3>

                      {/* Actions Dropdown */}
                      <ActionDropdown
                        isOpen={isDropdownOpen(cat.id)}
                        onToggle={() => toggleDropdown(cat.id)}
                        onClose={closeDropdown}
                        disabled={isDeleting}
                        actions={[
                          {
                            label: "Edit",
                            icon: <Edit2 className="w-4 h-4" />,
                            onClick: () => startEdit(cat),
                            disabled: isDeleting,
                          },
                          {
                            label: isDeleting ? "Deleting..." : "Delete",
                            icon: isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            ),
                            onClick: () => handleDelete(cat.id),
                            variant: "danger",
                            disabled: isDeleting,
                          },
                        ]}
                      />
                    </div>

                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        {itemCount} items
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-neutral-400 line-clamp-2 min-h-[2.5rem]">
                      {cat.description || (
                        <span className="italic">No description provided</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5 text-right">
                      {cat.createdAt
                        ? new Date(cat.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Categories Table View */}
          {viewMode === "table" && (
            <DataTable
              variant="card"
              columns={[
                {
                  key: "name",
                  header: "Category",
                  render: (value) => (
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {value}
                    </p>
                  ),
                },
                {
                  key: "description",
                  header: "Description",
                  hideOnMobile: true,
                  render: (value) => (
                    <p className="text-gray-600 dark:text-neutral-400 line-clamp-2">
                      {value || (
                        <span className="italic text-gray-400 dark:text-neutral-500">
                          No description
                        </span>
                      )}
                    </p>
                  ),
                },
                {
                  key: "itemCount",
                  header: "Items",
                  align: "center",
                  render: (value) => (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {value}
                    </span>
                  ),
                },
                {
                  key: "createdAt",
                  header: "Created",
                  hideOnTablet: true,
                  render: (value) => (
                    <span className="text-gray-600 dark:text-neutral-400">
                      {value ? new Date(value).toLocaleDateString() : "—"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (_, row) => {
                    const isDeleting = deletingId === row.id;
                    return (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="hidden sm:inline">
                                Deleting...
                              </span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  },
                },
              ]}
              rows={filtered.map((cat) => ({
                ...cat,
                itemCount: items.filter((i) => i.categoryId === cat.id).length,
              }))}
              emptyMessage={
                categories.length === 0
                  ? "No categories yet. Create your first category to organize menu items."
                  : "No categories match your search"
              }
            />
          )}

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                <FolderOpen className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-neutral-400 mb-1">
                {categories.length === 0
                  ? "No categories yet"
                  : "No categories match your search"}
              </p>
              {categories.length === 0 && (
                <>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4">
                    Create your first category to organize menu items
                  </p>
                  <button
                    onClick={startCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Category
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-5 shadow-xl text-xs">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {form.id ? "Edit category" : "New category"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
              Group related menu items together to keep your POS simple.
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className="space-y-3"
              autoComplete="off"
            >
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Name
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Burgers, Drinks, Sides..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-1.5" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {form.id ? "Saving..." : "Creating..."}
                    </>
                  ) : (
                    <>{form.id ? "Save changes" : "Create category"}</>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
