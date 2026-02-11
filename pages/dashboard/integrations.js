import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import {
  getIntegrations,
  saveIntegration,
  toggleIntegration,
  deleteIntegration,
  SubscriptionInactiveError
} from "../../lib/apiClient";
import { Plus, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight, Loader2, RefreshCw, Link2 } from "lucide-react";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";

const PLATFORMS = [
  {
    value: "FOODPANDA",
    label: "Foodpanda",
    color: "bg-pink-100 text-pink-700 border-pink-300",
    logo: "🐼",
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
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setError("")}
          >
            dismiss
          </button>
        </div>
      )}

      <Card
        title="Third-party Integrations"
        description="Connect food delivery platforms to receive orders automatically."
      >
        <div className="flex items-center justify-between mb-4">
          <Button
            type="button"
            variant="ghost"
            className="text-xs gap-1"
            onClick={loadIntegrations}
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
          {!configuredPlatforms.has("FOODPANDA") && (
            <Button type="button" className="gap-1 text-xs" onClick={openAddModal}>
              <Plus className="w-3 h-3" />
              Add Foodpanda
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : integrations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-2">🐼</div>
            <p className="text-sm text-neutral-500 mb-1">No integrations configured</p>
            <p className="text-xs text-neutral-400 mb-4">
              Connect Foodpanda to receive delivery orders directly on your order board.
            </p>
            <Button type="button" className="gap-1 text-xs" onClick={openAddModal}>
              <Plus className="w-3 h-3" />
              Connect Foodpanda
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map(integration => {
              const platform = PLATFORMS.find(p => p.value === integration.platform);
              const isToggling = togglingId === integration.id;

              return (
                <div
                  key={integration.id}
                  className={`rounded-xl border p-4 ${
                    integration.isActive
                      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/5 dark:border-emerald-500/30"
                      : "border-gray-300 bg-bg-primary dark:bg-neutral-950 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{platform?.logo || "🔗"}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {platform?.label || integration.platform}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              integration.isActive
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40"
                                : "bg-bg-primary text-gray-500 border-gray-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                            }`}
                          >
                            {integration.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {platform?.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggle(integration.id)}
                        disabled={isToggling}
                        className="inline-flex items-center gap-1 text-[11px] text-gray-700 dark:text-neutral-300 hover:text-primary transition-colors"
                      >
                        {isToggling ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : integration.isActive ? (
                          <ToggleRight className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2"
                        onClick={() => openEditModal(integration)}
                      >
                        <Link2 className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 text-red-500 hover:bg-red-50 dark:hover:bg-secondary/10"
                        onClick={() => handleDelete(integration.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Credentials summary */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                    <div className="space-y-0.5">
                      <label className="text-[10px] uppercase tracking-wide text-neutral-500">
                        Store ID
                      </label>
                      <p className="font-mono text-gray-900 dark:text-neutral-200">
                        {integration.storeId || "—"}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] uppercase tracking-wide text-neutral-500">
                        API Key
                      </label>
                      <div className="flex items-center gap-1">
                        <p className="font-mono text-gray-900 dark:text-neutral-200">
                          {showSecrets[integration.id]
                            ? integration.apiKey || "—"
                            : integration.apiKey
                            ? "••••" + integration.apiKey.slice(-4)
                            : "—"}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleShowSecret(integration.id)}
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          {showSecrets[integration.id] ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] uppercase tracking-wide text-neutral-500">
                        Last Synced
                      </label>
                      <p className="text-gray-900 dark:text-neutral-200">
                        {integration.lastSyncAt
                          ? new Date(integration.lastSyncAt).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                  </div>

                  {/* Webhook URL hint */}
                  {integration.isActive && (
                    <div className="mt-3 p-2 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-800 text-[11px]">
                      <label className="text-[10px] uppercase tracking-wide text-neutral-500 block mb-1">
                        Webhook URL (share with Foodpanda)
                      </label>
                      <code className="text-primary break-all font-mono text-[11px]">
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
      </Card>

      {/* Test Sync Card */}
      {integrations.some(i => i.isActive) && (
        <div className="mt-4">
          <TestSyncCard integrations={integrations} onOrderCreated={loadIntegrations} />
        </div>
      )}

      {/* Modal for add/edit credentials */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-5 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🐼</span>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Foodpanda Integration
              </h2>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-neutral-400 mb-4">
              Enter your Foodpanda merchant API credentials. These are used to
              verify incoming webhook orders.
            </p>
            {modalError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-400">
                {modalError}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  Store ID <span className="text-red-500">*</span>
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
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  API Key
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
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">
                  API Secret
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
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="gap-1" disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  {saving ? "Saving..." : "Save credentials"}
                </Button>
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
    <Card
      title="Test Foodpanda Sync"
      description="Simulate a Foodpanda order to verify your integration works. The order will appear on your All Orders page."
    >
      <form onSubmit={handleTest} className="space-y-3 text-xs">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
              Customer Name
            </label>
            <input
              type="text"
              value={testForm.customerName}
              onChange={e =>
                setTestForm(prev => ({ ...prev, customerName: e.target.value }))
              }
              placeholder="Foodpanda Customer"
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
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
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
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
            className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
          />
        </div>
        <div className="space-y-1">
          <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
            Items (format: name:qty:price, separated by commas)
          </label>
          <input
            type="text"
            value={testForm.items}
            onChange={e =>
              setTestForm(prev => ({ ...prev, items: e.target.value }))
            }
            placeholder="Cheezy Pizza:2:1300, Crunch Burger:1:550"
            className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60 font-mono"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
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
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            >
              <option value="ONLINE">Online</option>
              <option value="CASH">Cash on Delivery</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-gray-700 dark:text-neutral-300 text-[11px]">
              Total (auto-calculated if empty)
            </label>
            <input
              type="number"
              min="0"
              value={testForm.total}
              onChange={e =>
                setTestForm(prev => ({ ...prev, total: e.target.value }))
              }
              placeholder="Auto"
              className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>
        </div>

        {testError && (
          <p className="text-[11px] text-red-600">{testError}</p>
        )}
        {result && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-[11px] text-emerald-700 dark:text-emerald-400">
            Order created successfully! Order number:{" "}
            <span className="font-semibold">{result.orderNumber}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button type="submit" className="gap-1 text-xs" disabled={testing}>
            {testing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {testing ? "Sending..." : "Send Test Order"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
