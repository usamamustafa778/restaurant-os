import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import { getStoredAuth } from "../../lib/apiClient";

export default function ProfilePage() {
  const auth = typeof window !== "undefined" ? getStoredAuth() : null;
  const user = auth?.user || null;

  return (
    <AdminLayout title="Profile">
      <Card title="Your Profile" description="View basic account information for this login.">
        {user ? (
          <div className="space-y-2 text-xs text-gray-700 dark:text-neutral-300">
            <div>
              <span className="font-semibold">Name: </span>
              <span>{user.name}</span>
            </div>
            <div>
              <span className="font-semibold">Email: </span>
              <span>{user.email}</span>
            </div>
            <div>
              <span className="font-semibold">Role: </span>
              <span>{user.role}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">No profile data available.</p>
        )}
      </Card>
    </AdminLayout>
  );
}

