import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import DataTable from "../../../../components/ui/DataTable";
import {
  Loader2,
  Printer,
  Download,
  BookOpen,
  ChevronDown,
  FileText,
  RefreshCw,
  FileSearch,
  Info,
} from "lucide-react";
import { getStoredAuth, getCurrencySymbol } from "../../../../lib/apiClient";
import toast from "react-hot-toast";
import AsyncCombobox from "../../../../components/accounting/AsyncCombobox";
import {
  localToday,
  localMonthStart,
  fmtMoneyPK,
  fmtDateRangeHuman,
} from "../../../../lib/accountingFormat";
import ReportsNav from "../../../../components/accounting/ReportsNav";

// ─── API ─────────────────────────────────────────────────────────────────────

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
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...buildHeaders(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => localToday();

function monthStart() {
  return localMonthStart();
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function fmtAmt(n) {
  if (!n && n !== 0) return "";
  return fmtMoneyPK(n);
}

function fmtBalAccounting(n, sym) {
  if (!n && n !== 0) return "";
  const abs = fmtAmt(Math.abs(Number(n) || 0));
  return Number(n) < 0 ? `(${sym} ${abs})` : `${sym} ${abs}`;
}

const VOUCHER_TYPE_LABELS = {
  cash_payment: "Cash Payment",
  cash_receipt: "Cash Receipt",
  bank_payment: "Bank Payment",
  bank_receipt: "Bank Receipt",
  journal: "Journal Entry",
  card_transfer: "Card Transfer",
};

/** Column ids for table + export (order matters) */
const LEDGER_COL_ORDER = [
  "date",
  "voucherNo",
  "type",
  "description",
  "party",
  "debit",
  "credit",
  "balance",
];

const LEDGER_COL_LABELS = {
  date: "Date",
  voucherNo: "Voucher No",
  type: "Type",
  description: "Description",
  party: "Party",
  debit: "Debit",
  credit: "Credit",
  balance: "Balance",
};

const DEFAULT_VISIBLE_COLS = Object.fromEntries(
  LEDGER_COL_ORDER.map((id) => [id, true]),
);

function visibleColList(visibleCols, showPartyColumn) {
  return LEDGER_COL_ORDER.filter(
    (id) => visibleCols[id] && (id !== "party" || showPartyColumn),
  );
}

function csvCell(row, colId, typeLabelForRow, cols) {
  if (row.isHeader) {
    const firstId = cols[0];
    if (colId === "balance")
      return row.balance !== undefined ? String(row.balance) : "";
    if (colId === firstId) return row.label || "";
    return "";
  }
  switch (colId) {
    case "date":
      return fmtDate(row.date);
    case "voucherNo":
      return row.voucherNumber || "";
    case "type":
      return typeLabelForRow || "";
    case "description":
      return `"${(row.description || "").replace(/"/g, '""')}"`;
    case "party":
      return `"${(row.partyName || "").replace(/"/g, '""')}"`;
    case "debit":
      return row.debit ? String(row.debit) : "";
    case "credit":
      return row.credit ? String(row.credit) : "";
    case "balance":
      return row.balance !== undefined ? row.balance.toFixed(2) : "";
    default:
      return "";
  }
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(rows, accountName, visibleCols, showPartyColumn) {
  const cols = visibleColList(visibleCols, showPartyColumn);
  if (cols.length === 0) return;
  const headers = cols.map((id) => LEDGER_COL_LABELS[id]);
  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const typeLabel =
        VOUCHER_TYPE_LABELS[r.voucherType] || r.voucherType || "";
      return cols.map((id) => csvCell(r, id, typeLabel, cols)).join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-${accountName}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportLedgerPDFHTML({
  rows,
  accountName,
  sym,
  visibleCols,
  showPartyColumn,
  dateFrom,
  dateTo,
  partyName,
}) {
  const cols = visibleColList(visibleCols, showPartyColumn);
  const typeFor = (r) =>
    VOUCHER_TYPE_LABELS[r.voucherType] || r.voucherType || "";
  let body = "";
  for (const r of rows) {
    if (r.isHeader) {
      const nb = cols.filter((c) => c !== "balance");
      const hasBal = cols.includes("balance");
      if (hasBal && nb.length) {
        body += `<tr><td colspan="${nb.length}" style="font-weight:bold;padding:8px;border:1px solid #ddd">${escapeHtml(r.label)}</td><td style="text-align:right;font-weight:bold;padding:8px;border:1px solid #ddd">${r.balance !== undefined ? sym + " " + fmtAmt(r.balance) : ""}</td></tr>`;
      } else {
        const txt =
          r.label +
          (!hasBal && r.balance !== undefined
            ? ` — ${sym} ${fmtAmt(r.balance)}`
            : "");
        body += `<tr><td colspan="${cols.length}" style="font-weight:bold;padding:8px;border:1px solid #ddd">${escapeHtml(txt)}</td></tr>`;
      }
      continue;
    }
    body += "<tr>";
    for (const id of cols) {
      let v = "";
      if (id === "date") v = fmtDate(r.date);
      else if (id === "voucherNo") v = r.voucherNumber || "—";
      else if (id === "type") v = typeFor(r);
      else if (id === "description") v = r.description || "—";
      else if (id === "party") v = r.partyName || "—";
      else if (id === "debit")
        v = r.debit > 0 ? `${sym} ${fmtAmt(r.debit)}` : "";
      else if (id === "credit")
        v = r.credit > 0 ? `${sym} ${fmtAmt(r.credit)}` : "";
      else if (id === "balance") {
        v = fmtBalAccounting(r.balance, sym);
      }
      const align =
        id === "debit" || id === "credit" || id === "balance"
          ? "right"
          : "left";
      body += `<td style="padding:6px 8px;border:1px solid #eee;text-align:${align}">${escapeHtml(String(v))}</td>`;
    }
    body += "</tr>";
  }
  const th = cols
    .map(
      (id) =>
        `<th style="text-align:${["debit", "credit", "balance"].includes(id) ? "right" : "left"};padding:8px;border:1px solid #ccc;background:#f5f5f5">${LEDGER_COL_LABELS[id]}</th>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ledger — ${escapeHtml(accountName)}</title></head><body style="font-family:system-ui,sans-serif;font-size:12px;padding:24px;color:#111">
<h1 style="font-size:18px;margin:0 0 4px">Ledger — ${escapeHtml(accountName)}</h1>
<p style="margin:0 0 16px;color:#555">${escapeHtml(dateFrom)} to ${escapeHtml(dateTo)}${partyName ? ` · ${escapeHtml(partyName)}` : ""}</p>
<table style="width:100%;border-collapse:collapse">${th ? `<thead><tr>${th}</tr></thead>` : ""}<tbody>${body}</tbody></table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPrintableLedgerPDF(html) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Allow pop-ups to export PDF");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LedgerPage() {
  const sym = getCurrencySymbol();
  const router = useRouter();

  const [accountId, setAccountId] = useState(null);
  const [accountObj, setAccountObj] = useState(null);
  const [partyId, setPartyId] = useState(null);
  const [partyObj, setPartyObj] = useState(null);
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  /** Bump on Reset so AsyncCombobox remounts and drops any stale internal state */
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLS);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const qAccount = router.query?.accountId;
  const qParty = router.query?.partyId;
  const accountFromQuery =
    qAccount == null
      ? undefined
      : Array.isArray(qAccount)
        ? qAccount[0]
        : qAccount;
  const partyFromQuery =
    qParty == null ? undefined : Array.isArray(qParty) ? qParty[0] : qParty;

  // Pre-fill from URL once per stable query values (never depend on whole router.query — new object every render)
  useEffect(() => {
    if (!router.isReady) return;
    if (accountFromQuery) setAccountId(String(accountFromQuery));
    if (partyFromQuery) setPartyId(String(partyFromQuery));
  }, [router.isReady, accountFromQuery, partyFromQuery]);

  // Resolve display objects when only IDs are present in the URL
  useEffect(() => {
    if (!router.isReady || !accountId || accountObj) return;
    const idStr = String(accountId);
    (async () => {
      try {
        const d = await apiFetch("/api/accounting/accounts");
        const acc = (d.accounts || []).find((a) => String(a._id) === idStr);
        if (acc) setAccountObj(acc);
      } catch {
        /* ignore */
      }
    })();
  }, [router.isReady, accountId, accountObj]);

  useEffect(() => {
    if (!router.isReady || !partyId || partyObj) return;
    const idStr = String(partyId);
    (async () => {
      try {
        const d = await apiFetch("/api/accounting/parties?limit=500&page=1");
        const p = (d.parties || []).find((x) => String(x._id) === idStr);
        if (p) setPartyObj(p);
      } catch {
        /* ignore */
      }
    })();
  }, [router.isReady, partyId, partyObj]);

  useEffect(() => {
    if (!exportOpen) return;
    function handleDown(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [exportOpen]);

  function toggleLedgerColumn(id) {
    setVisibleCols((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const n = LEDGER_COL_ORDER.filter((k) => next[k]).length;
      if (n === 0) return prev;
      return next;
    });
  }

  const fetchAccounts = useCallback(async (q) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const d = await apiFetch(`/api/accounting/accounts?${p.toString()}`);
    return d.accounts || [];
  }, []);

  const fetchParties = useCallback(async (q) => {
    const p = new URLSearchParams({ limit: 40 });
    if (q) p.set("q", q);
    const d = await apiFetch(`/api/accounting/parties?${p.toString()}`);
    return d.parties || [];
  }, []);

  async function runReport() {
    if (!accountId) {
      toast.error("Please select an account");
      return;
    }
    setLoading(true);
    setHasRun(true);
    try {
      const p = new URLSearchParams({ accountId, dateFrom, dateTo });
      if (partyId) p.set("partyId", partyId);
      const data = await apiFetch(
        `/api/accounting/reports/ledger?${p.toString()}`,
      );
      setReport(data);
    } catch (err) {
      toast.error(err.message || "Failed to run report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setAccountId(null);
    setAccountObj(null);
    setPartyId(null);
    setPartyObj(null);
    setDateFrom(monthStart());
    setDateTo(today());
    setReport(null);
    setHasRun(false);
    setFilterResetKey((k) => k + 1);
    router.replace({ pathname: router.pathname, query: {} }, undefined, {
      shallow: true,
    });
  }

  function handleExportCSV() {
    if (!report) {
      toast.error("Run a report first");
      return;
    }
    exportCSV(
      tableRows,
      accountObj?.name || "ledger",
      visibleCols,
      showPartyColumn,
    );
    setExportOpen(false);
  }

  function handleExportPDF() {
    if (!report) {
      toast.error("Run a report first");
      return;
    }
    const html = exportLedgerPDFHTML({
      rows: tableRows,
      accountName: accountObj?.name || "Ledger",
      sym,
      visibleCols,
      showPartyColumn,
      dateFrom,
      dateTo,
      partyName: partyObj?.name || "",
    });
    openPrintableLedgerPDF(html);
    setExportOpen(false);
  }

  function handleExportPrint() {
    if (!report) {
      toast.error("Run a report first");
      return;
    }
    setExportOpen(false);
    window.print();
  }

  // Flat row list for CSV/PDF + table
  const tableRows = useMemo(() => {
    if (!report) return [];
    const rows = [];
    rows.push({
      label: "Opening Balance",
      balance: report.openingBalance,
      isHeader: true,
    });
    (report.entries || []).forEach((e) => {
      rows.push({
        ...e,
        typeLabel: VOUCHER_TYPE_LABELS[e.voucherType] || e.voucherType || "",
      });
    });
    rows.push({
      label: "Closing Balance",
      balance: report.closingBalance,
      isHeader: true,
    });
    return rows;
  }, [report]);

  const showPartyColumn = useMemo(() => {
    const ent = report?.entries;
    if (!ent?.length) return false;
    return ent.some((e) => String(e.partyName || "").trim());
  }, [report]);

  const ledgerTableRows = useMemo(() => {
    let di = 0;
    return tableRows.map((r) =>
      r.isHeader ? r : { ...r, __stripe: di++ % 2 === 1 },
    );
  }, [tableRows]);

  const activeCols = useMemo(
    () => visibleColList(visibleCols, showPartyColumn),
    [visibleCols, showPartyColumn],
  );

  const ledgerColumns = useMemo(() => {
    return activeCols.map((colId) => ({
      key: colId,
      header:
        colId === "party" ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap normal-case">
            {LEDGER_COL_LABELS.party}
            <span
              title="Party is shown when the entry is linked to a supplier or customer"
              className="inline-flex cursor-help text-gray-400 dark:text-neutral-500"
              role="note"
            >
              <Info className="w-3.5 h-3.5" aria-hidden />
            </span>
          </span>
        ) : (
          LEDGER_COL_LABELS[colId]
        ),
      align: ["debit", "credit", "balance"].includes(colId) ? "right" : "left",
      cellClassName: "tabular-nums",
      className:
        colId === "description" || colId === "party"
          ? "whitespace-normal"
          : undefined,
      render: (_, row) => {
        const isNeg = row.balance < 0;
        if (colId === "date")
          return (
            <span className="text-gray-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
              {fmtDate(row.date)}
            </span>
          );
        if (colId === "voucherNo")
          return (
            <span className="font-mono text-orange-500 dark:text-orange-400 text-xs">
              {row.voucherNumber || "—"}
            </span>
          );
        if (colId === "type")
          return row.typeLabel ? (
            <span className="text-[10px] bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 px-1.5 py-0.5 rounded font-medium">
              {row.typeLabel}
            </span>
          ) : (
            "—"
          );
        if (colId === "description")
          return (
            <span className="text-gray-900 dark:text-white max-w-[180px] truncate block">
              {row.description || "—"}
            </span>
          );
        if (colId === "party")
          return (
            <span className="text-gray-500 dark:text-neutral-400 max-w-[140px] truncate block">
              {row.partyName || "—"}
            </span>
          );
        if (colId === "debit")
          return row.debit > 0 ? (
            <span className="text-blue-600 dark:text-blue-400">
              {sym} {fmtAmt(row.debit)}
            </span>
          ) : (
            ""
          );
        if (colId === "credit")
          return row.credit > 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              {sym} {fmtAmt(row.credit)}
            </span>
          ) : (
            ""
          );
        if (colId === "balance")
          return (
            <span
              className={`font-medium ${isNeg ? "text-red-500 dark:text-red-400" : "text-gray-900 dark:text-white"}`}
            >
              {fmtBalAccounting(row.balance, sym)}
            </span>
          );
        return "—";
      },
    }));
  }, [activeCols, sym]);

  const renderLedgerHeaderRow = useCallback(
    (row) => {
      if (!row.isHeader) return null;
      const bal = row.balance;
      const isNeg = bal < 0;
      const nb = activeCols.filter((c) => c !== "balance");
      const hasBal = activeCols.includes("balance");
      if (hasBal && nb.length > 0) {
        return (
          <tr className="bg-gray-50/90 dark:bg-neutral-900/80">
            <td
              colSpan={nb.length}
              className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white"
            >
              {row.label}
            </td>
            <td
              className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${isNeg ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {fmtBalAccounting(bal, sym)}
            </td>
          </tr>
        );
      }
      const combined =
        row.label +
        (!hasBal && bal !== undefined
          ? ` — ${fmtBalAccounting(bal, sym)}`
          : "");
      return (
        <tr className="bg-gray-50/90 dark:bg-neutral-900/80">
          <td
            colSpan={Math.max(activeCols.length, 1)}
            className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white"
          >
            {combined}
          </td>
        </tr>
      );
    },
    [activeCols, sym],
  );

  const dateInputCls =
    "w-full h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors";

  return (
    <AdminLayout title="Ledger">
      <style>{`@media print { .no-print { display:none !important; } body { background:white; color:#111; } }`}</style>
      <div className="space-y-4">
        <ReportsNav />
        {/* Page intro — matches accounting list pages */}
        <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl px-5 py-3 shadow-sm no-print">
          <BookOpen className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pick an account and date range, then run the report. Export to CSV,
            PDF, or print — same flow as vouchers and parties.
          </p>
        </div>

        {/* Filters — VoucherForm-style card (header + body + footer toolbar) */}
        <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm no-print">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 rounded-t-2xl flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Report parameters
            </h2>
            <span className="text-[10px] text-gray-400 dark:text-neutral-600 uppercase tracking-wider hidden sm:inline">
              Account required
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                  Account <span className="text-red-500">*</span>
                </label>
                <AsyncCombobox
                  key={`account-${filterResetKey}`}
                  placeholder="Search account…"
                  fetchFn={fetchAccounts}
                  value={accountId}
                  valueObj={accountObj}
                  onChange={(v, obj) => {
                    setAccountId(v);
                    setAccountObj(obj);
                  }}
                  displayFn={(a) => `${a.code} – ${a.name}`}
                  keyFn={(a) => a._id}
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                  Party{" "}
                  <span className="normal-case font-normal text-gray-400 dark:text-neutral-600">
                    (optional)
                  </span>
                </label>
                <AsyncCombobox
                  key={`party-${filterResetKey}`}
                  placeholder="Search party…"
                  fetchFn={fetchParties}
                  value={partyId}
                  valueObj={partyObj}
                  onChange={(v, obj) => {
                    setPartyId(v);
                    setPartyObj(obj);
                  }}
                  displayFn={(p) => p.name}
                  keyFn={(p) => p._id}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                  Date from
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={dateInputCls}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-400 mb-1.5 tracking-wide uppercase">
                  Date to
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={dateInputCls}
                />
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 rounded-b-2xl flex flex-wrap items-center justify-end gap-2 overflow-visible relative z-10">
            <button
              type="button"
              onClick={() => accountId && runReport()}
              disabled={loading || !accountId}
              title="Refresh with current filters"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-orange-500 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={runReport}
              disabled={loading || !accountId}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-sm font-semibold text-white transition-colors shadow-sm shadow-orange-500/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BookOpen className="w-4 h-4" />
              )}
              Run Report
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Reset
            </button>
            <div className="relative z-50" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportOpen((o) => !o)}
                className="flex items-center gap-2 h-9 pl-3 pr-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Export
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${exportOpen ? "rotate-180" : ""}`}
                />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl z-[200] overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      disabled={!report}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Download className="w-4 h-4 text-gray-400" />
                      Download CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      disabled={!report}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <FileText className="w-4 h-4 text-gray-400" />
                      Export PDF…
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPrint}
                      disabled={!report}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Printer className="w-4 h-4 text-gray-400" />
                      Print
                    </button>
                  </div>
                  <div className="border-t border-gray-100 dark:border-neutral-800 px-3 py-2.5 bg-gray-50/80 dark:bg-neutral-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-2">
                      Columns
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {LEDGER_COL_ORDER.filter(
                        (id) => id !== "party" || showPartyColumn,
                      ).map((id) => (
                        <label
                          key={id}
                          className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-300 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={visibleCols[id]}
                            onChange={() => toggleLedgerColumn(id)}
                            className="rounded border-gray-300 dark:border-neutral-600 text-orange-500 focus:ring-orange-500"
                          />
                          {LEDGER_COL_LABELS[id]}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4 text-center">
          <h2 className="text-lg font-bold">
            Ledger Report — {accountObj?.name}
          </h2>
          <p className="text-sm text-gray-600">
            {fmtDateRangeHuman(dateFrom, dateTo, "to")}
            {partyObj ? ` · ${partyObj.name}` : ""}
          </p>
        </div>

        {/* Report table */}
        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Loading ledger…
            </p>
          </div>
        )}

        {!loading && hasRun && !report && (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-sm text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              No ledger data
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
              Nothing matched this account, party, and date range. Try different
              filters or run the report again.
            </p>
          </div>
        )}

        {!loading && report && (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Ledger results
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                  {accountObj
                    ? `${accountObj.code} – ${accountObj.name}`
                    : "Account"}
                  {partyObj ? ` · ${partyObj.name}` : ""}
                  <span className="text-gray-400 dark:text-neutral-600">
                    {" "}
                    · {fmtDateRangeHuman(dateFrom, dateTo)}
                  </span>
                </p>
              </div>
            </div>
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-500 dark:text-neutral-500">
                      Opening balance
                    </span>
                    <BookOpen className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">
                    {sym} {fmtAmt(report.openingBalance)}
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-500 dark:text-neutral-500">
                      Entries
                    </span>
                    <FileText className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">
                    {report.entries?.length || 0}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">
                    in this period
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-500 dark:text-neutral-500">
                      Closing balance
                    </span>
                    <BookOpen className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <div
                    className={`text-base font-semibold tabular-nums ${
                      Number(report.closingBalance) < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {fmtBalAccounting(report.closingBalance, sym)}
                  </div>
                </div>
              </div>
            </div>
            <DataTable
              columns={ledgerColumns}
              data={ledgerTableRows}
              getRowId={(row, i) =>
                row.isHeader
                  ? `hdr-${i}-${row.label}`
                  : `e-${i}-${row.voucherNumber || ""}-${row.date || ""}`
              }
              renderRow={(row) => renderLedgerHeaderRow(row)}
              getRowClassName={(row) =>
                row.isHeader
                  ? ""
                  : row.__stripe
                    ? "bg-gray-50/50 dark:bg-neutral-900/35"
                    : ""
              }
              tableClassName="ledger-print-table text-sm"
              emptyMessage="No rows."
              loading={false}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
