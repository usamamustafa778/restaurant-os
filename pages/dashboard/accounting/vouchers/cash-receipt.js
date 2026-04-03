import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function CashReceiptPage() {
  return (
    <AdminLayout title="Cash Receipt Voucher">
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Cash Receipt Voucher</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Record cash received from a customer or other income</p>
        </div>
        <VoucherForm type="cash_receipt" title="Cash Receipt" />
      </div>
    </AdminLayout>
  );
}
