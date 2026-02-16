import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getTables,
  createTable,
  updateTable,
  deleteTable,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import { Plus, Trash2, Edit3, UtensilsCrossed } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";

export default function TablesPage() {
  const { currentBranch } = useBranch() || {};
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState({ id: null, name: "", isAvailable: true });
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [search, setSearch] = useState("");
  const { confirm } = useConfirmDialog();

  useEffect(() => {
    (async () => {
      try {
        const data = await getTables();
        setTables(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else setError(err.message || "Failed to load tables");
      }
    })();
  }, [currentBranch?.id]);

  function resetForm() {
    setForm({ id: null, name: "", isAvailable: true });
  }

  function startEdit(table) {
    setForm({
      id: table.id,
      name: table.name || "",
      isAvailable: table.isAvailable !== false,
    });
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Table name is required");
      return;
    }
    setModalError("");
    setLoading(true);
    try {
      if (form.id) {
        const updated = await updateTable(form.id, {
          name: form.name.trim(),
          isAvailable: form.isAvailable,
        });
        setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await createTable({ name: form.name.trim() });
        setTables((prev) => [created, ...prev]);
      }
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || "Failed to save table");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete table",
      message: "Delete this table? This cannot be undone.",
    });
    if (!ok) return;
    await deleteTable(id);
    setTables((prev) => prev.filter((t) => t.id !== id));
    if (form.id === id) resetForm();
  }

  const filtered = tables.filter((t) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (t.name || "").toLowerCase().includes(term);
  });

  return (
    <AdminLayout title="Tables" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-5 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setModalError("");
            setIsModalOpen(true);
          }}
          disabled={!currentBranch}
          title={!currentBranch ? "Select a branch to add tables" : ""}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Add Table
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-900/50">
              <tr>
                <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Table</th>
                <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Status</th>
                <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <UtensilsCrossed className="w-12 h-12 text-gray-300 dark:text-neutral-600" />
                      <p className="text-gray-500 dark:text-neutral-400">
                        {tables.length === 0 ? "No tables yet" : "No results found"}
                      </p>
                      {tables.length === 0 && currentBranch && (
                        <button
                          type="button"
                          onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                          }}
                          className="text-primary font-semibold hover:underline"
                        >
                          Add Your First Table
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((table) => (
                  <tr
                    key={table.id}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-gray-900 dark:text-white">{table.name}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex px-3 py-1 rounded-lg text-xs font-semibold ${
                          table.isAvailable
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                        }`}
                      >
                        {table.isAvailable ? "Available" : "Occupied"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(table)}
                          className="p-2 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(table.id)}
                          className="p-2 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {form.id ? "Edit Table" : "Add Table"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-4 py-2 text-sm">
                  {modalError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">
                  Table name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Table 1"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white outline-none focus:border-primary"
                  autoFocus
                />
              </div>
              {form.id && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isAvailable"
                    checked={form.isAvailable}
                    onChange={(e) => setForm((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                    Available
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? "Saving…" : form.id ? "Update" : "Add Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
