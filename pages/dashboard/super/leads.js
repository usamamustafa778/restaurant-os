import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import DataTable from "../../../components/ui/DataTable";
import {
  addLeadNoteForSuperAdmin,
  convertLeadForSuperAdmin,
  createLeadForSuperAdmin,
  importLeadsForSuperAdmin,
  deleteLeadForSuperAdmin,
  getLeadsForSuperAdmin,
  getLeadStatsForSuperAdmin,
  getPlatformTeamMembers,
  getRestaurantsForSuperAdmin,
  getStoredAuth,
  updateLeadForSuperAdmin,
} from "../../../lib/apiClient";
import { usePermissions } from "../../../contexts/PermissionContext";
import {
  AlertTriangle,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  KanbanSquare,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Table2,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
  Eye,
  X,
  Upload,
  FileDown,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

const CURRENCY = "Rs";

const STAGES = [
  { key: "new", label: "New", dot: "bg-gray-400" },
  { key: "contacted", label: "Contacted", dot: "bg-blue-500" },
  { key: "demo", label: "Demo", dot: "bg-amber-500" },
  { key: "negotiating", label: "Negotiating", dot: "bg-orange-500" },
  { key: "won", label: "Won", dot: "bg-emerald-500" },
  { key: "lost", label: "Lost", dot: "bg-red-500" },
];

const PIPELINE_STAGES = STAGES.map((s) => s.key);

const STATUS_FILTERS = [{ value: "", label: "All" }, ...STAGES.map((s) => ({ value: s.key, label: s.label }))];

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "website", label: "Website" },
  { value: "website_signup", label: "Website signup" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

const SOURCE_LABELS = Object.fromEntries(SOURCE_OPTIONS.map((o) => [o.value, o.label]));

const STATUS_BADGE = {
  new: "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  demo: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  negotiating: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  lost: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const ACTIVITY_META = {
  created: { label: "Created", icon: Plus },
  note: { label: "Note", icon: MessageSquare },
  stage_change: { label: "Stage", icon: TrendingUp },
  assignment: { label: "Assignment", icon: UserPlus },
  convert: { label: "Converted", icon: CheckCircle2 },
  follow_up: { label: "Follow-up", icon: Calendar },
  value_change: { label: "Value", icon: Banknote },
};

function formatLabel(status) {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatMoney(n) {
  const v = Number(n || 0);
  return `${CURRENCY} ${v.toLocaleString()}`;
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

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function toDateInput(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function displayRestaurantName(lead) {
  return (lead.restaurantName || lead.name || "—").trim() || "—";
}

function displayAddedBy(lead) {
  const name = (lead?.createdByName || "").trim();
  if (name) return name;
  return "System";
}

function leadInitials(lead) {
  const src = (lead.restaurantName || lead.name || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function isOverdue(lead) {
  if (!lead.nextFollowUpAt) return false;
  if (lead.status === "won" || lead.status === "lost") return false;
  return new Date(lead.nextFollowUpAt).getTime() <= Date.now();
}

function activitySummary(entry) {
  if (!entry) return "—";
  if (entry.type === "stage_change") return entry.body || `Stage: ${entry.toStatus}`;
  return entry.body || entry.type;
}

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

function normalizeCsvHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

const CSV_HEADER_MAP = {
  restaurant: "restaurantName",
  restaurant_name: "restaurantName",
  restaurantname: "restaurantName",
  name: "name",
  contact: "name",
  contact_name: "name",
  owner: "name",
  owner_name: "name",
  phone: "phone",
  mobile: "phone",
  phone_number: "phone",
  email: "email",
  city: "city",
  source: "source",
  value: "value",
  deal_value: "value",
  follow_up: "nextFollowUpAt",
  followup: "nextFollowUpAt",
  next_follow_up: "nextFollowUpAt",
  note: "note",
  notes: "note",
  status: "status",
  assigned_to: "assignedToEmail",
  assignee: "assignedToEmail",
  assigned_to_email: "assignedToEmail",
};

function parseLeadsCsv(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { error: "CSV must include a header row and at least one data row.", rows: [] };
  }

  const headerCells = parseCSVLine(lines[0]).map(normalizeCsvHeader);
  const phoneIdx = headerCells.findIndex((h) => CSV_HEADER_MAP[h] === "phone");
  if (phoneIdx === -1) {
    return {
      error: 'CSV must include a "phone" column.',
      rows: [],
    };
  }

  const rows = [];
  const rowErrors = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.every((c) => !String(c).trim())) continue;

    const row = {};
    headerCells.forEach((h, idx) => {
      const key = CSV_HEADER_MAP[h];
      if (!key) return;
      const val = cells[idx] != null ? String(cells[idx]).trim() : "";
      if (val) row[key] = val;
    });

    if (!row.phone) {
      rowErrors.push({ row: i + 1, message: "Missing phone" });
      continue;
    }

    if (row.source) {
      const src = row.source.toLowerCase().replace(/\s+/g, "_");
      row.source = SOURCE_OPTIONS.some((o) => o.value === src) ? src : "manual";
    } else {
      row.source = "manual";
    }

    if (row.status) {
      row.status = row.status.toLowerCase();
      if (!PIPELINE_STAGES.includes(row.status)) {
        row.status = "new";
      }
    }

    if (row.value != null && row.value !== "") {
      const n = Number(String(row.value).replace(/,/g, ""));
      row.value = Number.isFinite(n) && n >= 0 ? n : 0;
    }

    rows.push(row);
  }

  if (rows.length === 0 && rowErrors.length === 0) {
    return { error: "No valid lead rows found in CSV.", rows: [] };
  }

  return { rows, rowErrors };
}

function downloadLeadsImportTemplate() {
  const header = [
    "restaurant_name",
    "name",
    "phone",
    "email",
    "city",
    "source",
    "value",
    "follow_up",
    "note",
    "status",
    "assigned_to",
  ];
  const example = [
    "Shawarma House",
    "Ali Khan",
    "03001234567",
    "ali@example.com",
    "Lahore",
    "manual",
    "15000",
    "2026-07-15",
    "Met at expo",
    "new",
    "",
  ];
  const blob = new Blob(["\uFEFF" + `${header.join(",")}\n${example.join(",")}\n`], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leads-import-template.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function SuperLeadsPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.leads.view");
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("platform.leads.manage");
  const canViewAll = hasPermission("platform.leads.view_all");
  const canConvert = hasPermission("platform.leads.convert");
  const canDelete = hasPermission("platform.leads.delete");

  const [viewMode, setViewMode] = useState("table");
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [selectedLead, setSelectedLead] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const [valueDraft, setValueDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);

  const [draggingLead, setDraggingLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    restaurantName: "",
    name: "",
    phone: "",
    email: "",
    city: "",
    source: "manual",
    value: "",
    nextFollowUpAt: "",
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

  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef(null);

  const scopeParams = useMemo(
    () => ({
      assignedTo: canViewAll && assigneeFilter ? assigneeFilter : undefined,
      source: sourceFilter || undefined,
      search: searchApplied.trim() || undefined,
    }),
    [canViewAll, assigneeFilter, sourceFilter, searchApplied],
  );

  const loadStats = useCallback(async () => {
    try {
      const data = await getLeadStatsForSuperAdmin(scopeParams);
      setStats(data);
    } catch {
      setStats(null);
    }
  }, [scopeParams]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeadsForSuperAdmin({
        ...scopeParams,
        status: viewMode === "table" && statusFilter ? statusFilter : undefined,
        limit: 200,
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
  }, [scopeParams, viewMode, statusFilter]);

  useEffect(() => {
    if (!hasAccess) return;
    const auth = getStoredAuth();
    setCurrentUserId(auth?.user?.id || null);
  }, [hasAccess]);

  useEffect(() => {
    if (!hasAccess) return;
    loadLeads();
    loadStats();
  }, [hasAccess, loadLeads, loadStats]);

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
    setAddForm((f) => ({ ...f, assignedTo: f.assignedTo || currentUserId || "" }));
  }, [showAddModal, currentUserId]);

  useEffect(() => {
    if (!selectedLead) return;
    setValueDraft(selectedLead.value ? String(selectedLead.value) : "");
    setFollowUpDraft(toDateInput(selectedLead.nextFollowUpAt));
    setNoteText("");
  }, [selectedLead]);

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

  const board = useMemo(() => {
    const map = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, []]));
    for (const lead of leads) {
      (map[lead.status] || map.new).push(lead);
    }
    return map;
  }, [leads]);

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
        value: addForm.value ? Number(addForm.value) : 0,
        nextFollowUpAt: addForm.nextFollowUpAt || null,
        note: addForm.note.trim() || undefined,
      };
      if (canViewAll && addForm.assignedTo) payload.assignedTo = addForm.assignedTo;
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
        value: "",
        nextFollowUpAt: "",
        note: "",
        assignedTo: currentUserId || "",
      });
      if (data?.lead) {
        setLeads((prev) => [data.lead, ...prev]);
        setTotal((t) => t + 1);
      } else {
        loadLeads();
      }
      loadStats();
    } catch (err) {
      toast.error(err.message || "Failed to create lead");
    } finally {
      setAddSaving(false);
    }
  }

  function closeImportModal() {
    if (importing) return;
    setShowImportModal(false);
    setImportPreview(null);
    setImportFile(null);
    if (importFileRef.current) importFileRef.current.value = "";
  }

  function handleImportFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseLeadsCsv(String(reader.result || ""));
      setImportPreview(parsed);
    };
    reader.onerror = () => {
      toast.error("Could not read CSV file");
      setImportPreview({ error: "Could not read file.", rows: [] });
    };
    reader.readAsText(file);
  }

  async function handleImportLeads() {
    if (!importPreview?.rows?.length) {
      toast.error(importPreview?.error || "No rows to import");
      return;
    }
    setImporting(true);
    try {
      const data = await importLeadsForSuperAdmin(importPreview.rows);
      const created = data?.createdCount ?? data?.created?.length ?? 0;
      const failed = data?.failedCount ?? data?.failed?.length ?? 0;
      if (created > 0) {
        toast.success(`Imported ${created} lead${created === 1 ? "" : "s"}`);
        loadLeads();
        loadStats();
      }
      if (failed > 0) {
        toast.error(`${failed} row${failed === 1 ? "" : "s"} failed to import`);
        setImportPreview((prev) => ({
          ...prev,
          importFailed: data?.failed || [],
        }));
        if (created > 0) closeImportModal();
        return;
      }
      closeImportModal();
    } catch (err) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function applyStatusChange(lead, nextStatus, reason = "") {
    if (!canManage || !lead || lead.status === nextStatus) return;
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
      toast.success(`Moved to ${formatLabel(nextStatus)}`);
      setLostPrompt(null);
      setLostReason("");
      loadStats();
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

  async function handleSaveDetail() {
    if (!selectedLead || !canManage) return;
    const nextValue = valueDraft ? Number(valueDraft) : 0;
    const body = {};
    if (nextValue !== (selectedLead.value || 0)) body.value = nextValue;
    const currentFollow = toDateInput(selectedLead.nextFollowUpAt);
    if (followUpDraft !== currentFollow) body.nextFollowUpAt = followUpDraft || null;
    if (Object.keys(body).length === 0) {
      toast("Nothing to update");
      return;
    }
    setDetailSaving(true);
    try {
      const data = await updateLeadForSuperAdmin(selectedLead.id, body);
      upsertLead(data.lead);
      toast.success("Lead updated");
      loadStats();
    } catch (err) {
      toast.error(err.message || "Failed to update lead");
    } finally {
      setDetailSaving(false);
    }
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
    try {
      const value = assigneeId === "unassigned" ? null : assigneeId;
      const data = await updateLeadForSuperAdmin(selectedLead.id, { assignedTo: value });
      upsertLead(data.lead);
      toast.success("Lead reassigned");
    } catch (err) {
      toast.error(err.message || "Failed to reassign");
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
      loadStats();
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
      loadStats();
    } catch (err) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setDeleteSaving(false);
    }
  }

  function handleDrop(stage) {
    const lead = draggingLead;
    setDraggingLead(null);
    setDragOverStage(null);
    if (lead && lead.status !== stage) applyStatusChange(lead, stage);
  }

  const metrics = useMemo(() => {
    if (!stats) return null;
    return [
      {
        label: "Open pipeline",
        value: String(stats.openCount ?? 0),
        sub: formatMoney(stats.openValue),
        icon: TrendingUp,
        accent: "text-primary",
        bg: "bg-primary/10",
      },
      {
        label: "Won this month",
        value: String(stats.wonThisMonth?.count ?? 0),
        sub: formatMoney(stats.wonThisMonth?.value),
        icon: Trophy,
        accent: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-950/40",
      },
      {
        label: "Win rate",
        value: `${stats.winRate ?? 0}%`,
        sub: `${stats.wonCount ?? 0} won · ${stats.lostCount ?? 0} lost`,
        icon: CheckCircle2,
        accent: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-950/40",
      },
      {
        label: "Overdue follow-ups",
        value: String(stats.overdueFollowUps ?? 0),
        sub: stats.overdueFollowUps > 0 ? "Needs attention" : "All caught up",
        icon: AlertTriangle,
        accent:
          stats.overdueFollowUps > 0
            ? "text-red-600 dark:text-red-400"
            : "text-gray-500 dark:text-neutral-400",
        bg:
          stats.overdueFollowUps > 0
            ? "bg-red-100 dark:bg-red-950/40"
            : "bg-gray-100 dark:bg-neutral-800",
      },
    ];
  }, [stats]);

  const showEmailColumn = useMemo(
    () => leads.some((l) => (l.email || "").trim()),
    [leads],
  );
  const showCityColumn = useMemo(
    () => leads.some((l) => (l.city || "").trim()),
    [leads],
  );

  const tableColumns = useMemo(() => {
    const cols = [
      {
        key: "restaurantName",
        header: "Restaurant",
        render: (_, lead) => (
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {leadInitials(lead)}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {displayRestaurantName(lead)}
              </p>
              {lead.name && lead.restaurantName && (
                <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{lead.name}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "phone",
        header: "Phone",
        render: (_, lead) => lead.phone || "—",
        cellClassName: "text-gray-700 dark:text-neutral-300 whitespace-nowrap",
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
      {
        key: "value",
        header: "Value",
        render: (_, lead) =>
          lead.value ? (
            <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
              {formatMoney(lead.value)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
        cellClassName: "whitespace-nowrap",
      },
      {
        key: "createdByName",
        header: "Added by",
        render: (_, lead) => (
          <span className="text-xs text-gray-500 dark:text-neutral-400 italic">
            {displayAddedBy(lead)}
          </span>
        ),
        cellClassName: "whitespace-nowrap",
      },
    ];

    if (canViewAll) {
      cols.push({
        key: "assignedTo",
        header: "Assigned to",
        render: (_, lead) => lead.assignedToName || "Unassigned",
        cellClassName: "text-gray-600 dark:text-neutral-400",
      });
    }

    cols.push(
      {
        key: "nextFollowUpAt",
        header: "Follow-up",
        render: (_, lead) =>
          lead.nextFollowUpAt ? (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                isOverdue(lead) ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-neutral-300"
              }`}
            >
              {isOverdue(lead) ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {formatDate(lead.nextFollowUpAt)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
        cellClassName: "whitespace-nowrap",
      },
      {
        key: "source",
        header: "Source",
        render: (_, lead) => SOURCE_LABELS[lead.source] || formatLabel(lead.source),
        cellClassName: "text-gray-600 dark:text-neutral-400",
      },
    );

    if (showEmailColumn) {
      cols.push({
        key: "email",
        header: "Email",
        render: (_, lead) =>
          (lead.email || "").trim() ? (
            <span className="text-gray-700 dark:text-neutral-300 truncate max-w-[180px] inline-block">
              {lead.email}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
        cellClassName: "max-w-[200px]",
      });
    }

    if (showCityColumn) {
      cols.push({
        key: "city",
        header: "City",
        render: (_, lead) =>
          (lead.city || "").trim() ? (
            <span className="text-gray-700 dark:text-neutral-300">{lead.city}</span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
        cellClassName: "whitespace-nowrap",
      });
    }

    cols.push({
      key: "actions",
      header: "Actions",
      render: (_, lead) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLead(lead);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/5 dark:border-neutral-700 dark:hover:bg-primary/10"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      ),
      cellClassName: "whitespace-nowrap",
    });

    return cols;
  }, [canViewAll, showEmailColumn, showCityColumn]);

  return (
    <AdminLayout
      title="Leads CRM"
      subtitle="Track prospects from first contact through onboarding."
    >
      <SuperPageGate permission="platform.leads.view">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Metrics */}
          {metrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 flex-shrink-0">
              {metrics.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.label}
                    className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3.5 flex items-start gap-3"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.bg}`}>
                      <Icon className={`h-4 w-4 ${m.accent}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500 truncate">
                        {m.label}
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                        {m.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{m.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 p-0.5 bg-gray-50 dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setViewMode("board")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    viewMode === "board"
                      ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-500 dark:text-neutral-400"
                  }`}
                >
                  <KanbanSquare className="w-4 h-4" />
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    viewMode === "table"
                      ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-500 dark:text-neutral-400"
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                  Table
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search name, phone, email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearchApplied(searchInput);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
              >
                <option value="">All sources</option>
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
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
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(true);
                      setImportPreview(null);
                      setImportFile(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Import CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Lead
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table-only status filter */}
          {viewMode === "table" && (
            <div className="flex flex-wrap items-center gap-2 mb-4 flex-shrink-0">
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
              <span className="ml-auto text-xs text-neutral-500">
                {leads.length} of {total}
              </span>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : viewMode === "board" ? (
            <div className="flex-1 min-h-0 overflow-x-auto pb-2">
              <div className="flex gap-3 h-full min-h-[300px]">
                {STAGES.map((stage) => {
                  const items = board[stage.key] || [];
                  const colValue = items.reduce((s, l) => s + (l.value || 0), 0);
                  return (
                    <div
                      key={stage.key}
                      onDragOver={(e) => {
                        if (!draggingLead) return;
                        e.preventDefault();
                        setDragOverStage(stage.key);
                      }}
                      onDragLeave={() => setDragOverStage((s) => (s === stage.key ? null : s))}
                      onDrop={() => handleDrop(stage.key)}
                      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-gray-50/60 dark:bg-neutral-900/40 ${
                        dragOverStage === stage.key
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-gray-200 dark:border-neutral-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-neutral-800">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                          <span className="text-xs font-bold text-gray-700 dark:text-neutral-200">
                            {stage.label}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-400 dark:text-neutral-500">
                            {items.length}
                          </span>
                        </div>
                        {colValue > 0 && (
                          <span className="text-[10px] font-semibold text-gray-500 dark:text-neutral-400 tabular-nums">
                            {formatMoney(colValue)}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                        {items.length === 0 ? (
                          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-neutral-800 text-xs text-gray-400">
                            {canManage ? "Drop here" : "Empty"}
                          </div>
                        ) : (
                          items.map((lead) => {
                            const overdue = isOverdue(lead);
                            return (
                              <button
                                key={lead.id}
                                type="button"
                                draggable={canManage}
                                onDragStart={() => setDraggingLead(lead)}
                                onDragEnd={() => {
                                  setDraggingLead(null);
                                  setDragOverStage(null);
                                }}
                                onClick={() => setSelectedLead(lead)}
                                className={`group w-full text-left rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 shadow-sm hover:border-primary/40 hover:shadow transition-all ${
                                  canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                                } ${draggingLead?.id === lead.id ? "opacity-50" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                    {displayRestaurantName(lead)}
                                  </p>
                                  {lead.value ? (
                                    <span className="shrink-0 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                      {formatMoney(lead.value)}
                                    </span>
                                  ) : null}
                                </div>
                                {lead.name && lead.restaurantName && (
                                  <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400 truncate">
                                    {lead.name}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500 dark:text-neutral-400">
                                  {lead.phone && (
                                    <span className="inline-flex items-center gap-1 truncate">
                                      <Phone className="w-3 h-3 shrink-0" />
                                      {lead.phone}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-neutral-300">
                                    {SOURCE_LABELS[lead.source] || formatLabel(lead.source)}
                                  </span>
                                  {lead.nextFollowUpAt && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                        overdue
                                          ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                          : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                      }`}
                                    >
                                      {overdue ? (
                                        <AlertTriangle className="w-3 h-3" />
                                      ) : (
                                        <Clock className="w-3 h-3" />
                                      )}
                                      {formatDate(lead.nextFollowUpAt)}
                                    </span>
                                  )}
                                </div>
                                {canViewAll && (
                                  <p className="mt-2 text-[10px] text-gray-400 dark:text-neutral-500 truncate">
                                    {lead.assignedToName || "Unassigned"}
                                  </p>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <DataTable
              showSno
              data={leads}
              loading={loading}
              emptyMessage="No leads yet. Add a lead or wait for website submissions."
              onRowClick={(lead) => setSelectedLead(lead)}
              columns={tableColumns}
            />
          )}
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
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    {leadInitials(selectedLead)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">
                      {displayRestaurantName(selectedLead)}
                    </p>
                    <span
                      className={`mt-0.5 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_BADGE[selectedLead.status] || STATUS_BADGE.new}`}
                    >
                      {formatLabel(selectedLead.status)}
                    </span>
                  </div>
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

              <div className="border-b border-gray-100 px-4 py-2.5 text-xs text-gray-600 dark:border-neutral-800 dark:text-neutral-400 space-y-1">
                <p>
                  Added by{" "}
                  <span className="font-medium text-gray-800 dark:text-neutral-200">
                    {displayAddedBy(selectedLead)}
                  </span>
                  {selectedLead.createdAt ? (
                    <>
                      {" "}
                      on{" "}
                      <span className="font-medium text-gray-800 dark:text-neutral-200">
                        {formatDate(selectedLead.createdAt)}
                      </span>
                    </>
                  ) : null}
                </p>
                {canViewAll && (
                  <p>
                    Assigned to{" "}
                    <span className="font-medium text-gray-800 dark:text-neutral-200">
                      {selectedLead.assignedToName || "Unassigned"}
                    </span>
                  </p>
                )}
              </div>

              {/* Quick contact actions */}
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
                <a
                  href={selectedLead.phone ? `tel:${selectedLead.phone}` : undefined}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                    selectedLead.phone
                      ? "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                      : "border-gray-100 text-gray-300 pointer-events-none dark:border-neutral-800 dark:text-neutral-700"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </a>
                <a
                  href={selectedLead.phone ? `https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, "")}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                    selectedLead.phone
                      ? "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                      : "border-gray-100 text-gray-300 pointer-events-none dark:border-neutral-800 dark:text-neutral-700"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
                <a
                  href={selectedLead.email ? `mailto:${selectedLead.email}` : undefined}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                    selectedLead.email
                      ? "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                      : "border-gray-100 text-gray-300 pointer-events-none dark:border-neutral-800 dark:text-neutral-700"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Contact info */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/80 space-y-2">
                  {selectedLead.name && (
                    <p className="flex items-center gap-2">
                      <UserPlus className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-800 dark:text-neutral-200">{selectedLead.name}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-800 dark:text-neutral-200">{selectedLead.phone || "—"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-800 dark:text-neutral-200">{selectedLead.email || "—"}</span>
                  </p>
                  {selectedLead.city && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-800 dark:text-neutral-200">{selectedLead.city}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500">Source:</span>
                    <span className="text-gray-800 dark:text-neutral-200">
                      {SOURCE_LABELS[selectedLead.source] || formatLabel(selectedLead.source)}
                    </span>
                  </p>
                </div>

                {/* Value + follow-up */}
                {canManage && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                        Est. value ({CURRENCY})
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={valueDraft}
                        onChange={(e) => setValueDraft(e.target.value)}
                        placeholder="0"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                        Next follow-up
                      </label>
                      <input
                        type="date"
                        value={followUpDraft}
                        onChange={(e) => setFollowUpDraft(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={handleSaveDetail}
                        disabled={detailSaving}
                        className="w-full py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 disabled:opacity-50"
                      >
                        {detailSaving ? "Saving..." : "Save value & follow-up"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500 mb-2">
                    Stage
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

                {/* Won → onboard */}
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

                {/* Reassign */}
                {canViewAll && canManage && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500">
                      Assigned to
                    </label>
                    <select
                      value={selectedLead.assignedTo || "unassigned"}
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

                {/* Activity timeline */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-500 mb-2">
                    Activity
                  </p>
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {(selectedLead.activity || []).length === 0 ? (
                      <li className="text-sm text-gray-500">No activity yet.</li>
                    ) : (
                      selectedLead.activity.map((entry) => {
                        const meta = ACTIVITY_META[entry.type] || { label: entry.type, icon: MessageSquare };
                        const Icon = meta.icon;
                        return (
                          <li
                            key={entry.id || `${entry.type}-${entry.createdAt}`}
                            className="flex gap-2.5 rounded-lg border border-gray-100 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400">
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-2 text-xs text-gray-400">
                                <span className="font-medium">{meta.label}</span>
                                <span>{formatDateTime(entry.createdAt)}</span>
                              </div>
                              <p className="mt-0.5 text-gray-800 dark:text-neutral-200 break-words">
                                {activitySummary(entry)}
                              </p>
                              {entry.authorName && (
                                <p className="mt-1 text-[10px] text-gray-400">— {entry.authorName}</p>
                              )}
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>

                {/* Add note */}
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
            <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-6 max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min="0"
                    placeholder={`Est. value (${CURRENCY})`}
                    value={addForm.value}
                    onChange={(e) => setAddForm((f) => ({ ...f, value: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  />
                  <input
                    type="date"
                    value={addForm.nextFollowUpAt}
                    onChange={(e) => setAddForm((f) => ({ ...f, nextFollowUpAt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  />
                </div>
                <select
                  value={addForm.source}
                  onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                >
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
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

        {/* Import CSV modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close modal"
              onClick={closeImportModal}
            />
            <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Import leads (CSV)
                </h2>
                <button
                  type="button"
                  onClick={closeImportModal}
                  disabled={importing}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {importing && (
                <div className="px-5 pt-3">
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing… please wait.
                  </div>
                </div>
              )}
              <div className={`p-5 space-y-4 overflow-y-auto text-sm ${importing ? "opacity-60 pointer-events-none" : ""}`}>
                <p className="text-gray-600 dark:text-neutral-400 text-xs leading-relaxed">
                  Required column: <code className="bg-gray-100 dark:bg-neutral-800 px-1 rounded">phone</code>.
                  Optional: restaurant_name, name, email, city, source, value, follow_up, note, status
                  {canViewAll ? ", assigned_to (team member email)" : ""}.
                  Leads are assigned to you{canViewAll ? " unless assigned_to is set" : ""}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadLeadsImportTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download template
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-primary text-primary text-xs font-semibold cursor-pointer hover:bg-primary/10">
                    <Upload className="w-3.5 h-3.5" />
                    Choose CSV file
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      disabled={importing}
                      onChange={handleImportFileSelected}
                    />
                  </label>
                </div>
                {importFile && (
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/80 px-3 py-2.5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Attached file</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{importFile.name}</p>
                    </div>
                  </div>
                )}
                {importPreview?.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">{importPreview.error}</p>
                )}
                {importPreview?.rowErrors?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 max-h-28 overflow-y-auto">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">Skipped rows</p>
                    <ul className="text-[11px] text-amber-900 dark:text-amber-100 space-y-0.5">
                      {importPreview.rowErrors.map((e, idx) => (
                        <li key={idx}>Line {e.row}: {e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {importPreview?.importFailed?.length > 0 && (
                  <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 max-h-28 overflow-y-auto">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">Server rejected rows</p>
                    <ul className="text-[11px] text-red-900 dark:text-red-100 space-y-0.5">
                      {importPreview.importFailed.map((e, idx) => (
                        <li key={idx}>
                          Row {e.row}{e.phone ? ` (${e.phone})` : ""}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {importPreview?.rows?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Ready to import: {importPreview.rows.length} lead{importPreview.rows.length !== 1 ? "s" : ""}
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
                      <table className="min-w-full text-[11px]">
                        <thead className="bg-gray-50 dark:bg-neutral-900">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Restaurant</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Phone</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">City</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.rows.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="border-t border-gray-100 dark:border-neutral-800">
                              <td className="px-2 py-1.5">{row.restaurantName || "—"}</td>
                              <td className="px-2 py-1.5 font-mono">{row.phone}</td>
                              <td className="px-2 py-1.5">{row.city || "—"}</td>
                              <td className="px-2 py-1.5">{row.status || "new"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importPreview.rows.length > 5 && (
                        <p className="px-2 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 dark:border-neutral-800">
                          + {importPreview.rows.length - 5} more row{importPreview.rows.length - 5 !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={closeImportModal}
                  disabled={importing}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportLeads}
                  disabled={importing || !importPreview?.rows?.length}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    `Import ${importPreview?.rows?.length || 0} lead${importPreview?.rows?.length === 1 ? "" : "s"}`
                  )}
                </button>
              </div>
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
