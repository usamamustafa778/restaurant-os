import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import AsyncCombobox from "../../../components/accounting/AsyncCombobox";
import {
  Plus,
  Loader2,
  Eye,
  Pencil,
  X,
  Trash2,
  Send,
  ShoppingCart,
  CheckCircle2,
  PackageCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  updatePurchaseOrder,
  getInventory,
  getAccountingParties,
  getCurrencySymbol,
  getStoredAuth,
} from "../../../lib/apiClient";
import { useBranch } from "../../../contexts/BranchContext";

const STATUS_COLORS = {
  draft: "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 ring-1 ring-gray-200 dark:ring-neutral-700",
  sent: "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-500/20",
  partially_received:
    "bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-500/20",
  received:
    "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-500/20",
  cancelled:
    "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-500/20",
};

const inputCls =
  "w-full bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/70 transition-colors";
const tableInputCls =
  "w-full bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-2.5 py-[7px] text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/70 transition-colors";
const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function buildHeaders() {
  const auth = getStoredAuth();
  const h = { "Content-Type": "application/json" };
  if (auth?.token) h.Authorization = `Bearer ${auth.token}`;
  const slug = auth?.user?.tenantSlug || auth?.tenantSlug;
  if (slug) h["x-tenant-slug"] = slug;
  return h;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...buildHeaders(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function fmtMoney(amount) {
  return Number(amount || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}
    >
      {String(status || "").replace(/_/g, " ")}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[11px] text-gray-500 dark:text-neutral-500">{label}</p>
      <p className="text-base font-semibold text-gray-900 dark:text-white tabular-nums">{value}</p>
      {sub ? <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function NewPoPanel({ onClose, onSaved, editPo, branches, currentBranch, hasMultipleBranches }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);

  const [form, setForm] = useState({
    supplierId: editPo?.supplierId || null,
    supplierObj: editPo?.supplierId ? { _id: editPo.supplierId, name: editPo.supplierName } : null,
    supplierName: editPo?.supplierName || "",
    customSupplierName: editPo?.supplierId ? "" : editPo?.supplierName || "",
    expectedDeliveryDate: editPo?.expectedDeliveryDate ? String(editPo.expectedDeliveryDate).slice(0, 10) : "",
    branchId: editPo?.branch || currentBranch?.id || branches?.[0]?.id || "",
    notes: editPo?.notes || "",
    lines:
      editPo?.lines?.map((l) => ({
        inventoryItem: String(l.inventoryItem || ""),
        itemName: l.itemName || "",
        unit: l.unit || "",
        orderedQty: l.orderedQty || "",
        estimatedUnitCost: l.estimatedUnitCost || "",
        notes: l.notes || "",
      })) || [],
  });

  useEffect(() => {
    getInventory()
      .then((rows) => setInventory(Array.isArray(rows) ? rows : []))
      .catch(() => setInventory([]));
  }, []);

  const fetchSuppliers = useCallback(async (q) => {
    const query = String(q || "").trim();
    setSupplierLoading(true);
    try {
      const params = new URLSearchParams({ type: "supplier", limit: "20" });
      if (query) params.set("q", query);
      const data = await apiFetch(`/api/accounting/parties?${params.toString()}`);
      return data?.parties || [];
    } catch {
      return [];
    } finally {
      setSupplierLoading(false);
    }
  }, []);

  const fetchItems = useCallback(
    async (q) => {
      const query = String(q || "").trim().toLowerCase();
      const rows = (inventory || []).map((item) => ({
        id: String(item.id || item._id || ""),
        name: String(item.name || ""),
        unit: String(item.unit || ""),
      }));
      if (!query) return rows;
      return rows.filter((item) => {
        const hay = `${item.name} ${item.unit}`.toLowerCase();
        return hay.includes(query);
      });
    },
    [inventory]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (form.supplierId) return;
      const next = await fetchSuppliers(supplierQuery);
      if (!cancelled) {
        setSupplierOptions(next);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [supplierQuery, fetchSuppliers, form.supplierId]);

  const grandTotal = useMemo(
    () =>
      form.lines.reduce(
        (sum, l) => sum + Number(l.orderedQty || 0) * Number(l.estimatedUnitCost || 0),
        0
      ),
    [form.lines]
  );

  function addLine() {
    setForm((f) => ({
      ...f,
      lines: [
        ...f.lines,
        {
          inventoryItem: "",
          itemName: "",
          unit: "",
          orderedQty: "",
          estimatedUnitCost: "",
          notes: "",
        },
      ],
    }));
  }

  function updateLine(idx, patch) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }));
  }

  function removeLine(idx) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  }

  async function submit(sendAfterCreate = false) {
    const effectiveSupplierName = (form.supplierId ? form.supplierName : form.customSupplierName).trim();
    if (!effectiveSupplierName) return toast.error("Supplier name is required");
    if (!form.branchId) return toast.error("Branch is required");
    if (!form.lines.length) return toast.error("Add at least one line");

    const badLine = form.lines.find(
      (l) => !l.inventoryItem || Number(l.orderedQty || 0) < 0.001
    );
    if (badLine) return toast.error("Each line requires item and quantity");

    setLoading(true);
    try {
      const payload = {
        supplierName: effectiveSupplierName,
        supplierId: form.supplierId || null,
        branchId: form.branchId,
        expectedDeliveryDate: form.expectedDeliveryDate || null,
        notes: form.notes || "",
        lines: form.lines.map((l) => ({
          inventoryItem: l.inventoryItem,
          itemName: l.itemName,
          unit: l.unit,
          orderedQty: Number(l.orderedQty || 0),
          estimatedUnitCost: Number(l.estimatedUnitCost || 0),
          notes: l.notes || "",
        })),
      };

      let po;
      if (editPo?._id) {
        po = await updatePurchaseOrder(editPo._id, payload);
      } else {
        po = await createPurchaseOrder(payload);
      }

      if (sendAfterCreate) await sendPurchaseOrder(po._id);
      toast.success(sendAfterCreate ? "Purchase order saved & sent" : "Purchase order saved");
      onSaved();
    } catch (err) {
      toast.error(err.message || "Failed to save purchase order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[980px] bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {editPo ? "Edit Purchase Order" : "New Purchase Order"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
              Supplier <span className="text-red-500">*</span>
            </label>

            {!form.supplierId ? (
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder="Search supplier..."
                  value={form.customSupplierName}
                  onFocus={() => setSupplierOpen(true)}
                  onBlur={() => setTimeout(() => setSupplierOpen(false), 180)}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, customSupplierName: e.target.value }));
                    setSupplierQuery(e.target.value);
                    setSupplierOpen(true);
                  }}
                />
                {supplierOpen && !form.supplierId && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg max-h-56 overflow-y-auto">
                    {supplierLoading ? (
                      <div className="px-3 py-2.5 text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
                      </div>
                    ) : supplierOptions.length ? (
                      supplierOptions.map((opt) => (
                        <button
                          key={opt._id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-800 dark:text-neutral-100"
                          onMouseDown={() => {
                            setForm((f) => ({
                              ...f,
                              supplierId: opt._id,
                              supplierObj: opt,
                              supplierName: opt.name,
                              customSupplierName: "",
                            }));
                            setSupplierOpen(false);
                          }}
                        >
                          {opt.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2.5 text-xs text-gray-500 dark:text-neutral-400">
                        No suppliers found
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 px-3 py-1.5 text-xs font-semibold ring-1 ring-orange-300 dark:ring-orange-500/20">
                {form.supplierName}
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      supplierId: null,
                      supplierObj: null,
                      supplierName: "",
                      customSupplierName: "",
                    }))
                  }
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
                Expected Delivery
              </label>
              <input
                type="date"
                className={inputCls}
                value={form.expectedDeliveryDate}
                onChange={(e) => setForm((f) => ({ ...f, expectedDeliveryDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
                Branch
              </label>
              {hasMultipleBranches ? (
                <select
                  className={inputCls}
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                >
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800 flex items-center text-sm text-gray-700 dark:text-neutral-300">
                  {branches?.[0]?.name || currentBranch?.name || "Branch"}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-500 mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              className={`${inputCls} resize-none`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes..."
            />
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Order Lines</h3>
                <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-0.5">
                  Add items and estimated costs for this purchase order.
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-neutral-500">
                {form.lines.length} line{form.lines.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/40">
                    <th className="pl-5 pr-2 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[240px]">
                      Item
                    </th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                      Unit
                    </th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[120px]">
                      Qty
                    </th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[150px]">
                      Est. Unit Cost
                    </th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide min-w-[130px]">
                      Line Total
                    </th>
                    <th className="pr-5 py-2.5 text-right text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800/60">
                  {form.lines.map((line, idx) => (
                    <tr
                      key={`line-${idx}`}
                      className={`${idx % 2 === 0 ? "bg-white dark:bg-neutral-950" : "bg-gray-50/60 dark:bg-neutral-900/40"} hover:bg-gray-50 dark:hover:bg-neutral-800/30 transition-colors`}
                    >
                      <td className="pl-5 pr-2 py-2">
                        <AsyncCombobox
                          placeholder="Search item..."
                          fetchFn={fetchItems}
                          value={line.inventoryItem}
                          valueObj={
                            line.inventoryItem
                              ? { id: String(line.inventoryItem), name: line.itemName, unit: line.unit }
                              : null
                          }
                          onChange={(v, obj) =>
                            updateLine(idx, {
                              inventoryItem: String(v || ""),
                              itemName: obj?.name || "",
                              unit: obj?.unit || "",
                            })
                          }
                          displayFn={(item) => `${item.name}${item.unit ? ` (${item.unit})` : ""}`}
                          keyFn={(item) => String(item.id || item._id || "")}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300">
                          {line.unit || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          placeholder="0"
                          className={`${tableInputCls} text-right`}
                          value={line.orderedQty}
                          onChange={(e) => updateLine(idx, { orderedQty: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-neutral-400">Rs</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className={`${tableInputCls} text-right pl-8`}
                            value={line.estimatedUnitCost}
                            onChange={(e) => updateLine(idx, { estimatedUnitCost: e.target.value })}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className="text-sm text-gray-500 dark:text-neutral-400 tabular-nums">
                          Rs{" "}
                          {fmtMoney(
                            Number(line.orderedQty || 0) * Number(line.estimatedUnitCost || 0)
                          )}
                        </span>
                      </td>
                      <td className="pr-5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-gray-300 dark:text-neutral-700 hover:text-red-400 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40">
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-sm text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors font-medium"
              >
                <Plus className="w-4 h-4" /> Add Line
              </button>
              <div className="text-right mt-2">
                <span className="text-xl font-bold tabular-nums text-orange-500 dark:text-orange-400">
                  Grand Total: Rs {fmtMoney(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => submit(false)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save as Draft
          </Button>
          <Button type="button" onClick={() => submit(true)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Save &amp; Send
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { currentBranch, branches = [], hasMultipleBranches } = useBranch() || {};
  const sym = getCurrencySymbol();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [editingPo, setEditingPo] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getPurchaseOrders(statusFilter === "all" ? {} : { status: statusFilter });
      setRows(data?.orders || []);
    } catch (err) {
      toast.error(err.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthValue = rows
      .filter((r) => new Date(r.createdAt).getTime() >= monthStart)
      .reduce((s, r) => s + Number(r.totalEstimatedCost || 0), 0);
    return {
      total: rows.length,
      draft: rows.filter((r) => r.status === "draft").length,
      sent: rows.filter((r) => r.status === "sent").length,
      monthValue,
    };
  }, [rows]);

  const columns = [
    {
      key: "poNumber",
      header: "PO No",
      render: (v) => <span className="font-mono text-xs text-orange-500 dark:text-orange-400">{v}</span>,
    },
    { key: "supplierName", header: "Supplier" },
    {
      key: "createdAt",
      header: "Created",
      render: (v) => new Date(v).toLocaleDateString("en-PK"),
      cellClassName: "text-gray-500 dark:text-neutral-400",
    },
    {
      key: "expectedDeliveryDate",
      header: "Expected Delivery",
      render: (v) => (v ? new Date(v).toLocaleDateString("en-PK") : "—"),
      cellClassName: "text-gray-500 dark:text-neutral-400",
    },
    { key: "lines", header: "Items", align: "center", render: (v) => v?.length || 0 },
    {
      key: "totalEstimatedCost",
      header: "Est. Cost",
      align: "right",
      render: (v) => <span className="tabular-nums">{sym} {fmtMoney(v)}</span>,
    },
    { key: "status", header: "Status", render: (v) => <StatusPill status={v} /> },
    {
      key: "_actions",
      header: "Actions",
      align: "right",
      render: (_, row) => (
        <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            onClick={() => setDetail(row)}
            title="View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.status === "draft" && (
            <>
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                onClick={() => {
                  setEditingPo(row);
                  setShowNew(true);
                }}
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                onClick={async () => {
                  try {
                    await cancelPurchaseOrder(row._id);
                    toast.success("Purchase order cancelled");
                    load();
                  } catch (err) {
                    toast.error(err.message || "Could not cancel purchase order");
                  }
                }}
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {row.status === "sent" && (
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg border border-orange-300 dark:border-orange-500/30 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
              onClick={() => router.push(`/dashboard/inventory/receive-stock?poId=${row._id}`)}
            >
              Receive
            </button>
          )}
          {row.status === "received" && (
            <span className="p-1.5 text-emerald-500 dark:text-emerald-400" title="Received">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      ),
    },
  ];

  const hasRows = rows.length > 0;

  return (
    <AdminLayout title="Purchase Orders">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total POs" value={stats.total} sub="all statuses" />
          <StatCard label="Draft" value={stats.draft} sub="pending send" />
          <StatCard label="Sent" value={stats.sent} sub="awaiting receive" />
          <StatCard label="This Month Value" value={`${sym} ${fmtMoney(stats.monthValue)}`} sub="estimated value" />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-9 px-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-xs text-gray-600 dark:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="text-xs text-gray-400 dark:text-neutral-600">
            {rows.length} {rows.length === 1 ? "PO" : "POs"}
          </span>
          <div className="ml-auto">
            <Button
              type="button"
              onClick={() => {
                setEditingPo(null);
                setShowNew(true);
              }}
            >
              <Plus className="w-4 h-4" /> New Purchase Order
            </Button>
          </div>
        </div>

        {hasRows || loading ? (
          <DataTable
            variant="card"
            loading={loading}
            rows={rows}
            columns={columns}
            getRowId={(row) => row._id}
            getRowClassName={() => "hover:bg-gray-50/70 dark:hover:bg-neutral-800/30"}
            emptyMessage="No purchase orders yet."
          />
        ) : (
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-6 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-7 h-7 text-gray-400 dark:text-neutral-500" />
            </div>
            <p className="text-base font-medium text-gray-700 dark:text-neutral-300 mb-1">
              No purchase orders yet
            </p>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mb-5">
              Create your first PO to start tracking stock purchases
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingPo(null);
                setShowNew(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-semibold text-white transition-colors"
            >
              <Plus className="w-4 h-4" /> New Purchase Order
            </button>
          </div>
        )}
      </div>

      {showNew && (
        <NewPoPanel
          editPo={editingPo}
          branches={branches}
          currentBranch={currentBranch}
          hasMultipleBranches={hasMultipleBranches}
          onClose={() => {
            setShowNew(false);
            setEditingPo(null);
          }}
          onSaved={() => {
            setShowNew(false);
            setEditingPo(null);
            load();
          }}
        />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-orange-500" /> {detail.poNumber}
              </h3>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>Supplier:</strong> {detail.supplierName}</p>
              <p><strong>Status:</strong> <StatusPill status={detail.status} /></p>
              <p>
                <strong>Expected:</strong>{" "}
                {detail.expectedDeliveryDate
                  ? new Date(detail.expectedDeliveryDate).toLocaleDateString("en-PK")
                  : "—"}
              </p>
              <p><strong>Estimated Cost:</strong> {sym} {fmtMoney(detail.totalEstimatedCost || 0)}</p>
            </div>
            <div className="mt-4 border rounded-lg overflow-hidden">
              {(detail.lines || []).map((l, i) => (
                <div
                  key={i}
                  className="px-3 py-2 border-b last:border-b-0 text-xs flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{l.itemName}</p>
                    <p className="text-gray-500 dark:text-neutral-400">
                      {l.orderedQty} {l.unit}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {sym} {fmtMoney(Number(l.orderedQty || 0) * Number(l.estimatedUnitCost || 0))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
