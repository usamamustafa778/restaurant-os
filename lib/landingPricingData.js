/** Pricing page content from eatsdesk-pricing spec (Starter / Growth / Pro). */

export const COMPARISON_SECTIONS = [
  {
    title: "Point of Sale",
    rows: [
      {
        name: "POS terminal",
        desc: "Take orders at counter",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Dine-in / takeaway / delivery",
        desc: "All order types in one system",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Order management board",
        desc: "Kanban view: new → preparing → ready",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Deals & discounts",
        desc: "Apply offers at checkout",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Cash + digital payments",
        desc: "Easypaisa, JazzCash, card",
        s: true,
        g: true,
        p: true,
      },
    ],
  },
  {
    title: "Menu Management",
    rows: [
      {
        name: "Categories & items",
        desc: "Full menu builder with photos",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Out-of-stock toggle",
        desc: "Mark items unavailable instantly",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Centralised menu (all branches)",
        desc: "One menu pushed to all locations",
        s: false,
        g: false,
        p: true,
      },
    ],
  },
  {
    title: "Kitchen & Delivery",
    rows: [
      {
        name: "Kitchen Display System (KDS)",
        desc: "Live order screen for kitchen staff",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Riders app",
        desc: "Mobile app for delivery staff",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Per-rider earnings & history",
        desc: "Track deliveries and payments per rider",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Foodpanda integration",
        desc: "Receive Foodpanda orders directly",
        s: false,
        g: true,
        p: true,
      },
    ],
  },
  {
    title: "Staff & Access Control",
    rows: [
      {
        name: "Role-based access",
        desc: "Manager, cashier, waiter, rider roles",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Waiter app",
        desc: "Floor staff take & track orders on mobile",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Cashier dashboard",
        desc: "Dedicated cashier interface",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Staff scheduling",
        desc: "Shift planning and management",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Branch-level access control",
        desc: "Restrict staff to their own branch",
        s: false,
        g: false,
        p: true,
      },
    ],
  },
  {
    title: "Tables & Reservations",
    rows: [
      {
        name: "Table management",
        desc: "Set up and assign tables",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Reservations",
        desc: "Accept and manage bookings",
        s: false,
        g: true,
        p: true,
      },
    ],
  },
  {
    title: "Inventory",
    rows: [
      {
        name: "Inventory management",
        desc: "Track stock levels and usage",
        s: false,
        g: true,
        p: true,
      },
    ],
  },
  {
    title: "Analytics & Reports",
    rows: [
      {
        name: "Daily sales dashboard",
        desc: "Revenue, orders, avg ticket, live view",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Top selling items",
        desc: "Best performers by period",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Payment method breakdown",
        desc: "Cash vs card vs online split",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Riders overview report",
        desc: "Deliveries, earnings, cancellations",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Business day report",
        desc: "End-of-day summary and export",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Custom report builder",
        desc: "Build your own reports",
        s: false,
        g: false,
        p: true,
      },
      {
        name: "Cross-location analytics",
        desc: "Compare performance across branches",
        s: false,
        g: false,
        p: true,
      },
      {
        name: "Export to CSV",
        desc: "Download any report",
        s: false,
        g: true,
        p: true,
      },
    ],
  },
  {
    title: "Website & Online Presence",
    rows: [
      {
        name: "Restaurant website + CMS",
        desc: "Full website with menu, contact, branding",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Free subdomain",
        desc: "yourrestaurant.eatsdesk.app",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Custom domain",
        desc: "Connect your own domain",
        s: false,
        g: true,
        p: true,
      },
      {
        name: "SEO settings",
        desc: "Meta titles, descriptions",
        s: false,
        g: true,
        p: true,
      },
    ],
  },
  {
    title: "Customers",
    rows: [
      {
        name: "Customer database",
        desc: "Name, phone, order history, total spent",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Multi-branch customer view",
        desc: "See customers across all locations",
        s: false,
        g: false,
        p: true,
      },
    ],
  },
  {
    title: "Integrations & API",
    rows: [
      {
        name: "Foodpanda integration",
        desc: null,
        s: false,
        g: true,
        p: true,
      },
      {
        name: "Webhooks / API access",
        desc: null,
        s: false,
        g: false,
        p: true,
      },
      {
        name: "AI agents",
        desc: "Automated insights (coming soon)",
        s: false,
        g: false,
        p: true,
      },
    ],
  },
  {
    title: "Support",
    rows: [
      {
        name: "WhatsApp support",
        desc: null,
        s: "Standard",
        g: "Standard",
        p: "Priority",
      },
      {
        name: "Free setup & onboarding",
        desc: "We configure everything for you",
        s: true,
        g: true,
        p: true,
      },
      {
        name: "Dedicated onboarding session",
        desc: null,
        s: false,
        g: false,
        p: true,
      },
    ],
  },
];

export const FAQ_ITEMS = [
  {
    q: "How does daily billing work?",
    a: "You pay monthly upfront, but the price is calculated per day. So Growth at **Rs 250/day** is billed as **Rs 7,500/month**. Yearly billing gives you 2–3 months free.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — **30 days free**, no credit card required. We set everything up for you on day one.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Monthly plans can be cancelled anytime. Yearly plans are non-refundable after 30 days, but you keep access for the full period.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Bank transfer, Easypaisa, JazzCash, and other methods you already use. We keep billing straightforward for local restaurants.",
  },
  {
    q: "I have multiple branches. How does Pro pricing work?",
    a: "Pro is priced **per location**. 2 branches = 2× Pro. We offer a discount for 3+ locations — contact us.",
  },
  {
    q: "Do I need any hardware?",
    a: "No. EatsDesk runs entirely in the browser and on mobile. Any tablet, phone, or laptop works. No expensive POS terminals required.",
  },
];
