/**
 * Shared table component for Super Admin Dashboard pages.
 * Consistent design: sticky header, rounded border, small text, hover rows.
 *
 * @param {Object} props
 * @param {Array} props.columns - [{ key, header, align?, width?, className?, render? }]
 * @param {Array} props.data - rows
 * @param {boolean} props.loading
 * @param {string} props.emptyMessage
 * @param {boolean} props.showSno - add S.No as first column
 * @param {function} props.getRowId - (row, index) => id
 */
export default function SuperAdminTable({
  columns,
  data = [],
  loading = false,
  emptyMessage = "No records found.",
  showSno = false,
  getRowId = (row, index) => (row?.id ?? index),
}) {
  const allColumns = showSno
    ? [{ key: "_sno", header: "S.No", width: "w-12", align: "left", sno: true, cellClassName: "text-neutral-500 dark:text-neutral-400 font-medium" }, ...columns]
    : columns;

  return (
    <div className="max-h-[calc(100vh-18rem)] overflow-auto text-xs border border-gray-200 dark:border-neutral-700 rounded-lg">
      <table className="w-full text-xs">
        <thead className="text-[11px] uppercase text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 sticky top-0 z-10">
          <tr>
            {allColumns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 whitespace-nowrap ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                } ${col.width || ""} ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
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
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={allColumns.length}
                className="py-8 text-center text-xs text-neutral-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getRowId(row, index)}
                className="hover:bg-gray-50 dark:hover:bg-neutral-800/50"
              >
                {allColumns.map((col) => {
                  const align = col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";
                  let content;
                  if (col.sno) {
                    content = index + 1;
                  } else if (col.render) {
                    content = col.render(row[col.key], row, index);
                  } else {
                    content = row[col.key] ?? "—";
                  }
                  return (
                    <td
                      key={col.key}
                      className={`py-3 px-3 ${align} ${col.cellClassName || ""}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
