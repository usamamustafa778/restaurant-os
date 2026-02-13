import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getWebsiteSettings, updateWebsiteSettings, getBranches } from "../../lib/apiClient";
import { ExternalLink, Globe, Copy, CheckCircle2, Settings, Eye, EyeOff, Phone, Mail, Image, FileText, ShoppingCart, X } from "lucide-react";

export default function TenantWebsiteSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchOrderSettings, setBranchOrderSettings] = useState({});
  const [savingOrderSettings, setSavingOrderSettings] = useState(false);

  useEffect(() => {
    getWebsiteSettings().then(setSettings);
    loadBranches();
  }, []);

  async function loadBranches() {
    try {
      const data = await getBranches();
      const branchesList = Array.isArray(data) ? data : (data.branches || []);
      setBranches(branchesList);
      // Initialize branch order settings from branch data or default to restaurant-level setting
      const initialSettings = {};
      branchesList.forEach(branch => {
        // Use branch-level setting if available, otherwise use restaurant-level setting
        initialSettings[branch.id] = branch.allowWebsiteOrders !== undefined 
          ? branch.allowWebsiteOrders !== false 
          : (settings?.allowWebsiteOrders !== false);
      });
      setBranchOrderSettings(initialSettings);
    } catch (err) {
      console.error("Failed to load branches:", err);
    }
  }

  useEffect(() => {
    if (showOrderModal && branches.length > 0) {
      // Reload branch settings when modal opens
      const initialSettings = {};
      branches.forEach(branch => {
        initialSettings[branch.id] = branch.allowWebsiteOrders !== undefined 
          ? branch.allowWebsiteOrders !== false 
          : (settings?.allowWebsiteOrders !== false);
      });
      setBranchOrderSettings(initialSettings);
    }
  }, [showOrderModal, branches, settings]);

  async function handleSaveOrderSettings() {
    setSavingOrderSettings(true);
    try {
      // Update branch-level order settings via API
      // For now, if all branches allow orders, set restaurant-level to true
      // Otherwise, set to false (most restrictive)
      const allBranchesAllow = Object.values(branchOrderSettings).every(v => v === true);
      const anyBranchAllows = Object.values(branchOrderSettings).some(v => v === true);
      
      // Update restaurant-level setting based on branch settings
      const updatedSettings = { 
        ...settings, 
        allowWebsiteOrders: allBranchesAllow 
      };
      await updateWebsiteSettings(updatedSettings);
      setSettings(updatedSettings);
      
      // TODO: Update individual branch settings via API endpoint
      // For now, we'll show a success message
      setShowOrderModal(false);
    } catch (err) {
      console.error("Failed to save order settings:", err);
      alert("Failed to save order settings. Please try again.");
    } finally {
      setSavingOrderSettings(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateWebsiteSettings(settings);
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  }

  const onChange = field => e =>
    setSettings(prev => ({ ...prev, [field]: e.target.value }));

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const websiteUrl = settings?.subdomain
    ? rootDomain
      ? `https://${settings.subdomain}.${rootDomain}`
      : `${typeof window !== "undefined" ? window.location.origin : ""}/${settings.subdomain}`
    : null;

  const copyToClipboard = () => {
    if (websiteUrl) {
      navigator.clipboard.writeText(websiteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openWebsite = () => {
    if (websiteUrl) {
      window.open(websiteUrl, "_blank");
    }
  };

  if (!settings) {
    return (
      <AdminLayout title="Restaurant Website">
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Loading website settings…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Website Settings">
      {/* Website URL Banner */}
      {websiteUrl && (
        <div className="mb-6 rounded-2xl border-2 border-primary/30 dark:border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-lg">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-lg">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900 dark:text-white mb-2">Your Public Website</p>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-gray-700 dark:text-neutral-300 font-mono bg-white dark:bg-neutral-900 px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-neutral-700">
                    {websiteUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {settings.isPublic ? (
                    <>
                      <Eye className="w-4 h-4 text-emerald-500" />
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                        Website is live and accessible to everyone
                      </p>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4 text-orange-500" />
                      <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
                        Website is currently hidden from public
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all text-sm font-semibold"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy URL
                  </>
                )}
              </button>
              <button
                onClick={openWebsite}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all text-sm font-bold"
              >
                <ExternalLink className="w-4 h-4" />
                View Live Website
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Settings Form */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Branding & Content</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Configure your restaurant's public appearance</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Restaurant Name</label>
              <input
                type="text"
                value={settings.name || ""}
                onChange={onChange("name")}
                placeholder="Your Restaurant Name"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Description</label>
              <textarea
                rows={4}
                value={settings.description || ""}
                onChange={onChange("description")}
                placeholder="Tell customers about your restaurant..."
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Image className="w-3.5 h-3.5" />
                  Logo URL
                </label>
                <input
                  type="text"
                  value={settings.logoUrl || ""}
                  onChange={onChange("logoUrl")}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Image className="w-3.5 h-3.5" />
                  Banner URL
                </label>
                <input
                  type="text"
                  value={settings.bannerUrl || ""}
                  onChange={onChange("bannerUrl")}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={settings.contactPhone || ""}
                  onChange={onChange("contactPhone")}
                  placeholder="03XX-XXXXXXX"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Contact Email
                </label>
                <input
                  type="email"
                  value={settings.contactEmail || ""}
                  onChange={onChange("contactEmail")}
                  placeholder="contact@restaurant.com"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                {settings.isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                Website Visibility
              </label>
              <select
                value={settings.isPublic ? "yes" : "no"}
                onChange={e =>
                  setSettings(prev => ({
                    ...prev,
                    isPublic: e.target.value === "yes"
                  }))
                }
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
              >
                <option value="yes">✓ Visible to Public</option>
                <option value="no">✗ Hidden (Website Offline)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <Settings className="w-5 h-5" />
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Preview */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Live Preview</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400">How your website will appear</p>
            </div>
          </div>
          <div
            className="rounded-2xl border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden cursor-pointer hover:border-primary hover:shadow-xl transition-all group"
            onClick={openWebsite}
            title="Click to view live website"
          >
            <div className="relative h-40">
              {settings.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.bannerUrl}
                  alt="Banner"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
              <div className="absolute left-5 bottom-4 flex items-center gap-3">
                {settings.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="h-12 w-12 rounded-xl object-cover border-2 border-white shadow-lg"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-lg font-bold shadow-lg">
                    {(settings.name || "R")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-base font-bold text-white drop-shadow-lg">
                    {settings.name || "Restaurant Name"}
                  </div>
                  {settings.contactPhone && (
                    <div className="text-xs text-white/90 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {settings.contactPhone}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3 bg-gray-50 dark:bg-neutral-900">
              <p className="text-sm text-gray-700 dark:text-neutral-300 line-clamp-3">
                {settings.description ||
                  "Describe your restaurant, cuisine and signature dishes so guests know what to expect when they visit your website."}
              </p>
              
              {settings.contactEmail && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400">
                  <Mail className="w-3.5 h-3.5" />
                  {settings.contactEmail}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t-2 border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  {settings.isPublic ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Live</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-xs font-bold text-gray-500 dark:text-neutral-500">Offline</span>
                    </>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 text-primary text-xs font-bold group-hover:gap-2 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Live Site
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => router.push("/dashboard/website-content")}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all text-sm font-semibold"
            >
              <FileText className="w-4 h-4" />
              Website Content
            </button>
            <button
              onClick={() => setShowOrderModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-all text-sm font-semibold"
            >
              <ShoppingCart className="w-4 h-4" />
              Manage Website Orders
            </button>
          </div>
        </div>
      </div>

      {/* Branch Order Settings Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Manage Website Orders by Branch
                </h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                  Control whether customers can place orders from your website for each branch
                </p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-neutral-400" />
              </button>
            </div>

            {branches.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-neutral-400">
                  No branches found. Please create a branch first.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> Currently, order settings are applied at the restaurant level. 
                    Branch-specific order control will be available in a future update.
                  </p>
                </div>
                <div className="space-y-3 mb-6">
                  {branches.map((branch) => (
                    <div
                      key={branch.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        branchOrderSettings[branch.id] !== false
                          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                          : "border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {branch.name}
                          </h3>
                          {branchOrderSettings[branch.id] !== false && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                              Orders Enabled
                            </span>
                          )}
                          {branchOrderSettings[branch.id] === false && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 text-[10px] font-semibold">
                              Orders Disabled
                            </span>
                          )}
                        </div>
                        {branch.address && (
                          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                            {branch.address}
                          </p>
                        )}
                        {branch.code && (
                          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                            Code: {branch.code}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setBranchOrderSettings(prev => ({
                            ...prev,
                            [branch.id]: !prev[branch.id]
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full flex-shrink-0 transition-colors ml-4 ${
                          branchOrderSettings[branch.id] !== false
                            ? "bg-primary"
                            : "bg-gray-300 dark:bg-neutral-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            branchOrderSettings[branch.id] !== false
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOrderSettings}
                disabled={savingOrderSettings}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingOrderSettings ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

