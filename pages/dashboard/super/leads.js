import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import DataTable from "../../../components/ui/DataTable";
import { getLeadsForSuperAdmin } from "../../../lib/apiClient";
import { Search, FileDown } from "lucide-react";
import toast from "react-hot-toast";

export default function SuperLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  function escapeCsvCell(value) {
    if (value == null || value === "") return "";
    const s = String(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadLeadsExcel(rows) {
    const headers = ["S.No", "Name", "Phone", "Email", "Message", "Date"];
    const csvRows = [
      headers.join(","),
      ...rows.map((lead, i) =>
        [
          i + 1,
          escapeCsvCell(lead.name),
          escapeCsvCell(lead.phone),
          escapeCsvCell(lead.email),
          escapeCsvCell(lead.message),
          lead.createdAt ? new Date(lead.createdAt).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
        ].join(",")
      ),
    ];
    const csv = csvRows.join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const filteredLeads = searchQuery.trim()
    ? leads.filter((l) => {
        const q = searchQuery.trim().toLowerCase();
        const name = (l.name || "").toLowerCase();
        const phone = (l.phone || "").toLowerCase();
        const email = (l.email || "").toLowerCase();
        const msg = (l.message || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q) || msg.includes(q);
      })
    : leads;

  useEffect(() => {
    getLeadsForSuperAdmin()
      .then(setLeads)
      .catch((err) => {
        toast.error(err.message || "Failed to load leads");
        setLeads([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Leads">
      <div className="flex flex-col min-h-[calc(100vh-14rem)]">
        <Card
          title="Contact form submissions"
          description="Leads from the landing page “Send us a message” form."
        >
          <div className="flex flex-wrap items-center gap-3 mb-4 flex-shrink-0">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
              <input
                type="text"
                placeholder="Search by name, phone, email or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            {searchQuery && (
              <span className="text-xs text-neutral-500">{filteredLeads.length} of {leads.length}</span>
            )}
            <button
              type="button"
              onClick={() => {
                if (filteredLeads.length === 0) { toast.error("No data to export"); return; }
                downloadLeadsExcel(filteredLeads);
                toast.success(`Exported ${filteredLeads.length} lead(s) to Excel`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              title="Download table as Excel (CSV)"
            >
              <FileDown className="w-4 h-4" />
              Download Excel
            </button>
          </div>
          <DataTable
            showSno
            data={filteredLeads}
            loading={loading}
            emptyMessage="No leads yet. Submissions from the contact form will appear here."
            columns={[
              {
                key: "name",
                header: "Name",
                render: (_, lead) => (
                  <span className="font-medium text-gray-900 dark:text-white">{lead.name}</span>
                ),
              },
              {
                key: "phone",
                header: "Phone",
                render: (_, lead) => lead.phone,
                cellClassName: "text-gray-700 dark:text-neutral-300",
              },
              {
                key: "email",
                header: "Email",
                render: (_, lead) => lead.email,
                cellClassName: "text-gray-700 dark:text-neutral-300",
              },
              {
                key: "message",
                header: "Message",
                render: (_, lead) => lead.message,
                cellClassName: "text-gray-600 dark:text-neutral-400 max-w-xs truncate",
              },
              {
                key: "date",
                header: "Date",
                render: (_, lead) =>
                  lead.createdAt
                    ? new Date(lead.createdAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—",
                cellClassName: "text-gray-500 dark:text-neutral-400 whitespace-nowrap",
              },
            ]}
          />
        </Card>
      </div>
    </AdminLayout>
  );
}
