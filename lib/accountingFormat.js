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
