// Legacy status styles (for existing DB records until migrated)
const LEGACY_STYLES = {
  UNPROCESSED: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40",
  PENDING: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40",
  COMPLETED: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40",
};
const STATUS_STYLES = {
  NEW_ORDER:
    "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/40",
  PROCESSING:
    "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40",
  READY:
    "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-500/40",
  DELIVERED:
    "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40",
  CANCELLED:
    "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/40"
};

const STATUS_LABELS = {
  NEW_ORDER: "New order",
  PROCESSING: "Processing",
  READY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  // Legacy (for existing DB records until migrated)
  UNPROCESSED: "New order",
  PENDING: "Processing",
  COMPLETED: "Delivered",
};

export default function StatusBadge({ status }) {
  const normalized = status || "UNKNOWN";
  const cls =
    STATUS_STYLES[normalized] ||
    LEGACY_STYLES[normalized] ||
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700";
  const label = STATUS_LABELS[normalized] || normalized.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}
