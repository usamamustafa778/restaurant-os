import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getWebsiteSettings, updateWebsiteSettings, getMenu, getBranches, SubscriptionInactiveError, uploadImage } from "../../lib/apiClient";
import toast from "react-hot-toast";
import { Plus, Trash2, Save, Search, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, LayoutGrid, Smartphone, Monitor, RefreshCw, Phone, Mail, ShoppingCart, Link as LinkIcon, Upload, Loader2, Globe, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import WebsiteSectionsView from "../../components/website/WebsiteSectionsView";

const DEFAULT_SECTIONS = [
  { title: "Popular Food Items", subtitle: "Our chef's special recommendations", isActive: true, items: [] },
  { title: "Best Selling Dishes", subtitle: "Customer favorites you'll love", isActive: true, items: [] },
  { title: "Special Offers", subtitle: "Don't miss our exclusive deals", isActive: true, items: [] },
];

function ItemSelector({ allItems, categories, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selectedIds);

  const filtered = allItems.filter((item) => {
    if (!search) return true;
    return item.name.toLowerCase().includes(search.toLowerCase());
  });

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-700 dark:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-600 transition-colors"
      >
        <span>{selectedIds.length ? `${selectedIds.length} item(s) selected` : "Add items..."}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {selectedItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 dark:bg-primary/20 text-gray-800 dark:text-gray-200 border border-primary/30 dark:border-primary/40 text-xs font-medium"
            >
              {item.name}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="ml-0.5 p-0.5 rounded hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                aria-label={`Remove ${item.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
          <div
            className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-950 shadow-2xl border border-gray-200 dark:border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Select items for this section</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-gray-200 dark:border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-2">
              {Object.keys(grouped).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-neutral-500 py-6 text-center">No items found</p>
              ) : (
                Object.entries(grouped).map(([catName, catItems]) => (
                  <div key={catName} className="mb-3">
                    <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-900 rounded-lg sticky top-0">
                      {catName}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {catItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedSet.has(item.id) ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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
                            <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-neutral-800 flex-shrink-0 flex items-center justify-center text-gray-400 text-lg">🍽</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-neutral-500">PKR {item.price}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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

function WebsitePreview({ settings, menuItems, categories = [], viewMode = "desktop" }) {
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
  const frameWidth = isMobile ? 390 : 900;
  const scale = isMobile ? 0.8 : 0.67
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
            <div className="bg-black text-white py-1.5 px-3">
              <div className="flex items-center justify-between text-[6px] max-w-[850px] w-full mx-auto">
                <div className="flex items-center gap-1.5 min-w-0">
                  {settings?.contactPhone && (
                    <span className="flex items-center gap-0.5 truncate">
                      <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{settings.contactPhone}</span>
                    </span>
                  )}
                  {settings?.contactEmail && (
                    <span className="flex items-center gap-0.5 truncate">
                      <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{settings.contactEmail}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {settings?.socialMedia?.facebook && <span className="text-[6px]">FB</span>}
                  {settings?.socialMedia?.instagram && <span className="text-[6px]">IG</span>}
                </div>
              </div>
            </div>

            <nav className="bg-white shadow-sm sticky top-0 z-10 px-3 py-1.5 max-w-[850px] w-full mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {settings?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logoUrl} alt="" className="h-5 w-5 rounded object-cover" />
                  ) : (
                    <div className="flex-shrink-0 h-5 px-1.5 rounded flex items-center justify-center border" style={{ borderColor: primaryColor }}>
                      <span className="text-[8px] font-bold truncate max-w-[80px]" style={{ color: primaryColor }}>
                        {settings?.name || "Restaurant"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isMobile && (
                    <>
                      <a href="#menu" className="text-[8px] font-medium text-gray-700 hover:text-gray-900">Menu</a>
                      {resolvedSections.length > 0 && resolvedSections.map((sec, i) => (
                        <a key={i} href={`#section-${i}`} className="text-[8px] font-medium text-gray-700 hover:text-gray-900 truncate max-w-[48px]">{sec.title || `S${i + 1}`}</a>
                      ))}
                      <a href="#contact" className="text-[8px] font-medium text-gray-700 hover:text-gray-900">Contact</a>
                    </>
                  )}
                  <div
                    className="rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: primaryColor, width: isMobile ? 20 : 18, height: isMobile ? 20 : 18 }}
                    title="Cart"
                  >
                    <ShoppingCart className="w-2.5 h-2.5" />
                  </div>
                </div>
              </div>
            </nav>

            {heroSlides.length > 0 && (
              <div className="relative h-[250px] overflow-hidden">
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
                    <div className="absolute px-5 inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center">
                      <div className="flex flex-col gap-1">
                        <h2 className="text-[18px] font-bold text-white mb-0.5">{slide.title || "Welcome"}</h2>
                        <p className="text-[16px] text-gray-200 mb-1">{slide.subtitle || ""}</p>
                        {(slide.buttonText || slide.title) && (
                          <span
                            className="inline-block px-2 py-1 rounded-full text-[12px] font-bold text-white"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {slide.buttonText || "Order Now"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {heroSlides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length); }}
                      className="absolute left-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/90 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-2.5 h-2.5 text-gray-800" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setCurrentSlide((prev) => (prev + 1) % heroSlides.length); }}
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/90 flex items-center justify-center"
                    >
                      <ChevronRight className="w-2.5 h-2.5 text-gray-800" />
                    </button>
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
                  </>
                )}
              </div>
            )}

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

            <section id="menu" className={`py-4 bg-orange-50/40 ${isMobile ? "px-3" : ""}`}>
              <div className="px-3 max-w-[850px] w-full mx-auto">
                <div className="text-center mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: secondaryColor }}>
                    Food Menu
                  </p>
                  <h2 className="text-base font-black text-gray-900">
                    {settings?.name || "Our"} Menu
                  </h2>
                </div>
                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 sl-hide-sb" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                    <span className="flex-shrink-0 px-2 py-1 rounded-full text-[8px] font-semibold text-white" style={{ backgroundColor: primaryColor }}>All</span>
                    {categories.slice(0, 5).map((cat) => (
                      <span key={cat.id} className="flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-full text-[8px] font-medium text-gray-700 bg-white border border-gray-200">
                        {cat.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cat.imageUrl} alt={cat.name} className="w-4 h-4 rounded-full object-cover" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-[10px]">🍽</div>
                        )}
                        {cat.name}
                      </span>
                    ))}
                    {categories.length > 5 && <span className="text-[8px] text-gray-500 flex-shrink-0">+{categories.length - 5}</span>}
                  </div>
                )}
                <div className="w-full h-px bg-gray-200 mb-3" />
                <div className={`grid gap-y-3 text-left ${isMobile ? "grid-cols-1 gap-x-0" : "grid-cols-1 md:grid-cols-2 gap-x-4"}`}>
                  {menuItems.slice(0, 6).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 w-full">
                      <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-gray-200">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">🍽</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[10px] font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-[8px] text-gray-500 truncate">{item.description || ""}</p>
                      </div>
                      <span className="text-[10px] font-bold whitespace-nowrap flex-shrink-0" style={{ color: primaryColor }}>PKR {item.price}</span>
                    </div>
                  ))}
                </div>
                {menuItems.length > 6 && (
                  <p className="text-center text-[8px] text-gray-500 mt-2">+{menuItems.length - 6} more items</p>
                )}
              </div>
            </section>

            <footer className="bg-gray-900 text-white px-3 py-3 mt-auto">
              <div className={`grid gap-4 text-[6px] max-w-[850px] w-full mx-auto ${isMobile ? "grid-cols-1 text-left" : "grid-cols-1 sm:grid-cols-3 text-left"}`}>
                <div>
                  <h4 className="font-bold text-[7px] mb-0.5">{settings?.name || "Restaurant"}</h4>
                  <p className="text-gray-400">{settings?.tagline || settings?.description?.substring(0, 40) || "Delicious food, great service."}</p>
                </div>
                <div>
                  <h4 className="font-bold text-[7px] mb-0.5">Contact Us</h4>
                  {settings?.contactPhone && <p className="text-gray-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5 flex-shrink-0" /> {settings.contactPhone}</p>}
                  {settings?.contactEmail && <p className="text-gray-400 flex items-center gap-0.5"><Mail className="w-2.5 h-2.5 flex-shrink-0" /> {settings.contactEmail}</p>}
                </div>
                <div>
                  <h4 className="font-bold text-[7px] mb-0.5">Opening Hours</h4>
                  {settings?.openingHoursText?.trim() ? (
                    <p className="text-gray-400 whitespace-pre-line">{settings.openingHoursText.trim()}</p>
                  ) : (
                    <p className="text-gray-500 text-[6px]">Add opening hours in the Opening Hours tab.</p>
                  )}
                </div>
              </div>
              <p className="text-center text-[5px] text-gray-500 mt-3">© {new Date().getFullYear()} {settings?.name || "Restaurant"}. Powered by Eats Desk</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebsiteContentPage() {
  const [settings, setSettings] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");
  const [suspended, setSuspended] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [heroSlideImageTabs, setHeroSlideImageTabs] = useState({});
  const [uploadingHeroSlideIndex, setUploadingHeroSlideIndex] = useState(null);
  const heroSlideFileRefs = useRef({});
  const [copied, setCopied] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchOrderSettings, setBranchOrderSettings] = useState({});
  const [savingOrderSettings, setSavingOrderSettings] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await loadSettings();
        await loadMenuItems();
        await loadBranches();
      } catch (err) {
        toast.error(err.message || "Failed to load website content");
      } finally {
        setPageLoading(false);
      }
    })();
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

  async function loadBranches() {
    try {
      const data = await getBranches();
      const branchesList = Array.isArray(data) ? data : (data.branches || []);
      setBranches(branchesList);
      const initialSettings = {};
      branchesList.forEach(branch => {
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
      const initialSettings = {};
      branches.forEach(branch => {
        initialSettings[branch.id] = branch.allowWebsiteOrders !== undefined
          ? branch.allowWebsiteOrders !== false
          : (settings?.allowWebsiteOrders !== false);
      });
      setBranchOrderSettings(initialSettings);
    }
  }, [showOrderModal, branches, settings]);

  async function loadSettings() {
    try {
      const data = await getWebsiteSettings();
      if (!data.heroSlides) data.heroSlides = [];
      if (!data.socialMedia) data.socialMedia = {};
      if (data.openingHoursText === undefined) data.openingHoursText = "";
      delete data.openingHours;
      if (!data.themeColors) data.themeColors = { primary: '#EF4444', secondary: '#FFA500' };
      if (data.allowWebsiteOrders === undefined) data.allowWebsiteOrders = true;
      if (!data.websiteSections || data.websiteSections.length === 0) {
        data.websiteSections = DEFAULT_SECTIONS.map(s => ({ ...s }));
      }
      setSettings(data);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        console.error("Failed to load settings:", err);
      }
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const { openingHours, ...payload } = settings;
      await updateWebsiteSettings(payload);
      toast.success("Website settings saved!");
    } catch (err) {
      toast.error("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOrderSettings() {
    setSavingOrderSettings(true);
    try {
      const allBranchesAllow = Object.values(branchOrderSettings).every(v => v === true);
      const updatedSettings = {
        ...settings,
        allowWebsiteOrders: allBranchesAllow
      };
      await updateWebsiteSettings(updatedSettings);
      setSettings(updatedSettings);
      setShowOrderModal(false);
      toast.success("Order settings saved!");
    } catch (err) {
      console.error("Failed to save order settings:", err);
      toast.error("Failed to save order settings.");
    } finally {
      setSavingOrderSettings(false);
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

  async function handleHeroSlideImageUpload(index, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeroSlideIndex(index);
    try {
      const { url } = await uploadImage(file);
      updateHeroSlide(index, "imageUrl", url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingHeroSlideIndex(null);
      const ref = heroSlideFileRefs.current[index];
      if (ref) ref.value = "";
    }
  }

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
      <AdminLayout title="Website Settings" suspended={suspended}>
        <p className="text-sm text-gray-900 dark:text-neutral-400">Loading...</p>
      </AdminLayout>
    );
  }

  const tabs = [
    { id: "hero", label: "Hero Slides" },
    { id: "sections", label: "Sections" },
    { id: "social", label: "Social Media" },
    { id: "hours", label: "Opening Hours" },
    { id: "theme", label: "Theme" },
    { id: "orders", label: "Orders" },
  ];

  return (
    <AdminLayout title="Website Settings" suspended={suspended}>
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
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
      ) : (
        <>
          {/* Sticky Header with URL Banner + Tabs */}
          <div className="sticky top-0 z-20 -mx-6 px-6 py-4 bg-gray-100 dark:bg-black border-b border-gray-200 dark:border-neutral-800 mb-6 space-y-3">
            {/* URL Banner */}
            {websiteUrl && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-neutral-400 font-mono truncate bg-gray-50 dark:bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 min-w-0">
                    {websiteUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-semibold ${
                      settings.isPublic
                        ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                        : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${settings.isPublic ? "bg-emerald-500 animate-pulse" : "bg-orange-400"}`} />
                    {settings.isPublic ? "Live" : "Offline"}
                    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      settings.isPublic ? "bg-emerald-500" : "bg-gray-300 dark:bg-neutral-600"
                    }`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                        settings.isPublic ? "translate-x-[17px]" : "translate-x-[3px]"
                      }`} />
                    </span>
                  </button>
                  <div className="h-5 w-px bg-gray-200 dark:bg-neutral-700" />
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all text-xs font-medium"
                  >
                    {copied ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                  <button
                    onClick={openWebsite}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Live
                  </button>
                </div>
              </div>
            )}

            {/* Tabs + Save */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-primary text-white"
                        : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column - Management */}
            <div className="space-y-6 min-w-0">

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
                            placeholder="Button Text"
                            value={slide.buttonText || ''}
                            onChange={(e) => updateHeroSlide(index, 'buttonText', e.target.value)}
                            className="px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="space-y-2 mt-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Slide image</label>
                          <div className="flex rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden w-fit">
                            <button
                              type="button"
                              onClick={() => setHeroSlideImageTabs(prev => ({ ...prev, [index]: "link" }))}
                              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                                (heroSlideImageTabs[index] || "link") === "link"
                                  ? "bg-primary text-white"
                                  : "bg-bg-secondary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-800"
                              }`}
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              Paste URL
                            </button>
                            <button
                              type="button"
                              onClick={() => setHeroSlideImageTabs(prev => ({ ...prev, [index]: "upload" }))}
                              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-l border-gray-300 dark:border-neutral-700 transition-colors ${
                                heroSlideImageTabs[index] === "upload"
                                  ? "bg-primary text-white"
                                  : "bg-bg-secondary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-800"
                              }`}
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload from PC
                            </button>
                          </div>
                          {(heroSlideImageTabs[index] || "link") === "link" && (
                            <input
                              type="text"
                              placeholder="https://..."
                              value={slide.imageUrl || ''}
                              onChange={(e) => updateHeroSlide(index, 'imageUrl', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                            />
                          )}
                          {heroSlideImageTabs[index] === "upload" && (
                            <label className="flex flex-col items-center justify-center w-full h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-neutral-700 bg-bg-primary dark:bg-neutral-900 hover:border-primary/60 cursor-pointer transition-colors">
                              {uploadingHeroSlideIndex === index ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                  <span className="text-xs font-medium text-primary">Uploading...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <Upload className="w-5 h-5 text-gray-400" />
                                  <span className="text-xs text-gray-500 dark:text-neutral-400">Click to browse</span>
                                </div>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={el => { if (el) heroSlideFileRefs.current[index] = el; }}
                                onChange={(e) => handleHeroSlideImageUpload(index, e)}
                                disabled={uploadingHeroSlideIndex === index}
                              />
                            </label>
                          )}
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
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Facebook URL</label>
                      <input
                        type="url"
                        value={settings.socialMedia?.facebook || ""}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          socialMedia: { ...(prev.socialMedia || {}), facebook: e.target.value }
                        }))}
                        placeholder="https://facebook.com/yourpage"
                        className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Instagram URL</label>
                      <input
                        type="url"
                        value={settings.socialMedia?.instagram || ""}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          socialMedia: { ...(prev.socialMedia || {}), instagram: e.target.value }
                        }))}
                        placeholder="https://instagram.com/yourpage"
                        className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Twitter / X URL</label>
                      <input
                        type="url"
                        value={settings.socialMedia?.twitter || ""}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          socialMedia: { ...(prev.socialMedia || {}), twitter: e.target.value }
                        }))}
                        placeholder="https://twitter.com/yourpage"
                        className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">YouTube URL</label>
                      <input
                        type="url"
                        value={settings.socialMedia?.youtube || ""}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          socialMedia: { ...(prev.socialMedia || {}), youtube: e.target.value }
                        }))}
                        placeholder="https://youtube.com/yourchannel"
                        className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </Card>
              )}

              {/* Opening Hours Tab */}
              {activeTab === "hours" && (
                <Card title="Opening Hours" description="Add your opening hours as free text. For example: 24/7, All day 9am to 4pm, or list days and times.">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Opening hours (paragraph)</label>
                    <textarea
                      value={settings.openingHoursText || ""}
                      onChange={(e) => setSettings(prev => ({ ...prev, openingHoursText: e.target.value }))}
                      placeholder={"e.g. 24/7\n\nOr:\nMonday – Friday: 9am to 10pm\nSaturday – Sunday: 10am to 11pm\nOr: All day 9am to 4pm"}
                      rows={6}
                      className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y"
                    />
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
                              <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">Menu Items</label>
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
            <div className="lg:sticky lg:top-[160px] lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto w-full">
              <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl px-0 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-4 px-4 flex-shrink-0">
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
                  />
                </div>
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
        </>
      )}
    </AdminLayout>
  );
}
