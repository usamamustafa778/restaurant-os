import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Plus, Loader2, X, Check, Printer, RefreshCw, Lock } from "lucide-react";
import { getStoredAuth } from "../../lib/apiClient";
import toast from "react-hot-toast";
import AsyncCombobox from "./AsyncCombobox";
import VoucherPagesNav from "./VoucherPagesNav";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyLine() {
  return {
    id: Math.random().toString(36).slice(2),
    partyId: null, partyObj: null,
    accountId: null, accountObj: null,
    description: "", amount: "", debit: "", credit: "",
  };
}

function fmt(n) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── VoucherForm ─────────────────────────────────────────────────────────────

export default function VoucherForm({
  type,
  title,
  accountFilter,
  mainAccountLabel,
  showSplitAmounts = false,
  referenceLabel,
  referenceRequired = false,
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [voucherNumber, setVoucherNumber]   = useState("…");
  const [date, setDate]                     = useState(today);
  const [referenceNo, setReferenceNo]       = useState("");
  const [notes, setNotes]                   = useState("");
  const [mainAccountId, setMainAccountId]   = useState(null);
  const [mainAccountObj, setMainAccountObj] = useState(null);
  const [assetAccounts, setAssetAccounts]   = useState([]);

  const [lines, setLines]               = useState([emptyLine()]);
  const [submitting, setSubmitting]     = useState(false);
  const [savedVoucher, setSavedVoucher] = useState(null);
  const [submitted, setSubmitted]       = useState(false);
  const [prefilled, setPrefilled]       = useState(false);

  const isPayment     = type === "cash_payment" || type === "bank_payment";
  const isJournal     = showSplitAmounts;
  const hideMainPanel = isJournal;
  const mainLabel     = mainAccountLabel || (isPayment ? "Payment From" : "Received Into");
  const refLabel      = referenceLabel || "Reference No.";
  const filterPrefixes = accountFilter || ["301", "302", "303"];

  // Pick the preferred default account code based on voucher type
  const defaultAccountCode =
    type === "bank_payment" || type === "bank_receipt" ? "30201" : "30101";

  useEffect(() => {
    apiFetch(`/api/accounting/vouchers/next-number?type=${type}`)
      .then((d) => setVoucherNumber(d.number || "—"))
      .catch(() => setVoucherNumber("—"));

    if (!hideMainPanel) {
      apiFetch("/api/accounting/accounts?type=asset")
        .then((d) => {
          const accs = (d.accounts || [])
            .filter((a) => filterPrefixes.some((pfx) => a.code.startsWith(pfx)))
            .sort((a, b) => a.code.localeCompare(b.code));
          setAssetAccounts(accs);
          // Default to type-appropriate account (30101 for cash, 30201 for bank)
          const defaultAcc = accs.find((a) => a.code === defaultAccountCode) || accs[0];
          if (defaultAcc) {
            setMainAccountId(defaultAcc._id);
            setMainAccountObj(defaultAcc);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Pre-fill from URL params:
  // — Party flow: ?partyId=&partyName=&suggestedAmount=
  // — Expense flow (e.g. rider payout → 602 Rider Allowances): ?expenseAccountCode=602&suggestedAmount=&notes=&riderName=
  useEffect(() => {
    if (!router.isReady || prefilled) return;
    const q = router.query;
    const { partyId, partyName, suggestedAmount, amount, notes: notesParam, riderName } = q;
    const expenseAccountCode = q.expenseAccountCode || q.expenseCode;
    const prefillAmount = suggestedAmount || amount || "";

    // Cash/Bank payment: book expense to Chart of Accounts (no party), e.g. 602 Rider Allowances
    if (!partyId && expenseAccountCode && isPayment) {
      const code = String(expenseAccountCode).trim();
      apiFetch(`/api/accounting/accounts?q=${encodeURIComponent(code)}`)
        .then((d) => {
          const list = d.accounts || [];
          const acc =
            list.find((a) => String(a.code) === code) ||
            list.find((a) => String(a.code).startsWith(code)) ||
            null;
          const desc =
            (notesParam && String(notesParam)) ||
            (riderName
              ? `Rider payout — ${decodeURIComponent(String(riderName))}`
              : "Rider allowances");
          setLines([
            {
              ...emptyLine(),
              accountId: acc?._id || null,
              accountObj: acc || null,
              amount: prefillAmount ? String(prefillAmount) : "",
              description: desc,
            },
          ]);
          if (notesParam && String(notesParam).length > 3) {
            setNotes(String(notesParam));
          }
        })
        .catch(() => {});
      setPrefilled(true);
      return;
    }

    if (!partyId) return;

    // Code of the line account to pre-select based on voucher type
    const lineAccountCode = type === "cash_receipt" ? "20102" : "20101"; // 20101 = Suppliers Payable

    apiFetch(`/api/accounting/accounts?q=${lineAccountCode}`)
      .then((d) => {
        const acc = (d.accounts || []).find((a) => a.code === lineAccountCode) || null;
        setLines([{
          ...emptyLine(),
          partyId:    partyId,
          partyObj:   { _id: partyId, name: decodeURIComponent(partyName || "") },
          accountId:  acc?._id  || null,
          accountObj: acc       || null,
          amount:     prefillAmount,
        }]);
      })
      .catch(() => {
        setLines([{
          ...emptyLine(),
          partyId:  partyId,
          partyObj: { _id: partyId, name: decodeURIComponent(partyName || "") },
          amount:   prefillAmount,
        }]);
      });

    setTimeout(() => {
      const descInput = document.querySelector("input[data-line-description]");
      descInput?.focus();
    }, 120);

    setPrefilled(true);
  }, [router.isReady, router.query, prefilled, type, isPayment]);

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

  function handleAmountKeyDown(e, lineId, isLast) {
    if (e.key === "Tab" && !e.shiftKey && isLast) {
      e.preventDefault();
      addLine();
      setTimeout(() => {
        const inputs = document.querySelectorAll("[data-line-party-input]");
        inputs[inputs.length - 1]?.focus();
      }, 50);
    }
  }

  const totalAmount = lines.reduce((s, l) => s + (parseFloat(l.amount)  || 0), 0);
  const totalDebit  = isJournal ? lines.reduce((s, l) => s + (parseFloat(l.debit)   || 0), 0) : totalAmount;
  const totalCredit = isJournal ? lines.reduce((s, l) => s + (parseFloat(l.credit)  || 0), 0) : totalAmount;
  const isBalanced  = isJournal && Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  const imbalance   = isJournal ? Math.abs(totalDebit - totalCredit) : 0;
  const canSubmit   = isJournal ? isBalanced : totalAmount > 0;

  const hasAnyJournalAmount = isJournal && lines.some(
    (l) => (parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0
  );

  async function handleSubmit() {
    setSubmitted(true);

    // Inline validation
    if (referenceRequired && !referenceNo.trim()) {
      toast.error(`${refLabel} is required`);
      return;
    }
    for (const l of lines) {
      if (!l.accountId) { toast.error("Each line must have an account selected"); return; }
      if (isJournal) {
        const d = parseFloat(l.debit) || 0;
        const c = parseFloat(l.credit) || 0;
        if (d === 0 && c === 0) { toast.error("Each line must have a non-zero debit or credit"); return; }
        if (d > 0 && c > 0)     { toast.error("Each line can only have debit OR credit, not both"); return; }
      } else {
        if (!parseFloat(l.amount)) { toast.error("Each line must have a non-zero amount"); return; }
      }
    }
    if (!hideMainPanel && !mainAccountId) { toast.error(`Please select a "${mainLabel}" account`); return; }
    if (!canSubmit) {
      if (isJournal) toast.error(`Voucher is unbalanced by Rs ${fmt(imbalance)}`);
      return;
    }

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
      setSubmitted(false);
      toast.success(`Voucher ${voucher.voucherNumber} saved successfully`);
    } catch (err) {
      toast.error(err.message || "Failed to save voucher");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewVoucher() {
    setSavedVoucher(null);
    setSubmitted(false);
    setDate(today);
    setReferenceNo("");
    setNotes("");
    setLines([emptyLine()]);
    // Reset main account to type-appropriate default (30101 cash / 30201 bank)
    if (!hideMainPanel) {
      const defaultAcc = assetAccounts.find((a) => a.code === defaultAccountCode) || assetAccounts[0] || null;
      if (defaultAcc) {
        setMainAccountId(defaultAcc._id);
        setMainAccountObj(defaultAcc);
      }
    }
    apiFetch(`/api/accounting/vouchers/next-number?type=${type}`)
      .then((d) => setVoucherNumber(d.number || "—"))
      .catch(() => {});
  }

  const TYPE_BADGE_COLORS = {
    cash_payment:  "bg-red-500/15 text-red-500 dark:text-red-400",
    cash_receipt:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    bank_payment:  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    bank_receipt:  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    journal:       "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    card_transfer: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  };

  const inputCls      = "w-full bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/70 transition-colors";
  const tableInputCls = "w-full bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-2.5 py-[7px] text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/70 transition-colors";

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-4 pb-6">
      <VoucherPagesNav />

      <div className="flex flex-col lg:flex-row gap-5 h-full">
      {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
      <div className="lg:w-80 xl:w-96 flex-shrink-0 space-y-4">
        <div className="relative overflow-hidden bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 pt-6 space-y-4 shadow-sm">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-500" aria-hidden />
          {/* Type badge */}
          <div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_BADGE_COLORS[type] || ""}`}>
              {title}
            </span>
          </div>

          {/* Voucher No. */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">Voucher No.</label>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2.5">
              <span className="flex-1 text-sm font-mono text-orange-500 dark:text-orange-400">{voucherNumber}</span>
              <Lock className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-600 flex-shrink-0" />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
              Date <span className="text-red-400">*</span>
            </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} ${submitted && !date ? "border-red-400 ring-1 ring-red-400/30" : ""}`} />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
              {refLabel}{" "}
              {referenceRequired
                ? <span className="text-red-400">*</span>
                : <span className="text-gray-400 dark:text-neutral-600 font-normal">(optional)</span>}
            </label>
            <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
              placeholder={referenceRequired ? `Enter ${refLabel}` : "Invoice / Cheque / Transfer no."}
              className={`${inputCls} ${submitted && referenceRequired && !referenceNo.trim() ? "border-red-400 ring-1 ring-red-400/30" : ""}`} />
            {submitted && referenceRequired && !referenceNo.trim() && (
              <p className="text-red-500 text-xs mt-1">{refLabel} is required</p>
            )}
          </div>

          {/* Main account */}
          {!hideMainPanel && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
                {mainLabel} <span className="text-red-400">*</span>
              </label>
              <select value={mainAccountId || ""}
                onChange={(e) => {
                  const acc = assetAccounts.find((a) => a._id === e.target.value);
                  setMainAccountId(e.target.value);
                  setMainAccountObj(acc || null);
                }}
                className={`${inputCls} ${submitted && !mainAccountId ? "border-red-400 ring-1 ring-red-400/30" : ""}`}>
                <option value="">Select account…</option>
                {assetAccounts.map((a) => (
                  <option key={a._id} value={a._id}>{a.code} – {a.name}</option>
                ))}
              </select>
              {submitted && !mainAccountId && (
                <p className="text-red-500 text-xs mt-1">Please select an account</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
              Notes <span className="text-gray-400 dark:text-neutral-600 font-normal">(optional)</span>
            </label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes…" className={`${inputCls} resize-none`} />
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex-1 shadow-sm">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transaction lines</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isJournal
                  ? "Enter debits and credits; totals must balance before save."
                  : isPayment
                    ? "Who you paid and which expense or payable account — add multiple lines if needed."
                    : "Who paid you and which income or receivable account — add multiple lines if needed."}
              </p>
            </div>
            <span className="text-xs text-gray-400 dark:text-neutral-500">{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Lines table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/40">
                  <th className="pl-5 pr-2 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide w-8">#</th>
                  {isJournal && (
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[200px]">
                      Account <span className="text-red-400 normal-case">*</span>
                    </th>
                  )}
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[170px]">Party</th>
                  {!isJournal && (
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[200px]">
                      Account <span className="text-red-400 normal-case">*</span>
                    </th>
                  )}
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[150px]">Description</th>
                  {isJournal ? (
                    <>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[120px]">Debit (Rs)</th>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[120px]">Credit (Rs)</th>
                    </>
                  ) : (
                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[130px]">
                      Amount (Rs) <span className="text-red-400 normal-case">*</span>
                    </th>
                  )}
                  <th className="pr-4 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/60">
                {lines.map((line, idx) => {
                  const amountErr   = submitted && !isJournal && !parseFloat(line.amount);
                  const accountErr  = submitted && !line.accountId;
                  const debitErr    = submitted && isJournal && (parseFloat(line.debit) || 0) === 0 && (parseFloat(line.credit) || 0) === 0;

                  return (
                    <tr key={line.id} className={`transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-neutral-950" : "bg-gray-50/60 dark:bg-neutral-900/40"} hover:bg-orange-50/30 dark:hover:bg-neutral-800/20`}>
                      <td className="pl-5 pr-2 py-2.5 text-xs text-gray-400 dark:text-neutral-600 tabular-nums font-mono">{idx + 1}</td>

                      {/* Journal: account before party */}
                      {isJournal && (
                        <td className="px-2 py-2">
                          <AsyncCombobox
                            placeholder="Search account…"
                            fetchFn={fetchAccounts}
                            value={line.accountId}
                            valueObj={line.accountObj}
                            onChange={(v, obj) => updateLine(line.id, "accountId", v, obj)}
                            displayFn={(a) => `${a.code} – ${a.name}`}
                            keyFn={(a) => a._id}
                            hasError={accountErr}
                          />
                          {accountErr && <p className="text-red-500 text-[10px] mt-0.5">Required</p>}
                        </td>
                      )}

                      {/* Party (optional for all types) */}
                      <td className="px-2 py-2">
                        <div data-line-party>
                          <AsyncCombobox
                            placeholder="Search party…"
                            fetchFn={fetchParties}
                            value={line.partyId}
                            valueObj={line.partyObj}
                            onChange={(v, obj) => updateLine(line.id, "partyId", v, obj)}
                            displayFn={(p) => p.name}
                            keyFn={(p) => p._id}
                          />
                        </div>
                      </td>

                      {/* Non-journal: account after party */}
                      {!isJournal && (
                        <td className="px-2 py-2">
                          <AsyncCombobox
                            placeholder="Search account…"
                            fetchFn={fetchAccounts}
                            value={line.accountId}
                            valueObj={line.accountObj}
                            onChange={(v, obj) => updateLine(line.id, "accountId", v, obj)}
                            displayFn={(a) => `${a.code} – ${a.name}`}
                            keyFn={(a) => a._id}
                            hasError={accountErr}
                          />
                          {accountErr && <p className="text-red-500 text-[10px] mt-0.5">Required</p>}
                        </td>
                      )}

                      {/* Description */}
                      <td className="px-2 py-2">
                        <input value={line.description}
                          onChange={(e) => updateLine(line.id, "description", e.target.value)}
                          placeholder="optional"
                          data-line-description
                          className={tableInputCls} />
                      </td>

                      {/* Amount(s) */}
                      {isJournal ? (
                        <>
                          <td className="px-2 py-2">
                            <input type="number" min="0" step="0.01" value={line.debit}
                              onChange={(e) => {
                                updateLine(line.id, "debit", e.target.value);
                                if (parseFloat(e.target.value) > 0) updateLine(line.id, "credit", "");
                              }}
                              onKeyDown={(e) => handleAmountKeyDown(e, line.id, idx === lines.length - 1)}
                              placeholder="0.00"
                              className={`${tableInputCls} text-right ${debitErr ? "border-red-400 ring-1 ring-red-400/30" : ""}`} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" min="0" step="0.01" value={line.credit}
                              onChange={(e) => {
                                updateLine(line.id, "credit", e.target.value);
                                if (parseFloat(e.target.value) > 0) updateLine(line.id, "debit", "");
                              }}
                              placeholder="0.00"
                              className={`${tableInputCls} text-right ${debitErr ? "border-red-400 ring-1 ring-red-400/30" : ""}`} />
                          </td>
                        </>
                      ) : (
                        <td className="px-2 py-2">
                          <input type="number" min="0" step="0.01" value={line.amount}
                            onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                            onKeyDown={(e) => handleAmountKeyDown(e, line.id, idx === lines.length - 1)}
                            placeholder="0.00"
                            data-line-party-input
                            className={`${tableInputCls} text-right ${amountErr ? "border-red-400 ring-1 ring-red-400/30" : ""}`} />
                        </td>
                      )}

                      {/* Remove */}
                      <td className="pr-4 py-2 text-center">
                        <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1}
                          className="text-gray-300 dark:text-neutral-700 hover:text-red-500 disabled:opacity-20 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer: add line + totals */}
          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between gap-4 flex-wrap bg-gray-50/60 dark:bg-neutral-900/40">
            <button type="button" onClick={addLine}
              className="flex items-center gap-1.5 text-sm text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors font-medium">
              <Plus className="w-4 h-4" /> Add Line
            </button>

            {isJournal ? (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-neutral-500 mr-1.5">Total Debit</span>
                  <span className={`text-lg font-bold tabular-nums ${totalDebit > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-neutral-600"}`}>
                    Rs {fmt(totalDebit)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-neutral-500 mr-1.5">Total Credit</span>
                  <span className={`text-lg font-bold tabular-nums ${totalCredit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-neutral-600"}`}>
                    Rs {fmt(totalCredit)}
                  </span>
                </div>
                {hasAnyJournalAmount && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    isBalanced
                      ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400"
                  }`}>
                    {isBalanced ? <><Check className="w-3 h-3" /> Balanced</> : <>Unbalanced by Rs {fmt(imbalance)}</>}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-right">
                <span className="text-xs text-gray-500 dark:text-neutral-500 mr-2">Total</span>
                <span className={`text-xl font-bold tabular-nums ${totalAmount > 0 ? "text-orange-500 dark:text-orange-400" : "text-gray-300 dark:text-neutral-600"}`}>
                  Rs {fmt(totalAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Save / Success */}
        {savedVoucher ? (
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Voucher {savedVoucher.voucherNumber} saved</p>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Posted to general ledger · Rs {savedVoucher.totalAmount?.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" onClick={handleNewVoucher}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <RefreshCw className="w-4 h-4" /> New Voucher
              </button>
              <button type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`${API}/api/accounting/vouchers/${savedVoucher._id}/print`, { headers: buildHeaders() });
                    if (!res.ok) { toast.error("Could not load print view"); return; }
                    const html = await res.text();
                    const blob = new Blob([html], { type: "text/html" });
                    const url  = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  } catch {
                    toast.error("Failed to open print view");
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-sm text-gray-900 dark:text-white transition-colors">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-bold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-orange-500/20">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Saving…" : "Save Voucher"}
          </button>
        )}
      </div>
    </div>
    </div>
  );
}
