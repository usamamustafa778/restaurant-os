import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function CashReceiptPage() {
  return (
    <AdminLayout title="Cash Receipt">
      <VoucherForm type="cash_receipt" title="Cash Receipt" />
    </AdminLayout>
  );
}
