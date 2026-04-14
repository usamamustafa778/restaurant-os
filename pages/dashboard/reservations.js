import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import {
  getReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  getTables,
  updateTable,
  SubscriptionInactiveError,
} from "../../lib/apiClient";
import {
  Calendar,
  Clock,
  Users,
  Phone,
  Plus,
  Loader2,
  Edit3,
  Trash2,
  ChevronRight,
  UserCheck,
  MessageSquare,
  CalendarDays,
  X,
} from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { useBranch } from "../../contexts/BranchContext";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_FILTERS = ["Today", "Tomorrow", "This Week", "All"];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE = {
  pending:
    "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600",
  confirmed:
    "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/40",
  seated:
    "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40",
  completed:
    "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 border-gray-200 dark:border-neutral-700",
  cancelled:
    "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/40",
  no_show:
    "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40",
};

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d) { return d.toISOString().split("T")[0]; }
function todayStr() { return toDateStr(new Date()); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d); }
function weekRange() {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
  return { from: toDateStr(from), to: toDateStr(to) };
}

function fmtDate(dateVal) {
  if (!dateVal) return "—";
  return new Date(dateVal).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function generate30MinSlots() {
  const slots = [];
  for (let h = 9; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ap = h >= 12 ? "PM" : "AM";
      slots.push({
        value: `${String(h).padStart(2, "0")}:${m === 0 ? "00" : m}`,
        label: `${h12}:${m === 0 ? "00" : m} ${ap}`,
      });
    }
  }
  return slots;
}
const TIME_SLOTS = generate30MinSlots();

function emptyForm() {
  return { id: null, customerName: "", customerPhone: "", date: todayStr(), time: "19:00", guestCount: "2", tableId: "", specialRequests: "" };
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
        <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReservationsPage() {
  const router = useRouter();
  const { currentBranch } = useBranch() || {};
  const { confirm } = useConfirmDialog();

  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);

  const [dateFilter, setDateFilter] = useState("Today");
  const [statusFilter, setStatusFilter] = useState("all");

  const [slideOpen, setSlideOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchReservations = useCallback(async (filter) => {
    let params = {};
    if (filter === "Today") params.date = todayStr();
    else if (filter === "Tomorrow") params.date = tomorrowStr();
    else if (filter === "This Week") { const r = weekRange(); params.from = r.from; params.to = r.to; }
    const data = await getReservations(params);
    setReservations(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [tablesData] = await Promise.all([getTables()]);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        await fetchReservations("Today");
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) setSuspended(true);
        else toast.error(err.message || "Failed to load data");
      } finally {
        setPageLoading(false);
      }
    })();
  }, [currentBranch?.id]);

  async function changeDateFilter(f) {
    setDateFilter(f);
    try { await fetchReservations(f); } catch (err) { toast.error(err.message || "Failed"); }
  }

  function openAdd() { setForm(emptyForm()); setFormError(""); setSlideOpen(true); }
  function openEdit(res) {
    setForm({
      id: res.id,
      customerName: res.customerName || "",
      customerPhone: res.customerPhone || "",
      date: res.date ? toDateStr(new Date(res.date)) : todayStr(),
      time: res.time || "19:00",
      guestCount: String(res.guestCount || 2),
      tableId: res.tableId || "",
      specialRequests: res.specialRequests || "",
    });
    setFormError("");
    setSlideOpen(true);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!form.customerName.trim()) { setFormError("Guest name is required"); return; }
    if (!form.customerPhone.trim()) { setFormError("Phone number is required"); return; }
    setFormError("");
    setFormLoading(true);
    const toastId = toast.loading(form.id ? "Updating..." : "Creating...");
    try {
      const selectedTable = tables.find((t) => t.id === form.tableId);
      const payload = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        date: form.date,
        time: form.time,
        guestCount: parseInt(form.guestCount, 10) || 2,
        tableId: form.tableId || null,
        tableNumber: selectedTable?.name || "",
        specialRequests: form.specialRequests.trim(),
      };
      if (form.id) {
        const updated = await updateReservation(form.id, payload);
        setReservations((p) => p.map((r) => (r.id === updated.id ? updated : r)));
        toast.success("Reservation updated.", { id: toastId });
      } else {
        const created = await createReservation(payload);
        setReservations((p) => [created, ...p]);
        toast.success("Reservation created.", { id: toastId });
      }
      setSlideOpen(false);
      setForm(emptyForm());
    } catch (err) {
      setFormError(err.message || "Failed to save");
      toast.error(err.message || "Failed", { id: toastId });
    } finally {
      setFormLoading(false);
    }
  }

  async function updateStatus(res, status) {
    const toastId = toast.loading("Updating...");
    try {
      const updated = await updateReservation(res.id, { status });
      setReservations((p) => p.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(`Marked as ${STATUS_LABELS[status] || status}`, { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  }

  async function handleSeatNow(res) {
    const toastId = toast.loading("Seating guests...");
    try {
      await updateReservation(res.id, { status: "seated" });
      if (res.tableId) await updateTable(res.tableId, { status: "reserved" });
      setReservations((p) => p.map((r) => (r.id === res.id ? { ...r, status: "seated" } : r)));
      toast.success("Guests seated!", { id: toastId });
      const tp = res.tableNumber ? `&table=${encodeURIComponent(res.tableNumber)}` : "";
      router.push(`/dashboard/orders?view=pos${tp}`);
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: "Delete reservation", message: "Delete this reservation? This cannot be undone." });
    if (!ok) return;
    const toastId = toast.loading("Deleting...");
    try {
      await deleteReservation(id);
      setReservations((p) => p.filter((r) => r.id !== id));
      toast.success("Reservation deleted.", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed", { id: toastId });
    }
  }

  const displayed = reservations.filter((r) =>
    statusFilter === "all" || r.status === statusFilter
  );

  const statusCounts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === "all"
      ? reservations.length
      : reservations.filter((r) => r.status === f.value).length;
    return acc;
  }, {});

  const availableTablesForGuests = tables.filter((t) => {
    const n = parseInt(form.guestCount, 10) || 1;
    return t.capacity == null || t.capacity >= n;
  });

  const columns = [
    {
      key: "customerName",
      header: "Guest",
      render: (_, row) => (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white text-sm">{row.customerName}</p>
          {row.customerPhone && (
            <p className="text-xs text-gray-400 dark:text-neutral-500 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" />
              {row.customerPhone}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "date",
      header: "Date & Time",
      render: (_, row) => (
        <div>
          <p className="text-sm text-gray-700 dark:text-neutral-300">{fmtDate(row.date)}</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {row.time}
          </p>
        </div>
      ),
    },
    {
      key: "guestCount",
      header: "Guests",
      render: (val) => (
        <span className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-neutral-300">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          {val}
        </span>
      ),
    },
    {
      key: "tableNumber",
      header: "Table",
      render: (val) => val || <span className="text-gray-300 dark:text-neutral-600">—</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (val) => {
        const cls =
          STATUS_BADGE[val] ||
          "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600";
        return (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
            {STATUS_LABELS[val] || val}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1 flex-wrap">
          {row.status === "pending" && (
            <button
              type="button"
              onClick={() => updateStatus(row, "confirmed")}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-semibold hover:bg-sky-100 transition-colors"
            >
              Confirm
            </button>
          )}
          {row.status === "confirmed" && (
            <button
              type="button"
              onClick={() => handleSeatNow(row)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold hover:bg-emerald-100 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
              Seat Now
            </button>
          )}
          {["pending", "confirmed"].includes(row.status) && (
            <button
              type="button"
              onClick={() => updateStatus(row, "cancelled")}
              className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Cancel reservation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors"
            title="Edit"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.id)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Reservations" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <Calendar className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">Loading reservations...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
            {/* Date filter tabs — KDS style */}
            <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5">
              {DATE_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => changeDateFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dateFilter === f
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                      : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={openAdd}
              disabled={!currentBranch}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <Plus className="w-4 h-4" />
              New Reservation
            </button>
          </div>

          {/* Status filter tabs */}
          <div className="flex rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5 mb-5 w-fit overflow-x-auto">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
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
                  {statusCounts[f.value]}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <DataTable
            variant="card"
            columns={columns}
            rows={displayed}
            getRowId={(r) => r.id}
            emptyMessage={dateFilter === "Today" ? "No reservations for today." : "No reservations found."}
          />

          {displayed.length === 0 && reservations.length === 0 && currentBranch && (
            <div className="text-center mt-4">
              <button type="button" onClick={openAdd} className="text-xs text-primary font-semibold hover:underline">
                Create New Reservation
              </button>
            </div>
          )}
        </>
      )}

      {/* New / Edit Slide-Over */}
      <SlideOver
        open={slideOpen}
        onClose={() => { setSlideOpen(false); setForm(emptyForm()); }}
        title={form.id ? "Edit Reservation" : "New Reservation"}
        subtitle={form.id ? "Update reservation details." : "Book a table for your guest."}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
              Guest Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
              placeholder="e.g. Ahmed Khan"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium flex items-center gap-1">
              <Phone className="w-3 h-3" />
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
              placeholder="+92 300 0000000"
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Time
              </label>
              <select
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium flex items-center gap-1">
              <Users className="w-3 h-3" />
              Number of Guests
            </label>
            <input
              type="number"
              min="1"
              value={form.guestCount}
              onChange={(e) => setForm((p) => ({ ...p, guestCount: e.target.value, tableId: "" }))}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
              Table <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={form.tableId}
              onChange={(e) => setForm((p) => ({ ...p, tableId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
            >
              <option value="">— Select table —</option>
              {availableTablesForGuests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.capacity != null ? ` (${t.capacity} seats)` : ""}
                </option>
              ))}
            </select>
            {parseInt(form.guestCount, 10) > 1 && (
              <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                Showing tables with capacity ≥ {form.guestCount}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Special Requests <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.specialRequests}
              onChange={(e) => setForm((p) => ({ ...p, specialRequests: e.target.value }))}
              placeholder="Dietary requirements, occasion..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setSlideOpen(false); setForm(emptyForm()); }}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" disabled={formLoading} className="gap-1">
              {formLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {form.id ? "Save Changes" : "Save Reservation"}
            </Button>
          </div>
        </form>
      </SlideOver>
    </AdminLayout>
  );
}
