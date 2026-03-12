/**
 * Compute the "business date" (YYYY-MM-DD) for a given timestamp.
 *
 * A business day runs from cutoffHour on one calendar day to cutoffHour on the next.
 * Any timestamp before the cutoff hour belongs to the *previous* business day.
 *
 * Example with cutoffHour = 4 (4 AM):
 *   - 2026-03-13 02:30 AM → business date "2026-03-12"
 *   - 2026-03-13 04:00 AM → business date "2026-03-13"
 *   - 2026-03-12 11:00 PM → business date "2026-03-12"
 *
 * @param {Date|string|number} timestamp
 * @param {number} cutoffHour - Hour (0-23) when the business day rolls over. Default 4.
 * @returns {string} "YYYY-MM-DD"
 */
export function getBusinessDate(timestamp, cutoffHour = 4) {
  const d = new Date(timestamp);
  if (d.getHours() < cutoffHour) {
    d.setDate(d.getDate() - 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Get the start and end timestamps for a given business date.
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} cutoffHour - Hour (0-23). Default 4.
 * @returns {{ from: Date, to: Date }}
 */
export function getBusinessDayRange(dateStr, cutoffHour = 4) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const from = new Date(y, m - 1, d, cutoffHour, 0, 0, 0);
  const to = new Date(y, m - 1, d + 1, cutoffHour, 0, 0, 0);
  return { from, to };
}

/**
 * Format a business date for display: "Mar 12, 2026"
 *
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {string}
 */
export function formatBusinessDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
