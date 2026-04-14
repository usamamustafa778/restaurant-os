import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import {
  getTables,
  createTable,
  updateTable,
  deleteTable,
  getOrders,
  getReservations,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import {
  Plus,
  Trash2,
  Edit3,
  UtensilsCrossed,
  Loader2,
  Users,
  Clock,
  UserCheck,
  Eye,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "reserved", label: "Reserved" },
  { value: "cleaning", label: "Cleaning" },
];

const STATUS_BADGE = {
  available:
    "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40",
  occupied:
    "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/40",
  reserved:
    "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40",
  cleaning:
    "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/40",
};

const STATUS_LABELS = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
};

function elapsedMin(createdAt) {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function padOrder(n) {
  return `#${String(n || "").padStart(4, "0")}`;
}

// ─── SlideOver ────────────────────────────────────────────────────────────────

function SlideOver({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const router = useRouter();
  const { currentBranch } = useBranch() || {};
  const { confirm } = useConfirmDialog();

  const [tables, setTables] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [todayReservations, setTodayReservations] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState({ id: null, name: "", capacity: "", status: "available" });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [tablesData, ordersData, reservationsData] = await Promise.all([
        getTables(),
        getOrders({ limit: 200 }),
        getReservations({ date: new Date().toISOString().split("T")[0] }),
      ]);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      const orders = Array.isArray(ordersData?.orders) ? ordersData.orders : [];
      setActiveOrders(
        orders.filter(
          (o) =>
            o.orderType === "DINE_IN" &&
            o.tableName &&
            !["DELIVERED", "CANCELLED"].includes(o.status)
        )
      );
      setTodayReservations(Array.isArray(reservationsData) ? reservationsData : []);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) setSuspended(true);
      else toast.error(err.message || "Failed to load tables");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [currentBranch?.id, loadData]);

  function resetForm() {
    setForm({ id: null, name: "", capacity: "", status: "available" });
    setFormError("");
  }

  function openAdd() {
    resetForm();
    setSlideOpen(true);
  }

  function openEdit(table) {
    setForm({
      id: table.id,
      name: table.name || "",
      capacity: table.capacity != null ? String(table.capacity) : "",
      status: table.status || "available",
    });
    setFormError("");
    setSlideOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Table name is required"); return; }
    setFormError("");
    setFormLoading(true);
    const toastId = toast.loading(form.id ? "Updating table..." : "Creating table...");
    try {
      const cap = form.capacity !== "" ? parseInt(form.capacity, 10) : null;
      if (form.id) {
        const updated = await updateTable(form.id, {
          name: form.name.trim(),
          capacity: cap,
          status: form.status,
        });
        setTables((p) => p.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Table updated.", { id: toastId });
      } else {
        const created = await createTable({ name: form.name.trim(), capacity: cap });
        setTables((p) => [created, ...p]);
        toast.success("Table created.", { id: toastId });
      }
      resetForm();
      setSlideOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to save table");
      toast.error(err.message || "Failed to save table", { id: toastId });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: "Delete table", message: "Delete this table? This cannot be undone." });
    if (!ok) return;
    const toastId = toast.loading("Deleting...");
    try {
      await deleteTable(id);
      setTables((p) => p.filter((t) => t.id !== id));
      toast.success("Table deleted.", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to delete table", { id: toastId });
    }
  }

  function getActiveOrder(table) {
    return activeOrders.find(
      (o) => (o.tableName || "").trim().toLowerCase() === (table.name || "").trim().toLowerCase()
    );
  }

  function getReservation(table) {
    return todayReservations.find(
      (r) =>
        (r.tableId === table.id || r.tableNumber === table.name) &&
        ["confirmed", "pending"].includes(r.status)
    );
  }

  const counts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === "all"
      ? tables.length
      : tables.filter((t) => t.status === f.value).length;
    return acc;
  }, {});

  const filtered = tables.filter((t) => {
    const term = search.trim().toLowerCase();
    if (term && !(t.name || "").toLowerCase().includes(term)) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <AdminLayout title="Tables" suspended={suspended}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tables..."
          className="flex-1 h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
        />
        <button
          type="button"
          onClick={openAdd}
          disabled={!currentBranch}
          title={!currentBranch ? "Select a branch first" : ""}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <Plus className="w-4 h-4" />
          Add Table
        </button>
      </div>

      {/* Filter tabs — KDS style */}
      <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5 mb-5 w-fit">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === f.value
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {f.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === f.value
                  ? "bg-white/20"
                  : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"
              }`}
            >
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">Loading tables...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-7 h-7 text-gray-400 dark:text-neutral-600" />
          </div>
          <p className="text-sm text-gray-500 dark:text-neutral-400">
            {tables.length === 0 ? "No tables yet" : "No tables match this filter"}
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">
            {tables.length === 0 ? "Add your first table to get started." : "Try a different filter."}
          </p>
          {tables.length === 0 && currentBranch && (
            <button type="button" onClick={openAdd} className="mt-3 text-xs text-primary font-semibold hover:underline">
              Add Table
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              activeOrder={getActiveOrder(table)}
              reservation={getReservation(table)}
              onEdit={() => openEdit(table)}
              onDelete={() => handleDelete(table.id)}
              router={router}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Slide-Over */}
      <SlideOver
        open={slideOpen}
        onClose={() => { setSlideOpen(false); resetForm(); }}
        title={form.id ? "Edit Table" : "Add Table"}
        subtitle={form.id ? "Update this table's details." : "Add a new table to this branch."}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
              Table Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Table 1, VIP-A"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
              Capacity <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
              placeholder="e.g. 4"
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
          </div>

          {form.id && (
            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setSlideOpen(false); resetForm(); }}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" disabled={formLoading} className="gap-1">
              {formLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {form.id ? "Save Changes" : "Add Table"}
            </Button>
          </div>
        </form>
      </SlideOver>
    </AdminLayout>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────

function TableCard({ table, activeOrder, reservation, onEdit, onDelete, router }) {
  const badgeCls =
    STATUS_BADGE[table.status] ||
    "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600";
  const label = STATUS_LABELS[table.status] || table.status;

  return (
    <div className="group relative flex flex-col p-3 h-[120px] rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between gap-1.5 mb-0.5">
        <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight truncate flex-1">
          {table.name}
        </p>
        <span className={`flex-shrink-0 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badgeCls}`}>
          {label}
        </span>
      </div>

      {/* Capacity */}
      {table.capacity != null && (
        <p className="text-[11px] text-gray-400 dark:text-neutral-500 flex items-center gap-1 mb-1">
          <Users className="w-3 h-3" />
          {table.capacity} seats
        </p>
      )}

      {/* Active order or reservation info */}
      {table.status === "occupied" && activeOrder && (
        <p className="text-[10px] text-red-500 dark:text-red-400 flex items-center gap-1 truncate">
          <Clock className="w-3 h-3 flex-shrink-0" />
          {`Order ${padOrder(activeOrder.orderNumber)} · ${elapsedMin(activeOrder.createdAt)}m`}
        </p>
      )}
      {table.status === "reserved" && reservation && (
        <p className="text-[10px] text-orange-500 dark:text-orange-400 flex items-center gap-1 truncate">
          <UserCheck className="w-3 h-3 flex-shrink-0" />
          {`${reservation.customerName} · ${reservation.time}`}
        </p>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Hover action button */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {table.status === "available" && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/orders?view=pos&table=${encodeURIComponent(table.name)}`)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-white text-[10px] font-semibold hover:bg-secondary transition-colors"
            >
              <UserCheck className="w-3 h-3" />
              Seat Guests
            </button>
          )}
          {table.status === "occupied" && activeOrder && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/orders?editOrder=${activeOrder.id}`)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-semibold hover:bg-red-600 transition-colors"
            >
              <Eye className="w-3 h-3" />
              View Order
            </button>
          )}
          {table.status === "reserved" && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/orders?view=pos&table=${encodeURIComponent(table.name)}`)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500 text-white text-[10px] font-semibold hover:bg-orange-600 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
              Check In
            </button>
          )}
          {table.status === "cleaning" && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const updated = await updateTable(table.id, { status: "available" });
                  toast.success("Table available.");
                  // parent can't be accessed cleanly here; page will refresh via state
                  window.location.reload();
                } catch (err) {
                  toast.error(err.message || "Failed");
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500 text-white text-[10px] font-semibold hover:bg-yellow-600 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Mark Available
            </button>
          )}
        </div>

        {/* Edit / delete icons */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors"
            title="Edit"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
