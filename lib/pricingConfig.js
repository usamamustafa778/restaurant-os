export const PRICING_COPY = {
  headline: "Run your entire restaurant from Rs 250 a day",
  subheadline:
    "Most restaurants pay Rs 15,000+ a month for software they hate. EatsDesk gives you everything in one place — POS, kitchen display, riders, inventory, accounting, and your own website — for less than a cup of coffee a day.",
  socialProof: "Join X restaurants already running on EatsDesk",
  urgency:
    "Launch pricing. Once we hit 100 restaurants, prices go up. Lock in Rs 250/day forever.",
  guarantee:
    "3 months free. No credit card. Cancel anytime. We set everything up for you.",
  pricingSubtext:
    "POS. Kitchen display. Riders. Inventory. Accounting. Website. All in one place. No hardware. No long contracts.",
};

export const PRICING_COUNTRIES = {
  PK: {
    code: "PK",
    label: "Pakistan",
    flag: "🇵🇰",
    currency: "PKR",
    symbol: "Rs",
  },
  US: {
    code: "US",
    label: "USA",
    flag: "🇺🇸",
    currency: "USD",
    symbol: "$",
  },
};

export const PLAN_DEFINITIONS = {
  starter: {
    key: "starter",
    name: "Starter",
    target: "Small cafe, tea stall, takeaway counter",
    daily: { PK: 150, US: 1.5 },
    monthlyApprox: { PK: 4500, US: 45 },
    included: [
      "POS terminal",
      "Dine-in, takeaway, delivery order types",
      "Order management board (Kanban)",
      "Cash + Easypaisa/JazzCash payments",
      "Discount with reason tracking",
      "Order notes & special requests",
      "Customer search & attach to order",
      "Print receipt / bill",
      "Categories & menu items",
      "Item photos, descriptions, prices",
      "Enable/disable items instantly",
      "Deals & combo management",
      "Customer database",
      "Order history per customer",
      "Total spent tracking",
      "Daily sales dashboard",
      "Revenue, orders, avg ticket",
      "Payment method breakdown",
      "Top selling items",
      "Business day sessions",
      "Free subdomain (yourrestaurant.eatsdesk.app)",
      "WhatsApp support",
      "Free setup & onboarding",
      "1 branch",
      "Up to 3 staff accounts",
    ],
    notIncluded: ["Kitchen Display System", "Riders app", "Inventory management", "Accounting module", "Restaurant website", "Tables & reservations", "Advanced reports"],
  },
  growth: {
    key: "growth",
    name: "Growth",
    target: "Full-service restaurant, fast food",
    daily: { PK: 250, US: 2.5 },
    monthlyApprox: { PK: 7500, US: 75 },
    highlighted: true,
    badge: "MOST POPULAR",
    lockTag: "Launch pricing — locked in forever",
    additionalBranchDaily: { PK: 100, US: 1 },
    sections: [
      {
        title: "Point of Sale",
        items: [
          "Everything in Starter",
          "Discount with reason tracking",
          "Order notes & special requests",
          "Customer search & attach to order",
          "Business day sessions",
        ],
      },
      {
        title: "Kitchen & Delivery",
        items: [
          "Kitchen Display System (KDS)",
          "Live order timer & urgency alerts",
          "Riders app with live tracking",
          "Rider payout tracking",
          "Delivery zones with custom fees",
          "Per-rider earnings report",
        ],
      },
      {
        title: "Staff & Access Control",
        items: [
          "Role-based access control (Manager, Cashier, Waiter, Kitchen Staff, Rider)",
          "Staff management dashboard",
          "Multi-user simultaneous access",
          "Waiter app for floor staff",
        ],
      },
      {
        title: "Tables & Reservations",
        items: [
          "Table management (floor view)",
          "Table status (available/occupied/reserved/cleaning)",
          "Reservation booking & management",
          "Guest name, phone, date, time",
          "Reservation status flow",
        ],
      },
      {
        title: "Inventory Management",
        items: [
          "Stock level tracking",
          "Low stock alerts & restock list",
          "Recipe-based auto deduction",
          "COGS auto-calculation",
          "Purchase Orders (PO)",
          "Goods Received Notes (GRN)",
          "Purchase history",
          "Supplier management via Parties",
          "Unit conversion (g/kg, ml/l, pcs)",
          "Cost price tracking",
        ],
      },
      {
        title: "Accounting",
        items: [
          "Full double-entry accounting",
          "Auto-posting from POS orders",
          "Cash Payment voucher",
          "Cash Receipt voucher",
          "Bank Payment voucher",
          "Bank Receipt voucher",
          "Journal voucher",
          "Day Book report",
          "Ledger report (by account)",
          "P&L Statement",
          "Cash Statement",
          "Payables report (supplier balances)",
          "Balance sheet",
          "Chart of Accounts",
          "Parties (suppliers & customers)",
          "Payment accounts (Easypaisa, JazzCash, Bank)",
          "GRN auto-posts to accounting",
          "COGS journal auto-posts per order",
          "Rider payout accounting",
        ],
      },
      {
        title: "Website & Online Ordering",
        items: [
          "Full restaurant website",
          "Online ordering system",
          "3 design templates (Classic, Modern, Minimal)",
          "Custom branding & colors",
          "Hero banner or carousel",
          "Menu sections on homepage",
          "SEO settings (title, meta, OG image)",
          "Social media links",
          "Opening hours",
          "Contact information",
          "Custom domain support",
          "Website visibility toggle",
          "Online ordering on/off toggle",
        ],
      },
      {
        title: "Reports & Analytics",
        items: [
          "Full sales report with filters",
          "Orders list with export",
          "Discount tracking & reasons",
          "Business day report",
          "Rider earnings report",
          "Payables aging",
          "Export to CSV",
        ],
      },
      {
        title: "Discounts",
        items: [
          "Preset discount system",
          "Manager PIN for high discounts",
          "Discount reasons tracking",
          "Discount report",
        ],
      },
      {
        title: "Support",
        items: [
          "WhatsApp support (Standard)",
          "Free setup & onboarding",
          "1 branch (+Rs 100/day per extra branch)",
          "Unlimited staff accounts",
        ],
      },
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    target: "Chains, groups, large operators",
    custom: true,
    included: [
      "Everything in Growth",
      "Unlimited branches",
      "Multi-location dashboard",
      "Consolidated accounting",
      "Cross-location analytics",
      "API access & webhooks",
      "White-label option",
      "Custom integrations",
      "Dedicated account manager",
      "Priority WhatsApp support",
      "On-site training & onboarding",
      "SLA guarantee",
    ],
  },
};

export const VALUE_COMPARISON = {
  PK: [
    ["POS Software", 5000],
    ["Accounting Software", 3000],
    ["Restaurant Website", 2000],
    ["Riders Tracking App", 3000],
    ["Kitchen Display System", 4000],
    ["Inventory Management", 2000],
  ],
  US: [
    ["POS Software", 70],
    ["Accounting Software", 35],
    ["Restaurant Website", 25],
    ["Riders Tracking App", 40],
    ["Kitchen Display System", 45],
    ["Inventory Management", 30],
  ],
};

export const COMING_SOON_ITEMS = [
  "Foodpanda integration",
  "AI agents & automated insights",
  "Custom report builder",
  "Stripe / online payments",
  "WhatsApp Business API",
];

export const FEATURE_COMPARISON_GROUPS = [
  {
    title: "Point of Sale",
    rows: [
      ["POS terminal", true, true, true],
      ["Dine-in, takeaway, delivery order types", true, true, true],
      ["Order management board (Kanban)", true, true, true],
      ["Cash + Easypaisa/JazzCash payments", true, true, true],
      ["Discount with reason tracking", true, true, true],
      ["Order notes & special requests", true, true, true],
      ["Customer search & attach to order", true, true, true],
      ["Print receipt / bill", true, true, true],
    ],
  },
  {
    title: "Menu Management",
    rows: [
      ["Categories & menu items", true, true, true],
      ["Item photos, descriptions, prices", true, true, true],
      ["Enable/disable items instantly", true, true, true],
      ["Deals & combo management", true, true, true],
    ],
  },
  {
    title: "Kitchen & Delivery",
    rows: [
      ["Kitchen Display System (KDS)", false, true, true],
      ["Live order timer & urgency alerts", false, true, true],
      ["Riders app with live tracking", false, true, true],
      ["Rider payout tracking", false, true, true],
      ["Delivery zones with custom fees", false, true, true],
      ["Per-rider earnings report", false, true, true],
      ["Foodpanda integration", "Soon", "Soon", "Soon"],
    ],
  },
  {
    title: "Staff & Access Control",
    rows: [
      ["Role-based access control", false, true, true],
      ["Staff management dashboard", false, true, true],
      ["Multi-user simultaneous access", false, true, true],
      ["Waiter app for floor staff", false, true, true],
    ],
  },
  {
    title: "Tables & Reservations",
    rows: [
      ["Table management (floor view)", false, true, true],
      ["Table status flow", false, true, true],
      ["Reservation booking & management", false, true, true],
      ["Reservation status flow", false, true, true],
    ],
  },
  {
    title: "Inventory Management",
    rows: [
      ["Stock level tracking", false, true, true],
      ["Low stock alerts & restock list", false, true, true],
      ["Recipe-based auto deduction", false, true, true],
      ["COGS auto-calculation", false, true, true],
      ["Purchase Orders (PO)", false, true, true],
      ["Goods Received Notes (GRN)", false, true, true],
      ["Purchase history", false, true, true],
      ["Supplier management via Parties", false, true, true],
      ["Unit conversion", false, true, true],
      ["Cost price tracking", false, true, true],
    ],
  },
  {
    title: "Accounting",
    rows: [
      ["Full double-entry accounting", false, true, true],
      ["Auto-posting from POS orders", false, true, true],
      ["Cash/Bank/Journal vouchers", false, true, true],
      ["Day Book / Ledger / P&L", false, true, true],
      ["Balance Sheet", false, true, true],
      ["Cash Statement", false, true, true],
      ["Payables report", false, true, true],
      ["Chart of Accounts", false, true, true],
      ["Parties (suppliers & customers)", false, true, true],
      ["Payment accounts", false, true, true],
      ["GRN auto-posts to accounting", false, true, true],
      ["COGS journal auto-posts per order", false, true, true],
      ["Rider payout accounting", false, true, true],
      ["Consolidated accounting across branches", false, false, true],
    ],
  },
  {
    title: "Website & Online Ordering",
    rows: [
      ["Free subdomain (yourrestaurant.eatsdesk.app)", true, true, true],
      ["Full restaurant website", false, true, true],
      ["Online ordering system", false, true, true],
      ["Design templates", false, true, true],
      ["Custom branding & colors", false, true, true],
      ["Hero banner / carousel", false, true, true],
      ["SEO settings", false, true, true],
      ["Social links + opening hours + contact", false, true, true],
      ["Custom domain support", false, true, true],
      ["Website visibility toggle", false, true, true],
      ["Online ordering on/off toggle", false, true, true],
      ["Stripe / online payments", "Soon", "Soon", "Soon"],
      ["WhatsApp Business API", "Soon", "Soon", "Soon"],
    ],
  },
  {
    title: "Reports & Analytics",
    rows: [
      ["Daily sales dashboard", true, true, true],
      ["Revenue, orders, avg ticket", true, true, true],
      ["Payment method breakdown", true, true, true],
      ["Top selling items", true, true, true],
      ["Business day report", true, true, true],
      ["Rider overview report", false, true, true],
      ["Discount tracking & reasons", false, true, true],
      ["Payables aging", false, true, true],
      ["Export to CSV", false, true, true],
      ["Cross-location analytics", false, false, true],
      ["Custom report builder", "Soon", "Soon", "Soon"],
      ["AI agents & automated insights", "Soon", "Soon", "Soon"],
    ],
  },
  {
    title: "Discounts",
    rows: [
      ["Preset discount system", true, true, true],
      ["Manager PIN for high discounts", false, true, true],
      ["Discount reasons tracking", true, true, true],
      ["Discount report", false, true, true],
    ],
  },
  {
    title: "Support",
    rows: [
      ["WhatsApp support", true, "Standard", "Priority"],
      ["Free setup & onboarding", true, true, true],
      ["1 branch", true, true, false],
      ["Unlimited branches", false, false, true],
      ["Up to 3 staff accounts", true, false, false],
      ["Unlimited staff accounts", false, true, true],
      ["Dedicated account manager", false, false, true],
      ["On-site training & onboarding", false, false, true],
      ["SLA guarantee", false, false, true],
      ["Custom integrations", false, false, true],
    ],
  },
];

export function formatMoney(countryCode, amount, withDecimals = false) {
  const country = PRICING_COUNTRIES[countryCode] || PRICING_COUNTRIES.PK;
  if (country.currency === "USD") {
    return `${country.symbol}${withDecimals ? Number(amount).toFixed(2) : Number(amount)}`;
  }
  const n = Number(amount || 0);
  return `${country.symbol} ${n.toLocaleString("en-PK")}`;
}

