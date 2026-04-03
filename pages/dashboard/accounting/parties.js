import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import {
  Plus, Loader2, X, Search, Users, ChevronLeft, ChevronRight,
  Pencil, PhoneCall, Mail, Eye, BookMarked, MapPin, CreditCard,
  Clock, FileText, Building2, TrendingUp, AlertCircle, Trash2, RefreshCw,
  MessageCircle, Info, Banknote,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../lib/apiClient";
import toast from "react-hot-toast";

// ─── API ──────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "",          label: "All" },
  { key: "supplier",  label: "Suppliers" },
  { key: "customer",  label: "Customers" },
  { key: "employee",  label: "Employees" },
  { key: "director",  label: "Directors" },
];

const TYPE_COLORS = {
  supplier: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-500/20",
  customer: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-500/20",
  employee: "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 ring-1 ring-violet-300 dark:ring-violet-500/20",
  director: "bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 ring-1 ring-orange-300 dark:ring-orange-500/20",
  other:    "bg-gray-100 dark:bg-neutral-500/15 text-gray-600 dark:text-neutral-400 ring-1 ring-gray-300 dark:ring-neutral-500/20",
};

const PAYMENT_TERMS_LABELS = {
  immediate: "Immediate",
  "7days":   "7 Days",
  "15days":  "15 Days",
  "30days":  "30 Days",
  "60days":  "60 Days",
};

const PARTY_TYPES   = ["supplier", "customer", "employee", "director", "other"];
const PAYMENT_TERMS = ["immediate", "7days", "15days", "30days", "60days"];
const LIMIT = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-400 transition-colors";
const labelCls = "block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1.5";
const filterSelectCls = "h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-600 dark:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 0 });
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats, loading }) {
  const sym = getCurrencySymbol();
  const cards = [
    { label: "Suppliers",        value: loading ? "—" : stats?.supplierCount  ?? "—", icon: Building2,   sub: null },
    { label: "Customers",        value: loading ? "—" : stats?.customerCount  ?? "—", icon: Users,       sub: null },
    { label: "Total Payable",    value: loading ? "—" : `${sym} ${fmt(stats?.totalPayable)}`,    icon: TrendingUp,  sub: "to suppliers" },
    { label: "Total Receivable", value: loading ? "—" : `${sym} ${fmt(stats?.totalReceivable)}`, icon: CreditCard,  sub: "from customers" },
    { label: "Overdue Parties",  value: loading ? "—" : stats?.overdueCount ?? 0,                icon: AlertCircle, sub: "over credit limit" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 dark:text-neutral-500">{c.label}</span>
            <c.icon className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-700" />
          </div>
          <div className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">{c.value}</div>
          {c.sub && <div className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Party Form Slide-Over ────────────────────────────────────────────────────

function PartyFormSlideOver({ party, onClose, onSaved }) {
  const isEdit = !!party?._id;
  const [form, setForm] = useState({
    name:           party?.name           || "",
    type:           party?.type           || "supplier",
    phone:          party?.phone          || "",
    email:          party?.email          || "",
    city:           party?.city           || "",
    address:        party?.address        || "",
    ntn:            party?.ntn            || "",
    notes:          party?.notes          || "",
    creditLimit:    party?.creditLimit    ?? 0,
    paymentTerms:   party?.paymentTerms   || "immediate",
    openingBalance: party?.openingBalance ?? 0,
    balanceType:    party?.balanceType    || "credit",
  });
  const [errors, setErrors]         = useState({});
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
        phone:          form.phone.trim()   || undefined,
        email:          form.email.trim()   || undefined,
        city:           form.city.trim()    || undefined,
        address:        form.address.trim() || undefined,
        ntn:            form.ntn.trim()     || undefined,
        notes:          form.notes.trim()   || undefined,
        creditLimit:    Number(form.creditLimit) || 0,
        paymentTerms:   form.paymentTerms,
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
    } finally { setSubmitting(false); }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{isEdit ? "Edit Party" : "Add Party"}</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={set("name")} placeholder="e.g. Ali Brothers Supplies"
              className={`${inputCls} ${errors.name ? "border-red-400" : ""}`} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Type | Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type <span className="text-red-500">*</span></label>
              <select value={form.type} onChange={set("type")} className={`${inputCls} ${errors.type ? "border-red-400" : ""}`}>
                {PARTY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone} onChange={set("phone")} placeholder="03xx-xxxxxxx" className={inputCls} />
            </div>
          </div>

          {/* Email | City */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={set("email")} placeholder="optional" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input value={form.city} onChange={set("city")} placeholder="e.g. Karachi" className={inputCls} />
            </div>
          </div>

          {/* NTN | Payment Terms */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>NTN / CNIC</label>
              <input value={form.ntn} onChange={set("ntn")} placeholder="optional" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Terms</label>
              <select value={form.paymentTerms} onChange={set("paymentTerms")} className={inputCls}>
                {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{PAYMENT_TERMS_LABELS[t]}</option>)}
              </select>
            </div>
          </div>

          {/* Opening Balance | Balance Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Opening Balance</label>
              <input type="number" min="0" step="0.01" value={form.openingBalance}
                onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Balance Type</label>
              <div className="grid grid-cols-2 gap-2 mt-0.5">
                {[{ v: "credit", label: "We Owe", sub: "Payable" },
                  { v: "debit",  label: "They Owe", sub: "Receivable" }].map(({ v, label, sub }) => (
                  <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, balanceType: v }))}
                    className={`flex flex-col items-center px-2 py-2 rounded-lg border text-xs text-center transition-all ${
                      form.balanceType === v
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600"
                    }`}>
                    <span className="font-medium">{label}</span>
                    <span className="text-[10px] opacity-60">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Credit Limit | Address */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Credit Limit (Rs)</label>
              <input type="number" min="0" step="1" value={form.creditLimit}
                onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                placeholder="0 = no limit" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={form.address} onChange={set("address")} placeholder="optional" className={inputCls} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={set("notes")} rows={3}
              placeholder="Internal notes about this party…" className={`${inputCls} resize-none`} />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800 flex-shrink-0 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Party"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Party Detail Slide-Over ──────────────────────────────────────────────────

function PartyDetailSlideOver({ party, onClose, onEdit }) {
  const router = useRouter();
  const sym = getCurrencySymbol();
  const [balance, setBalance]             = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [txns, setTxns]                   = useState([]);
  const [txnsLoading, setTxnsLoading]     = useState(true);

  useEffect(() => {
    apiFetch(`/api/accounting/parties/${party._id}/balance`)
      .then(setBalance).catch(() => setBalance(null)).finally(() => setBalanceLoading(false));

    const from = new Date();
    from.setDate(from.getDate() - 30);
    const dateFrom = from.toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);
    apiFetch(`/api/accounting/reports/ledger?partyId=${party._id}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then((d) => setTxns(d.entries || [])).catch(() => setTxns([])).finally(() => setTxnsLoading(false));
  }, [party._id]);

  const balAbs   = balance ? Math.abs(balance.balance) : 0;
  const isCredit = balance?.balanceType === "credit";
  const recentTxns = txns.slice(-5).reverse();
  const totalDebit = txns.reduce((s, t) => s + (t.debit || 0), 0);
  const totalCredit = txns.reduce((s, t) => s + (t.credit || 0), 0);
  const lastTxnDate = txns.length ? txns[txns.length - 1]?.date : null;
  const initials = (party.name || "P").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "P";
  const avatarCls = party.type === "supplier"
    ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
    : party.type === "customer"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
      : "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300";
  const phoneDigits = String(party.phone || "").replace(/\D/g, "");
  const waPhone = phoneDigits
    ? (phoneDigits.startsWith("0") ? `92${phoneDigits.slice(1)}` : (phoneDigits.startsWith("92") ? phoneDigits : `92${phoneDigits}`))
    : "";

  const detailRows = [
    { icon: Mail,       label: "Email",         value: party.email  || "—" },
    { icon: MapPin,     label: "City",          value: party.city   || "—" },
    { icon: FileText,   label: "NTN / CNIC",    value: party.ntn    || "—" },
    { icon: Clock,      label: "Payment Terms", value: PAYMENT_TERMS_LABELS[party.paymentTerms] || "Immediate" },
    { icon: CreditCard, label: "Credit Limit",  value: party.creditLimit ? `${getCurrencySymbol()} ${fmt(party.creditLimit)}` : "No limit" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarCls}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">{party.name}</h2>
              <span className={`inline-flex mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[party.type] || TYPE_COLORS.other}`}>
                {party.type}
              </span>
              <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-1">ID: {party._id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button type="button" onClick={() => onEdit(party)}
              className="p-2 rounded-lg text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors ring-1 ring-orange-200 dark:ring-orange-500/30" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <PhoneCall className="w-3 h-3 text-gray-400 dark:text-neutral-600" />
              <span className="text-[10px] font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Phone</span>
            </div>
            {party.phone ? (
              <div className="flex items-center gap-2">
                <a href={`tel:${party.phone}`} className="text-sm text-orange-600 dark:text-orange-400 hover:underline">
                  {party.phone}
                </a>
                {waPhone && (
                  <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
                    title="Open WhatsApp">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : <span className="text-sm text-gray-500 dark:text-neutral-300">—</span>}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {detailRows.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className="w-3 h-3 text-gray-400 dark:text-neutral-600" />
                  <span className="text-[10px] font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wider">{label}</span>
                </div>
                <span className="text-sm text-gray-700 dark:text-neutral-300 break-words">{value}</span>
              </div>
            ))}
          </div>

          {party.address && (
            <div>
              <div className="text-[10px] font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Address</div>
              <p className="text-sm text-gray-700 dark:text-neutral-300">{party.address}</p>
            </div>
          )}
          {party.notes && (
            <div>
              <div className="text-[10px] font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">Notes</div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">{party.notes}</p>
            </div>
          )}

          {/* Balance card */}
          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-800/40">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Balance Summary</span>
            </div>
            {balanceLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-orange-400" /></div>
            ) : balance ? (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[10px] text-gray-400 dark:text-neutral-600 mb-0.5">Opening</div>
                    <div className="text-sm font-semibold text-gray-700 dark:text-neutral-300">{sym} {fmt(balance.openingBalance)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 dark:text-neutral-600 mb-0.5 inline-flex items-center gap-1">
                      Ledger Movement
                      <Info
                        className="w-3 h-3 text-gray-300 dark:text-neutral-600"
                        title="Total of all debit/credit entries in the general ledger for this party"
                      />
                    </div>
                    <div className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                      {balance.ledgerCredit - balance.ledgerDebit >= 0 ? "+" : ""}{sym} {fmt(Math.abs(balance.ledgerCredit - balance.ledgerDebit))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 dark:text-neutral-600 mb-0.5">Current</div>
                    <div className={`text-base font-bold ${balAbs === 0 ? "text-gray-500" : isCredit ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {sym} {fmt(balAbs)}
                    </div>
                  </div>
                </div>
                {balAbs > 0 && (
                  <div className="text-center">
                    <span className={`text-[10px] font-medium ${isCredit ? "text-red-400" : "text-emerald-500"}`}>
                      {isCredit ? "Payable — we owe them" : "Receivable — they owe us"}
                    </span>
                  </div>
                )}
                {/* Make Payment / Receive Payment quick action */}
                {balAbs > 0 && (
                  <button type="button"
                    onClick={() => {
                      const dest = isCredit ? "cash-payment" : "cash-receipt";
                      router.push(
                        `/dashboard/accounting/vouchers/${dest}?partyId=${party._id}&partyName=${encodeURIComponent(party.name)}&suggestedAmount=${balAbs}`
                      );
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isCredit
                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                        : "bg-white dark:bg-neutral-900 border border-teal-300 dark:border-teal-500/40 hover:bg-teal-50 dark:hover:bg-teal-500/10 text-teal-700 dark:text-teal-300"
                    }`}>
                    {isCredit ? `💳 Pay ${sym} ${fmt(balAbs)}` : `Receive ${sym} ${fmt(balAbs)}`}
                  </button>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400 dark:text-neutral-600">Could not load balance</div>
            )}
          </div>

          {/* Recent transactions */}
          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-800/40">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Recent Transactions (30 days)</span>
            </div>
            {txnsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-orange-400" /></div>
            ) : txns.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-neutral-600">No transactions in the last 30 days</div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-neutral-800/40 border-b border-gray-100 dark:border-neutral-800">
                        <th className="px-3 py-2 text-left font-semibold text-gray-400 dark:text-neutral-500 uppercase">Date</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-400 dark:text-neutral-500 uppercase">Voucher</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-400 dark:text-neutral-500 uppercase">Paid Via</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-400 dark:text-neutral-500 uppercase">Description</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-400 dark:text-neutral-500 uppercase">Debit</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-400 dark:text-neutral-500 uppercase">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-neutral-800/60">
                      {recentTxns.map((t, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                            {t.date ? new Date(t.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }) : "—"}
                          </td>
                          <td className="px-2 py-2 font-mono text-gray-500 dark:text-neutral-400 whitespace-nowrap">{t.voucherNumber || "—"}</td>
                          <td className="px-2 py-2 text-gray-700 dark:text-neutral-300 whitespace-nowrap">{t.accountName || "—"}</td>
                          <td className="px-2 py-2 text-gray-600 dark:text-neutral-400 max-w-[120px] truncate">{t.description || "—"}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-red-500">{t.debit > 0 ? `${sym} ${fmt(t.debit)}` : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{t.credit > 0 ? `${sym} ${fmt(t.credit)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button"
                  onClick={() => router.push(`/dashboard/accounting/reports/ledger?partyId=${party._id}`)}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-medium">
                  <BookMarked className="w-3.5 h-3.5" /> View Full Ledger →
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-800/40">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Quick Stats (30 days)</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div>
                <div className="text-[10px] text-gray-400 dark:text-neutral-600 mb-0.5">Total Paid</div>
                <div className="text-sm font-semibold text-red-500">{sym} {fmt(totalDebit)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 dark:text-neutral-600 mb-0.5">Total Purchased</div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{sym} {fmt(totalCredit)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 dark:text-neutral-600 mb-0.5">Last Transaction</div>
                <div className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                  {lastTxnDate ? new Date(lastTxnDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 dark:text-neutral-600 mb-0.5">Total Transactions</div>
                <div className="text-sm font-semibold text-gray-700 dark:text-neutral-300">{txns.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Balance Cell ──────────────────────────────────────────────────────────────

// Shared cache so both cells don't fire duplicate requests
const balanceCache = {};

function usePartyBalance(partyId) {
  const [data, setData]       = useState(balanceCache[partyId] || null);
  const [loading, setLoading] = useState(!balanceCache[partyId]);

  useEffect(() => {
    if (balanceCache[partyId]) { setData(balanceCache[partyId]); setLoading(false); return; }
    apiFetch(`/api/accounting/parties/${partyId}/balance`)
      .then((d) => { balanceCache[partyId] = d; setData(d); })
      .catch(() => { const fallback = { balance: 0, balanceType: "credit" }; balanceCache[partyId] = fallback; setData(fallback); })
      .finally(() => setLoading(false));
  }, [partyId]);

  return { data, loading };
}

function BalanceCell({ partyId }) {
  const { data, loading } = usePartyBalance(partyId);
  if (loading) return <span className="text-gray-300 dark:text-neutral-700 text-xs">—</span>;
  const abs = Math.abs(data?.balance || 0);
  if (abs === 0) return <span className="text-gray-400 dark:text-neutral-500">—</span>;
  const sym = getCurrencySymbol();
  return (
    <span className={`text-sm font-semibold tabular-nums ${data.balanceType === "credit" ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
      {sym} {fmt(abs)}
    </span>
  );
}

function BalanceStatusCell({ partyId }) {
  const { data, loading } = usePartyBalance(partyId);
  if (loading) return <span className="text-gray-300 dark:text-neutral-700 text-xs">—</span>;
  const abs = Math.abs(data?.balance || 0);
  if (abs === 0) return <span className="text-gray-400 dark:text-neutral-500">—</span>;
  const isCredit = data.balanceType === "credit";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
      isCredit
        ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 ring-red-200 dark:ring-red-500/20"
        : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-500/20"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCredit ? "bg-red-500" : "bg-emerald-500"}`} />
      {isCredit ? "Payable" : "Receivable"}
    </span>
  );
}

function PayActionButton({ party }) {
  const router = useRouter();
  const { data, loading } = usePartyBalance(party._id);
  if (loading) return null;
  const abs = Math.abs(data?.balance || 0);
  if (abs === 0) return null;
  const isCredit = data.balanceType === "credit";

  return (
    <button
      type="button"
      onClick={() => {
        const dest = isCredit ? "cash-payment" : "cash-receipt";
        router.push(
          `/dashboard/accounting/vouchers/${dest}?partyId=${party._id}&partyName=${encodeURIComponent(party.name)}&suggestedAmount=${abs}`
        );
      }}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
      title={isCredit ? "Make payment" : "Receive payment"}
    >
      <Banknote className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartiesPage() {
  const router = useRouter();

  const [parties, setParties]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [cities, setCities]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("");
  const [search, setSearch]         = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [balFilter, setBalFilter]   = useState("");
  const [sortBy, setSortBy]         = useState("");
  const [stats, setStats]           = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [formSlideOver, setFormSlideOver]     = useState(null);
  const [detailSlideOver, setDetailSlideOver] = useState(null);
  const debounceRef = useRef(null);

  const fetchParties = useCallback(async (q, type, p, city, sort) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (q)    params.set("q", q);
      if (type) params.set("type", type);
      if (city) params.set("city", city);
      if (sort) params.set("sortBy", sort);
      const data = await apiFetch(`/api/accounting/parties?${params.toString()}`);
      setParties(data.parties || []);
      setTotal(data.total || 0);
      setPage(data.page  || 1);
      if (data.cities?.length) setCities(data.cities);
    } catch (err) {
      toast.error(err.message || "Failed to load parties");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    apiFetch("/api/accounting/parties/totals")
      .then(setStats).catch(() => setStats(null)).finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchParties(search, activeTab, 1, cityFilter, sortBy);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, activeTab, cityFilter, balFilter, sortBy, fetchParties]);

  function handleSaved() {
    setFormSlideOver(null);
    setDetailSlideOver(null);
    fetchParties(search, activeTab, page, cityFilter, sortBy);
    apiFetch("/api/accounting/parties/totals").then(setStats).catch(() => {});
  }

  async function handleDelete(party) {
    if (!window.confirm(`Remove "${party.name}"?`)) return;
    try {
      await apiFetch(`/api/accounting/parties/${party._id}`, { method: "DELETE" });
      toast.success("Party removed");
      fetchParties(search, activeTab, page, cityFilter, sortBy);
      apiFetch("/api/accounting/parties/totals").then(setStats).catch(() => {});
    } catch (err) { toast.error(err.message || "Failed to remove party"); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  // DataTable column definitions
  const columns = [
    {
      key: "name",
      header: "Name",
      render: (_, party) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{party.name}</div>
          {party.email && (
            <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-neutral-500 mt-0.5">
              <Mail className="w-3 h-3" /> {party.email}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[v] || TYPE_COLORS.other}`}>
          {v}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      hideOnMobile: true,
      render: (v) => v
        ? <span className="flex items-center gap-1 text-gray-500 dark:text-neutral-400"><PhoneCall className="w-3 h-3 flex-shrink-0" />{v}</span>
        : <span className="text-gray-300 dark:text-neutral-700">—</span>,
    },
    {
      key: "city",
      header: "City",
      hideOnMobile: true,
      render: (v) => v || <span className="text-gray-300 dark:text-neutral-700">—</span>,
      cellClassName: "text-gray-500 dark:text-neutral-400",
    },
    {
      key: "paymentTerms",
      header: "Terms",
      hideOnTablet: true,
      render: (v) => PAYMENT_TERMS_LABELS[v] || "Immediate",
      cellClassName: "text-gray-500 dark:text-neutral-400",
    },
    {
      key: "creditLimit",
      header: "Credit Limit",
      align: "right",
      hideOnTablet: true,
      render: (v) => v > 0
        ? <span className="tabular-nums">{getCurrencySymbol()} {fmt(v)}</span>
        : <span className="text-gray-300 dark:text-neutral-700">—</span>,
      cellClassName: "text-gray-500 dark:text-neutral-400",
    },
    {
      key: "_id",
      header: "Balance",
      align: "right",
      render: (id) => <BalanceCell partyId={id} />,
    },
    {
      key: "_id2",
      header: "Status",
      align: "center",
      render: (_, party) => <BalanceStatusCell partyId={party._id} />,
    },
    {
      key: "_actions",
      header: "Actions",
      align: "right",
      render: (_, party) => (
        <div className="flex items-center justify-end gap-0.5">
          <button type="button" onClick={() => setDetailSlideOver(party)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" title="View details">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => setFormSlideOver(party)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-neutral-800 transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <PayActionButton party={party} />
          <button type="button"
            onClick={() => router.push(`/dashboard/accounting/reports/ledger?partyId=${party._id}`)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-neutral-800 transition-colors" title="View ledger">
            <BookMarked className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => handleDelete(party)}
            className="p-1.5 rounded-lg text-gray-300 dark:text-neutral-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-neutral-800 transition-colors" title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Parties">
      <div className="space-y-4">

        {/* Stats strip */}
        <StatsStrip stats={stats} loading={statsLoading} />

        {/* Filter + action row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 pointer-events-none" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search parties…"
              className="h-9 w-52 pl-9 pr-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors" />
          </div>

          {/* Type */}
          <select value={activeTab} onChange={(e) => { setActiveTab(e.target.value); setPage(1); }} className={filterSelectCls}>
            {TABS.map((tab) => <option key={tab.key} value={tab.key}>{tab.key === "" ? "All Types" : tab.label}</option>)}
          </select>

          {/* City */}
          {cities.length > 0 && (
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className={filterSelectCls}>
              <option value="">All Cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Balance */}
          <select value={balFilter} onChange={(e) => setBalFilter(e.target.value)} className={filterSelectCls}>
            <option value="">All Balances</option>
            <option value="has_balance">Has Balance</option>
            <option value="zero">Zero Balance</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={filterSelectCls}>
            <option value="">Name A–Z</option>
            <option value="balance_desc">Balance High–Low</option>
            <option value="balance_asc">Balance Low–High</option>
            <option value="recent">Recently Added</option>
          </select>

          <span className="text-xs text-gray-400 dark:text-neutral-600">{total} {total === 1 ? "party" : "parties"}</span>

          {/* Refresh + Add buttons — pushed to the right */}
          <div className="ml-auto flex items-center gap-2">
            <button type="button"
              onClick={() => { fetchParties(search, activeTab, page, cityFilter, sortBy); apiFetch("/api/accounting/parties/totals").then(setStats).catch(() => {}); }}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
              title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setFormSlideOver("new")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20">
              <Plus className="w-4 h-4" /> Add Party
            </button>
          </div>
        </div>

        {/* Table */}
        <DataTable
          variant="card"
          columns={columns}
          data={parties}
          getRowId={(row) => row._id}
          loading={loading}
          emptyMessage={
            search
              ? `No parties match "${search}"`
              : "No parties yet — add your first one."
          }
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500 dark:text-neutral-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => fetchParties(search, activeTab, page - 1, cityFilter, sortBy)}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 dark:text-neutral-400 tabular-nums">{page} / {totalPages}</span>
              <button type="button"
                onClick={() => fetchParties(search, activeTab, page + 1, cityFilter, sortBy)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {formSlideOver !== null && (
        <PartyFormSlideOver
          party={formSlideOver === "new" ? null : formSlideOver}
          onClose={() => setFormSlideOver(null)}
          onSaved={handleSaved}
        />
      )}

      {detailSlideOver !== null && (
        <PartyDetailSlideOver
          party={detailSlideOver}
          onClose={() => setDetailSlideOver(null)}
          onEdit={(p) => { setDetailSlideOver(null); setFormSlideOver(p); }}
        />
      )}
    </AdminLayout>
  );
}
