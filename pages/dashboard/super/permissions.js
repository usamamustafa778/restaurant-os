import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePlatformPermissionGate } from "../../../hooks/usePlatformPermissionGate";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import {
  getPermissionsForSuperAdmin,
  createPermissionForSuperAdmin,
  updatePermissionForSuperAdmin,
  deletePermissionForSuperAdmin,
  bulkUpdatePermissionSubgroupForSuperAdmin,
  applyCatalogSubgroupsForSuperAdmin,
} from "../../../lib/apiClient";
import { partitionBySubgroup } from "../../../lib/permissionGroups";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  List,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "../../../contexts/ConfirmDialogContext";
import { usePermissions } from "../../../contexts/PermissionContext";

const SCOPE_TABS = [
  { id: "", label: "All" },
  { id: "tenant", label: "Tenant" },
  { id: "platform", label: "Platform" },
];

const VIEW_MODES = [
  { id: "list", label: "List", icon: List },
  { id: "organize", label: "Organize", icon: FolderTree },
];

/** Suggested subgroup names when creating / bulk-assigning (by group). */
const SUGGESTED_SUBGROUPS = {
  POS: ["Access", "Orders", "Edit Order", "Status", "Money", "Session", "Print", "Legacy"],
  Accounts: ["View", "Manage"],
  Inventory: ["View", "Manage"],
  Staff: ["View", "Manage"],
  Menu: ["View", "Manage"],
  Reports: ["View", "Export"],
  Customers: ["View", "Manage"],
  Settings: ["View", "Manage"],
  Session: ["View", "Manage"],
  Tables: ["View", "Manage"],
  Reservations: ["View", "Manage"],
  WhatsApp: ["Config", "Conversations", "View", "Manage"],
  Branches: ["View", "Manage", "Delete"],
  Subscription: ["View", "Manage"],
  Integrations: ["View", "Manage"],
  Rider: ["View", "Manage"],
  Restaurants: ["View", "Manage", "Delete"],
  Billing: ["View", "Manage", "Delete"],
  Leads: ["View", "Manage", "Delete"],
  "Platform Users": ["View", "Manage", "Delete"],
  "Platform RBAC": ["View", "Manage"],
  "Platform Settings": ["View", "Manage"],
  "Platform · System": ["Staff", "Audit", "RBAC", "Settings", "Access"],
  "Platform · Operations": [
    "Overview",
    "Restaurants",
    "Customers",
    "WhatsApp",
    "Blog",
    "SEO",
  ],
  "Platform · Commercial": ["Subscriptions", "Invoices", "Payments"],
  "Platform · Pipeline": ["View", "Manage", "Delete"],
};

const EMPTY_FORM = {
  key: "",
  name: "",
  description: "",
  group: "",
  subgroup: "",
  scope: "tenant",
};

function ComboboxField({
  label,
  required,
  value,
  onChange,
  options,
  placeholder,
  hint,
  allowClear,
}) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, value]);

  const showCreate =
    value.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === value.trim().toLowerCase());

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium mb-1">
        {label}
        {hint ? (
          <span className="font-normal text-neutral-500"> {hint}</span>
        ) : null}
      </label>
      <input
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
      />
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-lg">
          {allowClear && value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              Clear
            </button>
          ) : null}
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              {opt}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/5 border-t border-gray-100 dark:border-neutral-800"
            >
              + Use &ldquo;{value.trim()}&rdquo;
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <div className="px-3 py-2 text-sm text-neutral-500">
              No matches
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SuperPermissionsPage() {
  const { hasAccess } = usePlatformPermissionGate("platform.permissions.view");
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("platform.permissions.manage");
  const { confirm } = useConfirmDialog();

  const [scopeFilter, setScopeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSubgroup, setBulkSubgroup] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [applyingCatalog, setApplyingCatalog] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [groupInput, setGroupInput] = useState("");
  const [subgroupInput, setSubgroupInput] = useState("");

  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedSubgroups, setExpandedSubgroups] = useState({});

  const groups = useMemo(() => {
    const seen = new Set();
    permissions.forEach((p) => {
      if (p.group) seen.add(p.group);
    });
    return Array.from(seen).sort();
  }, [permissions]);

  const subgroups = useMemo(() => {
    const seen = new Set();
    permissions.forEach((p) => {
      if (p.subgroup) seen.add(p.subgroup);
    });
    return Array.from(seen).sort();
  }, [permissions]);

  const missingSubgroupCount = useMemo(
    () => permissions.filter((p) => !String(p.subgroup || "").trim()).length,
    [permissions],
  );

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPermissionsForSuperAdmin({
        scope: scopeFilter || undefined,
      });
      setPermissions(Array.isArray(data) ? data : []);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err.message || "Failed to load permissions");
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  useEffect(() => {
    if (!hasAccess) return;
    loadPermissions();
  }, [loadPermissions, hasAccess]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return permissions.filter((p) => {
      if (groupFilter && p.group !== groupFilter) return false;
      if (!q) return true;
      return (
        (p.key || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.group || "").toLowerCase().includes(q) ||
        (p.subgroup || "").toLowerCase().includes(q)
      );
    });
  }, [permissions, searchQuery, groupFilter]);

  const organized = useMemo(() => {
    const byGroup = {};
    for (const p of filtered) {
      const g = p.group || "Ungrouped";
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(p);
    }
    return Object.keys(byGroup)
      .sort()
      .map((group) => ({
        group,
        ...partitionBySubgroup(byGroup[group]),
        items: byGroup[group],
      }));
  }, [filtered]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const selectedCount = selectedIds.size;

  const bulkSuggestionGroup = useMemo(() => {
    if (!selectedCount) return groupFilter || "";
    const selected = permissions.filter((p) => selectedIds.has(p.id));
    const g = selected[0]?.group || "";
    return selected.every((p) => p.group === g) ? g : groupFilter || "";
  }, [permissions, selectedIds, selectedCount, groupFilter]);

  const suggestionChips = useMemo(() => {
    const fromGroup = SUGGESTED_SUBGROUPS[bulkSuggestionGroup] || [];
    const merged = new Set([...fromGroup, ...subgroups]);
    return Array.from(merged);
  }, [bulkSuggestionGroup, subgroups]);

  const formSuggestionChips = useMemo(() => {
    const g = groupInput.trim();
    const fromGroup = SUGGESTED_SUBGROUPS[g] || [];
    const merged = new Set([...fromGroup, ...subgroups]);
    return Array.from(merged);
  }, [groupInput, subgroups]);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      scope: scopeFilter === "platform" ? "platform" : "tenant",
      group: groupFilter || "",
    });
    setGroupInput(groupFilter || "");
    setSubgroupInput("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      key: row.key,
      name: row.name,
      description: row.description || "",
      group: row.group,
      subgroup: row.subgroup || "",
      scope: row.scope,
    });
    setGroupInput(row.group || "");
    setSubgroupInput(row.subgroup || "");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const group = groupInput.trim();
    if (!group) {
      toast.error("Group is required");
      return;
    }
    const subgroup = subgroupInput.trim();
    setSaving(true);
    try {
      if (editing) {
        await updatePermissionForSuperAdmin(editing.id, {
          name: form.name,
          description: form.description,
          group,
          subgroup,
          scope: form.scope,
        });
        toast.success("Permission updated");
      } else {
        await createPermissionForSuperAdmin({
          ...form,
          group,
          subgroup,
        });
        toast.success("Permission created");
      }
      setModalOpen(false);
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(row) {
    const ok = await confirm({
      title: "Deactivate permission?",
      message: `Deactivate "${row.key}"? Roles keeping this key will stop matching it at enforcement.`,
      confirmLabel: "Deactivate",
    });
    if (!ok) return;
    try {
      await deletePermissionForSuperAdmin(row.id);
      toast.success("Permission deactivated");
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Deactivate failed");
    }
  }

  async function handleInlineSubgroup(row, subgroup) {
    if (!canManage) return;
    try {
      await updatePermissionForSuperAdmin(row.id, { subgroup });
      setPermissions((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, subgroup } : p)),
      );
      toast.success(
        subgroup
          ? `Moved to “${subgroup}”`
          : "Subgroup cleared",
      );
    } catch (err) {
      toast.error(err.message || "Update failed");
    }
  }

  function openBulkModal() {
    if (!selectedCount) {
      toast.error("Select permissions first");
      return;
    }
    setBulkSubgroup("");
    setBulkModalOpen(true);
  }

  async function handleBulkAssign(e) {
    e.preventDefault();
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkSaving(true);
    try {
      const result = await bulkUpdatePermissionSubgroupForSuperAdmin({
        ids,
        subgroup: bulkSubgroup.trim(),
      });
      toast.success(
        bulkSubgroup.trim()
          ? `Assigned “${bulkSubgroup.trim()}” to ${result.modified ?? ids.length} permission(s)`
          : `Cleared subgroup on ${result.modified ?? ids.length} permission(s)`,
      );
      setBulkModalOpen(false);
      setSelectedIds(new Set());
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Bulk update failed");
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleApplyCatalog() {
    const ok = await confirm({
      title: "Apply catalog subgroups?",
      message:
        "This creates any missing catalog keys and sets group/subgroup labels from the built-in catalog. It does not change role assignments.",
      confirmLabel: "Apply catalog",
    });
    if (!ok) return;
    setApplyingCatalog(true);
    try {
      const result = await applyCatalogSubgroupsForSuperAdmin();
      const created = result.upserted ?? 0;
      toast.success(
        created
          ? `Updated ${result.modified ?? 0}, created ${created} permission(s)`
          : `Updated ${result.modified ?? 0} permission(s) from catalog`,
      );
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Apply failed");
    } finally {
      setApplyingCatalog(false);
    }
  }

  function expandAllOrganize() {
    const nextGroups = {};
    const nextSubs = {};
    for (const block of organized) {
      nextGroups[block.group] = true;
      for (const sg of block.subgroups) {
        nextSubs[`${block.group}::${sg.name}`] = true;
      }
      if (block.ungrouped.length) {
        nextSubs[`${block.group}::__none`] = true;
      }
    }
    setExpandedGroups(nextGroups);
    setExpandedSubgroups(nextSubs);
  }

  return (
    <AdminLayout
      title="Permissions"
      subtitle="Organize catalog keys into groups and subgroups for the roles editor."
    >
      <SuperPageGate permission="platform.permissions.view">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 p-0.5 bg-white dark:bg-neutral-900">
              {SCOPE_TABS.map((tab) => (
                <button
                  key={tab.id || "all"}
                  type="button"
                  onClick={() => setScopeFilter(tab.id)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    scopeFilter === tab.id
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 p-0.5 bg-white dark:bg-neutral-900">
              {VIEW_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setViewMode(mode.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      viewMode === mode.id
                        ? "bg-primary text-white"
                        : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search key, name, group, subgroup…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
              />
            </div>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm min-w-[140px]"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <span className="text-xs text-neutral-500">
              {filtered.length} shown
              {missingSubgroupCount > 0
                ? ` · ${missingSubgroupCount} without subgroup`
                : ""}
            </span>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {canManage && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleApplyCatalog}
                    disabled={applyingCatalog || loading}
                    className="inline-flex items-center gap-1.5 py-2.5"
                  >
                    {applyingCatalog ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Apply catalog subgroups
                  </Button>
                  <Button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-1.5 py-2.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add permission
                  </Button>
                </>
              )}
            </div>
          </div>

          {canManage && selectedCount > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10">
              <Layers className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium">
                {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={openBulkModal}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Assign subgroup…
              </button>
              <button
                type="button"
                onClick={async () => {
                  setBulkSaving(true);
                  try {
                    await bulkUpdatePermissionSubgroupForSuperAdmin({
                      ids: [...selectedIds],
                      subgroup: "",
                    });
                    toast.success("Cleared subgroup on selected");
                    setSelectedIds(new Set());
                    loadPermissions();
                  } catch (err) {
                    toast.error(err.message || "Clear failed");
                  } finally {
                    setBulkSaving(false);
                  }
                }}
                disabled={bulkSaving}
                className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:underline"
              >
                Clear subgroup
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-neutral-500 hover:underline ml-auto"
              >
                Clear selection
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8 text-center">
              No permissions found. Run the seed script when the database is
              reachable.
            </p>
          ) : viewMode === "list" ? (
            <DataTable
              getRowId={(r) => r.id}
              columns={[
                ...(canManage
                  ? [
                      {
                        key: "_select",
                        header: (
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAllFiltered}
                            aria-label="Select all visible"
                            className="rounded border-gray-300"
                          />
                        ),
                        render: (_, r) => (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                            aria-label={`Select ${r.key}`}
                            className="rounded border-gray-300"
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  key: "key",
                  header: "Key",
                  render: (_, r) => <code className="text-xs">{r.key}</code>,
                },
                { key: "name", header: "Name" },
                { key: "group", header: "Group" },
                {
                  key: "subgroup",
                  header: "Subgroup",
                  render: (_, r) =>
                    canManage ? (
                      <select
                        value={r.subgroup || ""}
                        onChange={(e) =>
                          handleInlineSubgroup(r, e.target.value)
                        }
                        className="max-w-[160px] px-2 py-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs"
                        aria-label={`Subgroup for ${r.key}`}
                      >
                        <option value="">— None —</option>
                        {(SUGGESTED_SUBGROUPS[r.group] || [])
                          .concat(
                            subgroups.filter(
                              (s) =>
                                !(SUGGESTED_SUBGROUPS[r.group] || []).includes(
                                  s,
                                ),
                            ),
                          )
                          .filter(
                            (s, i, arr) => arr.indexOf(s) === i,
                          )
                          .map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        {r.subgroup &&
                        !(SUGGESTED_SUBGROUPS[r.group] || []).includes(
                          r.subgroup,
                        ) &&
                        !subgroups.includes(r.subgroup) ? (
                          <option value={r.subgroup}>{r.subgroup}</option>
                        ) : null}
                      </select>
                    ) : (
                      r.subgroup || "—"
                    ),
                },
                {
                  key: "scope",
                  header: "Scope",
                  render: (_, r) => (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        r.scope === "platform"
                          ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
                          : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                      }`}
                    >
                      {r.scope}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (_, r) =>
                    canManage ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(r)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Deactivate
                        </button>
                      </div>
                    ) : null,
                },
              ]}
              data={filtered}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={expandAllOrganize}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Expand all
                </button>
              </div>
              {organized.map((block) => {
                const groupExpanded = expandedGroups[block.group] === true;
                const noneKey = `${block.group}::__none`;
                return (
                  <div
                    key={block.group}
                    className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [block.group]: !groupExpanded,
                        }))
                      }
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-neutral-900"
                    >
                      {groupExpanded ? (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      )}
                      <span className="text-sm font-semibold">
                        {block.group}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {block.items.length} permission
                        {block.items.length === 1 ? "" : "s"}
                        {block.ungrouped.length
                          ? ` · ${block.ungrouped.length} unassigned`
                          : ""}
                      </span>
                      {canManage && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            const ids = block.items.map((p) => p.id);
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              const allIn = ids.every((id) => next.has(id));
                              if (allIn) ids.forEach((id) => next.delete(id));
                              else ids.forEach((id) => next.add(id));
                              return next;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              const ids = block.items.map((p) => p.id);
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                const allIn = ids.every((id) => next.has(id));
                                if (allIn) ids.forEach((id) => next.delete(id));
                                else ids.forEach((id) => next.add(id));
                                return next;
                              });
                            }
                          }}
                          className="ml-auto text-xs font-medium text-primary hover:underline"
                        >
                          Select group
                        </span>
                      )}
                    </button>

                    {groupExpanded && (
                      <div className="border-t border-gray-100 dark:border-neutral-800 px-3 pb-3 space-y-2 pt-2">
                        {block.ungrouped.length > 0 && (
                          <OrganizeSubgroupPanel
                            title="Unassigned"
                            expandKey={noneKey}
                            expanded={expandedSubgroups[noneKey] === true}
                            onToggle={() =>
                              setExpandedSubgroups((prev) => ({
                                ...prev,
                                [noneKey]: !prev[noneKey],
                              }))
                            }
                            items={block.ungrouped}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            canManage={canManage}
                            onEdit={openEdit}
                            suggestionOptions={
                              SUGGESTED_SUBGROUPS[block.group] || subgroups
                            }
                            onAssignSubgroup={handleInlineSubgroup}
                          />
                        )}
                        {block.subgroups.map((sg) => {
                          const sgKey = `${block.group}::${sg.name}`;
                          return (
                            <OrganizeSubgroupPanel
                              key={sgKey}
                              title={sg.name}
                              expandKey={sgKey}
                              expanded={expandedSubgroups[sgKey] === true}
                              onToggle={() =>
                                setExpandedSubgroups((prev) => ({
                                  ...prev,
                                  [sgKey]: !prev[sgKey],
                                }))
                              }
                              items={sg.items}
                              selectedIds={selectedIds}
                              onToggleSelect={toggleSelect}
                              canManage={canManage}
                              onEdit={openEdit}
                              suggestionOptions={
                                SUGGESTED_SUBGROUPS[block.group] || subgroups
                              }
                              onAssignSubgroup={handleInlineSubgroup}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
                <h3 className="text-sm font-semibold">
                  {editing ? "Edit permission" : "New permission"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {!editing && (
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Key
                    </label>
                    <input
                      required
                      value={form.key}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, key: e.target.value }))
                      }
                      placeholder="pos.view"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1">Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ComboboxField
                    label="Group"
                    required
                    value={groupInput}
                    onChange={setGroupInput}
                    options={groups}
                    placeholder="Select or create…"
                  />
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Scope
                    </label>
                    <select
                      value={form.scope}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, scope: e.target.value }))
                      }
                      disabled={!!editing}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm disabled:opacity-60"
                    >
                      <option value="tenant">tenant</option>
                      <option value="platform">platform</option>
                    </select>
                  </div>
                </div>
                <ComboboxField
                  label="Subgroup"
                  hint="(optional — used in roles editor)"
                  value={subgroupInput}
                  onChange={setSubgroupInput}
                  options={formSuggestionChips}
                  placeholder="e.g. Access, Orders, Money"
                  allowClear
                />
                {formSuggestionChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 -mt-1">
                    {formSuggestionChips.slice(0, 8).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setSubgroupInput(chip)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                          subgroupInput === chip
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-gray-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary/40"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editing ? (
                      "Save"
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {bulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
                <div>
                  <h3 className="text-sm font-semibold">Assign subgroup</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Apply to {selectedCount} selected permission
                    {selectedCount === 1 ? "" : "s"}
                    {bulkSuggestionGroup
                      ? ` in ${bulkSuggestionGroup}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleBulkAssign} className="p-5 space-y-4">
                <ComboboxField
                  label="Subgroup"
                  value={bulkSubgroup}
                  onChange={setBulkSubgroup}
                  options={suggestionChips}
                  placeholder="Type or pick a subgroup…"
                  allowClear
                />
                {suggestionChips.length > 0 && (
                  <div>
                    <p className="text-[11px] text-neutral-500 mb-1.5">
                      Suggestions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestionChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setBulkSubgroup(chip)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                            bulkSubgroup === chip
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-gray-200 dark:border-neutral-700 hover:border-primary/40"
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setBulkModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={bulkSaving}>
                    {bulkSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : bulkSubgroup.trim() ? (
                      "Assign subgroup"
                    ) : (
                      "Clear subgroup"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </SuperPageGate>
    </AdminLayout>
  );
}

function OrganizeSubgroupPanel({
  title,
  expanded,
  onToggle,
  items,
  selectedIds,
  onToggleSelect,
  canManage,
  onEdit,
  suggestionOptions,
  onAssignSubgroup,
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-neutral-800">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="truncate">{title}</span>
        <span className="text-[11px] font-normal text-neutral-500">
          {items.length}
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-gray-50 dark:divide-neutral-900 px-2 pb-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 py-2 px-1 text-xs"
            >
              {canManage && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => onToggleSelect(p.id)}
                  className="rounded border-gray-300 shrink-0"
                  aria-label={`Select ${p.key}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {p.name}
                </div>
                <code className="text-[10px] text-neutral-500 font-mono">
                  {p.key}
                </code>
              </div>
              {canManage && (
                <>
                  <select
                    value={p.subgroup || ""}
                    onChange={(e) => onAssignSubgroup(p, e.target.value)}
                    className="max-w-[120px] px-1.5 py-1 rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-[11px]"
                  >
                    <option value="">— None —</option>
                    {suggestionOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {p.subgroup && !suggestionOptions.includes(p.subgroup) ? (
                      <option value={p.subgroup}>{p.subgroup}</option>
                    ) : null}
                  </select>
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="text-[11px] font-medium text-primary hover:underline shrink-0"
                  >
                    Edit
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
