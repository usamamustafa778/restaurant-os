import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function BankReceiptPage() {
  return (
    <AdminLayout title="Bank Receipt">
      <VoucherForm
        type="bank_receipt"
        title="Bank Receipt"
        accountFilter={["302", "303"]}
        mainAccountLabel="Received Into (Bank / Wallet)"
        referenceLabel="Cheque / Transfer No."
        referenceRequired
      />
    </AdminLayout>
  );
}
