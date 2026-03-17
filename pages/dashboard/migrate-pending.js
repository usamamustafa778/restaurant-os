/**
 * ONE-TIME MIGRATION PAGE
 * Converts all PENDING payments on completed orders to ONLINE (Easypaisa).
 *
 * DELETE THIS FILE + pages/api/migrate-pending-to-online.js after use.
 */
import { useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getOrders, getStoredAuth } from "../../lib/apiClient";
import toast from "react-hot-toast";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

const ACCOUNT_NAME = "Easypaisa - 03408060908";

function getTenantSlugFromLocation() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain || typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  if (hostname.endsWith(rootDomain)) {
    const prefix = hostname.slice(0, -(rootDomain.length + 1));
    if (prefix && prefix !== "www" && !prefix.includes(".")) return prefix;
  }
  return null;
}

function getCurrentBranchId() {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem("restaurant_os_branch");
  return id && id !== "all" ? id : null;
}

export default function MigratePendingPage() {
  const [step, setStep] = useState("idle");
  const [affected, setAffected] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [migrating, setMigrating] = useState(false);

  async function handleScan() {
    setScanning(true);
    setStep("scanning");
    try {
      const raw = await getOrders();
      const orders = Array.isArray(raw) ? raw : (raw?.orders ?? []);
      const pending = orders.filter((o) => {
        const status = (o.status || "").toUpperCase();
        if (status !== "DELIVERED" && status !== "COMPLETED") return false;
        const pm = (o.paymentMethod || "").toUpperCase();
        return pm === "PENDING" || pm === "TO BE PAID" || pm === "";
      });
      setAffected(pending);
      setTotalAmount(pending.reduce((sum, o) => sum + (Number(o.total) || 0), 0));
      setStep("preview");
    } catch (err) {
      toast.error(err.message || "Failed to scan orders");
      setStep("idle");
    } finally {
      setScanning(false);
    }
  }

  async function handleMigrate() {
    if (affected.length === 0) return;
    setMigrating(true);
    setStep("migrating");

    const auth = getStoredAuth();
    const token = auth?.token || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const slug = getTenantSlugFromLocation();
    if (slug) headers["x-tenant-slug"] = slug;
    const branchId = getCurrentBranchId();
    if (branchId) headers["x-branch-id"] = branchId;

    try {
      const orderIds = affected.map((o) => o.id || o._id);
      const res = await fetch("/api/migrate-pending-to-online", {
        method: "POST",
        headers,
        body: JSON.stringify({ orderIds, accountName: ACCOUNT_NAME }),
      });
      const data = await res.json();
      setResult(data);
      setStep("done");
      if (data.failed === 0) {
        toast.success(`Migration complete! ${data.success} orders updated.`);
      } else {
        toast.error(`${data.success} succeeded, ${data.failed} failed.`);
      }
    } catch (err) {
      toast.error(err.message || "Migration failed");
      setStep("preview");
    } finally {
      setMigrating(false);
    }
  }

  return (
    <AdminLayout title="Migrate Pending Payments">
      <div className="max-w-2xl mx-auto py-8 space-y-6">

        <div className="bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">One-Time Migration</h2>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                This will change all <strong>PENDING</strong> payments on completed/delivered orders to
                <strong> ONLINE → {ACCOUNT_NAME}</strong>. This cannot be undone.
                Delete this page after use.
              </p>
            </div>
          </div>
        </div>

        {step === "idle" && (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-neutral-400 mb-4">
              Step 1: Scan all orders to find affected PENDING payments.
            </p>
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Scan Orders
            </button>
          </div>
        )}

        {step === "scanning" && (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-8 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Scanning orders...</p>
          </div>
        )}

        {step === "preview" && (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Scan Results</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 text-center">
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase font-semibold mb-1">Affected Orders</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{affected.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 text-center">
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase font-semibold mb-1">Total Amount</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">Rs {Math.round(totalAmount).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 text-center">
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase font-semibold mb-1">Target Account</p>
                  <p className="text-sm font-bold text-violet-600 dark:text-violet-400 mt-1">Easypaisa</p>
                </div>
              </div>

              {affected.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-gray-100 dark:border-neutral-800 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-neutral-500">
                        <th className="text-left px-3 py-2 font-semibold">Order</th>
                        <th className="text-left px-3 py-2 font-semibold">Status</th>
                        <th className="text-left px-3 py-2 font-semibold">Current Payment</th>
                        <th className="text-right px-3 py-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {affected.slice(0, 50).map((o) => (
                        <tr key={o.id || o._id} className="text-gray-700 dark:text-neutral-300">
                          <td className="px-3 py-1.5 font-medium">{o.orderNumber || o.id || o._id}</td>
                          <td className="px-3 py-1.5">{o.status}</td>
                          <td className="px-3 py-1.5 text-amber-600 dark:text-amber-400">{o.paymentMethod || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-semibold">Rs {Number(o.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {affected.length > 50 && (
                    <p className="text-center text-[10px] text-gray-400 py-2">Showing first 50 of {affected.length}</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-neutral-800 flex gap-3">
              <button
                type="button"
                onClick={() => { setStep("idle"); setAffected([]); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMigrate}
                disabled={affected.length === 0 || migrating}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Migrate {affected.length} Orders to Easypaisa
              </button>
            </div>
          </div>
        )}

        {step === "migrating" && (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-8 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Migrating {affected.length} orders...</p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">This may take a moment. Do not close this page.</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Migration Complete</h3>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-center">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold mb-1">Succeeded</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{result.success}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-center">
                  <p className="text-[10px] text-red-600 dark:text-red-400 uppercase font-semibold mb-1">Failed</p>
                  <p className="text-2xl font-black text-red-700 dark:text-red-400">{result.failed}</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-4 max-h-32 overflow-y-auto text-xs text-red-600 dark:text-red-400 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i}>{e.orderId}: {e.error}</p>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-4">
                All {result.success} orders now have paymentMethod: ONLINE, paymentProvider: {ACCOUNT_NAME}.
                You can delete this page and <code className="bg-gray-100 dark:bg-neutral-800 px-1 rounded">pages/api/migrate-pending-to-online.js</code> now.
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
