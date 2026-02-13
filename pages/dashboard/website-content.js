import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getWebsiteSettings, updateWebsiteSettings, getMenu, SubscriptionInactiveError } from "../../lib/apiClient";
import { Plus, Trash2, Save, Image as ImageIcon, Search, X, ChevronDown, ChevronUp, GripVertical, LayoutGrid, Smartphone, Monitor, Eye, RefreshCw } from "lucide-react";
import WebsiteSectionsView from "../../components/website/WebsiteSectionsView";

// Default sections for new restaurants
const DEFAULT_SECTIONS = [
  { title: "Popular Food Items", subtitle: "Our chef's special recommendations", isActive: true, items: [] },
  { title: "Best Selling Dishes", subtitle: "Customer favorites you'll love", isActive: true, items: [] },
  { title: "Special Offers", subtitle: "Don't miss our exclusive deals", isActive: true, items: [] },
];

// Multi-select dropdown component for picking menu items
function ItemSelector({ allItems, categories, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedSet = new Set(selectedIds);

  const filtered = allItems.filter((item) => {
    if (!search) return true;
    return item.name.toLowerCase().includes(search.toLowerCase());
  });

  // Group by category
  const grouped = {};
  for (const item of filtered) {
    const catName = categories.find(c => c.id === item.categoryId)?.name || "Uncategorized";
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(item);
  }

  const toggleItem = (id) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeItem = (id) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  const selectedItems = allItems.filter((item) => selectedSet.has(item.id));

  return (
    <div ref={ref} className="relative">
      {/* Selected items chips */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-500/20"
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
              )}
              {item.name}
              <button onClick={() => removeItem(item.id)} className="ml-0.5 hover:text-red-900 dark:hover:text-red-300">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-700 dark:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-600 transition-colors"
      >
        <span>{selectedIds.length ? `${selectedIds.length} item(s) selected` : "Select menu items..."}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 rounded-lg shadow-xl max-h-72 overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-neutral-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-bg-primary dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-56">
            {Object.keys(grouped).length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-neutral-500 p-3 text-center">No items found</p>
            ) : (
              Object.entries(grouped).map(([catName, catItems]) => (
                <div key={catName}>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-500 bg-bg-primary dark:bg-neutral-900 sticky top-0">
                    {catName}
                  </div>
                  {catItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-bg-primary dark:hover:bg-neutral-900 transition-colors ${
                        selectedSet.has(item.id) ? "bg-red-50/50 dark:bg-red-500/5" : ""
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selectedSet.has(item.id) ? "bg-primary border-primary" : "border-gray-300 dark:border-neutral-600"
                      }`}>
                        {selectedSet.has(item.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-neutral-800 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-500">PKR {item.price}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Resolve section item IDs to full menu objects (same shape as live website)
function resolveWebsiteSections(websiteSections, menuItems, categories) {
  if (!websiteSections || !menuItems) return [];
  return websiteSections
    .map((section) => {
      const items = (section.items || [])
        .map((id) => menuItems.find((m) => m.id === id))
        .filter(Boolean)
        .map((item) => ({
          ...item,
          category: categories.find((c) => c.id === item.categoryId)?.name || "Menu",
        }));
      return { ...section, items };
    })
    .filter((s) => s.items.length > 0 && s.isActive !== false);
}

// Website Preview Component – scaled so content is small (desktop: see more) and mobile matches site mobile view
function WebsitePreview({ settings, menuItems, categories = [], viewMode = "desktop", onViewModeChange }) {
  const primaryColor = settings?.themeColors?.primary || '#EF4444';
  const secondaryColor = settings?.themeColors?.secondary || '#FFA500';
  const heroSlides = settings?.heroSlides?.filter(slide => slide.isActive) || [];
  const [currentSlide, setCurrentSlide] = useState(0);
  const resolvedSections = resolveWebsiteSections(settings?.websiteSections, menuItems, categories);
  const contentRef = useRef(null);
  const scrollRef = useRef(null);
  const [spacerHeight, setSpacerHeight] = useState(400);

  const scrollPreview = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = 180;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    if (maxScroll <= 0) return;
    const newScrollTop = el.scrollTop + (direction === "up" ? -step : step);
    const clamped = Math.max(0, Math.min(newScrollTop, maxScroll));
    el.scrollTop = clamped;
  };

  const isMobile = viewMode === "mobile";
  const frameWidth = isMobile ? 375 : 1200;
  const scale = isMobile ? 0.85 : 0.38;
  const viewportWidth = Math.round(frameWidth * scale);

  useEffect(() => {
    if (heroSlides.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [heroSlides.length]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = el.offsetHeight;
      setSpacerHeight(Math.ceil(h * scale));
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale, resolvedSections?.length, heroSlides.length, menuItems.length]);

  return (
    <div className="w-full h-full relative bg-gray-100 dark:bg-neutral-900 rounded-xl overflow-hidden">
      {/* Chevron scroll buttons – right side of preview pane */}
      <button
        type="button"
        onClick={() => scrollPreview("up")}
        className="absolute right-2 top-4 z-20 p-2 rounded-full bg-white dark:bg-neutral-800 shadow-lg border border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
        title="Scroll up"
        aria-label="Scroll preview up"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollPreview("down")}
        className="absolute right-2 bottom-4 z-20 p-2 rounded-full bg-white dark:bg-neutral-800 shadow-lg border border-gray-200 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
        title="Scroll down"
        aria-label="Scroll preview down"
      >
        <ChevronDown className="w-5 h-5" />
      </button>
      {/* Scroll area: absolute fill so it always has a definite height and can scroll */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-y-scroll overflow-x-hidden py-4 flex justify-center"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="flex-shrink-0 overflow-hidden rounded-lg shadow-2xl relative bg-gray-100 dark:bg-neutral-900"
          style={{ width: viewportWidth, height: spacerHeight, minHeight: 300 }}
        >
          <div style={{ height: spacerHeight }} aria-hidden />
          <div
            ref={contentRef}
            className="bg-white rounded-lg shadow-2xl overflow-hidden absolute left-0 top-0 flex flex-col"
            style={{
              width: frameWidth,
              minHeight: isMobile ? 600 : 800,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {/* Top Bar */}
          <div className="bg-black text-white py-1 text-[6px] px-2">
            <div className="flex items-center justify-between">
              {settings?.contactPhone && (
                <span className="text-[6px]">{settings.contactPhone}</span>
              )}
              <div className="flex gap-1">
                {settings?.socialMedia?.facebook && <span className="text-[6px]">FB</span>}
                {settings?.socialMedia?.instagram && <span className="text-[6px]">IG</span>}
              </div>
            </div>
          </div>

          {/* Navigation – same links as live website (Menu, sections, Contact); stacks on mobile */}
          <nav className="bg-white shadow-sm sticky top-0 z-10 px-2 py-1.5">
            <div className={`flex items-center justify-between ${isMobile ? "flex-col gap-2" : ""}`}>
              <div className="flex items-center gap-1.5">
                {settings?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logoUrl} alt="" className="h-5 w-5 rounded object-cover" />
                ) : (
                  <div className="h-5 w-5 rounded flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: primaryColor }}>
                    {(settings?.name || "R")[0]}
                  </div>
                )}
                <div>
                  <h1 className="text-[10px] font-bold text-gray-900 leading-tight">{settings?.name || "Restaurant"}</h1>
                  <p className="text-[6px] text-gray-600">{settings?.tagline || "Delicious food"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href="#menu" className="text-[8px] font-medium text-gray-700 hover:text-gray-900">Menu</a>
                {resolvedSections.length > 0 && resolvedSections.map((sec, i) => (
                  <a key={i} href={`#section-${i}`} className="text-[8px] font-medium text-gray-700 hover:text-gray-900 truncate max-w-[48px]">{sec.title || `S${i + 1}`}</a>
                ))}
                <a href="#contact" className="text-[8px] font-medium text-gray-700 hover:text-gray-900">Contact</a>
                <div className="h-4 w-4 rounded-full flex items-center justify-center text-white text-[8px]" style={{ backgroundColor: primaryColor }}>🛒</div>
              </div>
            </div>
          </nav>

          {/* Hero Carousel */}
          {heroSlides.length > 0 && (
            <div className="relative h-24 overflow-hidden">
              {heroSlides.map((slide, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    index === currentSlide ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {slide.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-gray-200 to-gray-300" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center px-2">
                    <div>
                      <h2 className="text-[10px] font-bold text-white mb-0.5">{slide.title || "Welcome"}</h2>
                      <p className="text-[6px] text-gray-200">{slide.subtitle || ""}</p>
                    </div>
                  </div>
                </div>
              ))}
              {heroSlides.length > 1 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                  {heroSlides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setCurrentSlide(index)}
                      className={`h-1 rounded-full transition-all ${
                        index === currentSlide ? 'w-3 bg-white' : 'w-1 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Website sections – same component as live site, compact in preview */}
          {resolvedSections.length > 0 && (
            <div className="flex-1">
              <WebsiteSectionsView
                websiteSections={resolvedSections}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                onItemClick={() => {}}
                isPreview
                forceMobile={isMobile}
              />
            </div>
          )}

          {/* Food Menu section – same as on website (categories + menu list) */}
          <section id="menu" className="py-4 bg-orange-50/40">
            <div className="max-w-6xl mx-auto px-4">
              <div className="text-center mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: secondaryColor }}>
                  Food Menu
                </p>
                <h2 className="text-base font-black text-gray-900">
                  {settings?.name || "Our"} Menu
                </h2>
              </div>
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  <span className="flex-shrink-0 px-2 py-1 rounded-full text-[8px] font-semibold text-white" style={{ backgroundColor: primaryColor }}>All</span>
                  {categories.slice(0, 5).map((cat) => (
                    <span key={cat.id} className="flex-shrink-0 px-2 py-1 rounded-full text-[8px] font-medium text-gray-700 bg-white border border-gray-200">
                      {cat.name}
                    </span>
                  ))}
                  {categories.length > 5 && <span className="text-[8px] text-gray-500">+{categories.length - 5}</span>}
                </div>
              )}
              <div className="w-full h-px bg-gray-200 mb-3" />
              <div className={`grid gap-x-4 gap-y-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
                {menuItems.slice(0, 6).map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-gray-200">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">🍽</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-gray-900 truncate">{item.name}</p>
                      <p className="text-[8px] text-gray-500 truncate">{item.description || ""}</p>
                    </div>
                    <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: primaryColor }}>PKR {item.price}</span>
                  </div>
                ))}
              </div>
              {menuItems.length > 6 && (
                <p className="text-center text-[8px] text-gray-500 mt-2">+{menuItems.length - 6} more items</p>
              )}
            </div>
          </section>

          {/* Footer Preview */}
          <footer className="bg-gray-900 text-white px-2 py-1.5 mt-auto">
            <div className="text-center">
              <h4 className="text-[7px] font-bold mb-0.5">{settings?.name || "Restaurant"}</h4>
              <p className="text-[5px] text-gray-400 mb-1">{settings?.description?.substring(0, 50) || "Delicious food, great service."}</p>
              {settings?.contactPhone && (
                <p className="text-[5px] text-gray-400">{settings.contactPhone}</p>
              )}
            </div>
          </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebsiteContentPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [previewMode, setPreviewMode] = useState("desktop"); // "desktop" or "mobile"

  useEffect(() => {
    loadSettings();
    loadMenuItems();
  }, []);

  async function loadMenuItems() {
    try {
      const data = await getMenu();
      setMenuItems(data.items || []);
      setCategories(data.categories || []);
    } catch (err) {
      console.error("Failed to load menu items:", err);
    }
  }

  async function loadSettings() {
    try {
      const data = await getWebsiteSettings();
      // Initialize default structures if they don't exist
      if (!data.heroSlides) data.heroSlides = [];
      if (!data.socialMedia) data.socialMedia = {};
      if (!data.openingHours) data.openingHours = {};
      if (!data.themeColors) data.themeColors = { primary: '#EF4444', secondary: '#FFA500' };
      if (data.allowWebsiteOrders === undefined) data.allowWebsiteOrders = true;
      // Initialize website sections with defaults if not present
      if (!data.websiteSections || data.websiteSections.length === 0) {
        data.websiteSections = DEFAULT_SECTIONS.map(s => ({ ...s }));
      }
      setSettings(data);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        console.error("Failed to load settings:", err);
        setError(err.message || "Failed to load website settings");
      }
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await updateWebsiteSettings(settings);
      setSaveMessage({ type: "success", text: "Website content saved successfully!" });
    } catch (err) {
      setSaveMessage({ type: "error", text: "Failed to save: " + (err.message || "Unknown error") });
    } finally {
      setSaving(false);
    }
  }

  const addHeroSlide = () => {
    setSettings(prev => ({
      ...prev,
      heroSlides: [...(prev.heroSlides || []), {
        title: "",
        subtitle: "",
        imageUrl: "",
        buttonText: "Order Now",
        buttonLink: "",
        isActive: true
      }]
    }));
  };

  const updateHeroSlide = (index, field, value) => {
    setSettings(prev => ({
      ...prev,
      heroSlides: prev.heroSlides.map((slide, i) => 
        i === index ? { ...slide, [field]: value } : slide
      )
    }));
  };

  const removeHeroSlide = (index) => {
    setSettings(prev => ({
      ...prev,
      heroSlides: prev.heroSlides.filter((_, i) => i !== index)
    }));
  };

  if (!settings) {
    return (
      <AdminLayout title="Website Content" suspended={suspended}>
        <p className="text-sm text-gray-900 dark:text-neutral-400">Loading...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Website Content" suspended={suspended}>
      {saveMessage && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2 text-xs ${
            saveMessage.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {saveMessage.text}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("hero")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "hero"
                ? "bg-primary text-white"
                : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
            }`}
          >
            Hero Slides
          </button>
          <button
            onClick={() => setActiveTab("social")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "social"
                ? "bg-primary text-white"
                : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
            }`}
          >
            Social Media
          </button>
          <button
            onClick={() => setActiveTab("hours")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "hours"
                ? "bg-primary text-white"
                : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
            }`}
          >
            Opening Hours
          </button>
          <button
            onClick={() => setActiveTab("theme")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "theme"
                ? "bg-primary text-white"
                : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
            }`}
          >
            Theme Colors
          </button>
          <button
            onClick={() => setActiveTab("sections")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "sections"
                ? "bg-primary text-white"
                : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
            }`}
          >
            Website Sections
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "orders"
                ? "bg-primary text-white"
                : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
            }`}
          >
            Order Settings
          </button>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Management */}
        <div className="space-y-6">

          {/* Hero Slides Tab */}
          {activeTab === "hero" && (
            <Card title="Hero Slides" description="Manage homepage banner carousel">
              <div className="space-y-4">
                {settings.heroSlides?.map((slide, index) => (
                  <div key={index} className="p-4 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Slide {index + 1}</h3>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-gray-900 dark:text-neutral-400">
                          <input
                            type="checkbox"
                            checked={slide.isActive}
                            onChange={(e) => updateHeroSlide(index, 'isActive', e.target.checked)}
                            className="rounded"
                          />
                          Active
                        </label>
                        <button
                          onClick={() => removeHeroSlide(index)}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-secondary/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Title"
                        value={slide.title || ''}
                        onChange={(e) => updateHeroSlide(index, 'title', e.target.value)}
                        className="px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Subtitle"
                        value={slide.subtitle || ''}
                        onChange={(e) => updateHeroSlide(index, 'subtitle', e.target.value)}
                        className="px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Image URL"
                        value={slide.imageUrl || ''}
                        onChange={(e) => updateHeroSlide(index, 'imageUrl', e.target.value)}
                        className="px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Button Text"
                        value={slide.buttonText || ''}
                        onChange={(e) => updateHeroSlide(index, 'buttonText', e.target.value)}
                        className="px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={addHeroSlide}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-neutral-400 hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Hero Slide
                </button>
              </div>
            </Card>
          )}

          {/* Social Media Tab */}
          {activeTab === "social" && (
            <Card title="Social Media Links" description="Add your social media profiles">
              <div className="space-y-3">
                {/* existing social fields ... */}
              </div>
            </Card>
          )}

          {/* Opening Hours Tab */}
          {activeTab === "hours" && (
            <Card title="Opening Hours" description="Set your restaurant opening hours">
              <div className="space-y-3">
                {/* existing opening hours fields ... */}
              </div>
            </Card>
          )}

          {/* Theme Colors Tab */}
          {activeTab === "theme" && (
            <Card title="Theme Colors" description="Customize your website colors">
              <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.themeColors?.primary || '#EF4444'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    themeColors: { ...prev.themeColors, primary: e.target.value }
                  }))}
                  className="h-10 w-20 rounded border border-gray-300 dark:border-neutral-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.themeColors?.primary || '#EF4444'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    themeColors: { ...prev.themeColors, primary: e.target.value }
                  }))}
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Secondary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.themeColors?.secondary || '#FFA500'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    themeColors: { ...prev.themeColors, secondary: e.target.value }
                  }))}
                  className="h-10 w-20 rounded border border-gray-300 dark:border-neutral-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.themeColors?.secondary || '#FFA500'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    themeColors: { ...prev.themeColors, secondary: e.target.value }
                  }))}
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Website Sections Tab */}
      {activeTab === "sections" && (
        <div className="space-y-4">
          <Card title="Website Sections" description="Configure up to 3 sections on your public website. Assign menu items to each section — one item can appear in multiple sections.">
            <div className="space-y-6">
              {(settings.websiteSections || []).map((section, sIndex) => (
                <div
                  key={sIndex}
                  className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-bg-primary dark:bg-neutral-900"
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950 rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        Section {sIndex + 1}
                      </span>
                      {section.title && (
                        <span className="text-xs text-gray-500 dark:text-neutral-500">— {section.title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-neutral-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={section.isActive}
                          onChange={(e) => {
                            const updated = [...settings.websiteSections];
                            updated[sIndex] = { ...updated[sIndex], isActive: e.target.checked };
                            setSettings(prev => ({ ...prev, websiteSections: updated }));
                          }}
                          className="rounded"
                        />
                        Show on website
                      </label>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        section.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-gray-200 text-gray-600 dark:bg-neutral-800 dark:text-neutral-500"
                      }`}>
                        {section.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>

                  {/* Section Body */}
                  <div className="p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">Section Title</label>
                        <input
                          type="text"
                          placeholder="e.g., Popular Food Items"
                          value={section.title || ''}
                          onChange={(e) => {
                            const updated = [...settings.websiteSections];
                            updated[sIndex] = { ...updated[sIndex], title: e.target.value };
                            setSettings(prev => ({ ...prev, websiteSections: updated }));
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">Subtitle</label>
                        <input
                          type="text"
                          placeholder="e.g., Our chef's special recommendations"
                          value={section.subtitle || ''}
                          onChange={(e) => {
                            const updated = [...settings.websiteSections];
                            updated[sIndex] = { ...updated[sIndex], subtitle: e.target.value };
                            setSettings(prev => ({ ...prev, websiteSections: updated }));
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                        Menu Items
                        <span className="ml-1 font-normal text-gray-500 dark:text-neutral-500">
                          ({(section.items || []).length} selected)
                        </span>
                      </label>
                      <ItemSelector
                        allItems={menuItems}
                        categories={categories}
                        selectedIds={section.items || []}
                        onChange={(newItems) => {
                          const updated = [...settings.websiteSections];
                          updated[sIndex] = { ...updated[sIndex], items: newItems };
                          setSettings(prev => ({ ...prev, websiteSections: updated }));
                        }}
                      />
                    </div>

                    {/* Preview of selected items */}
                    {(section.items || []).length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-neutral-500 mb-2">Preview</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {(section.items || []).slice(0, 8).map((itemId) => {
                            const item = menuItems.find(m => m.id === itemId);
                            if (!item) return null;
                            return (
                              <div key={itemId} className="flex items-center gap-2 p-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-neutral-800 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                                  <p className="text-[10px] text-gray-500 dark:text-neutral-500">PKR {item.price}</p>
                                </div>
                              </div>
                            );
                          })}
                          {(section.items || []).length > 8 && (
                            <div className="flex items-center justify-center p-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
                              <p className="text-xs text-gray-500 dark:text-neutral-500">+{(section.items || []).length - 8} more</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(settings.websiteSections || []).length < 3 && (
                <button
                  onClick={() => {
                    const nextIndex = (settings.websiteSections || []).length;
                    const defaults = DEFAULT_SECTIONS[nextIndex] || { title: "", subtitle: "", isActive: true, items: [] };
                    setSettings(prev => ({
                      ...prev,
                      websiteSections: [...(prev.websiteSections || []), { ...defaults }]
                    }));
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Section ({3 - (settings.websiteSections || []).length} remaining)
                </button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Order Settings Tab */}
      {activeTab === "orders" && (
        <Card title="Order Settings" description="Control website ordering behaviour for your customers">
          <div className="space-y-6">
            {/* Allow Website Orders Toggle */}
            <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-bg-secondary dark:bg-neutral-950">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Allow Website Orders</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 max-w-md">
                  When enabled, customers can add items to cart and place orders via Cash on Delivery from your public website.
                  When disabled, customers can still browse the menu but will see a message to contact you directly at checkout.
                </p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, allowWebsiteOrders: !prev.allowWebsiteOrders }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full flex-shrink-0 transition-colors ${
                  settings.allowWebsiteOrders ? "bg-primary" : "bg-gray-300 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-bg-secondary shadow transition-transform ${
                    settings.allowWebsiteOrders ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Status indicator */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              settings.allowWebsiteOrders
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                : "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                settings.allowWebsiteOrders ? "bg-emerald-500" : "bg-amber-500"
              }`} />
              <p className={`text-xs font-medium ${
                settings.allowWebsiteOrders
                  ? "text-emerald-800 dark:text-emerald-400"
                  : "text-amber-800 dark:text-amber-400"
              }`}>
                {settings.allowWebsiteOrders
                  ? "Online ordering is active. Customers can place orders from your website."
                  : "Online ordering is blocked. Customers will be asked to contact you directly."}
              </p>
            </div>
          </div>
        </Card>
      )}
        </div>

        {/* Right Column - Preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl px-0 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-4 px-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Live Preview</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 rounded-lg p-1">
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      previewMode === "desktop"
                        ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-neutral-400"
                    }`}
                    title="Desktop View"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      previewMode === "mobile"
                        ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-neutral-400"
                    }`}
                    title="Mobile View"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { loadSettings(); loadMenuItems(); }}
                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors border border-transparent hover:border-gray-300 dark:hover:border-neutral-600"
                  title="Reload preview"
                  aria-label="Reload preview"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="h-[600px] relative overflow-hidden">
              <WebsitePreview 
                settings={settings} 
                menuItems={menuItems}
                categories={categories}
                viewMode={previewMode}
                onViewModeChange={setPreviewMode}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
