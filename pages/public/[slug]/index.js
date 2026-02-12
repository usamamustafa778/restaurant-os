import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { getPublicMenu, getPublicTenantInfo, getImageUrl, formatPrice } from "../../../lib/api";

const FEATURED_COUNT = 6;

const RESTAURANT_FEATURES = [
  { 
    label: "Fresh Ingredients", 
    sub: "Quality you can taste", 
    icon: "🥬",
    desc: "We source the freshest ingredients daily to ensure every dish meets our high standards."
  },
  { 
    label: "Fast Delivery", 
    sub: "Hot & on time", 
    icon: "🚀",
    desc: "Your order delivered quickly while it's still hot and delicious."
  },
  { 
    label: "Easy Ordering", 
    sub: "Order in seconds", 
    icon: "📱",
    desc: "Browse our menu and place your order with just a few clicks."
  },
  { 
    label: "24/7 Support", 
    sub: "We're here for you", 
    icon: "💬",
    desc: "Have a question? Our team is always ready to help."
  },
];

const STATS = [
  { value: "1000+", label: "Happy customers", icon: "😊" },
  { value: "4.8", label: "Average rating", icon: "⭐" },
  { value: "100%", label: "Fresh daily", icon: "✨" },
];

const DEFAULT_TESTIMONIALS = [
  {
    quote: "Best food in town! The flavors are authentic and the service is excellent. Highly recommend!",
    author: "Ahmed K.",
    role: "Regular Customer",
    stars: 5,
  },
  {
    quote: "Ordered online and the food arrived hot and fresh. Packaging was great too. Will order again!",
    author: "Fatima S.",
    role: "Food Lover",
    stars: 5,
  },
  {
    quote: "Amazing quality and taste. The prices are reasonable and portions are generous. Love it!",
    author: "Hassan M.",
    role: "Happy Customer",
    stars: 5,
  },
];

function StarRating({ count = 5 }) {
  return (
    <div className="flex gap-0.5 mb-3">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          className="w-4 h-4 text-amber-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function SectionBadge({ children, primaryColor }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      <span
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: primaryColor }}
      />
      <span
        className="text-xs uppercase tracking-[0.25em] font-semibold"
        style={{ color: primaryColor }}
      >
        {children}
      </span>
      <span
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: primaryColor }}
      />
    </div>
  );
}

function MenuItemCard({ item, primaryColor, slug }) {
  const router = useRouter();
  const imageUrl = getImageUrl(item.imageUrl);
  const price = item.finalPrice ?? item.price;
  const available = item.finalAvailable ?? item.available ?? true;

  const handleClick = () => {
    if (available) {
      router.push(`/public/${slug}/menu/${item.id || item._id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group rounded-2xl border-2 border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-2xl transition-all duration-300 ${
        available ? 'cursor-pointer' : 'opacity-60'
      }`}
    >
      <div className="relative h-52 bg-slate-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">
            🍽️
          </div>
        )}
        {!available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-bold text-lg">Currently Unavailable</span>
          </div>
        )}
        {item.isFeatured && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold shadow-lg">
            ⭐ Featured
          </div>
        )}
        {item.isBestSeller && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-red-500 text-white text-xs font-bold shadow-lg">
            🔥 Best Seller
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-sm text-slate-600 mb-4 line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span
              className="text-2xl font-bold"
              style={{ color: primaryColor }}
            >
              {formatPrice(price)}
            </span>
            {item.hasBranchOverride && item.branchPriceOverride !== null && item.branchPriceOverride !== undefined && (
              <span className="text-xs text-gray-500 line-through">
                Was {formatPrice(item.price)}
              </span>
            )}
          </div>
          {available && (
            <button
              className="px-4 py-2 rounded-lg text-white font-semibold text-sm group-hover:shadow-lg transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              Order Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RestaurantPage() {
  const router = useRouter();
  const { slug } = router.query;
  
  const [tenant, setTenant] = useState(null);
  const [menuData, setMenuData] = useState({ categories: [], items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load tenant info and menu in parallel
        const [tenantInfo, menuInfo] = await Promise.all([
          getPublicTenantInfo(slug),
          getPublicMenu(slug)
        ]);
        
        setTenant(tenantInfo);
        setMenuData({
          categories: menuInfo.categories || [],
          items: menuInfo.items || [],
        });
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(err.message || "Failed to load restaurant");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
          <p className="text-slate-600">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Restaurant not found</h1>
          <p className="text-slate-600">{error || "This restaurant website is not available or has been disabled."}</p>
        </div>
      </div>
    );
  }

  const web = tenant.website ?? tenant.websiteConfig ?? {};
  const primaryColor = web.themeColors?.primary || "#EF4444";
  const secondaryColor = web.themeColors?.secondary || "#FFA500";
  
  const description =
    web.description ||
    `Welcome to ${tenant?.name}. Order delicious food online for delivery or pickup. Fresh ingredients, authentic flavors, and fast service.`;

  const heroImageUrl = web.heroSlides?.[0]?.imageUrl || web.bannerUrl || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80";
  
  const testimonialsList =
    Array.isArray(web.testimonials) && web.testimonials.length > 0
      ? web.testimonials
      : DEFAULT_TESTIMONIALS;

  const availableItems = menuData.items.filter(item => item.finalAvailable ?? item.available ?? true);
  const featuredItems = availableItems.filter(item => item.isFeatured).slice(0, FEATURED_COUNT);
  const displayItems = featuredItems.length > 0 
    ? featuredItems 
    : availableItems.filter(item => item.isBestSeller).slice(0, FEATURED_COUNT);
  const itemsToShow = displayItems.length > 0 ? displayItems : availableItems.slice(0, FEATURED_COUNT);

  const openingHours = web.openingHours || {};
  const hasOpeningHours = Object.keys(openingHours).some(day => openingHours[day]);

  return (
    <div className="min-h-screen bg-white">
      {/* Simple Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {web.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getImageUrl(web.logoUrl)} alt={tenant.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
                {tenant.name?.[0] || "R"}
              </div>
            )}
            <span className="text-xl font-bold text-slate-900">{tenant.name}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#menu" className="text-slate-600 hover:text-slate-900 font-medium">Menu</a>
            <a href="#about" className="text-slate-600 hover:text-slate-900 font-medium">About</a>
            <a href="#contact" className="text-slate-600 hover:text-slate-900 font-medium">Contact</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-slate-900">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
          style={{ backgroundImage: `url('${heroImageUrl}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-900/95" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-white/90 font-medium mb-4">
            {tenant?.city || "Delicious Food"}
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.05] mb-6 drop-shadow-lg">
            {tenant?.name}
          </h1>
          <p className="text-lg sm:text-xl text-white/95 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#menu"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              style={{ background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})` }}
            >
              View Our Menu
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {RESTAURANT_FEATURES.map((item) => (
              <div key={item.label} className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <span
                  className="flex items-center justify-center w-12 h-12 rounded-2xl text-white text-2xl font-bold shrink-0 shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  {item.icon}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Menu Items */}
      <section id="menu" className="py-20 sm:py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <SectionBadge primaryColor={primaryColor}>Our Menu</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
              Featured Dishes
              {availableItems.length > 0 && (
                <span className="text-slate-500 font-normal text-xl ml-2">
                  ({availableItems.length} items)
                </span>
              )}
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Discover our most popular dishes, made fresh daily with the finest ingredients.
            </p>
          </div>

          {itemsToShow.length === 0 ? (
            <div className="text-center py-24 rounded-3xl border-2 border-dashed border-slate-200 bg-white/80 shadow-inner">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5 border border-slate-200 text-4xl">
                🍽️
              </div>
              <p className="text-slate-600 font-medium text-lg">Menu coming soon!</p>
              <p className="text-slate-500 text-sm mt-1">We're preparing something delicious for you.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {itemsToShow.map((item) => (
                <MenuItemCard
                  key={item.id ?? item._id}
                  item={item}
                  primaryColor={primaryColor}
                  slug={slug}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <SectionBadge primaryColor={primaryColor}>Reviews</SectionBadge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-3">
              What our customers say
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonialsList.map((t, i) => (
              <div key={i} className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-xl transition-all">
                <StarRating count={t.stars ?? 5} />
                <p className="text-slate-700 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {(t.author || "C").charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{t.author}</p>
                    <p className="text-sm text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">{tenant.name}</h3>
            <p className="text-slate-400 mb-6">{description}</p>
            {(web.contactPhone || web.contactEmail) && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
                {web.contactPhone && (
                  <a href={`tel:${web.contactPhone}`} className="hover:text-red-400 transition-colors">
                    📱 {web.contactPhone}
                  </a>
                )}
                {web.contactEmail && (
                  <a href={`mailto:${web.contactEmail}`} className="hover:text-red-400 transition-colors">
                    📧 {web.contactEmail}
                  </a>
                )}
              </div>
            )}
            <p className="text-slate-500 text-xs mt-8">© 2024 {tenant.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
