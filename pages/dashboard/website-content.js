import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useBranch } from "../../contexts/BranchContext";
import {
  getWebsiteSettings,
  updateWebsiteSettings,
  getMenu,
  uploadImage,
} from "../../lib/apiClient";
import toast from "react-hot-toast";
import {
  Globe,
  Loader2,
  Save,
  Palette,
  Image as ImageIcon,
  Type,
  Phone,
  Mail,
  MapPin,
  Link as LinkIcon,
  Upload,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ShoppingCart,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Clock,
  Layout,
  Sparkles,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  GripVertical,
  X,
  Check,
} from "lucide-react";

const SECTIONS = [
  { id: "template", label: "Template", icon: Layout },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "contact", label: "Contact", icon: Phone },
  { id: "hero", label: "Hero Slides", icon: ImageIcon },
  { id: "theme", label: "Theme", icon: Sparkles },
  { id: "social", label: "Social Media", icon: Globe },
  { id: "hours", label: "Opening Hours", icon: Clock },
  { id: "sections", label: "Website Sections", icon: Layout },
  { id: "settings", label: "Settings", icon: Eye },
];

const inp =
  "w-full h-10 px-4 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";
const labelCls =
  "block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5";
const btnPrimary =
  "inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
const btnSecondary =
  "inline-flex items-center gap-2 h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors";
const cardCls =
  "bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm";

// Unified gradient for all section icons so headings consistently use the brand primary
const iconAccentPrimary = "from-primary to-secondary";

const TEMPLATES = [
  {
    id: "classic",
    name: "Classic",
    desc: "Traditional restaurant layout with hero carousel, menu grid, and full-width sections.",
    color: "from-red-500 to-orange-500",
  },
  {
    id: "modern",
    name: "Modern",
    desc: "Sleek glass navbar, full-bleed hero, card grid menu, and modern typography.",
    color: "from-violet-500 to-indigo-500",
  },
  {
    id: "minimal",
    name: "Minimal",
    desc: "Editorial typography, wine-list menu style, serif headings. Elegant and fast.",
    color: "from-emerald-500 to-teal-500",
  },
];

function SectionCard({
  id,
  icon: Icon,
  title,
  subtitle,
  iconColor,
  bodyClassName = "",
  children,
}) {
  return (
    <div id={`section-${id}`} className={cardCls}>
      <div className="px-6 py-5 flex items-center gap-3 border-b border-gray-100 dark:border-neutral-800">
        <div
          className={`h-9 w-9 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center shadow-md flex-shrink-0`}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            {subtitle}
          </p>
        </div>
      </div>
      <div className={`p-6 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function MediaField({ label, value, onChange }) {
  const [mode, setMode] = useState(value ? "link" : "link");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadImage(file);
      onChange(result.url || result.secure_url || "");
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className={labelCls}>{label}</label>
        <div className="inline-flex rounded-xl border-2 border-gray-200 dark:border-neutral-700 overflow-hidden">
          {[
            ["link", LinkIcon, "URL"],
            ["upload", Upload, "Upload"],
          ].map(([t, Ic, lab]) => (
            <button
              key={t}
              type="button"
              onClick={() => setMode(t)}
              className={`inline-flex items-center gap-1.5 px-3 h-7 text-xs font-semibold transition-colors ${
                mode === t
                  ? "bg-gradient-to-r from-primary to-secondary text-white"
                  : "bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"
              }`}
            >
              <Ic className="w-3 h-3" />
              {lab}
            </button>
          ))}
        </div>
      </div>
      {mode === "link" ? (
        <input
          type="url"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className={inp}
        />
      ) : (
        <label
          className={`flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 cursor-pointer hover:border-primary transition-colors text-sm text-gray-500 ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? "Uploading..." : "Choose file"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      )}
      {value && (
        <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function WebsiteContentPage() {
  const { activeBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ws, setWs] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [activeSection, setActiveSection] = useState("template");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, menu] = await Promise.all([
        getWebsiteSettings(),
        getMenu(activeBranch?.id).catch(() => ({ items: [] })),
      ]);
      setWs(settings || {});
      const items = menu?.items || menu?.menu || [];
      setMenuItems(Array.isArray(items) ? items : []);
    } catch {
      toast.error("Failed to load website settings");
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function update(key, value) {
    setWs((prev) => ({ ...prev, [key]: value }));
  }

  function updateNested(parent, key, value) {
    setWs((prev) => ({
      ...prev,
      [parent]: { ...(prev[parent] || {}), [key]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    const toastId = toast.loading("Saving website settings...");
    try {
      const updated = await updateWebsiteSettings(ws);
      setWs(updated || ws);
      toast.success("Website settings saved!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  function scrollTo(id) {
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  // Hero slide helpers
  function addHeroSlide() {
    const slides = [...(ws.heroSlides || [])];
    slides.push({
      title: "",
      subtitle: "",
      imageUrl: "",
      buttonText: "Order Now",
      isActive: true,
    });
    update("heroSlides", slides);
  }

  function updateHeroSlide(idx, field, value) {
    const slides = [...(ws.heroSlides || [])];
    slides[idx] = { ...slides[idx], [field]: value };
    update("heroSlides", slides);
  }

  function removeHeroSlide(idx) {
    update(
      "heroSlides",
      (ws.heroSlides || []).filter((_, i) => i !== idx),
    );
  }

  // Website section helpers
  function addWebsiteSection() {
    const sections = [...(ws.websiteSections || [])];
    if (sections.length >= 3) {
      toast.error("Maximum 3 sections allowed");
      return;
    }
    sections.push({ title: "", subtitle: "", isActive: true, items: [] });
    update("websiteSections", sections);
  }

  function updateSection(idx, field, value) {
    const sections = [...(ws.websiteSections || [])];
    sections[idx] = { ...sections[idx], [field]: value };
    update("websiteSections", sections);
  }

  function removeSection(idx) {
    update(
      "websiteSections",
      (ws.websiteSections || []).filter((_, i) => i !== idx),
    );
  }

  function toggleSectionItem(sectionIdx, itemId) {
    const sections = [...(ws.websiteSections || [])];
    const section = { ...sections[sectionIdx] };
    const items = [...(section.items || [])];
    const exists = items.some(
      (id) => (id?._id || id?.toString?.() || id) === itemId,
    );
    if (exists) {
      section.items = items.filter(
        (id) => (id?._id || id?.toString?.() || id) !== itemId,
      );
    } else {
      section.items = [...items, itemId];
    }
    sections[sectionIdx] = section;
    update("websiteSections", sections);
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "eatsdesk.app";
  const liveUrl = ws.subdomain ? `https://${ws.subdomain}.${rootDomain}` : null;

  const stagingRoot = process.env.NEXT_PUBLIC_STOREFRONT_STAGING_DOMAIN || "";
  const stagingUrl =
    ws.subdomain && stagingRoot
      ? `https://${ws.subdomain}.${stagingRoot}`
      : null;

  const [envView, setEnvView] = useState("live");

  return (
    <AdminLayout title="Website Settings">
      {/* URL + Save bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Left: URL + env toggle */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              <Globe className="w-4 h-4 text-primary" />
              <span>Website URL</span>
            </div>
            {stagingUrl && (
              <div className="inline-flex rounded-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 overflow-hidden text-[11px]">
                <button
                  type="button"
                  onClick={() => setEnvView("live")}
                  className={`px-3 py-1 font-semibold transition-colors ${
                    envView === "live"
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-neutral-300"
                  }`}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setEnvView("staging")}
                  className={`px-3 py-1 font-semibold transition-colors ${
                    envView === "staging"
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-neutral-300"
                  }`}
                >
                  Staging
                </button>
              </div>
            )}
          </div>
          {(envView === "staging" ? stagingUrl : liveUrl) && (
            <a
              href={envView === "staging" ? stagingUrl : liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {envView === "staging" ? stagingUrl : liveUrl}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Right: visibility pill + save */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-neutral-900 px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
              Website visibility
            </span>
            <button
              type="button"
              onClick={() => update("isPublic", !ws.isPublic)}
              className={`relative flex items-center gap-2 h-7 px-2 rounded-full text-xs font-semibold transition-colors ${
                ws.isPublic !== false
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-300 dark:bg-neutral-700 text-gray-800 dark:text-neutral-100"
              }`}
            >
              <span
                className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  ws.isPublic !== false ? "translate-x-0" : "translate-x-0"
                }`}
              />
              <span>{ws.isPublic !== false ? "Visible" : "Hidden"}</span>
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className={btnPrimary}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={cardCls}>
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
              <Globe className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                Loading website settings...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Anchor nav */}
          <div className="hidden lg:block w-48 flex-shrink-0">
            <div className="sticky top-4 space-y-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? "bg-primary/10 text-primary dark:text-primary"
                      : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
                  }`}
                >
                  <s.icon className="w-4 h-4" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Template Selection */}
            <SectionCard
              id="template"
              icon={Layout}
              title="Template"
              subtitle="Choose the design template for your restaurant website"
              iconColor={iconAccentPrimary}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={t.soon}
                    onClick={() => update("template", t.id)}
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      ws.template === t.id ||
                      (!ws.template && t.id === "classic")
                        ? "border-primary ring-4 ring-primary/10"
                        : "border-gray-200 dark:border-neutral-700 hover:border-gray-300"
                    } ${t.soon ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div
                      className={`w-full h-20 rounded-lg bg-gradient-to-br ${t.color} mb-3`}
                    />
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {t.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                      {t.desc}
                    </p>
                    {(ws.template === t.id ||
                      (!ws.template && t.id === "classic")) && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    {t.soon && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-neutral-800 text-gray-500">
                        SOON
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Branding */}
            <SectionCard
              id="branding"
              icon={Palette}
              title="Branding"
              subtitle="Restaurant name, logo, and description"
              iconColor={iconAccentPrimary}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Restaurant Name</label>
                  <input
                    type="text"
                    value={ws.name || ""}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="My Restaurant"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tagline</label>
                  <input
                    type="text"
                    value={ws.tagline || ""}
                    onChange={(e) => update("tagline", e.target.value)}
                    placeholder="Best food in town"
                    className={inp}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={ws.description || ""}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Tell your customers about your restaurant..."
                    rows={3}
                    className={`${inp} h-auto py-2.5 resize-none`}
                  />
                </div>
                <MediaField
                  label="Logo"
                  value={ws.logoUrl}
                  onChange={(v) => update("logoUrl", v)}
                />
                <MediaField
                  label="Banner Image"
                  value={ws.bannerUrl}
                  onChange={(v) => update("bannerUrl", v)}
                />
              </div>
            </SectionCard>

            {/* Contact */}
            <SectionCard
              id="contact"
              icon={Phone}
              title="Contact Information"
              subtitle="Phone, email, and address shown on your website"
              iconColor={iconAccentPrimary}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={ws.contactPhone || ""}
                      onChange={(e) => update("contactPhone", e.target.value)}
                      placeholder="03XX-XXXXXXX"
                      className={`${inp} pl-10`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={ws.contactEmail || ""}
                      onChange={(e) => update("contactEmail", e.target.value)}
                      placeholder="contact@restaurant.com"
                      className={`${inp} pl-10`}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={ws.address || ""}
                      onChange={(e) => update("address", e.target.value)}
                      placeholder="123 Main St, City"
                      className={`${inp} pl-10`}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Hero Slides */}
            <SectionCard
              id="hero"
              icon={ImageIcon}
              title="Hero Slides"
              subtitle="Carousel images at the top of your website"
              iconColor={iconAccentPrimary}
            >
              <div className="space-y-4">
                {(ws.heroSlides || []).map((slide, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-gray-100 dark:border-neutral-800 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
                        Slide {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateHeroSlide(idx, "isActive", !slide.isActive)
                          }
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            slide.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"
                          }`}
                        >
                          {slide.isActive ? "Active" : "Hidden"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeHeroSlide(idx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Title</label>
                        <input
                          type="text"
                          value={slide.title || ""}
                          onChange={(e) =>
                            updateHeroSlide(idx, "title", e.target.value)
                          }
                          placeholder="Welcome to Our Restaurant"
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Subtitle</label>
                        <input
                          type="text"
                          value={slide.subtitle || ""}
                          onChange={(e) =>
                            updateHeroSlide(idx, "subtitle", e.target.value)
                          }
                          placeholder="Fresh food, great taste"
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Button Text</label>
                        <input
                          type="text"
                          value={slide.buttonText || ""}
                          onChange={(e) =>
                            updateHeroSlide(idx, "buttonText", e.target.value)
                          }
                          placeholder="Order Now"
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Image URL</label>
                        <input
                          type="url"
                          value={slide.imageUrl || ""}
                          onChange={(e) =>
                            updateHeroSlide(idx, "imageUrl", e.target.value)
                          }
                          placeholder="https://..."
                          className={inp}
                        />
                      </div>
                    </div>
                    {slide.imageUrl && (
                      <div className="mt-3 h-24 rounded-lg overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slide.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHeroSlide}
                  className={btnSecondary}
                >
                  <Plus className="w-4 h-4" />
                  Add Slide
                </button>
              </div>
            </SectionCard>

            {/* Theme Colors */}
            <SectionCard
              id="theme"
              icon={Sparkles}
              title="Theme Colors"
              subtitle="Primary and secondary colors for your website"
              iconColor={iconAccentPrimary}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={ws.themeColors?.primary || "#EF4444"}
                      onChange={(e) =>
                        updateNested("themeColors", "primary", e.target.value)
                      }
                      className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-neutral-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={ws.themeColors?.primary || "#EF4444"}
                      onChange={(e) =>
                        updateNested("themeColors", "primary", e.target.value)
                      }
                      className={`${inp} flex-1`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={ws.themeColors?.secondary || "#FFA500"}
                      onChange={(e) =>
                        updateNested("themeColors", "secondary", e.target.value)
                      }
                      className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-neutral-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={ws.themeColors?.secondary || "#FFA500"}
                      onChange={(e) =>
                        updateNested("themeColors", "secondary", e.target.value)
                      }
                      className={`${inp} flex-1`}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <div
                  className="h-12 flex-1 rounded-xl"
                  style={{
                    backgroundColor: ws.themeColors?.primary || "#EF4444",
                  }}
                />
                <div
                  className="h-12 flex-1 rounded-xl"
                  style={{
                    backgroundColor: ws.themeColors?.secondary || "#FFA500",
                  }}
                />
              </div>
            </SectionCard>

            {/* Social Media */}
            <SectionCard
              id="social"
              icon={Globe}
              title="Social Media"
              subtitle="Links shown in header and footer of your website"
              iconColor={iconAccentPrimary}
              bodyClassName="bg-primary/3 dark:bg-neutral-950"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["facebook", Facebook, "Facebook URL"],
                  ["instagram", Instagram, "Instagram URL"],
                  ["twitter", Twitter, "Twitter / X URL"],
                  ["youtube", Youtube, "YouTube URL"],
                ].map(([key, Ic, placeholder]) => (
                  <div key={key}>
                    <label className={labelCls}>
                      <span className="flex items-center gap-1.5">
                        <Ic className="w-3.5 h-3.5" />
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                    </label>
                    <input
                      type="url"
                      value={ws.socialMedia?.[key] || ""}
                      onChange={(e) =>
                        updateNested("socialMedia", key, e.target.value)
                      }
                      placeholder={placeholder}
                      className={inp}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Opening Hours */}
            <SectionCard
              id="hours"
              icon={Clock}
              title="Opening Hours"
              subtitle="Shown in the footer of your website"
              iconColor={iconAccentPrimary}
              bodyClassName="bg-primary/3 dark:bg-neutral-950"
            >
              <label className={labelCls}>Opening Hours Text</label>
              <textarea
                value={ws.openingHoursText || ""}
                onChange={(e) => update("openingHoursText", e.target.value)}
                placeholder={
                  "Mon - Fri: 9:00 AM - 10:00 PM\nSat - Sun: 10:00 AM - 11:00 PM"
                }
                rows={4}
                className={`${inp} h-auto py-2.5 resize-none`}
              />
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-2">
                Free text — use new lines to separate days.
              </p>
            </SectionCard>

            {/* Website Sections */}
            <SectionCard
              id="sections"
              icon={Layout}
              title="Website Sections"
              subtitle="Up to 3 custom sections showcasing menu items"
              iconColor={iconAccentPrimary}
            >
              <div className="space-y-4">
                {(ws.websiteSections || []).map((section, sIdx) => (
                  <div
                    key={sIdx}
                    className="border-2 border-gray-100 dark:border-neutral-800 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        Section {sIdx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateSection(sIdx, "isActive", !section.isActive)
                          }
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            section.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"
                          }`}
                        >
                          {section.isActive ? "Active" : "Hidden"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSection(sIdx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className={labelCls}>Title</label>
                        <input
                          type="text"
                          value={section.title || ""}
                          onChange={(e) =>
                            updateSection(sIdx, "title", e.target.value)
                          }
                          placeholder="Popular Items"
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Subtitle</label>
                        <input
                          type="text"
                          value={section.subtitle || ""}
                          onChange={(e) =>
                            updateSection(sIdx, "subtitle", e.target.value)
                          }
                          placeholder="Our most loved dishes"
                          className={inp}
                        />
                      </div>
                    </div>
                    <label className={labelCls}>
                      Select Menu Items ({(section.items || []).length}{" "}
                      selected)
                    </label>
                    <div className="max-h-48 overflow-y-auto rounded-xl border-2 border-gray-100 dark:border-neutral-800">
                      {menuItems.length === 0 ? (
                        <p className="p-4 text-xs text-gray-400 text-center">
                          No menu items found. Add items in the Menu section
                          first.
                        </p>
                      ) : (
                        menuItems.map((item) => {
                          const itemId =
                            item._id || item.id || item.id?.toString?.();
                          const sectionItems = (section.items || []).map(
                            (id) => id?._id || id?.toString?.() || id,
                          );
                          const selected = sectionItems.includes(itemId);
                          return (
                            <button
                              key={itemId}
                              type="button"
                              onClick={() => toggleSectionItem(sIdx, itemId)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-b border-gray-50 dark:border-neutral-800 last:border-b-0 ${
                                selected
                                  ? "bg-primary/5 text-gray-900 dark:text-white"
                                  : "text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  selected
                                    ? "bg-primary border-primary"
                                    : "border-gray-300 dark:border-neutral-600"
                                }`}
                              >
                                {selected && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                              {item.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                                />
                              )}
                              <span className="flex-1 truncate font-medium">
                                {item.name}
                              </span>
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                PKR {item.price}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
                {(ws.websiteSections || []).length < 3 && (
                  <button
                    type="button"
                    onClick={addWebsiteSection}
                    className={btnSecondary}
                  >
                    <Plus className="w-4 h-4" />
                    Add Section
                  </button>
                )}
              </div>
            </SectionCard>

            {/* Settings */}
            <SectionCard
              id="settings"
              icon={Eye}
              title="Settings"
              subtitle="Visibility and ordering controls"
              iconColor={iconAccentPrimary}
              bodyClassName="bg-primary/3 dark:bg-neutral-950"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-neutral-900">
                  <div className="flex items-center gap-3">
                    {ws.isPublic !== false ? (
                      <Eye className="w-5 h-5 text-primary" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Website Visibility
                      </p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">
                        {ws.isPublic !== false
                          ? "Your website is live and visible"
                          : "Your website is hidden from the public"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => update("isPublic", !ws.isPublic)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      ws.isPublic !== false
                        ? "bg-emerald-500"
                        : "bg-gray-300 dark:bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        ws.isPublic !== false
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-neutral-900">
                  <div className="flex items-center gap-3">
                    <ShoppingCart
                      className={`w-5 h-5 ${
                        ws.allowWebsiteOrders !== false
                          ? "text-primary"
                          : "text-gray-400"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Online Ordering
                      </p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">
                        {ws.allowWebsiteOrders !== false
                          ? "Customers can place orders from your website"
                          : "Online ordering is disabled"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update("allowWebsiteOrders", !ws.allowWebsiteOrders)
                    }
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      ws.allowWebsiteOrders !== false
                        ? "bg-emerald-500"
                        : "bg-gray-300 dark:bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        ws.allowWebsiteOrders !== false
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
