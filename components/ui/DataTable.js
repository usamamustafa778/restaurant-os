export default function DataTable({
  columns,
  rows,
  getRowId,
  emptyMessage = "No records found."
}) {
  const resolveRowId =
    getRowId || ((row, index) => (row && row.id ? row.id : index));

  return (
    <div className="overflow-x-auto text-xs">
      <table className="w-full">
        <thead className="text-[11px] uppercase text-gray-800 dark:text-neutral-400 border-b border-gray-300 dark:border-neutral-700 bg-bg-secondary dark:bg-neutral-950">
          <tr>
            {columns.map(col => (
              <th
                key={col.key || col.header}
                className={`py-2 px-2 ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left"
                }`}
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
                className="py-6 text-center text-xs text-neutral-500"
              >
                {emptyMessage}
              </td>
            </tr>
          )}

          {rows.map((row, rowIndex) => (
            <tr
              key={resolveRowId(row, rowIndex)}
              className="hover:bg-gray-50 dark:hover:bg-neutral-900/50"
            >
              {columns.map(col => {
                const value = row[col.key];
                const content = col.render
                  ? col.render(value, row)
                  : value;
                return (
                  <td
                    key={col.key || col.header}
                    className={`py-2 px-2 ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    }`}
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
}

