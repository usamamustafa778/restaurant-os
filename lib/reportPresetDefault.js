/**
 * Default Today/Yesterday report preset from day-session list.
 * OPEN session → "today"; otherwise → "yesterday" (last closed business day).
 */
export function getDefaultReportPreset(sessions) {
  if (!sessions || sessions.length === 0) return "today";
  const hasOpenSession = sessions.some((s) => s.status === "OPEN");
  return hasOpenSession ? "today" : "yesterday";
}
