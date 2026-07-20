/**
 * Public marketing catalog (USD / branch / month).
 * All modules sum to $100. Backend may bill differently in local currency.
 */

export const MODULE_CATALOG = {
  pos: {
    key: "pos",
    label: "POS Core",
    shortLabel: "POS",
    rate: 10,
    perBranch: true,
    required: true,
    dependencies: [],
    blurb:
      "Take dine-in, takeaway, and delivery orders. Payments, discounts, customers, and daily sales — included.",
    highlights: [
      "Counter, takeaway & delivery",
      "Cash, card & digital wallets",
      "Menu, deals & customers",
      "Daily sales reports",
    ],
  },
  kds: {
    key: "kds",
    label: "Kitchen Display",
    shortLabel: "KDS",
    rate: 5,
    perBranch: true,
    dependencies: ["pos"],
    blurb:
      "Orders hit the kitchen screen the second they are placed. Status updates live for counter and riders.",
    highlights: [
      "Live ticket board",
      "Preparing → ready flow",
      "Order-type colour coding",
      "Rush-hour clarity",
    ],
  },
  waiterApp: {
    key: "waiterApp",
    label: "Waiter App",
    shortLabel: "Waiter",
    rate: 5,
    perBranch: true,
    dependencies: ["pos"],
    blurb:
      "Floor staff take and track orders on mobile — no running back to the counter.",
    highlights: [
      "Mobile order taking",
      "Table-aware workflow",
      "Live status for floor",
      "Fewer missed requests",
    ],
  },
  reservations: {
    key: "reservations",
    label: "Reservations",
    shortLabel: "Reservations",
    rate: 5,
    perBranch: true,
    dependencies: ["pos"],
    blurb:
      "Take table bookings, manage covers, and keep the floor ready for walk-ins and reserved parties.",
    highlights: [
      "Booking calendar",
      "Guest name & party size",
      "Status: booked → seated → done",
      "Fewer no-show surprises",
    ],
  },
  website: {
    key: "website",
    label: "Website & Ordering",
    shortLabel: "Website",
    rate: 10,
    perBranch: true,
    dependencies: [],
    blurb:
      "Your own restaurant site with online ordering — keep customers on your brand, not a marketplace.",
    highlights: [
      "Branded storefront",
      "Online ordering",
      "Custom domain support",
      "SEO & opening hours",
    ],
  },
  websiteAnalytics: {
    key: "websiteAnalytics",
    label: "Website Analytics",
    shortLabel: "Analytics",
    rate: 10,
    perBranch: true,
    dependencies: ["website"],
    blurb:
      "See traffic, visitors, and what converts on your storefront — then act on it.",
    highlights: [
      "Page views & visitors",
      "Top pages & sources",
      "Add-on revenue proof",
      "Period comparisons",
    ],
  },
  rider: {
    key: "rider",
    label: "Rider App",
    shortLabel: "Riders",
    rate: 10,
    perBranch: true,
    dependencies: [],
    blurb:
      "Every rider gets an app. You see deliveries, cash collected, and payouts — end of day, no disputes.",
    highlights: [
      "Rider mobile app",
      "Live delivery status",
      "Cash reconciliation",
      "Per-rider earnings",
    ],
  },
  inventory: {
    key: "inventory",
    label: "Inventory",
    shortLabel: "Stock",
    rate: 10,
    perBranch: true,
    dependencies: [],
    includes: ["recipes"],
    blurb:
      "Stock levels update with every sale. Recipes, COGS, and low-stock alerts before Friday night runs dry.",
    highlights: [
      "Stock & low-stock alerts",
      "Recipe auto-deduction",
      "COGS tracking",
      "Unit conversions",
    ],
  },
  accounting: {
    key: "accounting",
    label: "Accounting",
    shortLabel: "Finance",
    rate: 20,
    perBranch: true,
    dependencies: [],
    includes: ["purchaseOrders", "grn"],
    blurb:
      "Double-entry books that post from POS. Vouchers, day book, P&L, payables, purchase orders & GRN.",
    highlights: [
      "Auto-post from POS",
      "P&L & balance sheet",
      "Purchase orders & GRN",
      "Payables & parties",
    ],
  },
  aiReceptionist: {
    key: "aiReceptionist",
    label: "AI Receptionist",
    shortLabel: "AI Chat",
    rate: 20,
    perBranch: true,
    dependencies: [],
    noTrial: true,
    blurb:
      "WhatsApp receptionist that never sleeps — answers menus, takes orders, handles 100+ chats at once.",
    highlights: [
      "24/7 WhatsApp replies",
      "Menu & order handling",
      "Handles many chats at once",
      "No extra staff on the phone",
    ],
  },
};

export const MODULE_ORDER = [
  "pos",
  "kds",
  "waiterApp",
  "reservations",
  "rider",
  "inventory",
  "accounting",
  "website",
  "websiteAnalytics",
  "aiReceptionist",
];

export const MODULE_LIST = MODULE_ORDER.map((key) => MODULE_CATALOG[key]);

/** All modules combined — $105 / branch / month. */
export const ALL_MODULES_TOTAL = MODULE_LIST.reduce(
  (sum, mod) => sum + Number(mod.rate || 0),
  0,
);

/** Suggested stacks customers can start from (keys only). */
export const PRICING_BUNDLES = [
  {
    id: "floor",
    name: "Floor Ready",
    tagline: "Counter + kitchen + waiters",
    modules: ["pos", "kds", "waiterApp"],
    popular: false,
  },
  {
    id: "ops",
    name: "Full Ops",
    tagline: "Run service, delivery & stock",
    modules: ["pos", "kds", "waiterApp", "rider", "inventory"],
    popular: true,
  },
  {
    id: "complete",
    name: "Complete Branch",
    tagline: "Ops + books + your own website",
    modules: [
      "pos",
      "kds",
      "waiterApp",
      "rider",
      "inventory",
      "accounting",
      "website",
    ],
    popular: false,
  },
];

export function formatModuleRate(rate) {
  return `$${Number(rate || 0).toLocaleString("en-US")}`;
}

export function sumModuleRates(keys) {
  const set = new Set(keys);
  return MODULE_LIST.reduce((sum, mod) => {
    if (!set.has(mod.key)) return sum;
    return sum + Number(mod.rate || 0);
  }, 0);
}

/**
 * Enforce required modules + dependency unlocks when toggling.
 * Returns the next selected key set.
 */
export function toggleModuleSelection(selectedKeys, key, enable) {
  const next = new Set(selectedKeys);
  const mod = MODULE_CATALOG[key];
  if (!mod) return Array.from(next);

  if (enable) {
    next.add(key);
    (mod.dependencies || []).forEach((dep) => next.add(dep));
    if (MODULE_CATALOG.pos) next.add("pos");
  } else {
    if (mod.required) return Array.from(next);
    next.delete(key);
    MODULE_LIST.forEach((other) => {
      if ((other.dependencies || []).includes(key) && next.has(other.key)) {
        next.delete(other.key);
      }
    });
  }

  next.add("pos");
  return MODULE_ORDER.filter((k) => next.has(k));
}
