import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  ChevronDown, ChevronRight, Lock, Eye, EyeOff,
  Pencil, Plus, Loader2, X, Check, BookOpen, Search,
} from "lucide-react";
import { getStoredAuth } from "../../../lib/apiClient";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "capital",   label: "Capital" },
  { key: "asset",     label: "Assets" },
  { key: "liability", label: "Liabilities" },
  { key: "revenue",   label: "Revenue" },
  { key: "cogs",      label: "Cost of Goods Sold" },
  { key: "expense",   label: "Expenses" },
];

const VALID_TYPES = ["asset", "liability", "capital", "revenue", "cogs", "expense"];

// ─── API ──────────────────────────────────────────────────────────────────────

function buildHeaders() {
  const auth = getStoredAuth();
  const headers = { "Content-Type": "application/json" };
  if (auth?.token) headers["Authorization"] = `Bearer ${auth.token}`;
  const slug = auth?.user?.tenantSlug || auth?.tenantSlug;
  if (slug) headers["x-tenant-slug"] = slug;
  return headers;
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...buildHeaders(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function buildTree(accounts) {
  const byId = {};
  accounts.forEach((a) => { byId[a._id] = { ...a, children: [] }; });
  const roots = [];
  accounts.forEach((a) => {
    if (a.parentId && byId[a.parentId]) byId[a.parentId].children.push(byId[a._id]);
    else roots.push(byId[a._id]);
  });
  function sortNode(node) {
    node.children.sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }));
    node.children.forEach(sortNode);
    return node;
  }
  roots.sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }));
  roots.forEach(sortNode);
  return roots;
}

function flattenTree(nodes, depth = 0) {
  const result = [];
  nodes.forEach((n) => {
    result.push({ ...n, depth });
    if (n.children?.length) result.push(...flattenTree(n.children, depth + 1));
  });
  return result;
}

function matchesSearch(account, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return account.name.toLowerCase().includes(lower) || account.code.toLowerCase().includes(lower);
}

// ─── Inline Edit ──────────────────────────────────────────────────────────────

function InlineEdit({ account, onSave, onCancel }) {
  const [val, setVal] = useState(account.name);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  function handleKeyDown(e) {
    if (e.key === "Enter") onSave(val);
    if (e.key === "Escape") onCancel();
  }
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input ref={inputRef} value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKeyDown} onBlur={() => onSave(val)}
        className="flex-1 min-w-0 bg-white dark:bg-neutral-800 border border-orange-400 rounded px-2 py-0.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onSave(val); }}
        className="p-0.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Account Row ──────────────────────────────────────────────────────────────

function AccountRow({ account, onToggleActive, onEditName, onDelete, isEditing, onStartEdit, onCancelEdit }) {
  const depth = account.depth || 0;

  return (
    <tr className={`group border-b border-gray-100 dark:border-neutral-800/60 transition-colors ${
      account.isActive
        ? "hover:bg-gray-50 dark:hover:bg-neutral-800/20"
        : "opacity-40 hover:opacity-70 hover:bg-gray-50 dark:hover:bg-neutral-800/20"
    }`}>
      {/* Code */}
      <td className="pl-4 pr-3 py-2.5 w-24 whitespace-nowrap">
        <span className="font-mono text-[11px] text-gray-400 dark:text-neutral-500 tabular-nums tracking-wide">
          {account.code}
        </span>
      </td>

      {/* Name */}
      <td className="px-3 py-2.5">
        <div className="flex items-center min-w-0" style={{ paddingLeft: depth * 20 }}>
          {depth > 0 && (
            <span className="mr-2 flex-shrink-0 text-gray-300 dark:text-neutral-700 text-xs select-none">└</span>
          )}
          {isEditing ? (
            <InlineEdit account={account} onSave={(name) => onEditName(account._id, name)} onCancel={onCancelEdit} />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-sm truncate ${
                account.isActive
                  ? `text-gray-900 dark:text-white ${depth === 0 ? "font-medium" : ""}`
                  : "text-gray-400 dark:text-neutral-500 line-through"
              }`}>
                {account.name}
              </span>
              {!account.isSystem && (
                <button type="button" onClick={() => onStartEdit(account._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 flex-shrink-0">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5 w-20 text-center">
        {!account.isActive && (
          <span className="text-[10px] font-medium text-gray-400 dark:text-neutral-600 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
            Inactive
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="pl-3 pr-4 py-2.5 w-16">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={() => onToggleActive(account)}
            title={account.isActive ? "Deactivate" : "Activate"}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
            {account.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          {account.isSystem ? (
            <div className="p-1.5" title="System account">
              <Lock className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-700" />
            </div>
          ) : (
            <button type="button" onClick={() => onDelete(account)}
              title="Delete"
              className="p-1.5 rounded text-gray-300 dark:text-neutral-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ section, rows, onToggleActive, onEditName, onDelete, editingId, onStartEdit, onCancelEdit }) {
  const [open, setOpen] = useState(true);
  if (!rows.length) return null;

  const activeCount = rows.filter((r) => r.isActive !== false).length;

  return (
    <div className="border-b border-gray-200 dark:border-neutral-800 last:border-b-0">
      {/* Section header */}
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-gray-50 dark:bg-neutral-900/60 hover:bg-gray-100 dark:hover:bg-neutral-800/60 transition-colors">
        <div className={`transition-transform duration-150 ${open ? "" : "-rotate-90"}`}>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
        </div>
        <span className="text-xs font-semibold text-gray-700 dark:text-neutral-300 uppercase tracking-wider">{section.label}</span>
        <span className="text-[10px] text-gray-400 dark:text-neutral-600 font-mono ml-1">{activeCount}/{rows.length}</span>
      </button>

      {open && (
        <table className="w-full">
          <colgroup>
            <col className="w-24" />
            <col />
            <col className="w-20" />
            <col className="w-16" />
          </colgroup>
          <tbody className="bg-white dark:bg-neutral-950">
            {rows.map((acc) => (
              <AccountRow key={acc._id} account={acc}
                onToggleActive={onToggleActive} onEditName={onEditName} onDelete={onDelete}
                isEditing={editingId === acc._id} onStartEdit={onStartEdit} onCancelEdit={onCancelEdit} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Add Account Modal ────────────────────────────────────────────────────────

const inputCls = "w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-400 transition-colors";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1.5";

function AddAccountModal({ accounts, onClose, onCreated }) {
  const [form, setForm] = useState({ code: "", name: "", type: "", parentId: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const parentOptions = form.type ? accounts.filter((a) => a.type === form.type) : [];

  function validate() {
    const e = {};
    if (!form.code.trim()) e.code = "Required";
    if (!form.name.trim()) e.name = "Required";
    if (!form.type) e.type = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const account = await apiFetch("/api/accounting/accounts", {
        method: "POST",
        body: JSON.stringify({ code: form.code.trim(), name: form.name.trim(), type: form.type, parentId: form.parentId || undefined }),
      });
      toast.success("Account created");
      onCreated(account);
    } catch (err) {
      toast.error(err.message || "Failed to create account");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Add Account</h2>
          <button type="button" onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Code <span className="text-red-500">*</span></label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. 30401" className={`${inputCls} font-mono ${errors.code ? "border-red-400" : ""}`} />
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
            </div>
            <div>
              <label className={labelCls}>Type <span className="text-red-500">*</span></label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, parentId: "" }))}
                className={`${inputCls} ${errors.type ? "border-red-400" : ""}`}>
                <option value="">Select…</option>
                {VALID_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
            </div>
          </div>
          <div>
            <label className={labelCls}>Account Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Petty Cash 2" className={`${inputCls} ${errors.name ? "border-red-400" : ""}`} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          {parentOptions.length > 0 && (
            <div>
              <label className={labelCls}>Parent Account <span className="text-gray-400 dark:text-neutral-600">(optional)</span></label>
              <select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))} className={inputCls}>
                <option value="">None — top-level</option>
                {parentOptions.map((a) => <option key={a._id} value={a._id}>{a.code} – {a.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onSetup, loading }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex items-center justify-center mb-4">
        <BookOpen className="w-7 h-7 text-gray-400 dark:text-neutral-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">No accounts set up yet</h3>
      <p className="text-sm text-gray-500 dark:text-neutral-500 text-center mb-6 max-w-xs leading-relaxed">
        Initialize your Chart of Accounts with 50+ pre-built accounts for restaurant operations.
      </p>
      <button type="button" onClick={onSetup} disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-semibold text-white transition-colors disabled:opacity-60 shadow-sm shadow-orange-500/20">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {loading ? "Setting up…" : "Setup Accounts"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts]         = useState([]);
  const [isEmpty, setIsEmpty]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId]       = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/accounting/accounts");
      setAccounts(data.accounts || []);
      setIsEmpty(data.isEmpty ?? false);
    } catch (err) {
      toast.error(err.message || "Failed to load accounts");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSetup() {
    setSetupLoading(true);
    try {
      const data = await apiFetch("/api/accounting/setup", { method: "POST" });
      toast.success(`${data.accountsCreated} accounts created`);
      await load();
    } catch (err) {
      toast.error(err.message || "Setup failed");
    } finally { setSetupLoading(false); }
  }

  async function handleToggleActive(account) {
    const next = !account.isActive;
    try {
      await apiFetch(`/api/accounting/accounts/${account._id}`, { method: "PATCH", body: JSON.stringify({ isActive: next }) });
      setAccounts((prev) => prev.map((a) => (a._id === account._id ? { ...a, isActive: next } : a)));
    } catch (err) { toast.error(err.message || "Failed to update account"); }
  }

  async function handleEditName(id, name) {
    if (!name.trim()) { setEditingId(null); return; }
    try {
      const updated = await apiFetch(`/api/accounting/accounts/${id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      setAccounts((prev) => prev.map((a) => (a._id === id ? { ...a, name: updated.name } : a)));
      toast.success("Name updated");
    } catch (err) {
      toast.error(err.message || "Failed to update name");
    } finally { setEditingId(null); }
  }

  async function handleDelete(account) {
    if (!window.confirm(`Delete "${account.name}" (${account.code})?`)) return;
    try {
      await apiFetch(`/api/accounting/accounts/${account._id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a._id !== account._id));
      toast.success("Account deleted");
    } catch (err) { toast.error(err.message || "Failed to delete account"); }
  }

  function handleCreated(account) {
    setAccounts((prev) => [...prev, account]);
    setIsEmpty(false);
    setShowAddModal(false);
  }

  const filtered = accounts.filter((a) => {
    const matchSearch = matchesSearch(a, search);
    const matchType = !typeFilter || a.type === typeFilter;
    return matchSearch && matchType;
  });

  const sectionRows = {};
  SECTIONS.forEach(({ key }) => {
    sectionRows[key] = flattenTree(buildTree(filtered.filter((a) => a.type === key)));
  });

  const visibleSections = SECTIONS.filter(({ key }) => sectionRows[key]?.length > 0);
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.isActive !== false).length;

  return (
    <AdminLayout title="Chart of Accounts">
      <div className="space-y-4">

        {/* Toolbar */}
        {!loading && !isEmpty && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 pointer-events-none" />
              <input type="text" placeholder="Search by name or code…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors" />
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="py-2 px-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-600 dark:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer">
              <option value="">All types</option>
              {VALID_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <span className="hidden sm:block text-xs text-gray-400 dark:text-neutral-600 ml-1">
              {activeAccounts} / {totalAccounts} active
            </span>
            <div className="ml-auto">
              <button type="button" onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20">
                <Plus className="w-4 h-4" /> Add Account
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        ) : isEmpty ? (
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl">
            <EmptyState onSetup={handleSetup} loading={setupLoading} />
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[96px_1fr_80px_64px] border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/60">
                <div className="pl-4 pr-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">Code</div>
                <div className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider">Name</div>
                <div className="px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-wider text-center">Status</div>
                <div />
              </div>

              {/* Sections */}
              {visibleSections.length > 0 ? visibleSections.map((section) => (
                <Section key={section.key} section={section} rows={sectionRows[section.key]}
                  onToggleActive={handleToggleActive} onEditName={handleEditName} onDelete={handleDelete}
                  editingId={editingId} onStartEdit={(id) => setEditingId(id)} onCancelEdit={() => setEditingId(null)} />
              )) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-500 dark:text-neutral-500">No accounts match your search</p>
                  <button type="button" onClick={() => { setSearch(""); setTypeFilter(""); }}
                    className="mt-2 text-xs text-orange-500 hover:underline">Clear filters</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <AddAccountModal accounts={accounts} onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
      )}
    </AdminLayout>
  );
}
