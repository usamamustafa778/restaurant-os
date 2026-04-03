import { cloneElement, isValidElement } from "react";

export default function DataTable({
  columns,
  rows = [],
  data,
  getRowId,
  emptyMessage = "No records found.",
  variant = "default", // "default" or "card"
  loading = false,
  showSno = false,
  /** Merged onto the inner table element (e.g. print CSS hooks). */
  tableClassName = "",
  /** Appended to each default data row tr (ignored when renderRow returns a row). */
  getRowClassName,
  /** Return a custom tr for this row, or null/undefined for normal column cells (e.g. colspan rows). */
  renderRow,
}) {
  const resolvedRows = data ?? rows;
  const resolveRowId =
    getRowId || ((row, index) => (row && row.id ? row.id : index));

  const allColumns = showSno
    ? [
        {
          key: "_sno",
          header: "S.No",
          align: "left",
          sno: true,
          cellClassName: "text-neutral-500 dark:text-neutral-400 font-medium",
        },
        ...columns,
      ]
    : columns;

  const tableContent = (
    <div className="overflow-x-auto">
      <table className={`w-full ${tableClassName}`.trim()}>
        <thead className="bg-gray-50 dark:bg-neutral-900/50 border-b border-gray-200 dark:border-neutral-800">
          <tr>
            {allColumns.map((col) => (
              <th
                key={col.key || col.header}
                className={`px-4 py-2.5 text-xs whitespace-nowrap font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left"
                } ${col.className || ""} ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.hideOnTablet ? "hidden lg:table-cell" : ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
          {loading ? (
            <tr>
              <td
                colSpan={allColumns.length}
                className="py-8 text-center text-neutral-500"
              >
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading…
                </span>
              </td>
            </tr>
          ) : resolvedRows.length === 0 ? (
            <tr>
              <td
                colSpan={allColumns.length}
                className="py-12 text-center text-sm text-gray-500 dark:text-neutral-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            resolvedRows.map((row, rowIndex) => {
              const custom = renderRow?.(row, rowIndex, allColumns);
              if (custom != null && isValidElement(custom)) {
                const k = resolveRowId(row, rowIndex);
                return cloneElement(custom, { key: k });
              }
              const extraRowCls = getRowClassName?.(row, rowIndex) || "";
              return (
                <tr
                  key={resolveRowId(row, rowIndex)}
                  className={`hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors whitespace-nowrap ${extraRowCls}`.trim()}
                >
                  {allColumns.map((col) => {
                    const value = row[col.key];
                    const content = col.sno
                      ? rowIndex + 1
                      : col.render
                        ? col.render(value, row, rowIndex)
                        : value ?? "—";
                    return (
                      <td
                        key={col.key || col.header}
                        className={`px-4 py-2.5 text-sm ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left"
                        } ${col.className || ""} ${col.cellClassName || ""} ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.hideOnTablet ? "hidden lg:table-cell" : ""}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  if (variant === "card") {
    return (
      <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {tableContent}
      </div>
    );
  }

  return tableContent;
}

