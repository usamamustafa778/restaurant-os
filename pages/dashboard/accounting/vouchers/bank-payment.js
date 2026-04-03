import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function BankPaymentPage() {
  return (
    <AdminLayout title="Bank Payment">
      <VoucherForm
        type="bank_payment"
        title="Bank Payment"
        accountFilter={["302", "303"]}
        mainAccountLabel="Payment From (Bank / Wallet)"
        referenceLabel="Cheque / Transfer No."
        referenceRequired
      />
    </AdminLayout>
  );
}
