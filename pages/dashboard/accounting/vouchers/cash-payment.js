import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function CashPaymentPage() {
  return (
    <AdminLayout title="Cash Payment">
      <VoucherForm type="cash_payment" title="Cash Payment" />
    </AdminLayout>
  );
}
