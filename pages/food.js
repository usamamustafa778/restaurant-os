import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Search,
  Clock,
  Star,
  UtensilsCrossed,
  ChevronRight,
  Bike,
  Sparkles,
} from "lucide-react";
import SEO from "../components/SEO";
import { buildTenantWebsiteUrl } from "../lib/routes";

const CUISINE_CHIPS = [
  { id: "all", label: "All" },
  { id: "burger", label: "Burgers", terms: ["burger", "zinger", "beef"] },
  { id: "pizza", label: "Pizza", terms: ["pizza"] },
  { id: "biryani", label: "Biryani & Rice", terms: ["biryani", "rice", "karahi", "handi"] },
  { id: "chinese", label: "Chinese", terms: ["chinese", "noodles", "manchurian"] },
  { id: "cafe", label: "Café & Desserts", terms: ["cafe", "coffee", "cake", "shake", "dessert"] },
];

const CITY_CHIPS = [
  "All areas",
  "Islamabad",
  "Lahore",
  "Karachi",
  "Rawalpindi",
  "Faisalabad",
];

function hashToRange(str, min, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return min + (Math.abs(h) % (max - min + 1));
}

function RestaurantCard({ r }) {
  const href = buildTenantWebsiteUrl(r.slug);
  const mins = hashToRange(r.slug, 22, 48);
  const rating = (4 + (hashToRange(r.slug + "r", 0, 9) / 10)).toFixed(1);
  const img = r.bannerUrl || r.logoUrl;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-pink-50 to-orange-50">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-14 w-14 text-pink-200" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-bold text-gray-800 shadow-sm backdrop-blur-sm">
          {mins}–{mins + 12} min
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold text-gray-900">{r.name}</h3>
          <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-amber-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {rating}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{r.tagline || r.address || "Order online"}</p>
        {r.address ? (
          <p className="mt-2 line-clamp-1 flex items-center gap-1 text-[11px] text-gray-400">
            <MapPin className="h-3 w-3 shrink-0" />
            {r.address}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
          <span className="text-[11px] font-medium text-gray-500">
            {r.allowWebsiteOrders ? "Delivery & pickup" : "View menu"}
          </span>
          <span className="flex items-center gap-0.5 text-xs font-bold text-pink-600">
            Order
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </a>
  );
}

export default function FoodHub({ initialRestaurants = [], fetchError = null }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("All areas");
  const [cuisine, setCuisine] = useState("all");

  const filtered = useMemo(() => {
    let list = initialRestaurants;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = [r.name, r.tagline, r.address, r.slug].join(" ").toLowerCase();
        return blob.includes(q);
      });
    }
    if (city && city !== "All areas") {
      list = list.filter((r) => (r.address || "").toLowerCase().includes(city.toLowerCase()));
    }
    if (cuisine !== "all") {
      const chip = CUISINE_CHIPS.find((c) => c.id === cuisine);
      const terms = chip?.terms || [];
      if (terms.length) {
        list = list.filter((r) => {
          const blob = [r.name, r.tagline].join(" ").toLowerCase();
          return terms.some((t) => blob.includes(t));
        });
      }
    }
    return list;
  }, [initialRestaurants, query, city, cuisine]);

  return (
    <>
      <SEO
        title="Order food online — discover restaurants near you | Eats Desk Food"
        description="Browse public restaurants on Eats Desk: menus, deals, and online ordering. Find food near you and order online."
        keywords="order food online, food delivery, restaurant near me, eats desk food, browse restaurants"
      />
      <div className="min-h-screen bg-[#f7f7f7] text-gray-900">
        {/* Top bar — Foodpanda-style pink accent */}
        <header className="sticky top-0 z-50 border-b border-pink-100 bg-white shadow-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/25">
                <Bike className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold tracking-tight text-gray-900 sm:text-base">
                  Eats Desk <span className="text-pink-600">Food</span>
                </p>
                <p className="hidden text-[10px] text-gray-500 sm:block">Find restaurants & order online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="hidden text-xs font-semibold text-gray-600 hover:text-pink-600 sm:inline"
              >
                For restaurants
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:px-4 sm:text-sm"
              >
                Sign in
              </Link>
            </div>
          </div>
        </header>

        {/* Hero search */}
        <section className="border-b border-pink-100 bg-gradient-to-b from-pink-500 via-rose-500 to-rose-600 px-4 pb-10 pt-8 text-white sm:pb-12 sm:pt-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Discover places near you
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
              What are you craving?
            </h1>
            <p className="mt-2 text-sm text-white/90 sm:text-base">
              Search by restaurant, dish, or area — then order on their official page.
            </p>

            <div className="relative mx-auto mt-6 max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Restaurant, cuisine, or dish…"
                className="h-12 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-sm text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-14 sm:text-base"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {CITY_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCity(c)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition sm:text-sm ${
                    city === c
                      ? "bg-white text-rose-600 shadow"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {fetchError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
              {fetchError}
            </div>
          ) : null}

          {/* Categories */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 sl-hide-sb">
            {CUISINE_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCuisine(c.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm ${
                  cuisine === c.id
                    ? "bg-gray-900 text-white shadow-md"
                    : "bg-white text-gray-700 shadow-sm ring-1 ring-gray-100 hover:ring-gray-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
              Restaurants near you
            </h2>
            <p className="text-sm text-gray-500">
              {filtered.length} place{filtered.length !== 1 ? "s" : ""} to explore
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
              <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="font-semibold text-gray-700">No restaurants match your filters</p>
              <p className="mt-1 text-sm text-gray-500">Try another area or search term.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <RestaurantCard key={r.slug} r={r} />
              ))}
            </div>
          )}

          <div className="mt-12 flex items-start gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-pink-500" />
            <div className="text-sm text-gray-600">
              <p className="font-semibold text-gray-900">Delivery times are estimates</p>
              <p className="mt-1 leading-relaxed">
                Each restaurant runs on its own Eats Desk website. Final prices, delivery zones, and
                availability are set by the restaurant. Open a listing to order or view the full menu.
              </p>
            </div>
          </div>
        </div>

        <footer className="border-t border-gray-200 bg-gray-900 py-8 text-center text-xs text-gray-400">
          <p>
            © {new Date().getFullYear()} Eats Desk —{" "}
            <Link href="/" className="text-pink-400 hover:underline">
              Restaurant dashboard
            </Link>
          </p>
        </footer>
      </div>
      <style jsx global>{`
        .sl-hide-sb::-webkit-scrollbar {
          display: none;
        }
        .sl-hide-sb {
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}

export async function getServerSideProps() {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    return {
      props: {
        initialRestaurants: [],
        fetchError: "Set NEXT_PUBLIC_API_BASE_URL to load restaurants.",
      },
    };
  }

  try {
    const res = await fetch(`${base}/api/storefront/directory`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const err = await res.text();
      return {
        props: {
          initialRestaurants: [],
          fetchError: `Could not load directory (${res.status}). ${err.slice(0, 120)}`,
        },
      };
    }
    const data = await res.json();
    return {
      props: {
        initialRestaurants: Array.isArray(data.restaurants) ? data.restaurants : [],
        fetchError: null,
      },
    };
  } catch (e) {
    return {
      props: {
        initialRestaurants: [],
        fetchError: e.message || "Network error loading restaurants.",
      },
    };
  }
}
