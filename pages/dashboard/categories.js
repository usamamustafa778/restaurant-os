import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import {
  getMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  SubscriptionInactiveError
} from "../../lib/apiClient";
import { Plus, Trash2, Edit2, FolderOpen } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id: null, name: "", description: "" });
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    (async () => {
      try {
        const menuData = await getMenu();
        setCategories(menuData.categories || []);
        setItems(menuData.items || []);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          setError(err.message || "Failed to load categories");
        }
      }
    })();
  }, []);

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
      return;
    }
    setModalError("");
    try {
      if (form.id) {
        const updated = await updateCategory(form.id, {
          name: form.name,
          description: form.description
        });
        setCategories(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createCategory({
          name: form.name,
          description: form.description
        });
        setCategories(prev => [...prev, created]);
      }
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || "Failed to save category");
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete category",
      message: "Delete this category and all its menu items? This cannot be undone."
    });
    if (!ok) return;
    await deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
    setItems(prev => prev.filter(i => i.categoryId !== id));
  }

  const filtered = categories.filter(cat => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      cat.name.toLowerCase().includes(term) ||
      (cat.description || "").toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout title="Categories" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4">
        <Card
          title="Menu Categories"
          description="Organize your menu into easy-to-browse groups."
        >
          <div className="flex flex-row items-center justify-between gap-3 mb-4 text-xs">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or description..."
              className="flex-1 px-3 py-1.5 max-w-sm rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
            <Button type="button" className="gap-2 shrink-0" onClick={startCreate}>
              <Plus className="w-3 h-3" />
              New category
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto text-xs">
            <table className="w-full text-xs">
              <thead className="text-[11px] uppercase text-gray-800 dark:text-neutral-400 border-b border-gray-300 dark:border-neutral-700 sticky top-0 z-10 bg-bg-secondary dark:bg-neutral-950">
                <tr>
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-center">Items</th>
                  <th className="py-2 text-left">Created</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                {filtered.map(cat => {
                  const itemCount = items.filter(i => i.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-bg-primary dark:hover:bg-neutral-900/50">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FolderOpen className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-medium text-gray-900 dark:text-neutral-100">{cat.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 dark:text-neutral-400 max-w-[200px] truncate">
                        {cat.description || <span className="text-gray-400 dark:text-neutral-600 italic">No description</span>}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                          {itemCount}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 dark:text-neutral-500">
                        {cat.createdAt ? new Date(cat.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2"
                            onClick={() => startEdit(cat)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-2 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/40 hover:bg-red-50 dark:hover:bg-secondary/10"
                            onClick={() => handleDelete(cat.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-gray-500 dark:text-neutral-500">
                      {categories.length === 0
                        ? "No categories yet. Create your first category to organize menu items."
                        : "No categories match your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

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
            <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Name</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Burgers, Drinks, Sides..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Description (optional)</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { resetForm(); setIsModalOpen(false); }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-1">
                  {form.id ? "Save changes" : "Create category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
