import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useBranch } from "../../contexts/BranchContext";
import {
  getWebsiteSettings,
  updateWebsiteSettings,
  getMenu,
  getDeals,
  uploadImage,
  uploadVideo,
} from "../../lib/apiClient";
import toast from "react-hot-toast";
import { STOREFRONT_TEMPLATES } from "../../lib/storefrontTemplates";
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
  CalendarDays,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  MessageCircle,
  Clock,
  Layout,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Copy,
  ChevronUp,
  ChevronDown,
  GripVertical,
  X,
  Check,
  Search,
  Circle,
  Film,
} from "lucide-react";

const SECTIONS = [
  { id: "template", label: "Template", icon: Layout },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "seo", label: "SEO", icon: Search },
  { id: "domain", label: "Domain", icon: LinkIcon },
  { id: "contact", label: "Contact", icon: Phone },
  { id: "hero", label: "Hero", icon: ImageIcon },
  { id: "atmosphere", label: "Atmosphere", icon: Film },
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

const HOURS_DAYS = [
  { key: "monday", short: "Mon" },
  { key: "tuesday", short: "Tue" },
  { key: "wednesday", short: "Wed" },
  { key: "thursday", short: "Thu" },
  { key: "friday", short: "Fri" },
  { key: "saturday", short: "Sat" },
  { key: "sunday", short: "Sun" },
];

const DEFAULT_HOURS_DRAFT = HOURS_DAYS.reduce((acc, d) => {
  acc[d.key] = { enabled: true, open: "09:00", close: "22:00" };
  return acc;
}, {});

function to12h(time24) {
  const [hRaw, mRaw] = String(time24 || "09:00").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "9:00 AM";
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

function to24hFrom12h(value) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = String(m[3]).toUpperCase();
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 1 || h > 12) return null;
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseOpeningHoursDraft(openingHours) {
  const next = { ...DEFAULT_HOURS_DRAFT };
  HOURS_DAYS.forEach(({ key }) => {
    const raw = String(openingHours?.[key] || "").trim();
    if (!raw) {
      next[key] = { ...next[key], enabled: false };
      return;
    }
    const mm = raw.match(/(.+)\s*-\s*(.+)/);
    if (!mm) {
      next[key] = { ...next[key], enabled: true };
      return;
    }
    next[key] = {
      enabled: true,
      open: to24hFrom12h(mm[1]) || next[key].open,
      close: to24hFrom12h(mm[2]) || next[key].close,
    };
  });
  return next;
}

function buildOpeningHoursMap(hoursDraft) {
  const out = {};
  HOURS_DAYS.forEach(({ key }) => {
    const row = hoursDraft?.[key];
    if (!row?.enabled) {
      out[key] = "";
      return;
    }
    out[key] = `${to12h(row.open)} - ${to12h(row.close)}`;
  });
  return out;
}

function buildOpeningHoursText(hoursDraft) {
  const lines = HOURS_DAYS.map(({ key, short }) => {
    const row = hoursDraft?.[key];
    if (!row?.enabled) return `${short}: Closed`;
    return `${short}: ${to12h(row.open)} - ${to12h(row.close)}`;
  });
  return lines.join("\n");
}

function normalizeWhatsAppForWaMe(input) {
  return String(input || "").replace(/[^\d]/g, "");
}

function SectionCard({
  id,
  icon: Icon,
  title,
  subtitle,
  iconColor,
  bodyClassName = "",
  isActive = true,
  children,
}) {
  if (!isActive) return null;
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

function MediaField({
  label,
  value,
  onChange,
  accept = "image/*",
  hint,
  previewClassName,
  className = "",
  pinHintToBottom = false,
  linkPlaceholder = "https://...",
  uploadFn = uploadImage,
  previewAs = "image",
  uploadLabel = "Choose file",
  successToast = "Image uploaded",
}) {
  const [mode, setMode] = useState("link");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFn(file);
      onChange(result.url || result.secure_url || "");
      toast.success(successToast);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40 ${className}`.trim()}
    >
      <div className="mb-3 flex min-h-[2.25rem] items-center justify-between gap-3">
        <label className={`${labelCls} mb-0 shrink-0`}>{label}</label>
        <div
          className="inline-flex shrink-0 rounded-lg border border-gray-200 dark:border-neutral-600 overflow-hidden"
          role="group"
          aria-label={`${label} source`}
        >
          {[
            ["link", LinkIcon, "URL"],
            ["upload", Upload, "Upload"],
          ].map(([t, Ic, lab]) => (
            <button
              key={t}
              type="button"
              onClick={() => setMode(t)}
              className={`inline-flex items-center gap-1.5 px-2.5 h-8 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${
                mode === t
                  ? "bg-gradient-to-r from-primary to-secondary text-white"
                  : "bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"
              }`}
            >
              <Ic className="w-3 h-3 shrink-0" />
              {lab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {mode === "link" ? (
          <input
            type="url"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={linkPlaceholder}
            className={inp}
          />
        ) : (
          <label
            className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-600 cursor-pointer hover:border-primary transition-colors text-sm text-gray-500 dark:text-neutral-500 ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? "Uploading..." : uploadLabel}
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        )}
        {value ? (
          <div
            className={`relative mt-3 shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-700 ${previewClassName || "h-20 w-20"}`}
          >
            {previewAs === "video" ? (
              <video
                src={value}
                className="h-full w-full object-cover"
                controls
                muted
                playsInline
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={value} alt="" className="h-full w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label={`Remove ${previewAs}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : null}
        {hint ? (
          <p
            className={`text-[11px] leading-relaxed text-gray-500 dark:text-neutral-500 ${
              pinHintToBottom ? "mt-auto pt-3" : "mt-2"
            }`}
          >
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Returns normalized #rrggbb or null if not a complete hex color */
function parseHexColor(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  const compact = withHash.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(compact)) return null;
  if (compact.length === 3) {
    const [a, b, c] = compact.split("");
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  if (compact.length === 6) return `#${compact.toLowerCase()}`;
  return null;
}

/** Valid #rrggbb for native <input type="color" /> */
function hexForColorInput(stored, fallback) {
  return parseHexColor(stored) ?? fallback;
}

export default function WebsiteContentPage() {
  const { activeBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSectionId, setSavedSectionId] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainFeedback, setDomainFeedback] = useState(null);
  const [domainInput, setDomainInput] = useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [ws, setWs] = useState({});
  const [hoursDraft, setHoursDraft] = useState(DEFAULT_HOURS_DRAFT);
  const [menuItems, setMenuItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [websiteSectionItemSearch, setWebsiteSectionItemSearch] = useState({});
  const [activeSection, setActiveSection] = useState("template");
  const [envView, setEnvView] = useState("live");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, menu, dealsResp] = await Promise.all([
        getWebsiteSettings(),
        getMenu(activeBranch?.id).catch(() => ({ items: [] })),
        getDeals(false).catch(() => []),
      ]);
      setWs(settings || {});
      setHoursDraft(parseOpeningHoursDraft(settings?.openingHours || {}));
      const items = menu?.items || menu?.menu || [];
      setMenuItems(Array.isArray(items) ? items : []);
      const allDeals = Array.isArray(dealsResp)
        ? dealsResp
        : Array.isArray(dealsResp?.deals)
          ? dealsResp.deals
          : [];
      setDeals(allDeals);
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

  function updateHoursDraft(dayKey, patch) {
    setHoursDraft((prev) => ({
      ...prev,
      [dayKey]: { ...(prev[dayKey] || {}), ...patch },
    }));
  }

  function updateSeo(key, value) {
    setWs((prev) => ({
      ...prev,
      seo: { ...(prev.seo || {}), [key]: value },
    }));
  }

  function normalizeDomainInput(value) {
    let v = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    if (v.startsWith("www.")) v = v.slice(4);
    return v;
  }

  async function handleSave() {
    setSaving(true);
    const toastId = toast.loading("Saving website settings...");
    try {
      const payload = { ...ws, openingHours: buildOpeningHoursMap(hoursDraft) };
      if (!String(payload.openingHoursText || "").trim()) {
        payload.openingHoursText = buildOpeningHoursText(hoursDraft);
      }
      if (payload.socialMedia?.whatsapp) {
        payload.socialMedia = {
          ...payload.socialMedia,
          whatsapp: payload.socialMedia.whatsapp.trim(),
        };
      }
      const updated = await updateWebsiteSettings(payload);
      setWs(updated || payload);
      setHoursDraft(parseOpeningHoursDraft((updated || payload).openingHours || {}));
      toast.success("Website settings saved!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSection(sectionId) {
    await handleSave();
    setSavedSectionId(sectionId);
    window.setTimeout(() => {
      setSavedSectionId((prev) => (prev === sectionId ? "" : prev));
    }, 2000);
  }

  function hasContent(v) {
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "boolean") return v;
    if (v && typeof v === "object") return Object.values(v).some((x) => hasContent(x));
    return false;
  }

  const sectionCompletion = {
    template: hasContent(ws.template),
    branding: hasContent(ws.name) || hasContent(ws.logoUrl) || hasContent(ws.themeColors?.primary),
    seo: hasContent(ws.seo?.title) || hasContent(ws.seo?.metaDescription),
    domain: hasContent(ws.customDomain),
    contact: hasContent(ws.contactPhone) || hasContent(ws.contactEmail) || hasContent(ws.address),
    hero:
      (ws.heroType === "banner" &&
        (hasContent(ws.bannerUrl) || hasContent(ws.heroHeadline))) ||
      (Array.isArray(ws.heroSlides) && ws.heroSlides.some((s) => hasContent(s?.imageUrl))),
    atmosphere:
      hasContent(ws.aboutVideoUrl) ||
      (Array.isArray(ws.galleryMedia) &&
        ws.galleryMedia.some((item) => hasContent(item?.url))),
    social: hasContent(ws.socialMedia),
    hours:
      hasContent(ws.openingHoursText) ||
      Object.values(hoursDraft || {}).some((d) => d?.enabled),
    sections: Array.isArray(ws.websiteSections) && ws.websiteSections.length > 0,
    settings:
      ws.isPublic !== false ||
      ws.allowWebsiteOrders !== false ||
      ws.allowWebsiteReservations !== false,
  };

  function renderSectionSave(sectionId) {
    return (
      <div className="mt-5 flex items-center justify-end gap-3">
        {savedSectionId === sectionId ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ Saved
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSaveSection(sectionId)}
          disabled={saving || loading}
          className={btnPrimary}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    );
  }

  async function handleConnectDomain() {
    const typedDomain = normalizeDomainInput(domainInput);
    const existingDomain = normalizeDomainInput(ws.customDomain);
    const normalizedDomain = typedDomain || existingDomain;
    if (!normalizedDomain) {
      setDomainFeedback({
        type: "error",
        message: "Please enter a domain first.",
      });
      return;
    }
    setDomainSaving(true);
    setDomainFeedback(null);
    const toastId = toast.loading(
      typedDomain ? "Connecting domain..." : "Checking domain status..."
    );
    try {
      const updated = await updateWebsiteSettings({ customDomain: normalizedDomain });
      setWs((prev) => ({ ...prev, ...(updated || {}), customDomain: normalizedDomain }));
      if (typedDomain) {
        // Keep connected domain details visible below; clear input for next add/check.
        setDomainInput("");
      }
      const backendMsg = updated?.customDomainConnection?.message;
      setDomainFeedback({
        type: "success",
        message:
          backendMsg ||
          (typedDomain
            ? "Domain request sent successfully."
            : "Domain status refreshed."),
      });
      toast.success(
        typedDomain ? "Domain connected successfully!" : "Domain status refreshed",
        { id: toastId }
      );
    } catch (err) {
      setDomainFeedback({
        type: "error",
        message: err.message || "Failed to update domain",
      });
      toast.error(err.message || "Failed to update domain", { id: toastId });
    } finally {
      setDomainSaving(false);
    }
  }

  async function handleRemoveDomain() {
    if (!connectedDomain) return;
    setShowRemoveConfirm(false);
    setDomainSaving(true);
    setDomainFeedback(null);
    const toastId = toast.loading("Removing domain...");
    try {
      const updated = await updateWebsiteSettings({ customDomain: "" });
      setWs((prev) => ({ ...prev, ...(updated || {}), customDomain: "" }));
      setDomainInput("");
      setDomainFeedback({
        type: "success",
        message: "Domain removed successfully.",
      });
      toast.success("Domain removed", { id: toastId });
    } catch (err) {
      setDomainFeedback({
        type: "error",
        message: err.message || "Failed to remove domain",
      });
      toast.error(err.message || "Failed to remove domain", { id: toastId });
    } finally {
      setDomainSaving(false);
    }
  }

  async function copyText(value, key) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1200);
    } catch (_) {
      toast.error("Copy failed");
    }
  }

  function scrollTo(id) {
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

  const rootDomain = "eatsdesk.app";
  const liveUrl = ws.subdomain ? `https://${ws.subdomain}.${rootDomain}` : null;
  const customDomainUrl = ws.customDomain
    ? `https://${String(ws.customDomain).trim().replace(/^https?:\/\//i, "")}`
    : null;
  const normalizedDomain = normalizeDomainInput(domainInput);
  const connectedDomain = normalizeDomainInput(ws.customDomain);
  const domainStatus = ws.customDomainConnection?.status || null;
  /** Backend registers apex + www on Vercel; status may include wwwHost. */
  const pairedWwwHost =
    domainStatus?.wwwHost ||
    (connectedDomain &&
    connectedDomain.includes(".") &&
    !connectedDomain.endsWith(".local") &&
    connectedDomain !== "localhost"
      ? `www.${connectedDomain}`
      : null);
  const wwwDomainUrl = pairedWwwHost ? `https://${pairedWwwHost}` : null;
  const domainVerified = domainStatus?.verified === true;
  const domainInvalidConfig = domainStatus?.invalidConfig === true;
  const apexDnsVerified =
    domainStatus?.apexStatus != null
      ? domainStatus.apexStatus.verified === true
      : domainVerified;
  const wwwDnsVerified = !pairedWwwHost
    ? true
    : domainStatus?.wwwStatus != null
      ? domainStatus.wwwStatus.verified === true
      : false;
  const domainVerificationRecords = Array.isArray(domainStatus?.dnsRecords)
    ? domainStatus.dnsRecords
    : Array.isArray(domainStatus?.verification)
      ? domainStatus.verification
      : [];

  /** Vercel apex A record when API returns no rows but domain is misconfigured (matches Vercel dashboard default). */
  const STATIC_INVALID_CONFIG_A_RECORD = {
    type: "A",
    domain: "@",
    value: "216.150.1.1",
  };

  /** One subsection per hostname (apex + www), matching Vercel’s domain list. */
  const dnsRecordGroupsBase = Array.isArray(domainStatus?.dnsRecordGroups)
    ? domainStatus.dnsRecordGroups
    : pairedWwwHost && (domainStatus?.apexStatus || domainStatus?.wwwStatus)
      ? [
          { hostname: connectedDomain, records: domainStatus?.apexStatus?.dnsRecords ?? [] },
          { hostname: pairedWwwHost, records: domainStatus?.wwwStatus?.dnsRecords ?? [] },
        ]
      : [{ hostname: connectedDomain || "Domain", records: domainVerificationRecords }];

  const apexNorm = (connectedDomain || "").toLowerCase();
  const wwwNorm = (pairedWwwHost || "").toLowerCase();

  const dnsDisplayGroups = dnsRecordGroupsBase.map((g) => {
    const raw = Array.isArray(g.records) ? [...g.records] : [];
    let recs = [...raw];
    const h = String(g.hostname || "").toLowerCase();

    if (apexNorm && h === apexNorm) {
      if (domainInvalidConfig && recs.length === 0) {
        recs = [STATIC_INVALID_CONFIG_A_RECORD];
      }
      recs = recs.filter((r) => String(r.type || "").toUpperCase() === "A");
    } else if (wwwNorm && h === wwwNorm) {
      recs = recs.filter((r) => String(r.type || "").toUpperCase() === "CNAME");
      if (domainInvalidConfig && recs.length === 0) {
        const fallback =
          raw.find((r) => String(r.type || "").toUpperCase() === "CNAME") ||
          (Array.isArray(domainStatus?.wwwStatus?.dnsRecords)
            ? domainStatus.wwwStatus.dnsRecords.find(
                (r) => String(r.type || "").toUpperCase() === "CNAME",
              )
            : null);
        if (fallback) {
          recs = [
            {
              type: "CNAME",
              domain: fallback.domain ?? "www",
              value: fallback.value ?? "",
            },
          ];
        }
      }
    }

    return { hostname: g.hostname, records: recs };
  });

  const groupDnsVerified = (hostname) => {
    const hn = String(hostname || "").toLowerCase();
    if (wwwNorm && hn === wwwNorm) return wwwDnsVerified;
    if (apexNorm && hn === apexNorm) return apexDnsVerified;
    return domainVerified;
  };

  const hasAnyDnsRows = dnsDisplayGroups.some((g) => g.records.length > 0);

  const stagingRoot = process.env.NEXT_PUBLIC_STOREFRONT_STAGING_DOMAIN || "";
  const stagingUrl =
    ws.subdomain && stagingRoot
      ? `https://${ws.subdomain}.${stagingRoot}`
      : null;

  /** Custom hostname is only shown once Vercel reports verified and not invalid; until then show preview (staging) URL. */
  const hasCustomDomain = !!connectedDomain;
  const customDomainDnsLive =
    hasCustomDomain && domainVerified && !domainInvalidConfig;
  const domainOverallActive = domainVerified && !domainInvalidConfig;
  const domainPendingDns = !domainInvalidConfig && !domainVerified;
  const effectiveLiveWebsiteUrl = !hasCustomDomain
    ? liveUrl
    : customDomainDnsLive
      ? customDomainUrl
      : stagingUrl || liveUrl;
  const displayWebsiteUrl =
    envView === "staging" ? stagingUrl || liveUrl : effectiveLiveWebsiteUrl;
  const galleryMedia = Array.isArray(ws.galleryMedia) ? ws.galleryMedia : [];
  const isLoungeTemplate =
    (ws.template || "classic") === "lounge" ||
    (!ws.template && false);

  function updateGalleryMedia(next) {
    update("galleryMedia", next);
  }

  function removeGalleryItem(idx) {
    updateGalleryMedia(galleryMedia.filter((_, i) => i !== idx));
  }

  function moveGalleryItem(idx, direction) {
    const next = [...galleryMedia];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updateGalleryMedia(next);
  }

  async function handleGalleryFileUpload(event, mediaType) {
    const file = event.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading(
      mediaType === "video" ? "Uploading video..." : "Uploading photo...",
    );
    try {
      const result =
        mediaType === "video" ? await uploadVideo(file) : await uploadImage(file);
      const url = result.url || result.secure_url || "";
      if (!url) throw new Error("Upload did not return a URL");
      updateGalleryMedia([...galleryMedia, { url, mediaType }]);
      toast.success(
        mediaType === "video" ? "Video added to gallery" : "Photo added to gallery",
        { id: toastId },
      );
    } catch (err) {
      toast.error(err.message || "Upload failed", { id: toastId });
    } finally {
      event.target.value = "";
    }
  }

  const dealItems = deals.map((deal) => ({
    ...deal,
    price: deal.comboPrice ?? deal.price ?? 0,
  }));

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
          {displayWebsiteUrl && (
            <a
              href={displayWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {displayWebsiteUrl}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Right: visibility pill */}
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors border-l-2 ${
                    activeSection === s.id
                      ? "border-l-primary text-primary bg-primary/5 dark:bg-primary/10"
                      : "border-l-transparent text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
                  }`}
                >
                  <s.icon className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                  {s.label}
                  <span
                    className={`ml-auto inline-block h-2.5 w-2.5 rounded-full border ${
                      sectionCompletion[s.id]
                        ? "bg-emerald-500 border-emerald-500"
                        : "bg-transparent border-gray-300 dark:border-neutral-600"
                    }`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6">
            <div className="lg:hidden">
              <label className={labelCls}>Active Section</label>
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value)}
                className={inp}
              >
                {SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sectionCompletion[s.id] ? "● " : "○ "}
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Template Selection */}
            <SectionCard
              id="template"
              icon={Layout}
              title="Template"
              subtitle="Choose the design template for your restaurant website"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "template"}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {STOREFRONT_TEMPLATES.map((t) => {
                  const isSelected =
                    ws.template === t.id ||
                    (!ws.template && t.id === "classic");

                  return (
                    <div
                      key={t.id}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-primary ring-4 ring-primary/10"
                          : "border-gray-200 dark:border-neutral-700 hover:border-gray-300"
                      } ${t.isComingSoon ? "opacity-50" : ""}`}
                    >
                      <button
                        type="button"
                        disabled={t.isComingSoon}
                        onClick={() => update("template", t.id)}
                        className={`w-full text-left ${
                          t.isComingSoon
                            ? "cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                      >
                        <div className="mb-3 overflow-hidden rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-900">
                          {t.thumbnail ? (
                            <img
                              src={t.thumbnail}
                              alt={`${t.name} template preview`}
                              className="aspect-[16/10] w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="p-2">
                              <div className="h-2 rounded bg-gray-200 dark:bg-neutral-700 mb-2" />
                              <div className="h-8 rounded mb-2 bg-gray-200 dark:bg-neutral-700" />
                              <div className="grid grid-cols-3 gap-1">
                                <div className="h-6 rounded bg-gray-100 dark:bg-neutral-800" />
                                <div className="h-6 rounded bg-gray-100 dark:bg-neutral-800" />
                                <div className="h-6 rounded bg-gray-100 dark:bg-neutral-800" />
                              </div>
                            </div>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          {t.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                          {t.description}
                        </p>
                      </button>

                      {displayWebsiteUrl ? (
                        <button
                          type="button"
                          className={`${btnSecondary} mt-3 w-full justify-center text-xs h-9`}
                          onClick={() =>
                            window.open(
                              `${displayWebsiteUrl}?previewTemplate=${encodeURIComponent(t.id)}`,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Preview
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      ) : null}

                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      {t.isComingSoon && (
                        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-neutral-800 text-gray-500">
                          SOON
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {renderSectionSave("template")}
            </SectionCard>

            {/* Branding */}
            <SectionCard
              id="branding"
              icon={Palette}
              title="Branding"
              subtitle="Name, logo, favicon, and colors"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "branding"}
            >
              <div className="space-y-8">
                <div>
                  <label className={labelCls}>Restaurant Name</label>
                  <input
                    type="text"
                    value={ws.name || ""}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Joe's Diner"
                    className={inp}
                  />
                </div>

                <div className="border-t border-gray-100 pt-8 dark:border-neutral-800">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
                    <div className="flex min-h-0 md:h-full">
                      <MediaField
                        label="Logo"
                        value={ws.logoUrl}
                        onChange={(v) => update("logoUrl", v)}
                        className="w-full flex-1"
                      />
                    </div>
                    <div className="flex min-h-0 md:h-full">
                      <MediaField
                        label="Favicon"
                        value={ws.faviconUrl}
                        onChange={(v) => update("faviconUrl", v)}
                        accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/jpeg,image/webp,.ico"
                        previewClassName="h-16 w-16"
                        className="w-full flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Theme Colors — moved from standalone Theme section */}
                <div className="border-t border-gray-100 pt-8 dark:border-neutral-800">
                  <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                    Theme Colors
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Primary Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          aria-label="Primary color picker"
                          value={hexForColorInput(ws.themeColors?.primary, "#ef4444")}
                          onChange={(e) =>
                            updateNested("themeColors", "primary", e.target.value)
                          }
                          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-2 border-gray-200 bg-transparent p-0 dark:border-neutral-700 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md"
                        />
                        <input
                          type="text"
                          value={ws.themeColors?.primary ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const parsed = parseHexColor(v);
                            updateNested("themeColors", "primary", parsed ?? v);
                          }}
                          placeholder="#ef4444"
                          spellCheck={false}
                          className={`${inp} flex-1 font-mono text-sm`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Secondary Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          aria-label="Secondary color picker"
                          value={hexForColorInput(ws.themeColors?.secondary, "#ffa500")}
                          onChange={(e) =>
                            updateNested("themeColors", "secondary", e.target.value)
                          }
                          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-2 border-gray-200 bg-transparent p-0 dark:border-neutral-700 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md"
                        />
                        <input
                          type="text"
                          value={ws.themeColors?.secondary ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const parsed = parseHexColor(v);
                            updateNested("themeColors", "secondary", parsed ?? v);
                          }}
                          placeholder="#ffa500"
                          spellCheck={false}
                          className={`${inp} flex-1 font-mono text-sm`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 w-full overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-800">
                    <div
                      className="flex h-10 items-center px-3 text-xs font-semibold text-white"
                      style={{
                        backgroundColor:
                          hexForColorInput(ws.themeColors?.primary, "#ef4444"),
                      }}
                    >
                      Navbar preview
                    </div>
                    <div className="space-y-3 bg-white p-3 dark:bg-neutral-900">
                      <button
                        type="button"
                        className="h-8 rounded-lg px-3 text-xs font-semibold text-white"
                        style={{
                          backgroundColor:
                            hexForColorInput(ws.themeColors?.primary, "#ef4444"),
                        }}
                      >
                        Order now
                      </button>
                      <div
                        className="h-2.5 w-20 rounded-full"
                        style={{
                          backgroundColor:
                            hexForColorInput(ws.themeColors?.secondary, "#ffa500"),
                        }}
                      />
                      <div className="h-2 w-full rounded bg-gray-200 dark:bg-neutral-700" />
                    </div>
                  </div>
                </div>
              </div>
              {renderSectionSave("branding")}
            </SectionCard>

            {/* SEO */}
            <SectionCard
              id="seo"
              icon={Search}
              title="SEO"
              subtitle="Search results and social sharing previews"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "seo"}
            >
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Page title</label>
                  <input
                    type="text"
                    value={ws.seo?.title ?? ""}
                    onChange={(e) => updateSeo("title", e.target.value)}
                    placeholder={ws.name ? `${ws.name} | Chicago` : "Joe's Diner | Chicago"}
                    className={inp}
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className={labelCls}>Meta description</label>
                  <textarea
                    value={ws.seo?.metaDescription ?? ""}
                    onChange={(e) => updateSeo("metaDescription", e.target.value)}
                    placeholder="Burgers, fries, and shakes. Open daily."
                    rows={3}
                    maxLength={500}
                    className={`${inp} h-auto py-2.5 resize-none`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Keywords</label>
                  <input
                    type="text"
                    value={ws.seo?.keywords ?? ""}
                    onChange={(e) => updateSeo("keywords", e.target.value)}
                    placeholder="burgers, fries, Austin"
                    className={inp}
                    maxLength={500}
                  />
                </div>
                <MediaField
                  label="Social share image (Open Graph)"
                  value={ws.seo?.ogImageUrl}
                  onChange={(v) => updateSeo("ogImageUrl", v)}
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border-2 border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Hide from search engines
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSeo("noIndex", !ws.seo?.noIndex)}
                    className={`self-start sm:self-center relative flex items-center gap-2 h-9 px-3 rounded-full text-xs font-semibold transition-colors ${
                      ws.seo?.noIndex
                        ? "bg-amber-500 text-white"
                        : "bg-gray-200 dark:bg-neutral-700 text-gray-800 dark:text-neutral-100"
                    }`}
                  >
                    <span
                      className={`inline-block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
                        ws.seo?.noIndex ? "translate-x-0" : "translate-x-0"
                      }`}
                    />
                    <span>{ws.seo?.noIndex ? "Hidden" : "Visible"}</span>
                  </button>
                </div>
              </div>
              {renderSectionSave("seo")}
            </SectionCard>

            {/* Connect Domain */}
            <SectionCard
              id="domain"
              icon={LinkIcon}
              title="Connect Domain"
              subtitle="Use your own domain for your restaurant website"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "domain"}
            >
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Custom Domain</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => {
                        setDomainFeedback(null);
                        setDomainInput(e.target.value);
                      }}
                      onBlur={(e) => setDomainInput(normalizeDomainInput(e.target.value))}
                      placeholder="yourbrand.com"
                      className={`${inp} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={handleConnectDomain}
                      disabled={domainSaving}
                      className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-sm font-semibold text-gray-800 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {domainSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      {domainSaving
                        ? "Saving..."
                        : normalizedDomain
                          ? "Connect Domain"
                          : connectedDomain
                          ? "Check DNS Status"
                          : "Connect Domain"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-neutral-400">
                    Enter only the hostname (no <code className="text-[11px]">https://</code>). We save the
                    apex form (e.g. <code className="text-[11px]">yourbrand.com</code>) and automatically
                    register both <code className="text-[11px]">yourbrand.com</code> and{" "}
                    <code className="text-[11px]">www.yourbrand.com</code> on Vercel when applicable.
                  </p>
                  {connectedDomain && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-neutral-400 space-y-0.5">
                      <p>
                        <span className="font-semibold text-gray-900 dark:text-white">Apex:</span>{" "}
                        <span className="font-mono">{connectedDomain}</span>
                      </p>
                      {pairedWwwHost ? (
                        <p>
                          <span className="font-semibold text-gray-900 dark:text-white">WWW:</span>{" "}
                          <span className="font-mono">{pairedWwwHost}</span>
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                {domainSaving && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-primary flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking domain on Vercel...
                  </div>
                )}

                {!domainSaving && domainFeedback?.message && (
                  <div
                    className={`rounded-xl border p-3 text-sm flex items-center gap-2 ${
                      domainFeedback.type === "success"
                        ? "border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {domainFeedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{domainFeedback.message}</span>
                  </div>
                )}

                {!domainSaving && connectedDomain && (
                  <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex items-center gap-2">
                        {domainInvalidConfig ? (
                          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        ) : domainOverallActive ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {connectedDomain}
                          {pairedWwwHost ? (
                            <span className="font-normal text-gray-500 dark:text-neutral-400">
                              {" "}
                              + {pairedWwwHost}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleConnectDomain}
                          className="h-8 px-3 rounded-md border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => setDomainInput(connectedDomain)}
                          className="h-8 px-3 rounded-md border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRemoveConfirm(true)}
                          className="h-8 px-3 rounded-md border border-red-200 dark:border-red-500/40 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              domainInvalidConfig
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                : domainOverallActive
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100"
                            }`}
                          >
                            {domainInvalidConfig
                              ? "Invalid configuration"
                              : domainOverallActive
                                ? "Active"
                                : "DNS pending"}
                          </span>
                          <a
                            href="https://vercel.com/docs/domains"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-gray-500 dark:text-neutral-400 hover:underline"
                          >
                            Learn more
                          </a>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-neutral-400">
                          Production
                        </span>
                      </div>
                    </div>

                    {domainInvalidConfig && (
                      <div className="mx-5 mt-3 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs leading-relaxed text-rose-900 dark:text-rose-100">
                        Vercel reports a DNS problem for this domain. Use the records below (apex: A only,
                        www: CNAME only) at your DNS provider, then click{" "}
                        <span className="font-semibold">Refresh</span>.
                      </div>
                    )}
                    {domainPendingDns && (
                      <div className="mx-5 mt-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                        Point your <span className="font-semibold">apex</span> to the{" "}
                        <span className="font-semibold">A</span> record and <span className="font-semibold">www</span>{" "}
                        to the <span className="font-semibold">CNAME</span> shown below, then click{" "}
                        <span className="font-semibold">Check DNS Status</span> or{" "}
                        <span className="font-semibold">Refresh</span>. Propagation can take a while.
                      </div>
                    )}

                    {dnsDisplayGroups.map((group, gIdx) => (
                      <div
                        key={group.hostname}
                        className={`mx-5 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden ${
                          gIdx === 0 ? "mt-3" : "mt-4"
                        }`}
                      >
                        <div className="px-3 py-2 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {domainInvalidConfig ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                            ) : groupDnsVerified(group.hostname) ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {group.hostname}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                domainInvalidConfig
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                                  : groupDnsVerified(group.hostname)
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                                    : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
                              }`}
                            >
                              {domainInvalidConfig
                                ? "Issue"
                                : groupDnsVerified(group.hostname)
                                  ? "OK"
                                  : "Pending"}
                            </span>
                          </div>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                            DNS records
                          </span>
                        </div>
                        {group.records.length === 0 ? (
                          <div className="px-3 py-3 text-xs text-gray-600 dark:text-neutral-400">
                            No DNS rows returned for this hostname yet. Click{" "}
                            <span className="font-semibold">Refresh</span> or compare with your
                            Vercel project&apos;s Domains page.
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-12 bg-gray-50/80 dark:bg-neutral-900/80 text-xs font-semibold text-gray-600 dark:text-neutral-300">
                              <div className="col-span-2 px-3 py-2.5">Type</div>
                              <div className="col-span-4 px-3 py-2.5 border-l border-gray-200 dark:border-neutral-800">
                                Name
                              </div>
                              <div className="col-span-6 px-3 py-2.5 border-l border-gray-200 dark:border-neutral-800">
                                Value
                              </div>
                            </div>
                            {group.records.map((record, idx) => (
                              <div
                                key={`${group.hostname}-${record.type || "r"}-${idx}`}
                                className="grid grid-cols-12 text-xs border-t border-gray-200 dark:border-neutral-800"
                              >
                                <div className="col-span-2 px-3 py-3 text-gray-900 dark:text-neutral-100 font-medium">
                                  {record.type || "TXT"}
                                </div>
                                <div className="col-span-4 px-3 py-3 border-l border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 font-mono break-all flex items-center gap-2">
                                  <span className="flex-1">{record.domain || "_vercel"}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyText(record.domain || "_vercel", `name-${gIdx}-${idx}`)
                                    }
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800"
                                    title="Copy name"
                                  >
                                    {copiedKey === `name-${gIdx}-${idx}` ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                <div className="col-span-6 px-3 py-3 border-l border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 font-mono break-all flex items-center gap-2">
                                  <span className="flex-1">{record.value || "—"}</span>
                                  {record.value ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        copyText(record.value, `value-${gIdx}-${idx}`)
                                      }
                                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800"
                                      title="Copy value"
                                    >
                                      {copiedKey === `value-${gIdx}-${idx}` ? (
                                        <Check className="w-3.5 h-3.5" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ))}

                    {!hasAnyDnsRows && !domainInvalidConfig && (
                      <div className="m-5 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-3 text-xs text-gray-600 dark:text-neutral-400">
                        No DNS verification records are required right now.
                      </div>
                    )}

                    <div className="mx-5 mb-4 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50/80 dark:bg-neutral-900 p-2.5 text-xs text-gray-600 dark:text-neutral-400">
                      It may take some time for DNS records to apply.{" "}
                      <a
                        href="https://vercel.com/docs/domains/working-with-dns"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Learn more
                      </a>
                    </div>
                    {customDomainUrl && (
                      <div className="mx-5 mb-4 flex flex-col gap-1.5">
                        <a
                          href={effectiveLiveWebsiteUrl || customDomainUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                          {customDomainDnsLive
                            ? "Open your site (apex)"
                            : "Open preview site — apex (DNS pending)"}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {wwwDomainUrl ? (
                          <a
                            href={customDomainDnsLive ? wwwDomainUrl : effectiveLiveWebsiteUrl || wwwDomainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            {customDomainDnsLive
                              ? "Open your site (www)"
                              : "Open preview site — www (DNS pending)"}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showRemoveConfirm && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                  <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Remove custom domain?
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-neutral-400 mb-4 leading-relaxed">
                      This will disconnect{" "}
                      <span className="font-semibold">{connectedDomain}</span>
                      {pairedWwwHost ? (
                        <>
                          {" "}
                          and <span className="font-semibold">{pairedWwwHost}</span>
                        </>
                      ) : null}{" "}
                      from your EatsDesk website and remove both from the Vercel project when possible.
                      Your site will no longer be served on these hostnames.
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRemoveConfirm(false)}
                        className="h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveDomain}
                        className="h-9 px-3 rounded-lg bg-red-500 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                        disabled={domainSaving}
                      >
                        {domainSaving ? "Removing..." : "Remove Domain"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {renderSectionSave("domain")}
            </SectionCard>

            {/* Contact */}
            <SectionCard
              id="contact"
              icon={Phone}
              title="Contact Information"
              subtitle="Phone, email, and address shown on your website"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "contact"}
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
              {renderSectionSave("contact")}
            </SectionCard>

            {/* Hero: banner vs slides */}
            <SectionCard
              id="hero"
              icon={ImageIcon}
              title="Hero"
              subtitle="Single banner image or a rotating carousel"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "hero"}
            >
              <div className="space-y-6">
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                  Choose how the top of your website introduces your restaurant.{" "}
                  <strong className="text-gray-800 dark:text-neutral-200">Hero banner</strong> uses a
                  single full-width image with custom text.{" "}
                  <strong className="text-gray-800 dark:text-neutral-200">Hero slides</strong> rotates
                  multiple promotional slides. Hero text is independent from Branding.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    {
                      id: "banner",
                      title: "Hero banner",
                      desc: "One full-width image with your own headline, sub-headline, and CTA button.",
                    },
                    {
                      id: "slides",
                      title: "Hero slides",
                      desc: "Multiple slides each with its own title, subtitle, image, and CTA. Great for promotions.",
                    },
                  ].map((opt) => {
                    const active =
                      (ws.heroType === "banner" ? "banner" : "slides") === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => update("heroType", opt.id)}
                        className={`text-left rounded-2xl border-2 p-5 transition-all ${
                          active
                            ? "border-primary ring-4 ring-primary/10 bg-primary/5 dark:bg-primary/10"
                            : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                            {opt.title}
                          </h4>
                          {active && (
                            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-neutral-400">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-5 dark:border-neutral-700 dark:bg-neutral-900/40 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                    Lounge hero eyebrow
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-neutral-500">
                    Small uppercase line above your headline on the Lounge template
                    (e.g. &quot;Cinematic Lounge Experience&quot;). Leave blank to use the default.
                  </p>
                  <div>
                    <label className={labelCls}>Eyebrow label</label>
                    <input
                      type="text"
                      value={ws.heroEyebrow || ""}
                      onChange={(e) => update("heroEyebrow", e.target.value)}
                      placeholder="Cinematic Lounge Experience"
                      className={inp}
                    />
                  </div>
                </div>

                {ws.heroType === "banner" ? (
                  <div className="space-y-4">
                    {/* Banner image */}
                    <MediaField
                      label="Banner image"
                      value={ws.bannerUrl}
                      onChange={(v) => update("bannerUrl", v)}
                      hint="Wide image works best (1200×400 px or larger). Also used as fallback for social previews."
                      previewClassName="aspect-[2.4/1] w-full max-h-44"
                    />
                    {/* Banner text & CTA */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-5 dark:border-neutral-700 dark:bg-neutral-900/40 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                        Banner text &amp; CTA
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-neutral-500">
                        These fields are shown on the hero overlay. If left blank, defaults to your restaurant name.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Headline</label>
                          <input
                            type="text"
                            value={ws.heroHeadline || ""}
                            onChange={(e) => update("heroHeadline", e.target.value)}
                            placeholder="Fresh, Fast &amp; Flavourful"
                            className={inp}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Sub-headline</label>
                          <input
                            type="text"
                            value={ws.heroSubheadline || ""}
                            onChange={(e) => update("heroSubheadline", e.target.value)}
                            placeholder="Order your favourite meal in minutes"
                            className={inp}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>CTA Button Text</label>
                          <input
                            type="text"
                            value={ws.heroCtaText || ""}
                            onChange={(e) => update("heroCtaText", e.target.value)}
                            placeholder="Order Now"
                            className={inp}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>CTA Button Link</label>
                          <input
                            type="text"
                            value={ws.heroCtaLink || ""}
                            onChange={(e) => update("heroCtaLink", e.target.value)}
                            placeholder="#menu"
                            className={inp}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Live preview */}
                    <div className="rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden relative min-h-[180px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ws.bannerUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop"}
                        alt="Hero preview"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 p-4 flex flex-col justify-end gap-1">
                        <p className="text-white text-lg font-bold leading-snug">
                          {ws.heroHeadline || ws.name || "Your Headline"}
                        </p>
                        <p className="text-white/85 text-sm">
                          {ws.heroSubheadline || "Your sub-headline"}
                        </p>
                        {(ws.heroCtaText || ws.heroCtaLink) && (
                          <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white">
                            {ws.heroCtaText || "Order Now"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {ws.heroType !== "banner" ? (
              <div className="mt-8 space-y-4 border-t border-gray-100 pt-8 dark:border-neutral-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                  Slide content
                </h4>
                <p className="text-xs text-gray-500 dark:text-neutral-500">
                  Each slide has its own headline, subtitle, image, and CTA — independent from Branding.
                </p>
                {(ws.heroSlides || []).map((slide, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-gray-100 dark:border-neutral-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
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
                        <label className={labelCls}>Slide Title</label>
                        <input
                          type="text"
                          value={slide.title || ""}
                          onChange={(e) =>
                            updateHeroSlide(idx, "title", e.target.value)
                          }
                          placeholder="Fresh, Fast &amp; Flavourful"
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Slide Sub-title</label>
                        <input
                          type="text"
                          value={slide.subtitle || ""}
                          onChange={(e) =>
                            updateHeroSlide(idx, "subtitle", e.target.value)
                          }
                          placeholder="Order your favourite meal in minutes"
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>CTA Button Text</label>
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
                        <label className={labelCls}>CTA Button Link</label>
                        <input
                          type="text"
                          value={slide.buttonLink || ""}
                          onChange={(e) =>
                            updateHeroSlide(idx, "buttonLink", e.target.value)
                          }
                          placeholder="#menu"
                          className={inp}
                        />
                      </div>
                    </div>
                    <MediaField
                      label="Slide image"
                      value={slide.imageUrl || ""}
                      onChange={(v) => updateHeroSlide(idx, "imageUrl", v)}
                      hint="Landscape images work best (1200×600 px or larger)."
                      previewClassName="aspect-[2/1] w-full max-h-36"
                    />
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
              ) : null}
              {renderSectionSave("hero")}
            </SectionCard>

            {/* Atmosphere — Lounge About video + gallery */}
            <SectionCard
              id="atmosphere"
              icon={Film}
              title="Atmosphere"
              subtitle="About video and gallery grid for the Lounge template"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "atmosphere"}
            >
              {!isLoungeTemplate ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  Select the <strong>Lounge</strong> template to show this media on
                  your public site. You can upload now and switch templates anytime.
                </p>
              ) : null}

              <div className="space-y-8">
                <MediaField
                  label="About section video"
                  value={ws.aboutVideoUrl || ""}
                  onChange={(v) => update("aboutVideoUrl", v)}
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  uploadFn={uploadVideo}
                  previewAs="video"
                  uploadLabel="Choose video"
                  successToast="Video uploaded"
                  previewClassName="aspect-video w-full max-h-52"
                  hint="Optional cinematic clip for the About section (MP4/WebM, max 50 MB). Replaces the still photo when set."
                />

                <div>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        Atmosphere gallery
                      </h4>
                      <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
                        Add at least 3 photos or videos. When set, these replace
                        the auto-generated gallery from hero slides and menu photos.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className={`${btnSecondary} cursor-pointer`}>
                        <Upload className="w-4 h-4" />
                        Add photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleGalleryFileUpload(e, "image")}
                        />
                      </label>
                      <label className={`${btnSecondary} cursor-pointer`}>
                        <Upload className="w-4 h-4" />
                        Add video
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/*"
                          className="hidden"
                          onChange={(e) => handleGalleryFileUpload(e, "video")}
                        />
                      </label>
                    </div>
                  </div>

                  {galleryMedia.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-neutral-700 dark:text-neutral-400">
                      No gallery media yet. Upload photos or short ambience clips.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {galleryMedia.map((item, idx) => (
                        <div
                          key={`${item.url}-${idx}`}
                          className="overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-700"
                        >
                          <div className="relative aspect-[4/3] bg-black/20">
                            {item.mediaType === "video" ? (
                              <video
                                src={item.url}
                                className="h-full w-full object-cover"
                                controls
                                muted
                                playsInline
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={item.url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              {item.mediaType === "video" ? "Video" : "Photo"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-2 py-2 dark:border-neutral-800">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => moveGalleryItem(idx, -1)}
                                disabled={idx === 0}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                                aria-label="Move earlier"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveGalleryItem(idx, 1)}
                                disabled={idx === galleryMedia.length - 1}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                                aria-label="Move later"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeGalleryItem(idx)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {renderSectionSave("atmosphere")}
            </SectionCard>

            {/* Social Media */}
            <SectionCard
              id="social"
              icon={Globe}
              title="Social Media"
              subtitle="Links shown in header and footer of your website"
              iconColor={iconAccentPrimary}
              bodyClassName="bg-primary/3 dark:bg-neutral-950"
              isActive={activeSection === "social"}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["whatsapp", MessageCircle, "WhatsApp Number (+923001234567)"],
                  ["facebook", Facebook, "Facebook URL"],
                  ["instagram", Instagram, "Instagram URL"],
                  ["twitter", Twitter, "Twitter / X URL"],
                  ["youtube", Youtube, "YouTube URL"],
                ].map(([key, Ic, placeholder]) => (
                  <div key={key}>
                    <label className={labelCls}>
                      <span className="flex items-center gap-1.5">
                        <Ic className="w-3.5 h-3.5" />
                        {key === "whatsapp"
                          ? "WhatsApp"
                          : key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                    </label>
                    <input
                      type={key === "whatsapp" ? "text" : "url"}
                      value={ws.socialMedia?.[key] || ""}
                      onChange={(e) =>
                        updateNested(
                          "socialMedia",
                          key,
                          key === "whatsapp"
                            ? e.target.value.replace(/[^\d+]/g, "")
                            : e.target.value
                        )
                      }
                      placeholder={placeholder}
                      className={inp}
                    />
                    {key === "whatsapp" ? (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-neutral-500">
                        Website link:{" "}
                        {ws.socialMedia?.whatsapp
                          ? `wa.me/${normalizeWhatsAppForWaMe(
                              ws.socialMedia.whatsapp
                            )}`
                          : "wa.me/923001234567"}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {renderSectionSave("social")}
            </SectionCard>

            {/* Opening Hours */}
            <SectionCard
              id="hours"
              icon={Clock}
              title="Opening Hours"
              subtitle="Shown in the footer of your website"
              iconColor={iconAccentPrimary}
              bodyClassName="bg-primary/3 dark:bg-neutral-950"
              isActive={activeSection === "hours"}
            >
              <label className={labelCls}>Opening Hours Text</label>
              <div className="grid grid-cols-[36px_1fr] rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 overflow-hidden">
                <div className="bg-gray-100 dark:bg-neutral-800 text-[11px] font-mono text-gray-500 dark:text-neutral-400 px-2 py-2.5 leading-6">
                  1
                  <br />
                  2
                  <br />
                  3
                  <br />
                  4
                </div>
                <textarea
                  value={ws.openingHoursText || ""}
                  onChange={(e) => update("openingHoursText", e.target.value)}
                  placeholder={"Mon: 9:00 AM - 10:00 PM\nTue: 9:00 AM - 10:00 PM\n..."}
                  rows={4}
                  className="w-full h-auto py-2.5 px-3 resize-none bg-transparent text-sm font-mono text-gray-900 dark:text-white outline-none"
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-2">
                Free text override. If left empty, structured hours below will
                auto-generate this text on save.
              </p>

              <div className="mt-5 rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Or use structured hours
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HOURS_DAYS.map((d) => {
                    const enabled = Boolean(hoursDraft?.[d.key]?.enabled);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() =>
                          updateHoursDraft(d.key, {
                            enabled: !enabled,
                          })
                        }
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                          enabled
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400"
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-2">
                  {HOURS_DAYS.map((d) => {
                    const row = hoursDraft?.[d.key] || {
                      enabled: false,
                      open: "09:00",
                      close: "22:00",
                    };
                    if (!row.enabled) return null;
                    return (
                      <div
                        key={`${d.key}-row`}
                        className="grid grid-cols-12 gap-2 items-center"
                      >
                        <span className="col-span-2 text-xs font-semibold text-gray-600 dark:text-neutral-300">
                          {d.short}
                        </span>
                        <input
                          type="time"
                          value={row.open || "09:00"}
                          onChange={(e) =>
                            updateHoursDraft(d.key, { open: e.target.value })
                          }
                          className={`${inp} col-span-5`}
                        />
                        <input
                          type="time"
                          value={row.close || "22:00"}
                          onChange={(e) =>
                            updateHoursDraft(d.key, { close: e.target.value })
                          }
                          className={`${inp} col-span-5`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {renderSectionSave("hours")}
            </SectionCard>

            {/* Website Sections */}
            <SectionCard
              id="sections"
              icon={Layout}
              title="Website Sections"
              subtitle="Up to 3 custom sections showcasing menu items"
              iconColor={iconAccentPrimary}
              isActive={activeSection === "sections"}
            >
              <div className="space-y-4">
                {(ws.websiteSections || []).length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 p-8 text-center">
                    <Layout className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      No sections added yet
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                      Add up to 3 featured menu sections to highlight your best dishes on the homepage.
                    </p>
                    <button
                      type="button"
                      onClick={addWebsiteSection}
                      className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add your first section
                    </button>
                  </div>
                ) : null}
                {(ws.websiteSections || []).map((section, sIdx) => (
                  <div
                    key={sIdx}
                    className="border-2 border-gray-100 dark:border-neutral-800 rounded-xl p-4"
                  >
                    {(() => {
                      const sectionSearch = String(
                        websiteSectionItemSearch[sIdx] || "",
                      )
                        .trim()
                        .toLowerCase();
                      const visibleMenuItems = sectionSearch
                        ? menuItems.filter((item) =>
                            String(item?.name || "")
                              .toLowerCase()
                              .includes(sectionSearch),
                          )
                        : menuItems;
                      const visibleDeals = sectionSearch
                        ? dealItems.filter((deal) =>
                            String(deal?.name || "")
                              .toLowerCase()
                              .includes(sectionSearch),
                          )
                        : dealItems;
                      const hasAnySelectableItems =
                        menuItems.length > 0 || dealItems.length > 0;
                      const hasAnyVisibleItems =
                        visibleMenuItems.length > 0 || visibleDeals.length > 0;
                      return (
                        <>
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
                      Select Items ({(section.items || []).length} selected)
                    </label>
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={websiteSectionItemSearch[sIdx] || ""}
                        onChange={(e) =>
                          setWebsiteSectionItemSearch((prev) => ({
                            ...prev,
                            [sIdx]: e.target.value,
                          }))
                        }
                        placeholder="Search menu items or deals..."
                        className="h-10 w-full rounded-xl border-2 border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-xl border-2 border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800">
                      {!hasAnySelectableItems ? (
                        <p className="p-4 text-xs text-gray-400 text-center">
                          No menu items or deals found. Add items in Menu or
                          deals in Deals first.
                        </p>
                      ) : !hasAnyVisibleItems ? (
                        <p className="p-4 text-xs text-gray-400 text-center">
                          No menu items or deals match your search.
                        </p>
                      ) : (
                        <>
                          {visibleMenuItems.length > 0 && (
                            <div>
                              <div className="sticky top-0 z-[1] bg-gray-50 dark:bg-neutral-900 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                                Menu Items
                              </div>
                              {visibleMenuItems.map((item) => {
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
                                    onClick={() =>
                                      toggleSectionItem(sIdx, itemId)
                                    }
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-t border-gray-50 dark:border-neutral-800 ${
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
                              })}
                            </div>
                          )}
                          {visibleDeals.length > 0 && (
                            <div>
                              <div className="sticky top-0 z-[1] bg-gray-50 dark:bg-neutral-900 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                                Deals
                              </div>
                              {visibleDeals.map((deal) => {
                                const itemId =
                                  deal._id || deal.id || deal.id?.toString?.();
                                const sectionItems = (section.items || []).map(
                                  (id) => id?._id || id?.toString?.() || id,
                                );
                                const selected = sectionItems.includes(itemId);
                                return (
                                  <button
                                    key={itemId}
                                    type="button"
                                    onClick={() =>
                                      toggleSectionItem(sIdx, itemId)
                                    }
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-t border-gray-50 dark:border-neutral-800 ${
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
                                    {deal.imageUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={deal.imageUrl}
                                        alt=""
                                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                                      />
                                    )}
                                    <span className="flex-1 truncate font-medium">
                                      {deal.name}
                                    </span>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                      PKR {deal.price}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                        </>
                      );
                    })()}
                  </div>
                ))}
                {(ws.websiteSections || []).length > 0 &&
                  (ws.websiteSections || []).length < 3 && (
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
              {renderSectionSave("sections")}
            </SectionCard>

            {/* Settings */}
            <SectionCard
              id="settings"
              icon={Eye}
              title="Settings"
              subtitle="Visibility and ordering controls"
              iconColor={iconAccentPrimary}
              bodyClassName="bg-primary/3 dark:bg-neutral-950"
              isActive={activeSection === "settings"}
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
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-neutral-900">
                  <div className="flex items-center gap-3">
                    <CalendarDays
                      className={`w-5 h-5 ${
                        ws.allowWebsiteReservations !== false
                          ? "text-primary"
                          : "text-gray-400"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Online Reservations
                      </p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">
                        {ws.allowWebsiteReservations !== false
                          ? "Customers can request a table from your website"
                          : "Website reservations are disabled"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "allowWebsiteReservations",
                        ws.allowWebsiteReservations === false,
                      )
                    }
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      ws.allowWebsiteReservations !== false
                        ? "bg-emerald-500"
                        : "bg-gray-300 dark:bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        ws.allowWebsiteReservations !== false
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
              {renderSectionSave("settings")}
            </SectionCard>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
