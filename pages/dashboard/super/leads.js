import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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
  sendLeadEmailForSuperAdmin,
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
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Table2,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
  ChevronDown,
  Pencil,
  Eye,
  X,
  Upload,
  FileDown,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

const CURRENCY = "Rs";

const STAGES = [
  { key: "prospect", label: "Prospect", dot: "bg-slate-400" },
  { key: "new", label: "New", dot: "bg-gray-400" },
  { key: "contacted", label: "Contacted", dot: "bg-blue-500" },
  { key: "demo", label: "Demo", dot: "bg-amber-500" },
  { key: "negotiating", label: "Negotiating", dot: "bg-orange-500" },
  { key: "won", label: "Won", dot: "bg-emerald-500" },
  { key: "lost", label: "Lost", dot: "bg-red-500" },
];

const PIPELINE_STAGES = STAGES.map((s) => s.key);

const STATUS_FILTERS = [
  { value: "", label: "All" },
  ...STAGES.map((s) => ({ value: s.key, label: s.label })),
];

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
  prospect:
    "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  new: "bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  demo: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  negotiating:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  lost: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const STAGE_SELECT_BORDER = {
  prospect: "border-slate-300 dark:border-slate-700",
  new: "border-gray-300 dark:border-neutral-700",
  contacted: "border-blue-300 dark:border-blue-800",
  demo: "border-amber-300 dark:border-amber-800",
  negotiating: "border-orange-300 dark:border-orange-800",
  won: "border-emerald-300 dark:border-emerald-800",
  lost: "border-red-200 dark:border-red-900",
};

const ACTIVITY_META = {
  created: { label: "Created", icon: Plus },
  note: { label: "Note", icon: MessageSquare },
  stage_change: { label: "Stage", icon: TrendingUp },
  assignment: { label: "Assignment", icon: UserPlus },
  convert: { label: "Converted", icon: CheckCircle2 },
  follow_up: { label: "Follow-up", icon: Calendar },
  value_change: { label: "Value", icon: Banknote },
  email_sent: { label: "Email", icon: Mail },
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

function isLeadAssignee(lead, userId) {
  if (!lead?.assignedTo || !userId) return false;
  return String(lead.assignedTo) === String(userId);
}

function leadInitials(lead) {
  const src = (lead.restaurantName || lead.name || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function primaryLeadPhone(lead) {
  return (
    (lead?.restaurantPhone || "").trim() ||
    (lead?.ownerPhone || "").trim() ||
    (lead?.phone || "").trim()
  );
}

function primaryLeadEmail(lead) {
  return (
    (lead?.restaurantEmail || "").trim() ||
    (lead?.ownerEmail || "").trim() ||
    (lead?.email || "").trim()
  );
}

function isOverdue(lead) {
  if (!lead.nextFollowUpAt) return false;
  if (lead.status === "won" || lead.status === "lost") return false;
  return new Date(lead.nextFollowUpAt).getTime() <= Date.now();
}

function activitySummary(entry) {
  if (!entry) return "—";
  if (entry.type === "stage_change")
    return entry.body || `Stage: ${entry.toStatus}`;
  if (entry.type === "email_sent")
    return entry.body ? `Subject: ${entry.body}` : "Email sent";
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
  restaurant_phone: "restaurantPhone",
  restaurant_email: "restaurantEmail",
  restaurant_mail: "restaurantEmail",
  name: "name",
  contact: "name",
  contact_name: "name",
  owner: "ownerName",
  owner_name: "ownerName",
  owner_phone: "ownerPhone",
  owner_email: "ownerEmail",
  phone: "phone",
  mobile: "phone",
  phone_number: "phone",
  email: "email",
  google_maps_url: "googleMapsUrl",
  googlemaps_url: "googleMapsUrl",
  maps_url: "googleMapsUrl",
  google_maps_place_id: "googleMapsPlaceId",
  googlemaps_place_id: "googleMapsPlaceId",
  opted_in: "optedIn",
  opt_in: "optedIn",
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
    return {
      error: "CSV must include a header row and at least one data row.",
      rows: [],
    };
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
        row.status = "prospect";
      }
    }

    if (row.optedIn != null && row.optedIn !== "") {
      const normalized = String(row.optedIn).trim().toLowerCase();
      row.optedIn = ["true", "1", "yes", "y", "on"].includes(normalized);
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
    "restaurant_phone",
    "restaurant_email",
    "owner_name",
    "owner_phone",
    "owner_email",
    "google_maps_url",
    "google_maps_place_id",
    "opted_in",
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
    "042-111-222333",
    "info@shawarmahouse.com",
    "Ali Khan",
    "03001234567",
    "ali@example.com",
    "https://maps.google.com/?q=shawarma+house",
    "ChIJ123EXAMPLE",
    "yes",
    "Ali Khan",
    "03001234567",
    "ali@example.com",
    "Lahore",
    "manual",
    "15000",
    "2026-07-15",
    "Met at expo",
    "prospect",
    "",
  ];
  const blob = new Blob(
    ["\uFEFF" + `${header.join(",")}\n${example.join(",")}\n`],
    {
      type: "text/csv;charset=utf-8;",
    },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leads-import-template.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function FieldRow({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-neutral-400 mb-0.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function InlineEditField({
  value,
  onSave,
  type = "text",
  placeholder = "",
  editable = true,
  emptyLabel = "—",
  actions = null,
  inputClassName,
  valueClassName = "text-sm text-gray-900 dark:text-neutral-100",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (typeof inputRef.current.select === "function") {
        inputRef.current.select();
      }
    }
  }, [editing]);

  async function commit() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    const next = String(draft ?? "").trim();
    const current = String(value ?? "").trim();
    if (next === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      setDraft(value ?? "");
      toast.error(err?.message || "Failed to save");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      skipBlurRef.current = true;
      setDraft(value ?? "");
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={
          inputClassName ||
          "h-9 w-full px-2.5 rounded-lg border border-primary/50 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        }
      />
    );
  }

  return (
    <div className="group flex items-center gap-1.5 min-w-0">
      {editable ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`truncate text-left ${value ? valueClassName : "text-gray-400 dark:text-neutral-500"}`}
        >
          {value || emptyLabel}
        </button>
      ) : (
        <span
          className={`truncate ${value ? valueClassName : "text-gray-400 dark:text-neutral-500"}`}
        >
          {value || emptyLabel}
        </span>
      )}
      {actions}
      {editable && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit"
          className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-gray-400 hover:text-primary"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function StageControl({ lead, editable, onChange, saving }) {
  const badgeClass = STATUS_BADGE[lead.status] || STATUS_BADGE.new;
  const borderClass =
    STAGE_SELECT_BORDER[lead.status] || STAGE_SELECT_BORDER.new;

  if (!editable) {
    return (
      <span
        className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${badgeClass}`}
      >
        {formatLabel(lead.status)}
      </span>
    );
  }

  return (
    <div className="relative shrink-0 inline-flex">
      <select
        disabled={saving}
        value={lead.status}
        onChange={(e) => onChange(e.target.value)}
        className={`cursor-pointer appearance-none rounded-full border pl-2 pr-6 py-0.5 text-[11px] font-semibold capitalize focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${badgeClass} ${borderClass}`}
      >
        {PIPELINE_STAGES.map((s) => (
          <option
            key={s}
            value={s}
            className="bg-white text-gray-900 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {formatLabel(s)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
    </div>
  );
}

function AssignedToControl({ lead, teamMembers, editable, onChange }) {
  const [saving, setSaving] = useState(false);

  if (!editable) {
    return (
      <span className="shrink-0 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
        {lead.assignedToName || "Unassigned"}
      </span>
    );
  }

  return (
    <div className="relative shrink-0 inline-flex max-w-[160px]">
      <select
        disabled={saving}
        value={lead.assignedTo || "unassigned"}
        onChange={async (e) => {
          setSaving(true);
          try {
            await onChange(e.target.value);
          } finally {
            setSaving(false);
          }
        }}
        className="max-w-full cursor-pointer truncate appearance-none rounded-full border border-gray-200 bg-gray-100 pl-2 pr-6 py-0.5 text-[11px] font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      >
        <option value="unassigned">Unassigned</option>
        {teamMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.email}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
    </div>
  );
}

export default function SuperLeadsPage() {
  const router = useRouter();
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
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);

  const [draggingLead, setDraggingLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    restaurantName: "",
    restaurantPhone: "",
    restaurantEmail: "",
    googleMapsUrl: "",
    googleMapsPlaceId: "",
    ownerName: "",
    ownerPhone: "",
    ownerEmail: "",
    optedIn: false,
    status: "new",
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
        const list = Array.isArray(data) ? data : (data?.members ?? []);
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

  useEffect(() => {
    // Only reset on switching to a different lead, not on every field
    // auto-save (which also produces a new selectedLead reference).
    setNoteText("");
    setEmailComposerOpen(false);
    setEmailSubject("");
    setEmailBody("");
  }, [selectedLead?.id]);

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
    const primaryName = (addForm.ownerName || addForm.restaurantName).trim();
    const resolvedPhone = (
      addForm.restaurantPhone || addForm.ownerPhone
    ).trim();
    const primaryEmail = (addForm.restaurantEmail || addForm.ownerEmail).trim();
    if (!resolvedPhone) {
      toast.error("Phone is required");
      return;
    }
    setAddSaving(true);
    try {
      const payload = {
        restaurantName: addForm.restaurantName.trim(),
        restaurantPhone: addForm.restaurantPhone.trim(),
        restaurantEmail: addForm.restaurantEmail.trim(),
        googleMapsUrl: addForm.googleMapsUrl.trim(),
        googleMapsPlaceId: addForm.googleMapsPlaceId.trim(),
        ownerName: addForm.ownerName.trim(),
        ownerPhone: addForm.ownerPhone.trim(),
        ownerEmail: addForm.ownerEmail.trim(),
        optedIn: addForm.optedIn === true,
        // Legacy fields are auto-derived from structured inputs.
        name: primaryName,
        phone: resolvedPhone,
        email: primaryEmail,
        status: addForm.status,
        city: addForm.city.trim(),
        source: addForm.source,
        value: addForm.value ? Number(addForm.value) : 0,
        nextFollowUpAt: addForm.nextFollowUpAt || null,
        note: addForm.note.trim() || undefined,
      };
      if (canViewAll && addForm.assignedTo)
        payload.assignedTo = addForm.assignedTo;
      const data = await createLeadForSuperAdmin(payload);
      toast.success("Lead created");
      setShowAddModal(false);
      setAddForm({
        restaurantName: "",
        restaurantPhone: "",
        restaurantEmail: "",
        googleMapsUrl: "",
        googleMapsPlaceId: "",
        ownerName: "",
        ownerPhone: "",
        ownerEmail: "",
        optedIn: false,
        status: "new",
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

  // Generic PATCH used by every inline-edit field in the drawer. Each
  // field auto-saves itself on blur; failures throw so the field can
  // revert its displayed value and surface a toast.
  async function patchLead(body) {
    if (!selectedLead) throw new Error("No lead selected");
    const data = await updateLeadForSuperAdmin(selectedLead.id, body);
    upsertLead(data.lead);
    loadStats();
    return data.lead;
  }

  async function saveRestaurantName(next) {
    await patchLead({
      restaurantName: next,
      name: (selectedLead.ownerName || next).trim(),
    });
  }

  async function saveOwnerName(next) {
    await patchLead({
      ownerName: next,
      name: (next || selectedLead.restaurantName).trim(),
    });
  }

  async function saveRestaurantPhone(next) {
    const resolved = (next || selectedLead.ownerPhone || "").trim();
    if (!resolved) throw new Error("Phone is required");
    await patchLead({ restaurantPhone: next, phone: resolved });
  }

  async function saveOwnerPhone(next) {
    const resolved = (selectedLead.restaurantPhone || next || "").trim();
    if (!resolved) throw new Error("Phone is required");
    await patchLead({ ownerPhone: next, phone: resolved });
  }

  async function saveRestaurantEmail(next) {
    const resolved = (next || selectedLead.ownerEmail || "")
      .trim()
      .toLowerCase();
    await patchLead({ restaurantEmail: next, email: resolved });
  }

  async function saveOwnerEmail(next) {
    const resolved = (selectedLead.restaurantEmail || next || "")
      .trim()
      .toLowerCase();
    await patchLead({ ownerEmail: next, email: resolved });
  }

  async function saveCity(next) {
    await patchLead({ city: next });
  }

  async function saveGoogleMapsUrl(next) {
    await patchLead({ googleMapsUrl: next });
  }

  async function saveValue(next) {
    const n = next ? Number(next) : 0;
    if (Number.isNaN(n) || n < 0) throw new Error("Enter a valid amount");
    await patchLead({ value: n });
  }

  async function saveFollowUp(next) {
    await patchLead({ nextFollowUpAt: next || null });
  }

  async function saveOptedIn(checked) {
    try {
      await patchLead({ optedIn: checked });
    } catch (err) {
      toast.error(err.message || "Failed to update opt-in");
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!selectedLead || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const data = await addLeadNoteForSuperAdmin(
        selectedLead.id,
        noteText.trim(),
      );
      upsertLead(data.lead);
      setNoteText("");
      toast.success("Note added");
    } catch (err) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleSendEmail(e) {
    e.preventDefault();
    if (!selectedLead || !emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    try {
      const data = await sendLeadEmailForSuperAdmin(selectedLead.id, {
        subject: emailSubject.trim(),
        body: emailBody.trim(),
      });
      upsertLead(data.lead);
      setEmailComposerOpen(false);
      setEmailSubject("");
      setEmailBody("");
      toast.success(`Email sent to ${data.to}`);
    } catch (err) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  }

  async function handleReassign(assigneeId) {
    if (!selectedLead || !canViewAll) return;
    try {
      const value = assigneeId === "unassigned" ? null : assigneeId;
      const data = await updateLeadForSuperAdmin(selectedLead.id, {
        assignedTo: value,
      });
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
      setRestaurants(Array.isArray(data) ? data : (data?.restaurants ?? []));
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
      const data = await convertLeadForSuperAdmin(
        selectedLead.id,
        restaurantId,
      );
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

  function handleCreateRestaurantFromLead(lead) {
    if (!lead?.id || !canConvert) return;
    const query = {
      fromLead: "1",
      leadId: lead.id,
      restaurantName: lead.restaurantName || "",
      restaurantPhone: lead.restaurantPhone || lead.phone || "",
      restaurantEmail:
        lead.restaurantEmail || lead.ownerEmail || lead.email || "",
      ownerName: lead.ownerName || lead.name || "",
      ownerPhone: lead.ownerPhone || lead.phone || "",
      ownerEmail: lead.ownerEmail || lead.restaurantEmail || lead.email || "",
      city: lead.city || "",
    };
    router.push({ pathname: "/super/restaurants", query });
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
    () =>
      leads.some(
        (l) =>
          (l.email || "").trim() ||
          (l.ownerEmail || "").trim() ||
          (l.restaurantEmail || "").trim(),
      ),
    [leads],
  );
  const showCityColumn = useMemo(
    () => leads.some((l) => (l.city || "").trim()),
    [leads],
  );
  const selectedQuickPhone = selectedLead ? primaryLeadPhone(selectedLead) : "";
  const selectedLeadEmail = selectedLead ? primaryLeadEmail(selectedLead) : "";

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
                <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                  {lead.name}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "phone",
        header: "Phone",
        render: (_, lead) => primaryLeadPhone(lead) || "—",
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
                isOverdue(lead)
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-600 dark:text-neutral-300"
              }`}
            >
              {isOverdue(lead) ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
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
        render: (_, lead) =>
          SOURCE_LABELS[lead.source] || formatLabel(lead.source),
        cellClassName: "text-gray-600 dark:text-neutral-400",
      },
    );

    if (showEmailColumn) {
      cols.push({
        key: "email",
        header: "Email",
        render: (_, lead) =>
          primaryLeadEmail(lead) ? (
            <span className="text-gray-700 dark:text-neutral-300 truncate max-w-[180px] inline-block">
              {primaryLeadEmail(lead)}
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
            <span className="text-gray-700 dark:text-neutral-300">
              {lead.city}
            </span>
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
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${m.accent}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-500 truncate">
                        {m.label}
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                        {m.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                        {m.sub}
                      </p>
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
                  const colValue = items.reduce(
                    (s, l) => s + (l.value || 0),
                    0,
                  );
                  return (
                    <div
                      key={stage.key}
                      onDragOver={(e) => {
                        if (!draggingLead) return;
                        e.preventDefault();
                        setDragOverStage(stage.key);
                      }}
                      onDragLeave={() =>
                        setDragOverStage((s) => (s === stage.key ? null : s))
                      }
                      onDrop={() => handleDrop(stage.key)}
                      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-gray-50/60 dark:bg-neutral-900/40 ${
                        dragOverStage === stage.key
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-gray-200 dark:border-neutral-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200 dark:border-neutral-800">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-2 w-2 rounded-full ${stage.dot}`}
                          />
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
                                  canManage
                                    ? "cursor-grab active:cursor-grabbing"
                                    : "cursor-pointer"
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
                                  {primaryLeadPhone(lead) && (
                                    <span className="inline-flex items-center gap-1 truncate">
                                      <Phone className="w-3 h-3 shrink-0" />
                                      {primaryLeadPhone(lead)}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-neutral-300">
                                    {SOURCE_LABELS[lead.source] ||
                                      formatLabel(lead.source)}
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
              {/* Sticky header */}
              <div className="shrink-0 border-b border-gray-100 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                      {leadInitials(selectedLead)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate">
                        {displayRestaurantName(selectedLead)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400 truncate">
                        Added by{" "}
                        <span className="font-medium text-gray-700 dark:text-neutral-300">
                          {displayAddedBy(selectedLead)}
                        </span>
                        {selectedLead.createdAt ? (
                          <>
                            {" "}
                            on{" "}
                            <span className="font-medium text-gray-700 dark:text-neutral-300">
                              {formatDateTime(selectedLead.createdAt)}
                            </span>
                          </>
                        ) : null}
                      </p>
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

                <div className="flex items-center gap-2 px-4 pb-2.5 overflow-x-auto">
                  {canConvert &&
                    (selectedLead.convertedRestaurant ? (
                      <Link
                        href={`/super/restaurants/${selectedLead.convertedRestaurant}`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {selectedLead.convertedRestaurantName || "Linked"}
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleCreateRestaurantFromLead(selectedLead)
                          }
                          className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                        >
                          Create restaurant
                        </button>
                        <button
                          type="button"
                          onClick={openConvertModal}
                          className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                        >
                          Link existing
                        </button>
                      </>
                    ))}
                  <StageControl
                    lead={selectedLead}
                    editable={canManage}
                    saving={stageSaving}
                    onChange={(next) => applyStatusChange(selectedLead, next)}
                  />
                  {canViewAll && (
                    <AssignedToControl
                      lead={selectedLead}
                      teamMembers={teamMembers}
                      editable={canManage}
                      onChange={handleReassign}
                    />
                  )}
                </div>
                {selectedLead.status === "lost" && selectedLead.lostReason && (
                  <p className="px-4 pb-2.5 text-xs text-red-600 dark:text-red-400">
                    Lost reason: {selectedLead.lostReason}
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {/* Contact */}
                  <section className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/30">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      Restaurant
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="col-span-2">
                        <FieldRow label="Name">
                          <InlineEditField
                            value={selectedLead.restaurantName || ""}
                            editable={canManage}
                            placeholder="Restaurant name"
                            emptyLabel="Add restaurant name"
                            onSave={saveRestaurantName}
                          />
                        </FieldRow>
                      </div>
                      <FieldRow label="Phone">
                        <InlineEditField
                          value={selectedLead.restaurantPhone || ""}
                          type="tel"
                          editable={canManage}
                          placeholder="Restaurant phone"
                          emptyLabel="Add phone"
                          onSave={saveRestaurantPhone}
                          actions={
                            selectedQuickPhone ? (
                              <>
                                <a
                                  href={`tel:${selectedQuickPhone}`}
                                  className="shrink-0 text-gray-400 hover:text-primary"
                                  aria-label="Call"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`https://wa.me/${selectedQuickPhone.replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-gray-400 hover:text-primary"
                                  aria-label="WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              </>
                            ) : null
                          }
                        />
                      </FieldRow>
                      <FieldRow label="Email">
                        <InlineEditField
                          value={selectedLead.restaurantEmail || ""}
                          type="email"
                          editable={canManage}
                          placeholder="Restaurant email"
                          emptyLabel="Add email"
                          onSave={saveRestaurantEmail}
                          actions={
                            canManage && selectedLeadEmail ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setEmailComposerOpen((open) => !open)
                                }
                                className="shrink-0 text-gray-400 hover:text-primary"
                                aria-label="Send email"
                                title="Send email"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            ) : null
                          }
                        />
                      </FieldRow>
                      {emailComposerOpen && canManage && selectedLeadEmail && (
                        <form
                          onSubmit={handleSendEmail}
                          className="col-span-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2 dark:border-neutral-700 dark:bg-neutral-900/50"
                        >
                          <p className="text-xs text-gray-500 dark:text-neutral-400">
                            To: {selectedLeadEmail}
                          </p>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Subject"
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <textarea
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            rows={4}
                            placeholder="Write your message..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEmailComposerOpen(false);
                                setEmailSubject("");
                                setEmailBody("");
                              }}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={
                                emailSending ||
                                !emailSubject.trim() ||
                                !emailBody.trim()
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                            >
                              {emailSending ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  Send
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      )}
                      <FieldRow label="City">
                        <InlineEditField
                          value={selectedLead.city || ""}
                          editable={canManage}
                          placeholder="City"
                          emptyLabel="Add city"
                          onSave={saveCity}
                        />
                      </FieldRow>
                      <FieldRow label="Google Maps URL">
                        <InlineEditField
                          value={selectedLead.googleMapsUrl || ""}
                          type="url"
                          editable={canManage}
                          placeholder="Google Maps URL"
                          emptyLabel="Add link"
                          onSave={saveGoogleMapsUrl}
                        />
                      </FieldRow>
                    </div>

                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-900/40">
                      <p className="text-xs font-medium text-gray-700 dark:text-neutral-300 flex items-center gap-1.5 mb-2.5">
                        <UserPlus className="w-3.5 h-3.5 text-gray-400" />
                        Owner (optional)
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <FieldRow label="Name">
                          <InlineEditField
                            value={selectedLead.ownerName || ""}
                            editable={canManage}
                            placeholder="Owner name"
                            emptyLabel="Add owner name"
                            onSave={saveOwnerName}
                          />
                        </FieldRow>
                        <FieldRow label="Phone">
                          <InlineEditField
                            value={selectedLead.ownerPhone || ""}
                            type="tel"
                            editable={canManage}
                            placeholder="Owner phone"
                            emptyLabel="Add phone"
                            onSave={saveOwnerPhone}
                          />
                        </FieldRow>
                        <div className="col-span-2">
                          <FieldRow label="Email">
                            <InlineEditField
                              value={selectedLead.ownerEmail || ""}
                              type="email"
                              editable={canManage}
                              placeholder="Owner email"
                              emptyLabel="Add email"
                              onSave={saveOwnerEmail}
                            />
                          </FieldRow>
                        </div>
                        <label className="col-span-2 inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={selectedLead.optedIn === true}
                            disabled={!canManage}
                            onChange={(e) => saveOptedIn(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                          />
                          Marketing opt-in consent
                        </label>
                      </div>
                    </div>
                  </section>

                  {/* Deal */}
                  <section className="rounded-xl border border-gray-200 bg-white p-3 space-y-2.5 dark:border-neutral-800 dark:bg-neutral-900/30">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Deal
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldRow label={`Est. value (${CURRENCY})`}>
                        <InlineEditField
                          value={
                            selectedLead.value ? String(selectedLead.value) : ""
                          }
                          type="number"
                          editable={canManage}
                          placeholder="0"
                          emptyLabel="—"
                          onSave={saveValue}
                        />
                      </FieldRow>
                      <FieldRow label="Next follow-up">
                        <InlineEditField
                          value={toDateInput(selectedLead.nextFollowUpAt)}
                          type="date"
                          editable={canManage}
                          emptyLabel="—"
                          valueClassName={`text-sm ${
                            isOverdue(selectedLead)
                              ? "text-red-600 dark:text-red-400 font-medium"
                              : "text-gray-900 dark:text-neutral-100"
                          }`}
                          onSave={saveFollowUp}
                        />
                      </FieldRow>
                    </div>
                    <p className="pt-1.5 text-xs text-gray-500 dark:text-neutral-400 border-t border-gray-100 dark:border-neutral-800">
                      Source:{" "}
                      <span className="text-gray-800 dark:text-neutral-200">
                        {SOURCE_LABELS[selectedLead.source] ||
                          formatLabel(selectedLead.source)}
                      </span>
                    </p>
                  </section>

                  {/* Activity & notes */}
                  <section className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/30">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                      Activity & notes
                    </p>
                    <ul className="space-y-2.5 max-h-56 overflow-y-auto">
                      {(selectedLead.activity || []).length === 0 ? (
                        <li className="text-sm text-gray-500 dark:text-neutral-400">
                          No activity yet.
                        </li>
                      ) : (
                        selectedLead.activity.map((entry) => {
                          const meta = ACTIVITY_META[entry.type] || {
                            label: entry.type,
                            icon: MessageSquare,
                          };
                          const ActivityIcon = meta.icon;
                          const authorLabel = entry.authorName || "System";
                          const initials =
                            authorLabel
                              .trim()
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0].toUpperCase())
                              .join("") || "?";
                          return (
                            <li
                              key={
                                entry.id || `${entry.type}-${entry.createdAt}`
                              }
                              className="flex gap-2.5"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {entry.type === "email_sent" ? (
                                  <ActivityIcon className="w-4 h-4" />
                                ) : (
                                  initials
                                )}
                              </span>
                              <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-gray-50 px-3 py-2 dark:bg-neutral-900/80">
                                <div className="flex items-baseline justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                                      {authorLabel}
                                    </span>
                                    <span className="ml-1.5 text-xs text-gray-500 dark:text-neutral-400">
                                      {meta.label}
                                    </span>
                                  </div>
                                  <span className="shrink-0 text-xs text-gray-400">
                                    {formatDateTime(entry.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-700 dark:text-neutral-300 break-words">
                                  {activitySummary(entry)}
                                </p>
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>

                    {canManage && (
                      <form
                        onSubmit={handleAddNote}
                        className="space-y-2 pt-2 border-t border-gray-100 dark:border-neutral-800"
                      >
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          rows={3}
                          placeholder="Write a note..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={noteSaving || !noteText.trim()}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
                          >
                            {noteSaving ? "Saving..." : "Post comment"}
                          </button>
                        </div>
                      </form>
                    )}
                  </section>

                  {canDelete &&
                    isLeadAssignee(selectedLead, currentUserId) && (
                    <div className="pt-2 border-t border-gray-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(selectedLead)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete lead
                      </button>
                    </div>
                  )}
                </div>
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
            <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Add lead
              </h2>
              <form onSubmit={handleAddLead} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="space-y-4 lg:col-span-7">
                    <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/40 p-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Restaurant lead
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400">
                          Capture essentials first: restaurant name, phone, and
                          city.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                          Stage
                        </label>
                        <div className="inline-flex w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1">
                          <button
                            type="button"
                            onClick={() =>
                              setAddForm((f) => ({ ...f, status: "prospect" }))
                            }
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                              addForm.status === "prospect"
                                ? "bg-primary text-white"
                                : "text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            }`}
                          >
                            Prospect
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAddForm((f) => ({ ...f, status: "new" }))
                            }
                            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                              addForm.status === "new"
                                ? "bg-primary text-white"
                                : "text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                            }`}
                          >
                            New
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                          Restaurant name
                        </label>
                        <input
                          type="text"
                          placeholder="Restaurant name"
                          value={addForm.restaurantName}
                          onChange={(e) =>
                            setAddForm((f) => ({
                              ...f,
                              restaurantName: e.target.value,
                            }))
                          }
                          className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Restaurant phone
                          </label>
                          <input
                            type="tel"
                            placeholder="Restaurant phone"
                            value={addForm.restaurantPhone}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                restaurantPhone: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            City
                          </label>
                          <input
                            type="text"
                            placeholder="City"
                            value={addForm.city}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                city: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Restaurant email
                          </label>
                          <input
                            type="email"
                            placeholder="Restaurant email"
                            value={addForm.restaurantEmail}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                restaurantEmail: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Google Maps URL
                          </label>
                          <input
                            type="url"
                            placeholder="Google Maps URL"
                            value={addForm.googleMapsUrl}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                googleMapsUrl: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-gray-50/40 dark:bg-neutral-900/30 p-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-600 dark:text-neutral-300">
                          Owner (optional)
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-500">
                          Add this if available, otherwise continue.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                          Owner name
                        </label>
                        <input
                          type="text"
                          placeholder="Owner name"
                          value={addForm.ownerName}
                          onChange={(e) =>
                            setAddForm((f) => ({
                              ...f,
                              ownerName: e.target.value,
                            }))
                          }
                          className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Owner phone
                          </label>
                          <input
                            type="tel"
                            placeholder="Owner phone"
                            value={addForm.ownerPhone}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                ownerPhone: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Owner email
                          </label>
                          <input
                            type="email"
                            placeholder="Owner email"
                            value={addForm.ownerEmail}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                ownerEmail: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>

                      <label className="inline-flex items-start gap-2.5 text-xs font-medium text-gray-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={addForm.optedIn}
                          onChange={(e) =>
                            setAddForm((f) => ({
                              ...f,
                              optedIn: e.target.checked,
                            }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span>Contact has marketing opt-in consent</span>
                      </label>
                    </section>
                  </div>

                  <div className="space-y-4 lg:col-span-5">
                    <section className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-3 h-full">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Details
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400">
                          Opportunity metadata and assignment.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Est. value ({CURRENCY})
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder={`Est. value (${CURRENCY})`}
                            value={addForm.value}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                value: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Follow-up date
                          </label>
                          <input
                            type="date"
                            value={addForm.nextFollowUpAt}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                nextFollowUpAt: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                          Source
                        </label>
                        <select
                          value={addForm.source}
                          onChange={(e) =>
                            setAddForm((f) => ({
                              ...f,
                              source: e.target.value,
                            }))
                          }
                          className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          {SOURCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {canViewAll && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                            Assignee
                          </label>
                          <select
                            value={addForm.assignedTo}
                            onChange={(e) =>
                              setAddForm((f) => ({
                                ...f,
                                assignedTo: e.target.value,
                              }))
                            }
                            className="h-10 w-full px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          >
                            {teamMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name || m.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                          Initial note
                        </label>
                        <textarea
                          placeholder="Initial note (optional)"
                          value={addForm.note}
                          onChange={(e) =>
                            setAddForm((f) => ({ ...f, note: e.target.value }))
                          }
                          rows={5}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </section>
                  </div>
                </div>

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
              <div
                className={`p-5 space-y-4 overflow-y-auto text-sm ${importing ? "opacity-60 pointer-events-none" : ""}`}
              >
                <p className="text-gray-600 dark:text-neutral-400 text-xs leading-relaxed">
                  Required column:{" "}
                  <code className="bg-gray-100 dark:bg-neutral-800 px-1 rounded">
                    phone
                  </code>
                  . Optional: restaurant_name, restaurant_phone,
                  restaurant_email, owner_name, owner_phone, owner_email,
                  google_maps_url, google_maps_place_id, opted_in, name, email,
                  city, source, value, follow_up, note, status
                  {canViewAll ? ", assigned_to (team member email)" : ""}. Leads
                  are assigned to you
                  {canViewAll ? " unless assigned_to is set" : ""}.
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
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Attached file
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {importFile.name}
                      </p>
                    </div>
                  </div>
                )}
                {importPreview?.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {importPreview.error}
                  </p>
                )}
                {importPreview?.rowErrors?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 max-h-28 overflow-y-auto">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
                      Skipped rows
                    </p>
                    <ul className="text-[11px] text-amber-900 dark:text-amber-100 space-y-0.5">
                      {importPreview.rowErrors.map((e, idx) => (
                        <li key={idx}>
                          Line {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {importPreview?.importFailed?.length > 0 && (
                  <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 max-h-28 overflow-y-auto">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">
                      Server rejected rows
                    </p>
                    <ul className="text-[11px] text-red-900 dark:text-red-100 space-y-0.5">
                      {importPreview.importFailed.map((e, idx) => (
                        <li key={idx}>
                          Row {e.row}
                          {e.phone ? ` (${e.phone})` : ""}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {importPreview?.rows?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Ready to import: {importPreview.rows.length} lead
                      {importPreview.rows.length !== 1 ? "s" : ""}
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
                      <table className="min-w-full text-[11px]">
                        <thead className="bg-gray-50 dark:bg-neutral-900">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">
                              Restaurant
                            </th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">
                              Phone
                            </th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">
                              City
                            </th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-500">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.rows.slice(0, 5).map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-t border-gray-100 dark:border-neutral-800"
                            >
                              <td className="px-2 py-1.5">
                                {row.restaurantName || "—"}
                              </td>
                              <td className="px-2 py-1.5 font-mono">
                                {row.phone ||
                                  row.restaurantPhone ||
                                  row.ownerPhone ||
                                  "—"}
                              </td>
                              <td className="px-2 py-1.5">{row.city || "—"}</td>
                              <td className="px-2 py-1.5">
                                {row.status || "prospect"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importPreview.rows.length > 5 && (
                        <p className="px-2 py-1.5 text-[10px] text-gray-400 border-t border-gray-100 dark:border-neutral-800">
                          + {importPreview.rows.length - 5} more row
                          {importPreview.rows.length - 5 !== 1 ? "s" : ""}
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Mark as lost
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                Optional: why was this lead lost?
              </p>
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Link restaurant
              </h2>
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
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No restaurants found
                  </p>
                ) : (
                  filteredRestaurants.map((r) => {
                    const id = r.id || r._id;
                    const label =
                      r.website?.name || r.name || r.website?.subdomain || id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={convertSaving}
                        onClick={() => handleConvert(id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 text-sm disabled:opacity-50"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">
                          {label}
                        </span>
                        {r.website?.subdomain && (
                          <span className="ml-2 text-xs text-gray-400">
                            {r.website.subdomain}.eatsdesk.app
                          </span>
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Delete lead?
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Remove <strong>{displayRestaurantName(deleteConfirm)}</strong>{" "}
                from the pipeline?
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
