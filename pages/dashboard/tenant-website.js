import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getWebsiteSettings, updateWebsiteSettings } from "../../lib/apiClient";
import { ExternalLink, Globe, Copy, CheckCircle2 } from "lucide-react";

export default function TenantWebsiteSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getWebsiteSettings().then(setSettings);
  }, []);

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
      : `${typeof window !== "undefined" ? window.location.origin : ""}/r/${settings.subdomain}`
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
        <p className="text-xs text-neutral-400">Loading website settings…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Restaurant Website">
      {/* Website URL Banner */}
      {websiteUrl && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-neutral-100 mb-1">Your Public Website</p>
                <p className="text-[11px] text-gray-700 dark:text-neutral-400 font-mono bg-bg-primary dark:bg-black/40 px-2 py-1 rounded border border-gray-300 dark:border-neutral-800 inline-block">
                  {websiteUrl}
                </p>
                <p className="text-[10px] text-gray-900 dark:text-neutral-500 mt-1">
                  {settings.isPublic
                    ? "✓ Website is live and accessible to everyone"
                    : "⚠ Website is currently hidden from public"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-bg-primary dark:hover:bg-neutral-900 transition-colors text-xs"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy URL
                  </>
                )}
              </button>
              <button
                onClick={openWebsite}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-secondary transition-colors text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Live Website
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)]">
        <Card
          title="Branding & content"
          description="Control how your restaurant appears on its public website."
        >
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Name</label>
              <input
                type="text"
                value={settings.name || ""}
                onChange={onChange("name")}
                className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Description</label>
              <textarea
                rows={3}
                value={settings.description || ""}
                onChange={onChange("description")}
                className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Logo URL</label>
                <input
                  type="text"
                  value={settings.logoUrl || ""}
                  onChange={onChange("logoUrl")}
                  placeholder="https://…"
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Banner URL</label>
                <input
                  type="text"
                  value={settings.bannerUrl || ""}
                  onChange={onChange("bannerUrl")}
                  placeholder="https://…"
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Phone</label>
                <input
                  type="text"
                  value={settings.contactPhone || ""}
                  onChange={onChange("contactPhone")}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Email</label>
                <input
                  type="email"
                  value={settings.contactEmail || ""}
                  onChange={onChange("contactEmail")}
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px]">Public website</label>
                <select
                  value={settings.isPublic ? "yes" : "no"}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      isPublic: e.target.value === "yes"
                    }))
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                >
                  <option value="yes">Visible to public</option>
                  <option value="no">Hidden (website offline)</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={saving} className="text-xs">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <Card
          title="Preview"
          description="Simple preview of how your website hero may look."
        >
          <div
            className="rounded-xl border border-gray-300 bg-bg-secondary dark:bg-neutral-950 overflow-hidden text-xs cursor-pointer hover:border-primary/50 transition-colors"
            onClick={openWebsite}
            title="Click to view live website"
          >
            <div className="relative h-32">
              {settings.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.bannerUrl}
                  alt="Banner"
                  className="h-full w-full object-cover opacity-70"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/10 via-primary/5 to-amber-100" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/60 to-white/10 dark:from-black dark:via-black/80 dark:to-black/20" />
              <div className="absolute left-4 bottom-3 flex items-center gap-3">
                {settings.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="h-10 w-10 rounded-lg object-cover border border-gray-300 dark:border-neutral-700 bg-bg-secondary dark:bg-neutral-900"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold">
                    {(settings.name || "R")[0]}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {settings.name || "Restaurant name"}
                  </div>
                  {settings.address && (
                    <div className="text-[11px] text-gray-900 dark:text-neutral-300">
                      {settings.address}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 text-[11px] text-gray-700 dark:text-neutral-300 space-y-2 bg-bg-secondary dark:bg-neutral-950">
              <p className="line-clamp-2">
                {settings.description ||
                  "Describe your restaurant, cuisine and signature dishes so guests know what to expect."}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-gray-300 dark:border-neutral-800">
                <p className="text-gray-900 dark:text-neutral-500">
                  Public website is{" "}
                  <span className="font-semibold text-gray-900 dark:text-neutral-200">
                    {settings.isPublic ? "visible" : "hidden"}
                  </span>
                </p>
                <span className="inline-flex items-center gap-1 text-primary text-[10px] font-medium">
                  <ExternalLink className="w-3 h-3" />
                  Click to view live
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

