import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import DataTable from "../../../components/ui/DataTable";
import {
  addLeadNoteForSuperAdmin,
  convertLeadForSuperAdmin,
  createLeadForSuperAdmin,
  deleteLeadForSuperAdmin,
  getLeadsForSuperAdmin,
  getPlatformTeamMembers,
  getRestaurantsForSuperAdmin,
  getStoredAuth,
  updateLeadForSuperAdmin,
} from "../../../lib/apiClient";
import { usePermissions } from "../../../contexts/PermissionContext";
import {
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "demo", label: "Demo" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const PIPELINE_STAGES = ["new", "contacted", "demo", "negotiating", "won", "lost"];

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "website", label: "Website" },
  { value: "website_signup", label: "Website signup" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

const SOURCE_LABELS = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label]),
);

const STATUS_BADGE = {
  new: "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  demo: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  negotiating: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  lost: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

function formatLabel(status) {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function displayRestaurantName(lead) {
  return (lead.restaurantName || lead.name || "—").trim() || "—";
}

function activitySummary(entry) {
  if (!entry) return "—";
  if (entry.type === "stage_change") {
    return entry.body || `Stage: ${entry.toStatus}`;
  }
  if (entry.type === "assignment") return entry.body;
  if (entry.type === "convert") return entry.body;
  if (entry.type === "created") return entry.body || "Lead created";
  return entry.body || entry.type;
}

export default function SuperLeadsPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.leads.view");
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("platform.leads.manage");
  const canViewAll = hasPermission("platform.leads.view_all");
  const canConvert = hasPermission("platform.leads.convert");
  const canDelete = hasPermission("platform.leads.delete");

  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [selectedLead, setSelectedLead] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    restaurantName: "",
    name: "",
    phone: "",
    email: "",
    city: "",
    source: "manual",
    note: "",
    assignedTo: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  const [lostPrompt, setLostPrompt] = useState(null);
  const [lostReason, setLostReason] = useState("");
  const [lostSaving, setLostSaving] = useState(false);

  const [showConvert, setShowConvert] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [convertSaving, setConvertSaving] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [reassignSaving, setReassignSaving] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeadsForSuperAdmin({
        status: statusFilter || undefined,
        assignedTo: canViewAll && assigneeFilter ? assigneeFilter : undefined,
        search: searchApplied.trim() || undefined,
        limit: 100,
      });
      setLeads(data?.leads ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      toast.error(err.message || "Failed to load leads");
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, assigneeFilter, searchApplied, canViewAll]);

  useEffect(() => {
    if (!hasAccess) return;
    const auth = getStoredAuth();
    setCurrentUserId(auth?.user?.id || null);
    loadLeads();
  }, [hasAccess, loadLeads]);

  useEffect(() => {
    if (!hasAccess || !canViewAll) return;
    getPlatformTeamMembers()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.members ?? [];
        setTeamMembers(list);
      })
      .catch(() => setTeamMembers([]));
  }, [hasAccess, canViewAll]);

  useEffect(() => {
    if (!showAddModal) return;
    setAddForm((f) => ({
      ...f,
      assignedTo: f.assignedTo || currentUserId || "",
    }));
  }, [showAddModal, currentUserId]);

  const assigneeOptions = useMemo(() => {
    const opts = [{ value: "unassigned", label: "Unassigned" }];
    for (const m of teamMembers) {
      opts.push({ value: m.id, label: m.name || m.email });
    }
    return opts;
  }, [teamMembers]);

  const filteredRestaurants = useMemo(() => {
    const q = restaurantSearch.trim().toLowerCase();
    if (!q) return restaurants.slice(0, 20);
    return restaurants
      .filter((r) => {
        const name = (r.website?.name || r.name || "").toLowerCase();
        const sub = (r.website?.subdomain || "").toLowerCase();
        return name.includes(q) || sub.includes(q);
      })
      .slice(0, 20);
  }, [restaurants, restaurantSearch]);

  function upsertLead(updated) {
    if (!updated?.id) return;
    setLeads((prev) => {
      const idx = prev.findIndex((l) => l.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setSelectedLead((prev) => (prev?.id === updated.id ? updated : prev));
  }

  async function handleAddLead(e) {
    e.preventDefault();
    if (!addForm.phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    setAddSaving(true);
    try {
      const payload = {
        restaurantName: addForm.restaurantName.trim(),
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        email: addForm.email.trim(),
        city: addForm.city.trim(),
        source: addForm.source,
        note: addForm.note.trim() || undefined,
      };
      if (canViewAll && addForm.assignedTo) {
        payload.assignedTo = addForm.assignedTo;
      }
      const data = await createLeadForSuperAdmin(payload);
      toast.success("Lead created");
      setShowAddModal(false);
      setAddForm({
        restaurantName: "",
        name: "",
        phone: "",
        email: "",
        city: "",
        source: "manual",
        note: "",
        assignedTo: currentUserId || "",
      });
      if (data?.lead) {
        setLeads((prev) => [data.lead, ...prev]);
        setTotal((t) => t + 1);
      } else {
        loadLeads();
      }
    } catch (err) {
      toast.error(err.message || "Failed to create lead");
    } finally {
      setAddSaving(false);
    }
  }

  async function applyStatusChange(lead, nextStatus, reason = "") {
    if (!canManage || lead.status === nextStatus) return;
    if (nextStatus === "lost" && !reason && !lostPrompt) {
      setLostPrompt(lead);
      setLostReason(lead.lostReason || "");
      return;
    }
    setStageSaving(true);
    try {
      const body = { status: nextStatus };
      if (nextStatus === "lost") body.lostReason = reason;
      const data = await updateLeadForSuperAdmin(lead.id, body);
      upsertLead(data.lead);
      toast.success(`Status updated to ${formatLabel(nextStatus)}`);
      setLostPrompt(null);
      setLostReason("");
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setStageSaving(false);
      setLostSaving(false);
    }
  }

  async function submitLostReason(e) {
    e.preventDefault();
    if (!lostPrompt) return;
    setLostSaving(true);
    await applyStatusChange(lostPrompt, "lost", lostReason.trim());
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!selectedLead || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const data = await addLeadNoteForSuperAdmin(selectedLead.id, noteText.trim());
      upsertLead(data.lead);
      setNoteText("");
      toast.success("Note added");
    } catch (err) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleReassign(assigneeId) {
    if (!selectedLead || !canViewAll) return;
    setReassignSaving(true);
    try {
      const value = assigneeId === "unassigned" ? null : assigneeId;
      const data = await updateLeadForSuperAdmin(selectedLead.id, {
        assignedTo: value,
      });
      upsertLead(data.lead);
      toast.success("Lead reassigned");
    } catch (err) {
      toast.error(err.message || "Failed to reassign");
    } finally {
      setReassignSaving(false);
    }
  }

  async function openConvertModal() {
    setShowConvert(true);
    setRestaurantSearch("");
    setConvertLoading(true);
    try {
      const data = await getRestaurantsForSuperAdmin();
      setRestaurants(Array.isArray(data) ? data : data?.restaurants ?? []);
    } catch {
      toast.error("Failed to load restaurants");
      setRestaurants([]);
    } finally {
      setConvertLoading(false);
    }
  }

  async function handleConvert(restaurantId) {
    if (!selectedLead) return;
    setConvertSaving(true);
    try {
      const data = await convertLeadForSuperAdmin(selectedLead.id, restaurantId);
      upsertLead(data.lead);
      setShowConvert(false);
      toast.success("Restaurant linked");
    } catch (err) {
      toast.error(err.message || "Failed to link restaurant");
    } finally {
      setConvertSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleteSaving(true);
    try {
      await deleteLeadForSuperAdmin(deleteConfirm.id);
      setLeads((prev) => prev.filter((l) => l.id !== deleteConfirm.id));
      setTotal((t) => Math.max(0, t - 1));
      if (selectedLead?.id === deleteConfirm.id) setSelectedLead(null);
      setDeleteConfirm(null);
      toast.success("Lead deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setDeleteSaving(false);
    }
  }

  const columns = [
    {
      key: "restaurantName",
      header: "Restaurant",
      render: (_, lead) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {displayRestaurantName(lead)}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (_, lead) => lead.phone || "—",
      cellClassName: "text-gray-700 dark:text-neutral-300",
    },
    {
      key: "status",
      header: "Status",
      render: (_, lead) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[lead.status] || STATUS_BADGE.new}`}
        >
          {formatLabel(lead.status)}
        </span>
      ),
    },
    ...(canViewAll
      ? [
          {
            key: "assignedTo",
            header: "Assigned to",
            render: (_, lead) => lead.assignedToName || (lead.assignedTo ? "—" : "Unassigned"),
            cellClassName: "text-gray-600 dark:text-neutral-400",
          },
        ]
      : []),
    {
      key: "source",
      header: "Source",
      render: (_, lead) => SOURCE_LABELS[lead.source] || formatLabel(lead.source),
      cellClassName: "text-gray-600 dark:text-neutral-400 capitalize",
    },
    {
      key: "lastActivityAt",
      header: "Last activity",
      render: (_, lead) => formatDateTime(lead.lastActivityAt),
      cellClassName: "text-gray-500 dark:text-neutral-400 whitespace-nowrap",
    },
  ];

  return (
    <AdminLayout
      title="Leads"
      subtitle="Sales pipeline — track prospects from first contact through onboarding."
    >
      <SuperPageGate permission="platform.leads.view">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === f.value
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Lead
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
              <input
                type="text"
                placeholder="Search restaurant, name, phone, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearchApplied(searchInput);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            {canViewAll && (
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
              >
                <option value="">All assignees</option>
                <option value="unassigned">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-neutral-500">{leads.length} of {total}</span>
          </div>

          <DataTable
            showSno
            data={leads}
            loading={loading}
            emptyMessage="No leads yet. Add a lead or wait for website submissions."
            onRowClick={(lead) => setSelectedLead(lead)}
            columns={columns}
          />
        </div>

        {/* Detail drawer */}
        {selectedLead && (
          <div className="fixed inset-0 z-40" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close overlay"
              onClick={() => setSelectedLead(null)}
            />
            <div
              className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
              role="dialog"
              aria-label="Lead details"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                    Lead
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {displayRestaurantName(selectedLead)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  aria-label="Close drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/80 space-y-2">
                  {selectedLead.restaurantName && (
                    <p><span className="text-gray-500">Restaurant:</span> {selectedLead.restaurantName}</p>
                  )}
                  {selectedLead.name && (
                    <p><span className="text-gray-500">Contact:</span> {selectedLead.name}</p>
                  )}
                  <p><span className="text-gray-500">Phone:</span> {selectedLead.phone || "—"}</p>
                  <p><span className="text-gray-500">Email:</span> {selectedLead.email || "—"}</p>
                  {selectedLead.city && (
                    <p><span className="text-gray-500">City:</span> {selectedLead.city}</p>
                  )}
                  <p><span className="text-gray-500">Source:</span> {SOURCE_LABELS[selectedLead.source] || formatLabel(selectedLead.source)}</p>
                  {canViewAll && (
                    <p>
                      <span className="text-gray-500">Assigned to:</span>{" "}
                      {selectedLead.assignedToName || "Unassigned"}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500 mb-2">
                    Status
                  </p>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      {PIPELINE_STAGES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={stageSaving}
                          onClick={() => applyStatusChange(selectedLead, s)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors disabled:opacity-50 ${
                            selectedLead.status === s
                              ? STATUS_BADGE[s]
                              : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                          }`}
                        >
                          {formatLabel(s)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[selectedLead.status] || STATUS_BADGE.new}`}
                    >
                      {formatLabel(selectedLead.status)}
                    </span>
                  )}
                  {selectedLead.status === "lost" && selectedLead.lostReason && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      Lost reason: {selectedLead.lostReason}
                    </p>
                  )}
                </div>

                {selectedLead.status === "won" && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/30">
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Ready to onboard
                    </p>
                    {selectedLead.convertedRestaurant ? (
                      <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
                        Linked:{" "}
                        <Link
                          href={`/super/restaurants/${selectedLead.convertedRestaurant}`}
                          className="underline font-medium"
                        >
                          {selectedLead.convertedRestaurantName || "Restaurant"}
                        </Link>
                      </p>
                    ) : canConvert ? (
                      <button
                        type="button"
                        onClick={openConvertModal}
                        className="mt-2 text-xs font-semibold text-emerald-700 underline dark:text-emerald-300"
                      >
                        Link restaurant →
                      </button>
                    ) : null}
                  </div>
                )}

                {canViewAll && canManage && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                      Reassign
                    </label>
                    <select
                      value={selectedLead.assignedTo || "unassigned"}
                      disabled={reassignSaving}
                      onChange={(e) => handleReassign(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                    >
                      <option value="unassigned">Unassigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500 mb-2">
                    Activity
                  </p>
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {(selectedLead.activity || []).length === 0 ? (
                      <li className="text-sm text-gray-500">No activity yet.</li>
                    ) : (
                      selectedLead.activity.map((entry) => (
                        <li
                          key={entry.id || `${entry.type}-${entry.createdAt}`}
                          className="rounded-lg border border-gray-100 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                        >
                          <div className="flex justify-between gap-2 text-xs text-gray-400">
                            <span className="font-medium capitalize">{entry.type.replace("_", " ")}</span>
                            <span>{formatDateTime(entry.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-gray-800 dark:text-neutral-200">
                            {activitySummary(entry)}
                          </p>
                          {entry.authorName && (
                            <p className="mt-1 text-[10px] text-gray-400">— {entry.authorName}</p>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                {canManage && (
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                      Add note
                    </label>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={3}
                      placeholder="Log a call, meeting, or follow-up..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm resize-none"
                    />
                    <button
                      type="submit"
                      disabled={noteSaving || !noteText.trim()}
                      className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {noteSaving ? "Saving..." : "Add note"}
                    </button>
                  </form>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(selectedLead)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete lead
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add lead modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close modal"
              onClick={() => setShowAddModal(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add lead</h2>
              <form onSubmit={handleAddLead} className="space-y-3">
                <input
                  type="text"
                  placeholder="Restaurant name"
                  value={addForm.restaurantName}
                  onChange={(e) => setAddForm((f) => ({ ...f, restaurantName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
                <input
                  type="text"
                  placeholder="Contact name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone *"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={addForm.city}
                  onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
                <select
                  value={addForm.source}
                  onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                >
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {canViewAll && (
                  <select
                    value={addForm.assignedTo}
                    onChange={(e) => setAddForm((f) => ({ ...f, assignedTo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  >
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        Assign to: {m.name || m.email}
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  placeholder="Initial note (optional)"
                  value={addForm.note}
                  onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm resize-none"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-semibold dark:border-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addSaving}
                    className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addSaving ? "Creating..." : "Create lead"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lost reason modal */}
        {lostPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close"
              onClick={() => setLostPrompt(null)}
            />
            <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Mark as lost</h2>
              <p className="text-sm text-gray-500 mb-3">Optional: why was this lead lost?</p>
              <form onSubmit={submitLostReason}>
                <textarea
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm resize-none mb-3"
                  placeholder="Price, timing, chose competitor..."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLostPrompt(null)}
                    className="flex-1 py-2 rounded-lg border text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={lostSaving}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {lostSaving ? "Saving..." : "Mark lost"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Link restaurant modal */}
        {showConvert && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close"
              onClick={() => setShowConvert(false)}
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-6 max-h-[80vh] flex flex-col">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Link restaurant</h2>
              <input
                type="text"
                placeholder="Search restaurants..."
                value={restaurantSearch}
                onChange={(e) => setRestaurantSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm mb-3"
              />
              <div className="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
                {convertLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredRestaurants.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No restaurants found</p>
                ) : (
                  filteredRestaurants.map((r) => {
                    const id = r.id || r._id;
                    const label = r.website?.name || r.name || r.website?.subdomain || id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={convertSaving}
                        onClick={() => handleConvert(id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 text-sm disabled:opacity-50"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{label}</span>
                        {r.website?.subdomain && (
                          <span className="ml-2 text-xs text-gray-400">{r.website.subdomain}.eatsdesk.app</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowConvert(false)}
                className="mt-3 py-2 rounded-lg border text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close"
              onClick={() => setDeleteConfirm(null)}
            />
            <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete lead?</h2>
              <p className="text-sm text-gray-500 mb-4">
                Remove <strong>{displayRestaurantName(deleteConfirm)}</strong> from the pipeline?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-lg border text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteSaving}
                  onClick={handleDelete}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {deleteSaving ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </SuperPageGate>
    </AdminLayout>
  );
}
