import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function BankPaymentPage() {
  return (
    <AdminLayout title="Bank Payment Voucher">
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Bank Payment Voucher</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Record a payment made via bank transfer or cheque</p>
        </div>
        <VoucherForm
          type="bank_payment"
          title="Bank Payment"
          accountFilter={["302", "303"]}
          mainAccountLabel="Payment From (Bank / Wallet)"
          referenceLabel="Cheque / Transfer No."
        />
      </div>
    </AdminLayout>
  );
}
