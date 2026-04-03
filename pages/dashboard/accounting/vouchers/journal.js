import AdminLayout from "../../../../components/layout/AdminLayout";
import VoucherForm from "../../../../components/accounting/VoucherForm";

export default function JournalVoucherPage() {
  return (
    <AdminLayout title="Journal Voucher">
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Journal Voucher</h1>
          <p className="text-sm text-neutral-500 mt-0.5">General journal entry — enter debit and credit amounts directly</p>
        </div>
        <VoucherForm
          type="journal"
          title="Journal"
          showSplitAmounts={true}
        />
      </div>
    </AdminLayout>
  );
}
