import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getWebsiteSettings, updateWebsiteSettings, getMenu, SubscriptionInactiveError } from "../../lib/apiClient";
import { Plus, Trash2, Save, Image as ImageIcon, Search, X, ChevronDown, GripVertical, LayoutGrid } from "lucide-react";

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

export default function WebsiteContentPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);

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
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">Facebook</label>
              <input
                type="url"
                placeholder="https://facebook.com/yourpage"
                value={settings.socialMedia?.facebook || ''}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  socialMedia: { ...prev.socialMedia, facebook: e.target.value }
                }))}
                className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">Instagram</label>
              <input
                type="url"
                placeholder="https://instagram.com/yourpage"
                value={settings.socialMedia?.instagram || ''}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  socialMedia: { ...prev.socialMedia, instagram: e.target.value }
                }))}
                className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">Twitter</label>
              <input
                type="url"
                placeholder="https://twitter.com/yourpage"
                value={settings.socialMedia?.twitter || ''}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  socialMedia: { ...prev.socialMedia, twitter: e.target.value }
                }))}
                className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-neutral-300">YouTube</label>
              <input
                type="url"
                placeholder="https://youtube.com/yourchannel"
                value={settings.socialMedia?.youtube || ''}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  socialMedia: { ...prev.socialMedia, youtube: e.target.value }
                }))}
                className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Opening Hours Tab */}
      {activeTab === "hours" && (
        <Card title="Opening Hours" description="Set your restaurant opening hours">
          <div className="space-y-3">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
              <div key={day} className="grid grid-cols-[120px_1fr] gap-3 items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-neutral-300 capitalize">{day}</label>
                <input
                  type="text"
                  placeholder="e.g., 9:00 AM - 10:00 PM"
                  value={settings.openingHours?.[day] || ''}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    openingHours: { ...prev.openingHours, [day]: e.target.value }
                  }))}
                  className="px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                />
              </div>
            ))}
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
    </AdminLayout>
  );
}
