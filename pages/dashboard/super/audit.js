import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import {
  downloadPlatformAuditCsv,
  getPlatformAuditLog,
  getPlatformTeamMembers,
} from "../../../lib/apiClient";
import {
  ChevronDown,
  ChevronRight,
  FileDown,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "rbac.deny", label: "RBAC denial" },
  { value: "team.create", label: "Team create" },
  { value: "team.role_change", label: "Team role change" },
  { value: "team.activate", label: "Team activate" },
  { value: "team.deactivate", label: "Team deactivate" },
  { value: "team.reset_password", label: "Team reset password" },
  { value: "restaurant.create", label: "Restaurant create" },
  { value: "restaurant.approve", label: "Restaurant approve" },
  { value: "restaurant.suspend", label: "Restaurant suspend" },
  { value: "restaurant.reactivate", label: "Restaurant reactivate" },
  { value: "restaurant.delete", label: "Restaurant delete" },
  { value: "restaurant.restore", label: "Restaurant restore" },
  { value: "restaurant.permanent_delete", label: "Restaurant permanent delete" },
  { value: "subscription.update", label: "Subscription update" },
  { value: "invoice.create", label: "Invoice create" },
  { value: "invoice.status_update", label: "Invoice status update" },
  { value: "invoice.delete", label: "Invoice delete" },
  { value: "impersonate.start", label: "Impersonate start" },
  { value: "impersonate.end", label: "Impersonate end" },
  { value: "lead.create", label: "Lead create" },
  { value: "lead.update", label: "Lead update" },
  { value: "lead.stage_change", label: "Lead stage change" },
  { value: "lead.assign", label: "Lead assign" },
  { value: "lead.note", label: "Lead note" },
  { value: "lead.convert", label: "Lead convert" },
  { value: "lead.delete", label: "Lead delete" },
];

function roleLabel(role) {
  if (!role || role === "owner") return "Owner";
  return String(role).replace(/_/g, " ");
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function actionBadgeClass(action, outcome) {
  if (outcome === "denied") {
    return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";
  }
  if (
    action.includes("delete")
    || action.includes("deactivate")
    || action === "restaurant.suspend"
  ) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  }
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
}

function MetadataBlock({ metadata }) {
  if (!metadata || typeof metadata !== "object") {
    return <span className="text-neutral-400 text-xs">—</span>;
  }

  const entries = Object.entries(metadata);
  if (!entries.length) {
    return <span className="text-neutral-400 text-xs">—</span>;
  }

  return (
    <dl className="grid gap-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-wrap gap-x-2">
          <dt className="text-neutral-500 dark:text-neutral-400 font-medium">{key}:</dt>
          <dd className="text-neutral-800 dark:text-neutral-200 font-mono break-all">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function SuperAuditPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.audit.view");

  const [team, setTeam] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({
      actorId: actorId || undefined,
      action: action || undefined,
      outcome: outcome || undefined,
      from: from || undefined,
      to: to || undefined,
      search: search.trim() || undefined,
      page,
      limit: 50,
    }),
    [actorId, action, outcome, from, to, search, page],
  );

  const loadAudit = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPlatformAuditLog(filters);
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 1);
    } catch (err) {
      toast.error(err.message || "Failed to load audit log");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!hasAccess) return;
    getPlatformTeamMembers()
      .then((list) => setTeam(Array.isArray(list) ? list : []))
      .catch(() => setTeam([]));
  }, [hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    loadAudit();
  }, [hasAccess, loadAudit]);

  async function handleExport() {
    try {
      setExporting(true);
      const { page: _p, limit: _l, ...exportFilters } = filters;
      await downloadPlatformAuditCsv(exportFilters);
      toast.success("Audit log exported");
    } catch (err) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout
      title="Audit Log"
      subtitle="Immutable record of platform actions and access denials"
    >
      <SuperPageGate permission="platform.audit.view">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="min-w-[160px]">
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                Actor
              </label>
              <select
                value={actorId}
                onChange={(e) => {
                  setActorId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              >
                <option value="">All actors</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => {
                  setOutcome(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="denied">Denied</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Actor email or target label…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={loadAudit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              Export CSV
            </button>
          </div>

          <p className="text-xs text-neutral-500">
            {total} event{total === 1 ? "" : "s"}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>

          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : entries.length === 0 ? (
              <p className="py-16 text-center text-sm text-neutral-500">
                No audit events match your filters.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {entries.map((entry) => {
                  const expanded = expandedId === entry.id;
                  return (
                    <div key={entry.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : entry.id)
                        }
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <span className="mt-0.5 text-neutral-400">
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0 grid gap-2 lg:grid-cols-[160px_1fr_140px_120px_100px] lg:items-center">
                            <span className="text-xs text-neutral-500 whitespace-nowrap tabular-nums">
                              {formatTimestamp(entry.createdAt)}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {entry.actorName || entry.actorEmail}
                              </div>
                              <div className="text-xs text-neutral-500 truncate">
                                {entry.actorEmail}
                              </div>
                              <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                {roleLabel(entry.actorPlatformRole)}
                              </span>
                            </div>
                            <span
                              className={`inline-flex self-start px-2 py-0.5 rounded-full text-[10px] font-semibold ${actionBadgeClass(entry.action, entry.outcome)}`}
                            >
                              {entry.action}
                            </span>
                            <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                              {entry.targetType ? (
                                <>
                                  <span className="text-neutral-400">
                                    {entry.targetType}
                                  </span>
                                  {entry.targetLabel ? (
                                    <> · {entry.targetLabel}</>
                                  ) : null}
                                </>
                              ) : (
                                "—"
                              )}
                            </div>
                            <span
                              className={`inline-flex self-start px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                                entry.outcome === "denied"
                                  ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                              }`}
                            >
                              {entry.outcome}
                            </span>
                          </div>
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-4 pl-11 bg-gray-50/80 dark:bg-neutral-900/40 border-t border-gray-100 dark:border-neutral-800">
                          <div className="grid gap-3 sm:grid-cols-2 pt-3 text-xs">
                            <div>
                              <p className="font-semibold text-neutral-500 mb-1">
                                Metadata
                              </p>
                              <MetadataBlock metadata={entry.metadata} />
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="text-neutral-500">IP: </span>
                                <span className="font-mono">{entry.ip || "—"}</span>
                              </div>
                              <div>
                                <span className="text-neutral-500">User agent: </span>
                                <span className="break-all text-neutral-700 dark:text-neutral-300">
                                  {entry.userAgent || "—"}
                                </span>
                              </div>
                              {entry.targetId && (
                                <div>
                                  <span className="text-neutral-500">Target ID: </span>
                                  <span className="font-mono">{entry.targetId}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-neutral-500">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </SuperPageGate>
    </AdminLayout>
  );
}
