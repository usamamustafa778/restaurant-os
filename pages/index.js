import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { FAQ_ITEMS } from "../lib/landingPricingData";
import {
  MODULE_CATALOG,
  MODULE_LIST,
  MODULE_ORDER,
  ALL_MODULES_TOTAL,
  formatModuleRate,
  sumModuleRates,
  toggleModuleSelection,
} from "../lib/moduleCatalog";
import { PRICING_COPY } from "../lib/pricingConfig";
import MarketingFooter from "../components/MarketingFooter";

const WHATSAPP_DEMO_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/923166222269";

const WHATSAPP_CHAT_URL = `${WHATSAPP_DEMO_URL}?text=${encodeURIComponent(
  "Hi, I'd like to know more about EatsDesk",
)}`;

const INSTAGRAM_DM_URL = "https://ig.me/m/eatsdesk.app";

const WHATSAPP_BOOK_DEMO_URL = `${WHATSAPP_DEMO_URL}?text=${encodeURIComponent(
  "Hi, I'd like to book a demo of EatsDesk",
)}`;

const DEFAULT_SELECTED = ["pos", "kds", "waiterApp", "rider", "inventory"];

const FULL_STACK = [
  "pos",
  "kds",
  "website",
  "rider",
  "inventory",
  "accounting",
];

const FEATURE_TABS = {
  pos: {
    label: "POS",
    title: "Point of Sale that keeps the line moving",
    desc: "Take dine-in, takeaway, and delivery in a few taps. Built for rush hour — not for training manuals.",
    points: [
      "Runs on any phone, tablet, or laptop you already own",
      "Cash, card, and digital wallets — tracked separately",
      "Modifiers and deals built in for faster upsells",
      "Business day sessions with clear end-of-day totals",
    ],
  },
  kds: {
    label: "Kitchen",
    title: "Kitchen display that never loses a ticket",
    desc: "Orders land on the kitchen screen the moment they’re placed. No paper slips. No shouting across the pass.",
    points: [
      "Colour-coded by dine-in, takeaway, and delivery",
      "One-tap status: preparing → ready",
      "Counter and riders see updates instantly",
      "Works on any kitchen screen you already have",
    ],
  },
  riders: {
    label: "Riders",
    title: "Every rider, every dollar — reconciled",
    desc: "Assign deliveries from POS, track progress, and settle cash at end of shift without arguments.",
    points: [
      "Rider mobile app for active orders",
      "Cash collected vs paid out, per rider",
      "Delivery performance by shift",
      "Fewer end-of-day disputes",
    ],
  },
  inventory: {
    label: "Inventory",
    title: "Stock that updates with every sale",
    desc: "Recipes deduct ingredients automatically — so Friday night doesn’t start with an empty fridge.",
    points: [
      "Recipe-linked auto deduction",
      "Low-stock alerts before you run out",
      "Purchase orders and GRN with suppliers",
      "COGS that feeds into accounting",
    ],
  },
};

const SEED_ORDERS = [
  {
    num: "#0201",
    items: "2× Shawarma, 1× Fries",
    status: "new",
    amount: "$8.50",
  },
  {
    num: "#0200",
    items: "1× Burger, 2× Zinger",
    status: "prep",
    amount: "$13.50",
  },
  {
    num: "#0199",
    items: "3× Wings, 1× Drink",
    status: "ready",
    amount: "$9.20",
  },
  {
    num: "#0198",
    items: "1× Pizza Large",
    status: "ready",
    amount: "$16.99",
  },
];

const INCOMING_ORDERS = [
  {
    num: "#0202",
    items: "1× Pizza Large, 1× Drink",
    status: "new",
    amount: "$18.99",
  },
  {
    num: "#0203",
    items: "2× Zinger Burger",
    status: "prep",
    amount: "$8.98",
  },
  {
    num: "#0204",
    items: "3× Shawarma, 2× Fries",
    status: "new",
    amount: "$17.45",
  },
];

function parseFaqBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function statusClass(status) {
  if (status === "new") return "ed-status-new";
  if (status === "prep") return "ed-status-prep";
  return "ed-status-ready";
}

function statusLabel(status) {
  if (status === "new") return "New";
  if (status === "prep") return "Preparing";
  return "Ready";
}

function FeatureVisual({ tab }) {
  if (tab === "pos") {
    return (
      <div className="ed-fp-visual">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            New order
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "var(--ed-orange-hot)",
            }}
          >
            Delivery
          </span>
        </div>
        <div className="ed-pos-grid">
          <div className="ed-pos-item">
            <small>Zinger Burger</small>
            <strong>$4.49</strong>
          </div>
          <div className="ed-pos-item active">
            <small>Shawarma</small>
            <strong>$3.49</strong>
          </div>
          <div className="ed-pos-item">
            <small>1.5L Drink</small>
            <strong>$1.99</strong>
          </div>
          <div className="ed-pos-item">
            <small>Fries</small>
            <strong>$1.50</strong>
          </div>
        </div>
        <div className="ed-pos-cta">Place Order — $11.47</div>
      </div>
    );
  }

  if (tab === "kds") {
    return (
      <div className="ed-fp-visual">
        <div className="ed-kds-ticket">
          <div className="ed-kds-num">#0201 · DELIVERY</div>
          <div className="ed-kds-items">
            2× Chicken Shawarma
            <br />
            1× Small Fries · 1× 7Up
          </div>
          <div className="ed-kds-time">2 min ago</div>
        </div>
        <div className="ed-kds-ticket" style={{ borderLeftColor: "#EAB308" }}>
          <div className="ed-kds-num" style={{ color: "#EAB308" }}>
            #0200 · TAKEAWAY
          </div>
          <div className="ed-kds-items">
            1× Zinger Burger
            <br />
            2× Beef Burger
          </div>
          <div className="ed-kds-time">5 min ago</div>
        </div>
        <div
          className="ed-kds-ticket"
          style={{ borderLeftColor: "#10B981", opacity: 0.7 }}
        >
          <div className="ed-kds-num" style={{ color: "#10B981" }}>
            #0199 · READY
          </div>
          <div className="ed-kds-items">3× Fried Chicken · 1× Platter</div>
          <div className="ed-kds-time">8 min ago</div>
        </div>
      </div>
    );
  }

  if (tab === "riders") {
    return (
      <div className="ed-fp-visual">
        <div className="ed-rider-row">
          <div>
            <strong>Ahmed · Rider</strong>
            <small>3 deliveries today</small>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong style={{ color: "#34d399" }}>$24.00</strong>
            <small>collected</small>
          </div>
        </div>
        <div className="ed-rider-row">
          <div>
            <strong>Bilal · Rider</strong>
            <small>2 deliveries · 1 active</small>
          </div>
          <div style={{ textAlign: "right" }}>
            <strong style={{ color: "var(--ed-orange-hot)" }}>Out</strong>
            <small>live now</small>
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            fontSize: 13,
            fontWeight: 700,
            color: "#34d399",
          }}
        >
          Collected today: $84.50 · Settled
        </div>
      </div>
    );
  }

  return (
    <div className="ed-fp-visual">
      <div className="ed-stock-row">
        <span>Chicken (kg)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="ed-bar">
            <i style={{ width: "65%", background: "#10B981" }} />
          </div>
          <small style={{ color: "#34d399", fontWeight: 700 }}>6.5 kg</small>
        </div>
      </div>
      <div className="ed-stock-row">
        <span>Bun (pcs)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="ed-bar">
            <i style={{ width: "22%", background: "#EAB308" }} />
          </div>
          <small style={{ color: "#EAB308", fontWeight: 700 }}>22 pcs</small>
        </div>
      </div>
      <div className="ed-stock-row">
        <span>Cheese (kg)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="ed-bar">
            <i style={{ width: "8%", background: "#EF4444" }} />
          </div>
          <small style={{ color: "#F87171", fontWeight: 700 }}>0.8 kg</small>
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          padding: "8px 12px",
          borderRadius: 8,
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 12,
          color: "#FCA5A5",
        }}
      >
        Cheese critically low — reorder before Friday rush
      </div>
    </div>
  );
}

export default function Home() {
  const [featureTab, setFeatureTab] = useState("pos");
  const [orders, setOrders] = useState(SEED_ORDERS);
  const [orderCount, setOrderCount] = useState(47);
  const [selectedModules, setSelectedModules] = useState(DEFAULT_SELECTED);
  const [branchCount, setBranchCount] = useState(1);

  const fullStackTotal = sumModuleRates(FULL_STACK);
  const monthlyPerBranch = useMemo(
    () => sumModuleRates(selectedModules),
    [selectedModules],
  );
  const monthlyTotal = monthlyPerBranch * Math.max(1, Number(branchCount) || 1);
  const activeFeature = FEATURE_TABS[featureTab];

  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      const next = INCOMING_ORDERS[idx % INCOMING_ORDERS.length];
      idx += 1;
      setOrderCount((c) => c + 1);
      setOrders((prev) => [next, ...prev].slice(0, 4));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const onToggleModule = (key) => {
    setSelectedModules((prev) => {
      const enabled = !prev.includes(key);
      return toggleModuleSelection(prev, key, enabled);
    });
  };

  return (
    <>
      <Head>
        <title>EatsDesk — The OS for High Volume Restaurants</title>
        <meta
          name="description"
          content="EatsDesk is the operating system for high volume restaurants. POS from $10/branch/mo — all modules from $105/branch/mo."
        />
        <meta
          property="og:title"
          content="EatsDesk — The Operating System for High Volume Restaurants"
        />
        <meta
          property="og:description"
          content="The command center for high volume kitchens — POS, kitchen, riders, inventory, accounting, and WhatsApp AI. Modular pricing in USD."
        />
        <link rel="canonical" href="https://eatsdesk.app/" />
      </Head>

      <div className="ed-home">
        <div className="ed-chat-float" aria-label="Chat with us">
          <a
            href={WHATSAPP_CHAT_URL}
            className="ed-chat-btn ed-chat-wa"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
          <a
            href={INSTAGRAM_DM_URL}
            className="ed-chat-btn ed-chat-ig"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </a>
        </div>

        <nav className="ed-nav">
          <div className="ed-nav-inner">
            <Link href="/" className="ed-logo">
              <img src="/favicon.png" alt="" width={30} height={30} />
              EatsDesk
            </Link>
            <ul className="ed-nav-links">
              <li>
                <Link href="/#features">Features</Link>
              </li>
              <li>
                <Link href="/#pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/#how">Setup</Link>
              </li>
              <li>
                <Link href="/#faq">FAQ</Link>
              </li>
              <li>
                <Link href="/blog">Blog</Link>
              </li>
            </ul>
            <div className="ed-nav-cta">
              <Link href="/login" className="ed-link-quiet">
                Sign in
              </Link>
              <Link href="/signup" className="ed-btn ed-btn-primary ed-btn-sm">
                Start free trial →
              </Link>
            </div>
          </div>
        </nav>

        <section className="ed-hero">
          <div className="ed-wrap">
            <div className="ed-hero-grid">
              <div>
                <div className="ed-badge">
                  <span className="ed-badge-dot" />
                  Restaurant OS
                </div>
                <h1>
                  The Operating System
                  <br />
                  for <em>High Volume</em>
                  <br />
                  Restaurants.
                </h1>
                <p className="ed-hero-lead">
                  EatsDesk is the command center for serious kitchens — POS,
                  kitchen display, riders, inventory, accounting, and WhatsApp
                  AI. Modular by design. Uncompromising on the floor.
                </p>
                <div className="ed-hero-actions">
                  <Link href="/signup" className="ed-btn ed-btn-primary">
                    Start free — 30 days →
                  </Link>
                  <a
                    href={WHATSAPP_BOOK_DEMO_URL}
                    className="ed-btn ed-btn-secondary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book a demo
                  </a>
                </div>
                <div className="ed-trust">
                  <div className="ed-trust-item">
                    <span className="ed-trust-dot" /> No credit card
                  </div>
                  <div className="ed-trust-item">
                    <span className="ed-trust-dot" /> Setup in one day
                  </div>
                  <div className="ed-trust-item">
                    <span className="ed-trust-dot" /> No hardware needed
                  </div>
                </div>
              </div>

              <div className="ed-ticker" aria-hidden>
                <div className="ed-ticker-head">
                  <span className="ed-ticker-title">Live floor · Today</span>
                  <span className="ed-live">
                    <span className="ed-live-dot" /> Live
                  </span>
                </div>
                <div className="ed-ticker-stats">
                  <div className="ed-tstat">
                    <div className="ed-tstat-label">Orders</div>
                    <div className="ed-tstat-val orange">{orderCount}</div>
                  </div>
                  <div className="ed-tstat">
                    <div className="ed-tstat-label">Revenue</div>
                    <div className="ed-tstat-val green">$2.1K</div>
                  </div>
                  <div className="ed-tstat">
                    <div className="ed-tstat-label">Active</div>
                    <div className="ed-tstat-val">6</div>
                  </div>
                </div>
                <div className="ed-order-feed">
                  {orders.map((order) => (
                    <div
                      key={`${order.num}-${order.amount}`}
                      className={`ed-order${order.status === "new" ? " is-new" : ""}`}
                    >
                      <div>
                        <div className="ed-order-num">{order.num}</div>
                        <div className="ed-order-items">{order.items}</div>
                      </div>
                      <div className="ed-order-right">
                        <span
                          className={`ed-status ${statusClass(order.status)}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                        <div className="ed-order-amt">{order.amount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="ed-proof">
          <div className="ed-proof-inner">
            <div className="ed-proof-item">
              <div className="ed-proof-num">
                <span>$10</span>
              </div>
              <div className="ed-proof-label">POS Core / branch / mo</div>
            </div>
            <div className="ed-proof-item">
              <div className="ed-proof-num">
                <span>{MODULE_LIST.length}</span>
              </div>
              <div className="ed-proof-label">modules you can mix</div>
            </div>
            <div className="ed-proof-item">
              <div className="ed-proof-num">
                <span>1</span> day
              </div>
              <div className="ed-proof-label">to go live</div>
            </div>
            <div className="ed-proof-item">
              <div className="ed-proof-num">
                $<span>0</span>
              </div>
              <div className="ed-proof-label">hardware cost</div>
            </div>
            <div className="ed-proof-item">
              <div className="ed-proof-num">
                <span>30</span>
              </div>
              <div className="ed-proof-label">days free on eligible modules</div>
            </div>
          </div>
        </div>

        <section className="ed-section" id="pain">
          <div className="ed-wrap">
            <div className="ed-eyebrow">Sound familiar?</div>
            <h2 className="ed-title">
              Your restaurant bleeds money
              <br />
              in ways you don’t notice.
            </h2>
            <p className="ed-sub">
              It’s not one big problem. It’s ten small ones happening every
              shift — and most software makes you pay for shelves you never open.
            </p>
            <div className="ed-problems-grid">
              <article className="ed-prob">
                <div className="ed-prob-mark">01</div>
                <div className="ed-prob-title">Rush hour chaos</div>
                <div className="ed-prob-desc">
                  Orders stack, kitchen loses track, riders wait outside. Your
                  busiest hour becomes your most expensive mistake.
                </div>
              </article>
              <article className="ed-prob">
                <div className="ed-prob-mark">02</div>
                <div className="ed-prob-title">Paper everywhere</div>
                <div className="ed-prob-desc">
                  Notebooks, WhatsApp screenshots, handwritten slips. You can’t
                  know today’s real numbers until tomorrow — if at all.
                </div>
              </article>
              <article className="ed-prob">
                <div className="ed-prob-mark">03</div>
                <div className="ed-prob-title">Riders you can’t track</div>
                <div className="ed-prob-desc">
                  Who has which order? Who collected cash? Who’s been paid?
                  Without a rider module, end of day is guesswork.
                </div>
              </article>
              <article className="ed-prob">
                <div className="ed-prob-mark">04</div>
                <div className="ed-prob-title">Paying for unused shelves</div>
                <div className="ed-prob-desc">
                  Forced all-in plans charge for accounting and websites whether
                  you use them. Modular billing ends that.
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="ed-features" id="features">
          <div className="ed-wrap">
            <div className="ed-eyebrow">The system</div>
            <h2 className="ed-title">One OS. Every moving part.</h2>
            <p className="ed-sub">
              Not a POS with bolt-ons. Modules share orders, menu, staff, and
              money — so counter, kitchen, and riders stay in sync.
            </p>

            <div className="ed-tabs" role="tablist">
              {Object.entries(FEATURE_TABS).map(([key, tab]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={featureTab === key}
                  className={`ed-tab${featureTab === key ? " active" : ""}`}
                  onClick={() => setFeatureTab(key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="ed-feature-panel">
              <div>
                <h3 className="ed-fp-title">{activeFeature.title}</h3>
                <p className="ed-fp-desc">{activeFeature.desc}</p>
                <ul className="ed-fp-points">
                  {activeFeature.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <FeatureVisual tab={featureTab} />
            </div>
          </div>
        </section>

        <section className="ed-ai" id="ai">
          <div className="ed-wrap">
            <div className="ed-ai-grid">
              <div>
                <div className="ed-badge" style={{ marginBottom: 18 }}>
                  <span className="ed-badge-dot" /> AI Receptionist · $20
                  /branch/mo
                </div>
                <h2 className="ed-title">
                  Your restaurant takes WhatsApp orders. While you sleep.
                </h2>
                <p className="ed-sub">
                  An AI receptionist on WhatsApp answers menu questions, takes
                  delivery orders, and hands off to your kitchen — 24/7. No
                  trial on this module.
                </p>
                <div className="ed-ai-feat">
                  <div className="ed-ai-icon">24</div>
                  <div>
                    <strong>Always on</strong>
                    <p>
                      Late-night orders and off-hours questions without night
                      staff on the phone.
                    </p>
                  </div>
                </div>
                <div className="ed-ai-feat">
                  <div className="ed-ai-icon">AI</div>
                  <div>
                    <strong>Knows your menu</strong>
                    <p>
                      Answers deals, ingredients, and availability from your
                      live catalog.
                    </p>
                  </div>
                </div>
                <div className="ed-ai-feat">
                  <div className="ed-ai-icon">→</div>
                  <div>
                    <strong>Human handoff</strong>
                    <p>
                      Staff can take over a chat in one tap. AI steps back with
                      no friction.
                    </p>
                  </div>
                </div>
              </div>

              <div className="ed-wa" aria-hidden>
                <div className="ed-wa-head">
                  <div className="ed-wa-avatar">ED</div>
                  <div>
                    <div className="ed-wa-name">EatsDesk AI Receptionist</div>
                    <div className="ed-wa-status">online</div>
                  </div>
                </div>
                <div className="ed-wa-msg">
                  <div className="ed-bubble in">
                    Hi — are you still delivering tonight?
                  </div>
                  <span className="ed-wa-time">10:47 PM</span>
                </div>
                <div className="ed-wa-msg out">
                  <div className="ed-bubble out">
                    Yes — we deliver until 11:30 PM. What area are you in?
                  </div>
                  <span className="ed-wa-time">10:47 PM</span>
                </div>
                <div className="ed-wa-msg">
                  <div className="ed-bubble in">Downtown · 4th Street</div>
                  <span className="ed-wa-time">10:48 PM</span>
                </div>
                <div className="ed-wa-msg out">
                  <div className="ed-bubble out">
                    Perfect — $2.50 delivery for that area. Tonight’s Family
                    Deal: 2 Large Pizza + 4 Burgers + 1.5L drink for $31.99.
                  </div>
                  <span className="ed-wa-time">10:48 PM</span>
                </div>
                <div className="ed-wa-msg">
                  <div className="ed-typing">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ed-section" id="pricing">
          <div className="ed-wrap">
            <div className="ed-eyebrow">Modular pricing</div>
            <h2 className="ed-title">Pay only for what you switch on.</h2>
            <p className="ed-sub">{PRICING_COPY.subheadline}</p>

            <div className="ed-price-cards">
              <article className="ed-price-card">
                <div className="ed-price-name">POS Core</div>
                <div className="ed-price-desc">
                  Order taking, day sessions, reports
                </div>
                <div className="ed-price-amount">
                  <span className="ed-price-rs">$</span>
                  <span className="ed-price-num">10</span>
                  <span className="ed-price-per">/branch/mo</span>
                </div>
                <div className="ed-price-note">Required base module</div>
                <Link href="/signup" className="ed-price-cta">
                  Start free trial
                </Link>
                <ul className="ed-price-feats">
                  <li>POS terminal</li>
                  <li>Order management</li>
                  <li>Day sessions & cash counting</li>
                  <li>Sales reports</li>
                  <li>Staff & roles</li>
                </ul>
              </article>

              <article className="ed-price-card featured">
                <div className="ed-price-badge">Most popular</div>
                <div className="ed-price-name">Full Stack</div>
                <div className="ed-price-desc">
                  POS + KDS + Website + Riders + Inventory + Accounting
                </div>
                <div className="ed-price-amount">
                  <span className="ed-price-rs">$</span>
                  <span className="ed-price-num">
                    {fullStackTotal.toLocaleString("en-US")}
                  </span>
                  <span className="ed-price-per">/branch/mo</span>
                </div>
                <div className="ed-price-note">Six modules · 1 branch</div>
                <Link href="/signup" className="ed-price-cta">
                  Start free trial
                </Link>
                <ul className="ed-price-feats">
                  <li>Everything in POS Core</li>
                  <li>Kitchen Display ($5)</li>
                  <li>Website + online ordering</li>
                  <li>Rider app</li>
                  <li>Inventory + recipes</li>
                  <li>Full accounting + PO/GRN</li>
                </ul>
              </article>

              <article className="ed-price-card">
                <div className="ed-price-name">Add-on modules</div>
                <div className="ed-price-desc">Mix only what you need</div>
                <div className="ed-price-amount">
                  <span className="ed-price-rs">$</span>
                  <span className="ed-price-num">5</span>
                  <span className="ed-price-per">– 20/mo</span>
                </div>
                <div className="ed-price-note">Per module · per branch</div>
                <a href="#builder" className="ed-price-cta">
                  Build your stack
                </a>
                <ul className="ed-price-feats">
                  <li>KDS / Waiter / Reservations — $5</li>
                  <li>Website / Analytics / Riders / Stock — $10</li>
                  <li>Accounting — $20</li>
                  <li>AI Receptionist — $20 (no trial)</li>
                  <li>
                    All {MODULE_LIST.length} modules — $
                    {ALL_MODULES_TOTAL}/branch/mo
                  </li>
                </ul>
              </article>
            </div>

            <div className="ed-builder" id="builder">
              <div className="ed-builder-left">
                <h3>Build your monthly bill</h3>
                <p className="ed-builder-hint">
                  Toggle modules. Dependencies unlock automatically. POS Core
                  stays on.
                </p>
                <div className="ed-mod-toggles">
                  {MODULE_ORDER.map((key) => {
                    const mod = MODULE_CATALOG[key];
                    const on = selectedModules.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`ed-mod-toggle${on ? " on" : ""}`}
                        onClick={() => !mod.required && onToggleModule(key)}
                        disabled={mod.required}
                        aria-pressed={on}
                      >
                        <span className="ed-check">{on ? "✓" : ""}</span>
                        <span>
                          <strong>
                            {mod.label}
                            {mod.noTrial ? " · No trial" : ""}
                          </strong>
                          <span>
                            {formatModuleRate(mod.rate)}/branch/mo
                            {(mod.dependencies || []).length
                              ? ` · needs ${mod.dependencies
                                  .map(
                                    (d) =>
                                      MODULE_CATALOG[d]?.shortLabel || d,
                                  )
                                  .join(", ")}`
                              : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <aside className="ed-builder-right">
                <h3>Your stack</h3>
                <div className="ed-branches">
                  <label htmlFor="branches">Branches</label>
                  <input
                    id="branches"
                    type="number"
                    min={1}
                    max={50}
                    value={branchCount}
                    onChange={(e) =>
                      setBranchCount(
                        Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                      )
                    }
                  />
                </div>
                <ul className="ed-lines">
                  {selectedModules.map((key) => {
                    const mod = MODULE_CATALOG[key];
                    return (
                      <li key={key}>
                        <span>{mod.label}</span>
                        <span>{formatModuleRate(mod.rate)}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="ed-total">
                  <span>Per branch / month</span>
                  <strong>{formatModuleRate(monthlyPerBranch)}</strong>
                </div>
                <div className="ed-total grand">
                  <span>
                    Total ({branchCount} branch{branchCount > 1 ? "es" : ""})
                  </span>
                  <strong>{formatModuleRate(monthlyTotal)}</strong>
                </div>
                <p className="ed-trial-note">{PRICING_COPY.trialNote}</p>
                <Link
                  href="/signup"
                  className="ed-btn ed-btn-primary"
                  style={{ width: "100%" }}
                >
                  Start free trial
                </Link>
              </aside>
            </div>
          </div>
        </section>

        <section className="ed-testimonial">
          <div className="ed-wrap">
            <div className="ed-quote">
              <p className="ed-quote-text">
                “We went from paper slips and WhatsApp screenshots to knowing
                exactly what we made — before closing time. Every order, every
                rider, every dollar from my phone.”
              </p>
              <div className="ed-author">
                <div className="ed-avatar">MK</div>
                <div>
                  <div className="ed-author-name">Mohsin Khan</div>
                  <div className="ed-author-biz">
                    Owner, Eat Out — High volume QSR
                  </div>
                </div>
              </div>
              <div className="ed-quote-stats">
                <div className="ed-quote-stat">
                  <strong>22,420</strong>
                  <span>orders managed</span>
                </div>
                <div className="ed-quote-stat">
                  <strong>$75K+</strong>
                  <span>revenue tracked</span>
                </div>
                <div className="ed-quote-stat">
                  <strong>30</strong>
                  <span>team members</span>
                </div>
                <div className="ed-quote-stat">
                  <strong>1 day</strong>
                  <span>to go live</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ed-section" id="how">
          <div className="ed-wrap">
            <div className="ed-eyebrow">Setup</div>
            <h2 className="ed-title">From zero to first order in one day.</h2>
            <p className="ed-sub">
              We set everything up. You choose modules. Billing follows what you
              switch on.
            </p>
            <div className="ed-steps">
              <div className="ed-step">
                <div className="ed-step-num">1</div>
                <div className="ed-step-title">Sign up free</div>
                <div className="ed-step-desc">
                  Create your account in minutes. No payment, no card.
                </div>
              </div>
              <div className="ed-step">
                <div className="ed-step-num">2</div>
                <div className="ed-step-title">We build your menu</div>
                <div className="ed-step-desc">
                  Share your menu — we add categories, items, and prices.
                </div>
              </div>
              <div className="ed-step">
                <div className="ed-step-num">3</div>
                <div className="ed-step-title">Pick your modules</div>
                <div className="ed-step-desc">
                  Start with POS. Add kitchen, riders, stock, books, or AI later.
                </div>
              </div>
              <div className="ed-step">
                <div className="ed-step-num">4</div>
                <div className="ed-step-title">Take orders</div>
                <div className="ed-step-desc">
                  Open a browser or tablet. First order the same day.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ed-section" id="faq" style={{ paddingTop: 0 }}>
          <div className="ed-wrap">
            <div className="ed-eyebrow">FAQ</div>
            <h2 className="ed-title">Common questions</h2>
            <p className="ed-sub">
              How modular billing works before you sign up.
            </p>
            <div className="ed-faq-grid">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q} className="ed-faq-item">
                  <div className="ed-faq-q">{item.q}</div>
                  <div className="ed-faq-a">{parseFaqBold(item.a)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ed-final">
          <div className="ed-wrap">
            <h2>
              Your restaurant deserves
              <br />
              better than <em>paper.</em>
            </h2>
            <p>
              30 days free on eligible modules. We set everything up. You only
              pay for what you switch on.
            </p>
            <div className="ed-final-actions">
              <Link href="/signup" className="ed-btn ed-btn-primary">
                Start free — 30 days →
              </Link>
              <a
                href={WHATSAPP_BOOK_DEMO_URL}
                className="ed-btn ed-btn-ghost-dark"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book a WhatsApp demo
              </a>
            </div>
            <div className="ed-final-note">
              From {formatModuleRate(MODULE_CATALOG.pos.rate)}/branch/mo · No
              hardware · Cancel anytime
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </>
  );
}
