import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import {
  ClipboardList,
  PackageCheck,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getPurchaseOrders,
  getPurchaseOrder,
  getInventory,
  getAccountingParties,
  getAccountingAccounts,
  createGrn,
  getGrnPrintUrl,
  getCurrencySymbol,
} from "../../../lib/apiClient";
import { useBranch } from "../../../contexts/BranchContext";

const UNIT_ABBR = {
  kilogram: "kg",
  gram: "g",
  piece: "pcs",
  bottle: "btl",
  liter: "ltr",
  milliliter: "ml",
  can: "can",
  box: "box",
  pack: "pack",
  bag: "bag",
  dozen: "doz",
};

function fmtUnit(unit) {
  const key = String(unit || "").toLowerCase();
  return UNIT_ABBR[key] || unit || "-";
}

export default function ReceiveStockPage() {
  const router = useRouter();
  const { poId } = router.query;
  const { currentBranch } = useBranch() || {};
  const sym = getCurrencySymbol();

  const [mode, setMode] = useState(poId ? "po" : "");
  const [sourcePos, setSourcePos] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState(poId || "");
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    supplierName: "",
    supplierId: "",
    purchaseOrderId: "",
    lines: [],
    invoiceNumber: "",
    invoiceDate: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    paymentType: "cash",
    paymentAccountId: "",
    paymentAccountCode: "",
    notes: "",
  });

  useEffect(() => {
    getInventory().then((d) => setInventory(Array.isArray(d) ? d : [])).catch(() => setInventory([]));
    getAccountingParties({ type: "supplier", limit: 200 }).then((d) => setSuppliers(d?.parties || [])).catch(() => {});
    getAccountingAccounts({ type: "asset", q: "" }).then((d) => setCashAccounts(d?.accounts || [])).catch(() => {});
    getPurchaseOrders({ status: "sent" }).then((d) => setSourcePos(d?.orders || [])).catch(() => setSourcePos([]));
  }, []);

  useEffect(() => {
    if (!poId) return;
    setMode("po");
    setSelectedPoId(poId);
  }, [poId]);

  useEffect(() => {
    if (!selectedPoId || mode !== "po") return;
    getPurchaseOrder(selectedPoId)
      .then((po) => {
        setForm((f) => ({
          ...f,
          supplierName: po.supplierName || "",
          supplierId: po.supplierId || "",
          purchaseOrderId: po._id,
          lines: (po.lines || []).map((l) => ({
            inventoryItem: l.inventoryItem,
            itemName: l.itemName,
            unit: l.unit,
            orderedQty: l.orderedQty,
            prevReceivedQty: l.receivedQty || 0,
            receivedQty: Math.max(0, Number(l.orderedQty || 0) - Number(l.receivedQty || 0)),
            unitCost: l.estimatedUnitCost || 0,
          })),
        }));
      })
      .catch((err) => toast.error(err.message || "Failed to load purchase order"));
  }, [selectedPoId, mode]);

  const total = useMemo(
    () => form.lines.reduce((sum, l) => sum + Number(l.receivedQty || 0) * Number(l.unitCost || 0), 0),
    [form.lines]
  );
  const isCredit = String(form.paymentType || "").toLowerCase() === "credit";

  function addLine() {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { inventoryItem: "", itemName: "", unit: "", receivedQty: 1, unitCost: 0 }],
    }));
  }

  function updateLine(idx, patch) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  }

  async function postGrn() {
    if (!currentBranch?.id) return toast.error("Please select a branch");
    if (!form.supplierName.trim()) return toast.error("Supplier name is required");
    if (!form.lines.length) return toast.error("Add at least one line");
    setLoading(true);
    try {
      const payload = {
        supplierName: form.supplierName.trim(),
        supplierId: form.supplierId || null,
        branchId: currentBranch.id,
        paymentType: form.paymentType,
        purchaseOrderId: mode === "po" ? form.purchaseOrderId || null : null,
        invoiceNumber: form.invoiceNumber || "",
        invoiceDate: form.invoiceDate || null,
        receivedDate: form.receivedDate || null,
        paymentAccountId: form.paymentType === "cash" ? form.paymentAccountId || null : null,
        paymentAccountCode: form.paymentType === "cash" ? form.paymentAccountCode || null : null,
        notes: form.notes || "",
        lines: form.lines
          .filter((l) => Number(l.receivedQty || 0) > 0)
          .map((l) => ({
            inventoryItem: l.inventoryItem,
            itemName: l.itemName,
            unit: l.unit,
            receivedQty: Number(l.receivedQty || 0),
            unitCost: Number(l.unitCost || 0),
          })),
      };
      const data = await createGrn(payload);
      setResult(data);
      toast.success(data.message || "GRN posted");
    } catch (err) {
      toast.error(err.message || "Failed to post GRN");
    } finally {
      setLoading(false);
    }
  }

  if (result?.grn) {
    return (
      <AdminLayout title="Receive Stock">
        <div className="max-w-2xl mx-auto mt-8 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-xl font-black">GRN {result.grn.grnNumber} posted</h3>
          <p className="text-sm text-gray-500">Voucher: {result.voucherNumber || "Not created"}</p>
          {result.accountingError && <p className="text-xs text-red-500">{result.accountingError}</p>}
          <div className="flex justify-center gap-2">
            <Button type="button" onClick={() => window.open(getGrnPrintUrl(result.grn._id), "_blank")}>Print GRN</Button>
            <Button type="button" variant="ghost" onClick={() => window.location.reload()}>Receive Another</Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/dashboard/inventory/purchase-history")}>View Purchase History</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Receive Stock">
      <div className="space-y-4">
        {!mode && (
          <div className="grid md:grid-cols-2 gap-4">
            <button type="button" onClick={() => setMode("po")} className="p-6 text-left rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-orange-300">
              <ClipboardList className="w-7 h-7 text-orange-500 mb-2" />
              <h3 className="font-bold">Against a PO</h3>
              <p className="text-sm text-gray-500">Select from sent purchase orders</p>
            </button>
            <button type="button" onClick={() => setMode("direct")} className="p-6 text-left rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-orange-300">
              <PackageCheck className="w-7 h-7 text-orange-500 mb-2" />
              <h3 className="font-bold">Direct Receiving</h3>
              <p className="text-sm text-gray-500">No purchase order required</p>
            </button>
          </div>
        )}

        {mode && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 space-y-4">
              {mode === "po" && (
                <select className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}>
                  <option value="">Select purchase order</option>
                  {sourcePos.map((po) => (
                    <option key={po._id} value={po._id}>{po.poNumber} - {po.supplierName}</option>
                  ))}
                </select>
              )}

              {mode === "direct" && (
                <input list="supplier-options" className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  placeholder="Supplier" value={form.supplierName}
                  onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))} />
              )}

              <datalist id="supplier-options">
                {suppliers.map((s) => <option key={s._id} value={s.name} />)}
              </datalist>

              <div className="rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
                  <p className="font-semibold text-sm">Items</p>
                  {mode === "direct" && <Button type="button" onClick={addLine}><Plus className="w-4 h-4" />Add Line</Button>}
                </div>
                <div className="p-3 space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      {mode === "direct" ? (
                        <select className="col-span-4 h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs"
                          value={line.inventoryItem}
                          onChange={(e) => {
                            const item = inventory.find((x) => x.id === e.target.value);
                            updateLine(idx, { inventoryItem: e.target.value, itemName: item?.name || "", unit: item?.unit || "" });
                          }}>
                          <option value="">Select item</option>
                          {inventory.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      ) : (
                        <input className="col-span-4 h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-xs" readOnly value={line.itemName} />
                      )}
                      <input className="col-span-1 h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 text-xs" readOnly value={fmtUnit(line.unit)} />
                      {mode === "po" && <input className="col-span-1 h-9 px-2 rounded-lg border border-gray-200 bg-gray-50 text-xs" readOnly value={line.orderedQty || 0} />}
                      {mode === "po" && <input className="col-span-1 h-9 px-2 rounded-lg border border-gray-200 bg-gray-50 text-xs" readOnly value={line.prevReceivedQty || 0} />}
                      <input type="number" min="0.001" step="0.001" className="col-span-2 h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs"
                        value={line.receivedQty} onChange={(e) => updateLine(idx, { receivedQty: e.target.value })} />
                      <input type="number" min="0" step="0.01" className="col-span-2 h-9 px-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs"
                        value={line.unitCost} onChange={(e) => updateLine(idx, { unitCost: e.target.value })} />
                      <div className="col-span-1 text-right text-xs font-semibold">{(Number(line.receivedQty || 0) * Number(line.unitCost || 0)).toFixed(0)}</div>
                      {mode === "direct" && (
                        <button type="button" className="col-span-1 text-red-500" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <input className="h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700" placeholder="Invoice Number" value={form.invoiceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
                <input type="date" className="h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700" value={form.invoiceDate}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))} />
                <input type="date" className="h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700" value={form.receivedDate}
                  onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, paymentType: "cash" }))}
                    className={`h-10 rounded-lg border text-sm ${form.paymentType === "cash" ? "border-orange-400 bg-orange-50 text-orange-600" : "border-gray-200"}`}>Cash Payment</button>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, paymentType: "credit" }))}
                    className={`h-10 rounded-lg border text-sm ${form.paymentType === "credit" ? "border-orange-400 bg-orange-50 text-orange-600" : "border-gray-200"}`}>On Credit</button>
                </div>
              </div>

              {form.paymentType === "cash" ? (
                <select className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-neutral-700"
                  value={form.paymentAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, paymentAccountId: e.target.value }))}>
                  <option value="">Pay From Account (default: Cash in Hand)</option>
                  {(cashAccounts || []).map((a) => (
                    <option key={a._id} value={a._id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 text-sm rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  This will create a payable to <strong>{form.supplierName || "supplier"}</strong>.
                </div>
              )}

              <textarea rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700" placeholder="Notes"
                value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 h-fit sticky top-4 space-y-3">
              <h3 className="font-semibold">Summary</h3>
              <div className="max-h-56 overflow-auto border rounded-lg divide-y">
                {form.lines.filter((l) => Number(l.receivedQty || 0) > 0).map((l, idx) => (
                  <div key={idx} className="px-3 py-2 text-xs flex justify-between">
                    <span>{l.itemName} x {l.receivedQty}</span>
                    <span>{sym} {(Number(l.receivedQty || 0) * Number(l.unitCost || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <p className="text-xl font-black text-orange-500">Grand Total: {sym} {total.toLocaleString()}</p>
              <div className="text-xs rounded-lg bg-gray-50 dark:bg-neutral-900 p-2">
                {!isCredit ? (
                  <>
                    <p>↓ Cash in Hand {sym} {total.toLocaleString()}</p>
                    <p>↑ Raw Materials {sym} {total.toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <p>↑ Raw Materials {sym} {total.toLocaleString()}</p>
                    <p>↑ Payable to {form.supplierName || "Supplier"} {sym} {total.toLocaleString()}</p>
                  </>
                )}
              </div>
              <Button type="button" className="w-full" onClick={postGrn} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Post GRN
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
