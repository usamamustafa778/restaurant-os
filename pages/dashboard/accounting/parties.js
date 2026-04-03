import { useCallback, useEffect, useRef, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  Plus, Loader2, X, Search, Users, ChevronLeft, ChevronRight,
  Pencil, Check, PhoneCall, Mail,
} from "lucide-react";
import { getStoredAuth } from "../../../lib/apiClient";
import toast from "react-hot-toast";

// ─── API ────────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function buildHeaders() {
  const auth = getStoredAuth();
  const h = { "Content-Type": "application/json" };
  if (auth?.token) h["Authorization"] = `Bearer ${auth.token}`;
  const slug = auth?.user?.tenantSlug || auth?.tenantSlug;
  if (slug) h["x-tenant-slug"] = slug;
  return h;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...buildHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { key: "",          label: "All" },
  { key: "supplier",  label: "Suppliers" },
  { key: "customer",  label: "Customers" },
  { key: "employee",  label: "Employees" },
  { key: "director",  label: "Directors" },
];

const TYPE_COLORS = {
  supplier: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  customer: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  employee: "bg-violet-500/15 text-violet-400 ring-violet-500/20",
  director: "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  other:    "bg-neutral-500/15 text-neutral-400 ring-neutral-500/20",
};

const PARTY_TYPES = ["supplier", "customer", "employee", "director", "other"];
const LIMIT = 50;

// ─── Slide-over panel ────────────────────────────────────────────────────────

function PartySlideOver({ party, onClose, onSaved }) {
  const isEdit = !!party?._id;
  const [form, setForm] = useState({
    name:           party?.name           || "",
    type:           party?.type           || "supplier",
    phone:          party?.phone          || "",
    email:          party?.email          || "",
    openingBalance: party?.openingBalance ?? 0,
    balanceType:    party?.balanceType    || "credit",
  });
  const [errors, setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.type)         e.type = "Type is required";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const body = {
        name:           form.name.trim(),
        type:           form.type,
        phone:          form.phone.trim() || undefined,
        email:          form.email.trim() || undefined,
        openingBalance: Number(form.openingBalance) || 0,
        balanceType:    form.balanceType,
      };
      const saved = isEdit
        ? await apiFetch(`/api/accounting/parties/${party._id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/api/accounting/parties", { method: "POST", body: JSON.stringify(body) });
      toast.success(isEdit ? "Party updated" : "Party created");
      onSaved(saved);
    } catch (err) {
      toast.error(err.message || "Failed to save party");
    } finally {
      setSubmitting(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{isEdit ? "Edit Party" : "Add Party"}</h2>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={set("name")} placeholder="e.g. Ali Brothers Supplies"
              className={`w-full bg-neutral-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 ${errors.name ? "border-red-500" : "border-neutral-700"}`} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Type <span className="text-red-400">*</span></label>
            <select value={form.type} onChange={set("type")}
              className={`w-full bg-neutral-800 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 ${errors.type ? "border-red-500" : "border-neutral-700"}`}>
              {PARTY_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Phone</label>
              <input value={form.phone} onChange={set("phone")} placeholder="03xx-xxxxxxx"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set("email")} placeholder="optional"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
          </div>

          {/* Opening Balance */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Opening Balance</label>
            <input type="number" min="0" step="0.01" value={form.openingBalance}
              onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>

          {/* Balance Type */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">Balance Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "credit", label: "We Owe Them", sub: "Payable / Supplier" },
                { v: "debit",  label: "They Owe Us", sub: "Receivable / Customer" }].map(({ v, label, sub }) => (
                <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, balanceType: v }))}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all ${
                    form.balanceType === v
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
                  }`}>
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-[10px] opacity-60 mt-0.5">{sub}</span>
                </button>
              ))}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-neutral-800 flex-shrink-0 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Party"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Balance cell ─────────────────────────────────────────────────────────────

function BalanceCell({ partyId }) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/accounting/parties/${partyId}/balance`)
      .then(setData)
      .catch(() => setData({ balance: 0, balanceType: "credit" }))
      .finally(() => setLoading(false));
  }, [partyId]);

  if (loading) return <span className="text-neutral-600 text-xs">—</span>;
  if (!data) return null;

  const abs = Math.abs(data.balance);
  if (abs === 0) return <span className="text-neutral-500 text-sm">Rs 0</span>;

  const label = data.balanceType === "credit" ? "Payable" : "Receivable";
  return (
    <span className={`text-sm font-medium ${data.balanceType === "credit" ? "text-red-400" : "text-emerald-400"}`}>
      Rs {abs.toLocaleString()} <span className="text-[10px] opacity-70">{label}</span>
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartiesPage() {
  const [parties, setParties]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch]       = useState("");
  const [slideOver, setSlideOver] = useState(null); // null | 'new' | party object
  const debounceRef               = useRef(null);

  const fetchParties = useCallback(async (q, type, p) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (q)    params.set("q", q);
      if (type) params.set("type", type);
      const data = await apiFetch(`/api/accounting/parties?${params.toString()}`);
      setParties(data.parties || []);
      setTotal(data.total   || 0);
      setPage(data.page     || 1);
    } catch (err) {
      toast.error(err.message || "Failed to load parties");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchParties(search, activeTab, 1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, activeTab, fetchParties]);

  function handleSaved(party) {
    setSlideOver(null);
    fetchParties(search, activeTab, page);
  }

  async function handleDelete(party) {
    if (!window.confirm(`Remove "${party.name}"?`)) return;
    try {
      await apiFetch(`/api/accounting/parties/${party._id}`, { method: "DELETE" });
      toast.success("Party removed");
      fetchParties(search, activeTab, page);
    } catch (err) {
      toast.error(err.message || "Failed to remove party");
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Parties</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Suppliers, customers, employees and directors</p>
          </div>
          <button type="button" onClick={() => setSlideOver("new")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors">
            <Plus className="w-4 h-4" /> Add Party
          </button>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 flex-wrap">
            {TABS.map((tab) => (
              <button key={tab.key} type="button"
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-orange-500 text-white shadow"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search parties…"
              className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-900 border-b border-neutral-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="bg-neutral-950 divide-y divide-neutral-800/60">
                {loading ? (
                  <tr><td colSpan={5} className="py-16 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400 mx-auto" />
                  </td></tr>
                ) : parties.length === 0 ? (
                  <tr><td colSpan={5} className="py-16 text-center">
                    <Users className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                    <p className="text-neutral-500 text-sm">
                      {search ? `No parties match "${search}"` : "No parties yet"}
                    </p>
                    {!search && (
                      <button type="button" onClick={() => setSlideOver("new")}
                        className="mt-4 text-orange-400 hover:text-orange-300 text-sm underline underline-offset-2">
                        Add your first party
                      </button>
                    )}
                  </td></tr>
                ) : parties.map((party) => (
                  <tr key={party._id} className="hover:bg-neutral-900/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{party.name}</div>
                      {party.email && (
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5">
                          <Mail className="w-3 h-3" /> {party.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TYPE_COLORS[party.type] || TYPE_COLORS.other}`}>
                        {party.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {party.phone
                        ? <span className="flex items-center gap-1"><PhoneCall className="w-3 h-3" />{party.phone}</span>
                        : <span className="text-neutral-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <BalanceCell partyId={party._id} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => setSlideOver(party)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-orange-400 hover:bg-neutral-800 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(party)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors" title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800 bg-neutral-900">
              <span className="text-xs text-neutral-500">
                Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fetchParties(search, activeTab, page - 1)} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-neutral-400">{page} / {totalPages}</span>
                <button type="button" onClick={() => fetchParties(search, activeTab, page + 1)} disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {slideOver && (
        <PartySlideOver
          party={slideOver === "new" ? null : slideOver}
          onClose={() => setSlideOver(null)}
          onSaved={handleSaved}
        />
      )}
    </AdminLayout>
  );
}
