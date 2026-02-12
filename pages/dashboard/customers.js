import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  SubscriptionInactiveError
} from "../../lib/apiClient";
import { UserPlus, Trash2, Edit3, User, Phone, Mail, MapPin, UserCheck } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";

export default function CustomersPage() {
  const { currentBranch } = useBranch() || {};
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const [allBranches, setAllBranches] = useState(false);
  const { confirm } = useConfirmDialog();

  const canCreate = !!currentBranch;
  const fetchAllBranches = !currentBranch || allBranches;

  useEffect(() => {
    (async () => {
      try {
        const data = await getCustomers(fetchAllBranches);
        setCustomers(Array.isArray(data) ? data : data?.customers || []);
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else setError(err.message || "Failed to load customers");
      }
    })();
  }, [fetchAllBranches, currentBranch?.id]);

  function resetForm() {
    setForm({ id: null, name: "", phone: "", email: "", address: "", notes: "" });
  }

  function startEdit(customer) {
    setForm({
      id: customer.id,
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || ""
    });
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setModalError("Name is required"); return; }
    if (!form.phone.trim()) { setModalError("Phone is required"); return; }
    setModalError("");
    setLoading(true);
    try {
      const payload = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || undefined, address: form.address.trim() || undefined, notes: form.notes.trim() || undefined };
      if (form.id) {
        const updated = await updateCustomer(form.id, payload);
        setCustomers(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createCustomer(payload);
        setCustomers(prev => [created, ...prev]);
      }
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      setModalError(err.message || "Failed to save customer");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: "Delete customer", message: "Delete this customer? This cannot be undone." });
    if (!ok) return;
    await deleteCustomer(id);
    setCustomers(prev => prev.filter(c => c.id !== id));
    if (form.id === id) resetForm();
  }

  const filtered = customers.filter(c => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      (c.name || "").toLowerCase().includes(term) ||
      (c.phone || "").includes(term) ||
      (c.email || "").toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout title="Customers" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-5 py-3 text-sm font-medium text-red-700 dark:text-red-400">{error}</div>
      )}

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone or email..."
            className="w-full px-5 py-3.5 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
          />
        </div>
        {currentBranch && (
          <label className="inline-flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-300 cursor-pointer hover:border-primary/30 transition-all whitespace-nowrap">
            <input
              type="checkbox"
              checked={allBranches}
              onChange={e => setAllBranches(e.target.checked)}
              className="rounded border-gray-300 dark:border-neutral-600 text-primary focus:ring-primary/20"
            />
            View all branches
          </label>
        )}
        <button
          type="button"
          onClick={() => { resetForm(); setModalError(""); setIsModalOpen(true); }}
          disabled={!canCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none whitespace-nowrap"
          title={!canCreate ? "Select a branch to add customers" : ""}
        >
          <UserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <UserCheck className="w-10 h-10 text-primary" />
            </div>
            <p className="text-base font-bold text-gray-700 dark:text-neutral-300">
              {customers.length === 0 ? "No customers yet" : "No results found"}
            </p>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 max-w-md">
              {customers.length === 0 ? "Customers are created when orders are placed, or add them manually." : "Try a different search term."}
            </p>
            {customers.length === 0 && canCreate && (
              <button
                onClick={() => { resetForm(); setModalError(""); setIsModalOpen(true); }}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add Your First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-neutral-900/50 dark:to-neutral-900/30">
                <tr>
                  <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Customer</th>
                  <th className="py-4 px-6 text-left font-bold text-gray-700 dark:text-neutral-300">Contact</th>
                  <th className="py-4 px-6 text-center font-bold text-gray-700 dark:text-neutral-300">Orders</th>
                  <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Total Spent</th>
                  <th className="py-4 px-6 text-right font-bold text-gray-700 dark:text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-100 dark:divide-neutral-800">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                          {c.address && (
                            <div className="text-xs text-gray-500 dark:text-neutral-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {c.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-neutral-300">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium">{c.phone}</span>
                        </div>
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-neutral-400 text-xs">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold">
                        {c.totalOrders ?? 0}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="text-base font-bold text-primary">
                        Rs {(c.totalSpent ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={() => startEdit(c)} 
                          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" 
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleDelete(c.id)} 
                          className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" 
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 shadow-2xl rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {form.id ? "Edit Customer" : "Add Customer"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {form.id ? "Update customer details" : `Assign to ${currentBranch?.name || "current branch"}`}
                </p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">{modalError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Customer name"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  Phone *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="03XX-XXXXXXX"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Delivery address"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" 
                  onClick={() => { resetForm(); setIsModalOpen(false); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  <UserPlus className="w-4 h-4" />
                  {form.id ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
