import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getIntegrations,
  saveIntegration,
  toggleIntegration,
  deleteIntegration,
  SubscriptionInactiveError
} from "../../lib/apiClient";
import { Plus, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight, Loader2, RefreshCw, Link2, Package } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";

const PLATFORMS = [
  {
    value: "FOODPANDA",
    label: "Foodpanda",
    color: "bg-primary/10 text-primary border-primary/30",
    description: "Sync delivery orders from Foodpanda directly into your order board."
  }
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState([]);
  const [error, setError] = useState("");
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    platform: "FOODPANDA",
    storeId: "",
    apiKey: "",
    apiSecret: ""
  });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [modalError, setModalError] = useState("");

  const { confirm } = useConfirmDialog();

  async function loadIntegrations() {
    setLoading(true);
    try {
      const data = await getIntegrations();
      setIntegrations(data);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        setError(err.message || "Failed to load integrations");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntegrations();
  }, []);

  function resetForm() {
    setForm({ platform: "FOODPANDA", storeId: "", apiKey: "", apiSecret: "" });
  }

  function openAddModal() {
    resetForm();
    setModalError("");
    setIsModalOpen(true);
  }

  function openEditModal(integration) {
    setForm({
      platform: integration.platform,
      storeId: integration.storeId || "",
      apiKey: "",
      apiSecret: ""
    });
    setModalError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.storeId.trim()) {
      setModalError("Store ID is required");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        platform: form.platform,
        storeId: form.storeId
      };
      if (form.apiKey) payload.apiKey = form.apiKey;
      if (form.apiSecret) payload.apiSecret = form.apiSecret;

      const updated = await saveIntegration(payload);
      setIntegrations(prev => {
        const exists = prev.find(i => i.platform === updated.platform);
        if (exists) {
          return prev.map(i => (i.platform === updated.platform ? updated : i));
        }
        return [...prev, updated];
      });
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      setModalError(err.message || "Failed to save integration");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id) {
    setTogglingId(id);
    setError("");
    try {
      const updated = await toggleIntegration(id);
      setIntegrations(prev => prev.map(i => (i.id === id ? updated : i)));
    } catch (err) {
      setError(err.message || "Failed to toggle integration");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete integration",
      message: "Delete this integration? Webhook orders will stop being received."
    });
    if (!ok) return;
    try {
      await deleteIntegration(id);
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete integration");
    }
  }

  function toggleShowSecret(id) {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Check which platforms are already configured
  const configuredPlatforms = new Set(integrations.map(i => i.platform));

  return (
    <AdminLayout title="Integrations" suspended={suspended}>
      {error && (
        <div className="mb-5 rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-5 py-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between shadow-sm">
          <span className="font-medium">{error}</span>
          <button
            type="button"
            className="text-xs underline hover:no-underline"
            onClick={() => setError("")}
          >
            dismiss
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Third-party Integrations</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400">Connected platforms and webhooks</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-gray-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={loadIntegrations}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {!configuredPlatforms.has("FOODPANDA") && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Foodpanda
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : integrations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <p className="text-base font-bold text-gray-900 dark:text-white mb-2">No integrations configured</p>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-6 max-w-md mx-auto">
              Connect Foodpanda to receive delivery orders directly on your order board
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-5 h-5" />
              Connect Foodpanda
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {integrations.map(integration => {
              const platform = PLATFORMS.find(p => p.value === integration.platform);
              const isToggling = togglingId === integration.id;

              return (
                <div
                  key={integration.id}
                  className={`rounded-2xl border-2 p-5 transition-all shadow-sm hover:shadow-lg ${
                    integration.isActive
                      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/30"
                      : "border-gray-200 bg-gray-50 dark:bg-neutral-900 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg ${
                      integration.isActive
                        ? "bg-gradient-to-br from-primary to-secondary"
                        : "bg-gradient-to-br from-gray-400 to-gray-500"
                    }`}>
                      <Package className="w-7 h-7 text-white" />
                    </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            {platform?.label || integration.platform}
                          </h3>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                              integration.isActive
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40"
                                : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                            }`}
                          >
                            {integration.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-neutral-400">
                          {platform?.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(integration.id)}
                        disabled={isToggling}
                        className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-neutral-800 transition-colors"
                      >
                        {isToggling ? (
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        ) : integration.isActive ? (
                          <ToggleRight className="w-7 h-7 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-gray-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(integration)}
                        className="p-2 rounded-lg hover:bg-white dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-primary transition-colors"
                      >
                        <Link2 className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(integration.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Credentials summary */}
                  <div className="grid gap-4 sm:grid-cols-3 text-sm">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500 font-bold flex items-center gap-1">
                        🏪 Store ID
                      </label>
                      <p className="font-mono text-base font-bold text-gray-900 dark:text-white px-3 py-2 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                        {integration.storeId || "—"}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500 font-bold flex items-center gap-1">
                        🔑 API Key
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                        <p className="flex-1 font-mono text-base font-bold text-gray-900 dark:text-white">
                          {showSecrets[integration.id]
                            ? integration.apiKey || "—"
                            : integration.apiKey
                            ? "••••" + integration.apiKey.slice(-4)
                            : "—"}
                        </p>
                        {integration.apiKey && (
                          <button
                            type="button"
                            onClick={() => toggleShowSecret(integration.id)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                          >
                            {showSecrets[integration.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-500 font-bold flex items-center gap-1">
                        ⏱️ Last Synced
                      </label>
                      <p className="font-semibold text-base text-gray-900 dark:text-white px-3 py-2 rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                        {integration.lastSyncAt
                          ? new Date(integration.lastSyncAt).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                  </div>

                  {/* Webhook URL hint */}
                  {integration.isActive && (
                    <div className="mt-4 p-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-blue-200 dark:border-blue-500/30">
                      <label className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold mb-2 flex items-center gap-1">
                        🔗 Webhook URL
                        <span className="text-[10px] normal-case font-normal text-gray-500">(share with Foodpanda)</span>
                      </label>
                      <code className="text-primary break-all font-mono text-sm block p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                        {typeof window !== "undefined"
                          ? `${window.location.origin.replace(":3000", ":5001")}/api/webhooks/foodpanda/${integration.restaurantId}`
                          : `/api/webhooks/foodpanda/[restaurantId]`}
                      </code>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Test Sync Card */}
      {integrations.some(i => i.isActive) && (
        <div className="mt-6">
          <TestSyncCard integrations={integrations} onOrderCreated={loadIntegrations} />
        </div>
      )}

      {/* Modal for add/edit credentials */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Foodpanda Integration
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  Configure merchant API credentials
                </p>
              </div>
            </div>
            {modalError && (
              <div className="mb-4 rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5 mt-5" autoComplete="off">
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  🏪 Store ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fp_store_id"
                  autoComplete="off"
                  value={form.storeId}
                  onChange={e =>
                    setForm(prev => ({ ...prev, storeId: e.target.value }))
                  }
                  placeholder="e.g. s8dy-fnk2"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  🔑 API Key
                </label>
                <input
                  type="text"
                  name="fp_api_key"
                  autoComplete="off"
                  value={form.apiKey}
                  onChange={e =>
                    setForm(prev => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder="Paste your Foodpanda API key"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  🔐 API Secret
                </label>
                <input
                  type="text"
                  name="fp_api_secret"
                  autoComplete="new-password"
                  value={form.apiSecret}
                  onChange={e =>
                    setForm(prev => ({ ...prev, apiSecret: e.target.value }))
                  }
                  placeholder="Paste your Foodpanda API secret"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Save credentials
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// ─── Test Sync card ──────────────────────────────────────────────────────────
// Lets the restaurant admin manually test creating a Foodpanda order via the webhook

function TestSyncCard({ integrations, onOrderCreated }) {
  const [testForm, setTestForm] = useState({
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    items: "Cheezy Pizza:1:1300",
    paymentMethod: "ONLINE",
    total: ""
  });
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  const foodpanda = integrations.find(i => i.platform === "FOODPANDA" && i.isActive);
  if (!foodpanda) return null;

  async function handleTest(e) {
    e.preventDefault();
    setTesting(true);
    setTestError("");
    setResult(null);

    try {
      // Parse items: "name:qty:price, name:qty:price"
      const parsedItems = testForm.items
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
          const [name, qty, price] = s.split(":");
          return {
            name: (name || "").trim(),
            quantity: parseInt(qty) || 1,
            unitPrice: parseFloat(price) || 0
          };
        });

      if (parsedItems.length === 0) {
        setTestError("At least one item is required (format: name:qty:price)");
        setTesting(false);
        return;
      }

      const computedTotal =
        parseFloat(testForm.total) ||
        parsedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

      // Use the authenticated test endpoint (no API key needed)
      const { apiFetch: testApiFetch } = await import("../../lib/apiClient");

      // We can't use apiFetch directly since it's not designed for this.
      // Instead, use the saveIntegration-style call to our test endpoint.
      const apiBase =
        typeof window !== "undefined"
          ? window.location.origin.replace(":3000", ":5001")
          : "";

      const auth = JSON.parse(
        typeof window !== "undefined"
          ? window.localStorage.getItem("restaurantos_auth") || "{}"
          : "{}"
      );

      const headers = { "Content-Type": "application/json" };
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

      // Get tenant slug for x-tenant-slug header
      const slugMatch = window.location.pathname.match(/^\/r\/([^/]+)\//);
      if (slugMatch) headers["x-tenant-slug"] = slugMatch[1];

      const res = await fetch(
        `${apiBase}/api/integrations/test-order`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            externalOrderId: `FP-TEST-${Date.now()}`,
            customerName: testForm.customerName || "Test Customer",
            customerPhone: testForm.customerPhone || "",
            deliveryAddress: testForm.deliveryAddress || "Test Address",
            items: parsedItems,
            paymentMethod: testForm.paymentMethod,
            total: computedTotal,
            subtotal: computedTotal,
            discountAmount: 0
          })
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setTestError(data.message || "Test failed");
      } else {
        setResult(data);
        if (onOrderCreated) onOrderCreated();
      }
    } catch (err) {
      setTestError(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
          <RefreshCw className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Test Foodpanda Sync</h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400">Simulate an order to verify your integration</p>
        </div>
      </div>

      <form onSubmit={handleTest} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
              Customer Name
            </label>
            <input
              type="text"
              value={testForm.customerName}
              onChange={e =>
                setTestForm(prev => ({ ...prev, customerName: e.target.value }))
              }
              placeholder="Foodpanda Customer"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
              Phone
            </label>
            <input
              type="text"
              value={testForm.customerPhone}
              onChange={e =>
                setTestForm(prev => ({
                  ...prev,
                  customerPhone: e.target.value
                }))
              }
              placeholder="+923001234567"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
            Delivery Address
          </label>
          <input
            type="text"
            value={testForm.deliveryAddress}
            onChange={e =>
              setTestForm(prev => ({
                ...prev,
                deliveryAddress: e.target.value
              }))
            }
            placeholder="Food Street Phase 7, Bahria Town RWP"
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
            Items <span className="text-xs font-normal text-gray-500">(format: name:qty:price, separated by commas)</span>
          </label>
          <input
            type="text"
            value={testForm.items}
            onChange={e =>
              setTestForm(prev => ({ ...prev, items: e.target.value }))
            }
            placeholder="Cheezy Pizza:2:1300, Crunch Burger:1:550"
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
              Payment Method
            </label>
            <select
              value={testForm.paymentMethod}
              onChange={e =>
                setTestForm(prev => ({
                  ...prev,
                  paymentMethod: e.target.value
                }))
              }
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="ONLINE">Online</option>
              <option value="CASH">Cash on Delivery</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">
              Total <span className="text-xs font-normal text-gray-500">(auto-calculated if empty)</span>
            </label>
            <input
              type="number"
              min="0"
              value={testForm.total}
              onChange={e =>
                setTestForm(prev => ({ ...prev, total: e.target.value }))
              }
              placeholder="Auto"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>

        {testError && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
            {testError}
          </div>
        )}
        {result && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Order created successfully! Order number:{" "}
            <span className="font-bold">{result.orderNumber}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={testing}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {testing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Send Test Order
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
