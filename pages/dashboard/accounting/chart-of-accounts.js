import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Loader2,
  X,
  Check,
  BookOpen,
} from "lucide-react";
import { getStoredAuth } from "../../../lib/apiClient";
import toast from "react-hot-toast";

// ─── Constants ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "capital",   label: "Capital" },
  { key: "asset",     label: "Assets" },
  { key: "liability", label: "Liabilities" },
  { key: "revenue",   label: "Revenue" },
  { key: "cogs",      label: "Cost of Goods Sold" },
  { key: "expense",   label: "Expenses" },
];

const TYPE_COLORS = {
  capital:   "bg-violet-500/15 text-violet-400 ring-violet-500/20",
  asset:     "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  liability: "bg-red-500/15 text-red-400 ring-red-500/20",
  revenue:   "bg-blue-500/15 text-blue-400 ring-blue-500/20",
  cogs:      "bg-orange-500/15 text-orange-400 ring-orange-500/20",
  expense:   "bg-yellow-500/15 text-yellow-400 ring-yellow-500/20",
};

// ─── API helpers ────────────────────────────────────────────────────────────

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

async function fetchAccounts() {
  return apiFetch("/api/accounting/accounts");
}

async function setupAccounting() {
  return apiFetch("/api/accounting/setup", { method: "POST" });
}

async function createAccount(body) {
  return apiFetch("/api/accounting/accounts", { method: "POST", body: JSON.stringify(body) });
}

async function patchAccount(id, body) {
  return apiFetch(`/api/accounting/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

async function deleteAccount(id) {
  return apiFetch(`/api/accounting/accounts/${id}`, { method: "DELETE" });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildTree(accounts) {
  const byId = {};
  accounts.forEach((a) => { byId[a._id] = { ...a, children: [] }; });
  const roots = [];
  accounts.forEach((a) => {
    if (a.parentId && byId[a.parentId]) {
      byId[a.parentId].children.push(byId[a._id]);
    } else {
      roots.push(byId[a._id]);
    }
  });
  // sort by code within each level
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
  return (
    account.name.toLowerCase().includes(lower) ||
    account.code.toLowerCase().includes(lower)
  );
}

// ─── Inline Edit ────────────────────────────────────────────────────────────

function InlineEdit({ account, onSave, onCancel }) {
  const [val, setVal] = useState(account.name);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleKeyDown(e) {
    if (e.key === "Enter") onSave(val);
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(val)}
        className="flex-1 min-w-0 bg-neutral-800 border border-orange-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
      />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onSave(val); }} className="text-emerald-400 hover:text-emerald-300 transition-colors">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); onCancel(); }} className="text-neutral-500 hover:text-neutral-300 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Account Row ────────────────────────────────────────────────────────────

function AccountRow({ account, onToggleActive, onEditName, onDelete, isEditing, onStartEdit, onCancelEdit }) {
  const indent = account.depth * 24;
  const isChild = account.depth > 0;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800/60 hover:bg-neutral-800/30 transition-colors group ${!account.isActive ? "opacity-50" : ""}`}
    >
      {/* Indent + left border for children */}
      <div className="flex items-center flex-shrink-0" style={{ width: indent }}>
        {isChild && (
          <div className="w-0.5 h-6 bg-neutral-700 rounded-full ml-auto mr-0" />
        )}
      </div>

      {/* Code */}
      <span className="font-mono text-xs text-neutral-400 w-16 flex-shrink-0 tabular-nums">
        {account.code}
      </span>

      {/* Name / inline edit */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {isEditing ? (
          <InlineEdit
            account={account}
            onSave={(name) => onEditName(account._id, name)}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <span className={`text-sm truncate ${account.isActive ? "text-white" : "text-neutral-500"}`}>
              {account.name}
            </span>
            {!account.isSystem && (
              <button
                type="button"
                onClick={() => onStartEdit(account._id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500 hover:text-orange-400"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Type badge */}
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 flex-shrink-0 ${TYPE_COLORS[account.type] || ""}`}>
        {account.type}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {account.isSystem ? (
          <Lock className="w-3.5 h-3.5 text-neutral-600" title="System account" />
        ) : (
          <button
            type="button"
            onClick={() => onDelete(account)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-600 hover:text-red-400 p-0.5"
            title="Delete account"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggleActive(account)}
          className="text-neutral-500 hover:text-orange-400 transition-colors p-0.5"
          title={account.isActive ? "Deactivate" : "Activate"}
        >
          {account.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

function Section({ section, rows, onToggleActive, onEditName, onDelete, editingId, onStartEdit, onCancelEdit }) {
  const [open, setOpen] = useState(true);
  if (!rows.length) return null;

  return (
    <div className="mb-2 rounded-xl border border-neutral-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900 hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{section.label}</span>
          <span className="text-xs text-neutral-500 bg-neutral-800 rounded-full px-2 py-0.5">{rows.length}</span>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-neutral-400" />
          : <ChevronRight className="w-4 h-4 text-neutral-400" />
        }
      </button>
      {open && (
        <div className="bg-neutral-950">
          {rows.map((acc) => (
            <AccountRow
              key={acc._id}
              account={acc}
              onToggleActive={onToggleActive}
              onEditName={onEditName}
              onDelete={onDelete}
              isEditing={editingId === acc._id}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Account Modal ──────────────────────────────────────────────────────

const VALID_TYPES = ["asset", "liability", "capital", "revenue", "cogs", "expense"];

function AddAccountModal({ accounts, onClose, onCreated }) {
  const [form, setForm] = useState({ code: "", name: "", type: "", parentId: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const parentOptions = form.type
    ? accounts.filter((a) => a.type === form.type)
    : [];

  function validate() {
    const e = {};
    if (!form.code.trim()) e.code = "Code is required";
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.type) e.type = "Type is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const account = await createAccount({
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || undefined,
      });
      toast.success("Account created");
      onCreated(account);
    } catch (err) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-base font-semibold text-white">Add Account</h2>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Account Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="e.g. 30401"
              className={`w-full bg-neutral-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 ${errors.code ? "border-red-500" : "border-neutral-700"}`}
            />
            {errors.code && <p className="text-red-400 text-xs mt-1">{errors.code}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Account Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Petty Cash 2"
              className={`w-full bg-neutral-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 ${errors.name ? "border-red-500" : "border-neutral-700"}`}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Account Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, parentId: "" }))}
              className={`w-full bg-neutral-800 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 ${errors.type ? "border-red-500" : "border-neutral-700"}`}
            >
              <option value="">Select type…</option>
              {VALID_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            {errors.type && <p className="text-red-400 text-xs mt-1">{errors.type}</p>}
          </div>
          {parentOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Parent Account <span className="text-neutral-600">(optional)</span></label>
              <select
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">None (top-level)</option>
                {parentOptions.map((a) => (
                  <option key={a._id} value={a._id}>{a.code} – {a.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onSetup, loading }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mb-5">
        <BookOpen className="w-8 h-8 text-neutral-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No accounts set up yet</h3>
      <p className="text-sm text-neutral-500 text-center mb-8 max-w-sm">
        Set up your Chart of Accounts with a standard restaurant-ready account structure. This takes a second.
      </p>
      <button
        type="button"
        onClick={onSetup}
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Setup Accounts
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAccounts();
      setAccounts(data.accounts || []);
      setIsEmpty(data.isEmpty ?? false);
    } catch (err) {
      toast.error(err.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSetup() {
    setSetupLoading(true);
    try {
      const data = await setupAccounting();
      toast.success(`${data.accountsCreated} accounts created`);
      await load();
    } catch (err) {
      toast.error(err.message || "Setup failed");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleToggleActive(account) {
    const next = !account.isActive;
    try {
      await patchAccount(account._id, { isActive: next });
      setAccounts((prev) =>
        prev.map((a) => (a._id === account._id ? { ...a, isActive: next } : a))
      );
    } catch (err) {
      toast.error(err.message || "Failed to update account");
    }
  }

  async function handleEditName(id, name) {
    if (!name.trim()) { setEditingId(null); return; }
    try {
      const updated = await patchAccount(id, { name: name.trim() });
      setAccounts((prev) =>
        prev.map((a) => (a._id === id ? { ...a, name: updated.name } : a))
      );
      toast.success("Name updated");
    } catch (err) {
      toast.error(err.message || "Failed to update name");
    } finally {
      setEditingId(null);
    }
  }

  async function handleDelete(account) {
    if (!window.confirm(`Delete "${account.name}" (${account.code})?`)) return;
    try {
      await deleteAccount(account._id);
      setAccounts((prev) => prev.filter((a) => a._id !== account._id));
      toast.success("Account deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete account");
    }
  }

  function handleCreated(account) {
    setAccounts((prev) => [...prev, account]);
    setIsEmpty(false);
    setShowAddModal(false);
  }

  // Build section rows with search filter
  const filtered = search
    ? accounts.filter((a) => matchesSearch(a, search))
    : accounts;

  const sectionRows = {};
  SECTIONS.forEach(({ key }) => {
    const typeAccs = filtered.filter((a) => a.type === key);
    const tree = buildTree(typeAccs);
    sectionRows[key] = flattenTree(tree);
  });

  return (
    <AdminLayout>
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Chart of Accounts</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Manage your general ledger account structure</p>
          </div>
          {!isEmpty && !loading && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-sm font-semibold text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        ) : isEmpty ? (
          <EmptyState onSetup={handleSetup} loading={setupLoading} />
        ) : (
          <>
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search accounts by name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Sections */}
            <div>
              {SECTIONS.map((section) => (
                <Section
                  key={section.key}
                  section={section}
                  rows={sectionRows[section.key] || []}
                  onToggleActive={handleToggleActive}
                  onEditName={handleEditName}
                  onDelete={handleDelete}
                  editingId={editingId}
                  onStartEdit={(id) => setEditingId(id)}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
              {search && filtered.length === 0 && (
                <div className="text-center py-12 text-neutral-500 text-sm">
                  No accounts match &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <AddAccountModal
          accounts={accounts}
          onClose={() => setShowAddModal(false)}
          onCreated={handleCreated}
        />
      )}
    </AdminLayout>
  );
}
