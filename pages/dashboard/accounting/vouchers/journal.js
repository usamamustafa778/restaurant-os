import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function JournalVoucherPage() {
  return (
    <AdminLayout title="Journal Entry">
      <VoucherForm
        type="journal"
        title="Journal Entry"
        showSplitAmounts={true}
      />
    </AdminLayout>
  );
}
