export default function DataTable({
  columns,
  rows,
  getRowId,
  emptyMessage = "No records found.",
  variant = "default" // "default" or "card"
}) {
  const resolveRowId =
    getRowId || ((row, index) => (row && row.id ? row.id : index));

  const tableContent = (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-neutral-900/50 border-b border-gray-200 dark:border-neutral-800">
          <tr>
            {columns.map(col => (
              <th
                key={col.key || col.header}
                className={`px-6 py-4 text-xs font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-wider ${
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
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="py-12 text-center text-sm text-gray-500 dark:text-neutral-400"
              >
                {emptyMessage}
              </td>
            </tr>
          )}

          {rows.map((row, rowIndex) => (
            <tr
              key={resolveRowId(row, rowIndex)}
              className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors"
            >
              {columns.map(col => {
                const value = row[col.key];
                const content = col.render
                  ? col.render(value, row)
                  : value;
                return (
                  <td
                    key={col.key || col.header}
                    className={`px-6 py-4 text-sm ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    } ${col.className || ""} ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.hideOnTablet ? "hidden lg:table-cell" : ""}`}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
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

