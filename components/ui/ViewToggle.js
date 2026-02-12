import { Grid3x3, Table2 } from "lucide-react";

export default function ViewToggle({ viewMode, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          viewMode === "grid"
            ? "bg-white dark:bg-neutral-950 text-primary shadow-sm"
            : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        <Grid3x3 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={`inline-flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          viewMode === "table"
            ? "bg-white dark:bg-neutral-950 text-primary shadow-sm"
            : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        <Table2 className="w-4 h-4" />
      </button>
    </div>
  );
}
