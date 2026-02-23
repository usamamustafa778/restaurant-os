import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import { getLeadsForSuperAdmin } from "../../../lib/apiClient";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function SuperLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

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
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm font-medium text-gray-600 dark:text-neutral-400">Loading leads...</span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 dark:border-neutral-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50">
                  <tr>
                    <th className="py-3 px-4 text-left w-12">#</th>
                    <th className="py-3 px-4 text-left">Name</th>
                    <th className="py-3 px-4 text-left">Phone</th>
                    <th className="py-3 px-4 text-left">Email</th>
                    <th className="py-3 px-4 text-left">Message</th>
                    <th className="py-3 px-4 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {leads.map((lead, i) => (
                    <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                      <td className="py-3 px-4 text-gray-500 dark:text-neutral-400">{i + 1}</td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{lead.name}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-neutral-300">{lead.phone}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-neutral-300">{lead.email}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-neutral-400 max-w-xs truncate" title={lead.message}>
                        {lead.message}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                        {lead.createdAt
                          ? new Date(lead.createdAt).toLocaleString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-neutral-400">
                        No leads yet. Submissions from the contact form will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
