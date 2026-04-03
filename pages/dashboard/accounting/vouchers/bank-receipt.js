import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function BankReceiptPage() {
  return (
    <AdminLayout title="Bank Receipt Voucher">
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Bank Receipt Voucher</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Record cash received into a bank account or digital wallet</p>
        </div>
        <VoucherForm
          type="bank_receipt"
          title="Bank Receipt"
          accountFilter={["302", "303"]}
          mainAccountLabel="Received Into (Bank / Wallet)"
          referenceLabel="Cheque / Transfer No."
        />
      </div>
    </AdminLayout>
  );
}
