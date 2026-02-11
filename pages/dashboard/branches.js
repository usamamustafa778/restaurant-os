import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";

export default function BranchesPage() {
  return (
    <AdminLayout title="Branch Management">
      <Card
        title="Branches"
        description="Manage restaurant branches, opening hours, and status. (Coming soon.)"
      >
        <p className="text-xs text-neutral-500">
          This tenant dashboard will soon support full branch management similar to the Nimbus
          example (opening/closing hours, branch status, and tables). For now, use the main
          dashboard and reports to monitor performance.
        </p>
      </Card>
    </AdminLayout>
  );
}

