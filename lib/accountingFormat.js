/** Calendar dates in local timezone (avoid UTC shift from toISOString). */
export function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localToday() {
  return localISODate(new Date());
}

export function localMonthStart(d = new Date()) {
  return localISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Rs-style amount: X,XXX.00 */
export function fmtMoneyPK(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00";
  return Math.abs(v).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Human-readable local date from ISO-like input: 31 Mar 2026 */
export function fmtDateHuman(isoLike) {
  if (!isoLike) return "";
  const raw = String(isoLike).split("T")[0];
  const parts = raw.split("-");
  if (parts.length !== 3) return String(isoLike);
  const [y, m, d] = parts.map((p) => Number(p));
  if (!y || !m || !d) return String(isoLike);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateRangeHuman(fromIso, toIso, separator = "→") {
  return `${fmtDateHuman(fromIso)} ${separator} ${fmtDateHuman(toIso)}`;
}
