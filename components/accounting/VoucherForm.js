import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Loader2, X, Check, Printer, RefreshCw, Search } from "lucide-react";
import { getStoredAuth } from "../../lib/apiClient";
import toast from "react-hot-toast";

// ─── API helpers ─────────────────────────────────────────────────────────────

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

// ─── Async searchable dropdown ───────────────────────────────────────────────

function AsyncSelect({ placeholder, fetchFn, value, onChange, displayFn, keyFn }) {
  const [query, setQuery]     = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef(null);
  const wrapRef               = useRef(null);

  const runSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const results = await fetchFn(q);
      setOptions(results);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  // Load initial options on mount
  useEffect(() => { runSearch(""); }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = value ? options.find((o) => keyFn(o) === value) || null : null;

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-sm text-left focus:outline-none focus:ring-1 focus:ring-orange-500 hover:border-neutral-600 transition-colors min-w-0">
        <span className={`truncate ${selected ? "text-white" : "text-neutral-500"}`}>
          {selected ? displayFn(selected) : placeholder}
        </span>
        {value && (
          <span onMouseDown={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-neutral-500 hover:text-white flex-shrink-0">
            <X className="w-3 h-3" />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-700">
            <Search className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none" />
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500 flex-shrink-0" />}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-3 text-xs text-neutral-500">No results</p>
            ) : options.map((opt) => (
              <button key={keyFn(opt)} type="button"
                onMouseDown={() => { onChange(keyFn(opt), opt); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 transition-colors ${keyFn(opt) === value ? "text-orange-400 bg-orange-500/10" : "text-white"}`}>
                {displayFn(opt)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty line factory ───────────────────────────────────────────────────────

function emptyLine() {
  return { id: Math.random().toString(36).slice(2), partyId: null, partyObj: null, accountId: null, accountObj: null, description: "", amount: "", debit: "", credit: "" };
}

function fmt(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── VoucherForm ─────────────────────────────────────────────────────────────

/**
 * Props:
 *   type: 'cash_payment' | 'cash_receipt' | 'bank_payment' | 'bank_receipt' | 'journal'
 *   title: string
 *   accountFilter?: string[]        — code prefixes to filter the main account select (default ['301','302','303'])
 *   mainAccountLabel?: string       — override the label on the main account field
 *   showSplitAmounts?: boolean      — replace single Amount column with Debit + Credit columns (journal mode)
 *   referenceLabel?: string         — override label for Reference No field
 */
export default function VoucherForm({
  type,
  title,
  accountFilter,
  mainAccountLabel,
  showSplitAmounts = false,
  referenceLabel,
}) {
  const today = new Date().toISOString().split("T")[0];

  // Left panel state
  const [voucherNumber, setVoucherNumber] = useState("…");
  const [date, setDate]                   = useState(today);
  const [referenceNo, setReferenceNo]     = useState("");
  const [notes, setNotes]                 = useState("");
  const [mainAccountId, setMainAccountId] = useState(null);
  const [mainAccountObj, setMainAccountObj] = useState(null);
  const [assetAccounts, setAssetAccounts]   = useState([]);

  // Right panel state
  const [lines, setLines]         = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState(null);

  const isPayment     = type === "cash_payment" || type === "bank_payment";
  const isJournal     = showSplitAmounts;
  // Journal mode hides the main account panel entirely
  const hideMainPanel = isJournal;
  const mainLabel     = mainAccountLabel || (isPayment ? "Payment From" : "Received Into");
  const refLabel      = referenceLabel || "Reference No.";
  // Code prefixes for the main account filter
  const filterPrefixes = accountFilter || ["301", "302", "303"];

  // Load voucher number + asset accounts on mount
  useEffect(() => {
    apiFetch(`/api/accounting/vouchers/next-number?type=${type}`)
      .then((d) => setVoucherNumber(d.number || "—"))
      .catch(() => setVoucherNumber("—"));

    if (!hideMainPanel) {
      apiFetch("/api/accounting/accounts?type=asset")
        .then((d) => {
          const accs = (d.accounts || []).filter((a) =>
            filterPrefixes.some((pfx) => a.code.startsWith(pfx))
          );
          setAssetAccounts(accs);
          const defaultAcc = accs.find((a) => a.code === "30101") || accs[0];
          if (defaultAcc) { setMainAccountId(defaultAcc._id); setMainAccountObj(defaultAcc); }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Fetch functions for async selects
  const fetchParties = useCallback(async (q) => {
    const params = new URLSearchParams({ limit: 30 });
    if (q) params.set("q", q);
    const d = await apiFetch(`/api/accounting/parties?${params.toString()}`);
    return d.parties || [];
  }, []);

  const fetchAccounts = useCallback(async (q) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const d = await apiFetch(`/api/accounting/accounts?${params.toString()}`);
    return d.accounts || [];
  }, []);

  // Line manipulation
  function updateLine(id, key, value, obj) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, [key]: value };
        if (obj !== undefined) next[`${key.replace("Id", "Obj")}`] = obj;
        return next;
      })
    );
  }

  function removeLine(id) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  // Auto-add line when tabbing out of last amount field
  function handleAmountKeyDown(e, lineId, isLast) {
    if (e.key === "Tab" && !e.shiftKey && isLast) {
      e.preventDefault();
      addLine();
      // Focus new row's party field after render
      setTimeout(() => {
        const rows = document.querySelectorAll("[data-line-party]");
        rows[rows.length - 1]?.click();
      }, 50);
    }
  }

  const totalAmount  = lines.reduce((s, l) => s + (parseFloat(l.amount)  || 0), 0);
  const totalDebit   = isJournal ? lines.reduce((s, l) => s + (parseFloat(l.debit)   || 0), 0) : totalAmount;
  const totalCredit  = isJournal ? lines.reduce((s, l) => s + (parseFloat(l.credit)  || 0), 0) : totalAmount;
  const isBalanced   = isJournal && Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const imbalance    = isJournal ? Math.abs(totalDebit - totalCredit) : 0;

  const canSubmit = isJournal ? isBalanced : totalAmount > 0;

  async function handleSubmit() {
    if (!canSubmit) return;

    // Validate lines
    for (const l of lines) {
      if (!l.accountId) { toast.error("Each line must have an account selected"); return; }
      if (isJournal) {
        const d = parseFloat(l.debit) || 0;
        const c = parseFloat(l.credit) || 0;
        if (d === 0 && c === 0) { toast.error("Each line must have a non-zero debit or credit"); return; }
        if (d > 0 && c > 0) { toast.error("Each line can only have debit OR credit, not both"); return; }
      } else {
        if (!parseFloat(l.amount)) { toast.error("Each line must have a non-zero amount"); return; }
      }
    }
    if (!hideMainPanel && !mainAccountId) { toast.error(`Please select a "${mainLabel}" account`); return; }

    // Build double-entry lines
    let builtLines;
    if (isJournal) {
      builtLines = lines.map((l) => ({
        accountId:   l.accountId,
        partyId:     l.partyId || undefined,
        debit:       parseFloat(l.debit)  || 0,
        credit:      parseFloat(l.credit) || 0,
        description: l.description || "",
      }));
    } else {
      builtLines = isPayment
        ? [
            { accountId: mainAccountId, debit: 0, credit: totalAmount, description: title },
            ...lines.map((l) => ({ accountId: l.accountId, partyId: l.partyId || undefined, debit: parseFloat(l.amount), credit: 0, description: l.description || "" })),
          ]
        : [
            { accountId: mainAccountId, debit: totalAmount, credit: 0, description: title },
            ...lines.map((l) => ({ accountId: l.accountId, partyId: l.partyId || undefined, debit: 0, credit: parseFloat(l.amount), description: l.description || "" })),
          ];
    }

    setSubmitting(true);
    try {
      const voucher = await apiFetch("/api/accounting/vouchers", {
        method: "POST",
        body: JSON.stringify({ type, date, referenceNo: referenceNo || undefined, notes: notes || undefined, lines: builtLines }),
      });
      setSavedVoucher(voucher);
      toast.success(`Voucher ${voucher.voucherNumber} saved successfully`);
    } catch (err) {
      toast.error(err.message || "Failed to save voucher");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewVoucher() {
    setSavedVoucher(null);
    setDate(today);
    setReferenceNo("");
    setNotes("");
    setLines([emptyLine(), emptyLine()]);
    // Refresh voucher number
    apiFetch(`/api/accounting/vouchers/next-number?type=${type}`)
      .then((d) => setVoucherNumber(d.number || "—"))
      .catch(() => {});
  }

  const TYPE_BADGE_COLORS = {
    cash_payment:  "bg-red-500/15 text-red-400",
    cash_receipt:  "bg-emerald-500/15 text-emerald-400",
    bank_payment:  "bg-orange-500/15 text-orange-400",
    bank_receipt:  "bg-blue-500/15 text-blue-400",
    journal:       "bg-violet-500/15 text-violet-400",
    card_transfer: "bg-cyan-500/15 text-cyan-400",
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full">
      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="lg:w-80 xl:w-96 flex-shrink-0 space-y-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
          {/* Type badge */}
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_BADGE_COLORS[type] || ""}`}>
              {title}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Voucher No.</label>
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-orange-400">
              {voucherNumber}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Date <span className="text-red-400">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">{refLabel} <span className="text-neutral-600">(optional)</span></label>
            <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Invoice / Cheque / Transfer no."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>

          {/* Main account — hidden for journal mode */}
          {!hideMainPanel && (
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">{mainLabel}</label>
              <select value={mainAccountId || ""}
                onChange={(e) => {
                  const acc = assetAccounts.find((a) => a._id === e.target.value);
                  setMainAccountId(e.target.value);
                  setMainAccountObj(acc || null);
                }}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                <option value="">Select account…</option>
                {assetAccounts.map((a) => (
                  <option key={a._id} value={a._id}>{a.code} – {a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Notes <span className="text-neutral-600">(optional)</span></label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none" />
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden flex-1">
          <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Transaction Lines</h3>
            <span className="text-xs text-neutral-500">{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Lines table — scrollable */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="pl-5 pr-2 py-2.5 text-left text-xs font-medium text-neutral-500 w-6">#</th>
                  {isJournal && (
                    <th className="px-2 py-2.5 text-left text-xs font-medium text-neutral-500 min-w-[180px]">Account <span className="text-red-400">*</span></th>
                  )}
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-neutral-500 min-w-[160px]">Party</th>
                  {!isJournal && (
                    <th className="px-2 py-2.5 text-left text-xs font-medium text-neutral-500 min-w-[180px]">Account <span className="text-red-400">*</span></th>
                  )}
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-neutral-500 min-w-[140px]">Description</th>
                  {isJournal ? (
                    <>
                      <th className="px-2 py-2.5 text-right text-xs font-medium text-neutral-500 min-w-[110px]">Debit (Rs)</th>
                      <th className="px-2 py-2.5 text-right text-xs font-medium text-neutral-500 min-w-[110px]">Credit (Rs)</th>
                    </>
                  ) : (
                    <th className="px-2 py-2.5 text-right text-xs font-medium text-neutral-500 min-w-[120px]">Amount (Rs) <span className="text-red-400">*</span></th>
                  )}
                  <th className="pr-4 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="pl-5 pr-2 py-2 text-xs text-neutral-600 tabular-nums">{idx + 1}</td>
                    {/* Journal: account before party */}
                    {isJournal && (
                      <td className="px-2 py-2">
                        <AsyncSelect
                          placeholder="Account…"
                          fetchFn={fetchAccounts}
                          value={line.accountId}
                          onChange={(v, obj) => updateLine(line.id, "accountId", v, obj)}
                          displayFn={(a) => `${a.code} – ${a.name}`}
                          keyFn={(a) => a._id}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2">
                      <div data-line-party>
                        <AsyncSelect
                          placeholder="Party…"
                          fetchFn={fetchParties}
                          value={line.partyId}
                          onChange={(v, obj) => updateLine(line.id, "partyId", v, obj)}
                          displayFn={(p) => p.name}
                          keyFn={(p) => p._id}
                        />
                      </div>
                    </td>
                    {/* Non-journal: account after party */}
                    {!isJournal && (
                      <td className="px-2 py-2">
                        <AsyncSelect
                          placeholder="Account…"
                          fetchFn={fetchAccounts}
                          value={line.accountId}
                          onChange={(v, obj) => updateLine(line.id, "accountId", v, obj)}
                          displayFn={(a) => `${a.code} – ${a.name}`}
                          keyFn={(a) => a._id}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2">
                      <input value={line.description}
                        onChange={(e) => updateLine(line.id, "description", e.target.value)}
                        placeholder="optional"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                    </td>
                    {isJournal ? (
                      <>
                        <td className="px-2 py-2">
                          <input type="number" min="0" step="0.01"
                            value={line.debit}
                            onChange={(e) => {
                              updateLine(line.id, "debit", e.target.value);
                              if (parseFloat(e.target.value) > 0) updateLine(line.id, "credit", "");
                            }}
                            onKeyDown={(e) => handleAmountKeyDown(e, line.id, idx === lines.length - 1)}
                            placeholder="0.00"
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-neutral-600 text-right focus:outline-none focus:ring-1 focus:ring-orange-500" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" step="0.01"
                            value={line.credit}
                            onChange={(e) => {
                              updateLine(line.id, "credit", e.target.value);
                              if (parseFloat(e.target.value) > 0) updateLine(line.id, "debit", "");
                            }}
                            placeholder="0.00"
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-neutral-600 text-right focus:outline-none focus:ring-1 focus:ring-orange-500" />
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="0.01"
                          value={line.amount}
                          onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                          onKeyDown={(e) => handleAmountKeyDown(e, line.id, idx === lines.length - 1)}
                          placeholder="0.00"
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-neutral-600 text-right focus:outline-none focus:ring-1 focus:ring-orange-500" />
                      </td>
                    )}
                    <td className="pr-4 py-2">
                      <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1}
                        className="text-neutral-600 hover:text-red-400 disabled:opacity-20 transition-colors p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add line + totals */}
          <div className="px-5 py-3 border-t border-neutral-800/60 flex items-center justify-between gap-4 flex-wrap">
            <button type="button" onClick={addLine}
              className="flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition-colors flex-shrink-0">
              <Plus className="w-4 h-4" /> Add Line
            </button>

            {isJournal ? (
              /* Journal: two totals + balance indicator */
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <span className="text-xs text-neutral-500 mr-1.5">Total Debit</span>
                  <span className={`text-lg font-bold tabular-nums ${totalDebit > 0 ? "text-blue-400" : "text-neutral-600"}`}>
                    Rs {fmt(totalDebit)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-500 mr-1.5">Total Credit</span>
                  <span className={`text-lg font-bold tabular-nums ${totalCredit > 0 ? "text-emerald-400" : "text-neutral-600"}`}>
                    Rs {fmt(totalCredit)}
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isBalanced
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-orange-500/15 text-orange-400"
                }`}>
                  {isBalanced ? (
                    <><Check className="w-3 h-3" /> Balanced</>
                  ) : (
                    <>Unbalanced by Rs {fmt(imbalance)}</>
                  )}
                </div>
              </div>
            ) : (
              /* Normal: single total */
              <div className="text-right">
                <span className="text-xs text-neutral-500 mr-2">Total</span>
                <span className={`text-xl font-bold tabular-nums ${totalAmount > 0 ? "text-orange-400" : "text-neutral-600"}`}>
                  Rs {fmt(totalAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Success / submit */}
        {savedVoucher ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Voucher {savedVoucher.voucherNumber} saved</p>
                <p className="text-xs text-neutral-400 mt-0.5">Posted to general ledger · Rs {savedVoucher.totalAmount?.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" onClick={handleNewVoucher}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">
                <RefreshCw className="w-4 h-4" /> New Voucher
              </button>
              <button type="button"
                onClick={() => window.open(`${API}/api/accounting/vouchers/${savedVoucher._id}/print`, "_blank")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm text-white transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}
            className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-400 text-sm font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Voucher
          </button>
        )}
      </div>
    </div>
  );
}
