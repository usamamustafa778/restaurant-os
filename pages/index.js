import { Fragment, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { COMPARISON_SECTIONS, FAQ_ITEMS } from "../lib/landingPricingData";
import MarketingFooter from "../components/MarketingFooter";

const WHATSAPP_DEMO_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/923166222269";

const TAB_DATA = {
  kds: {
    items: [
      {
        icon: "📺",
        title: "Live kitchen display",
        desc: "Orders appear instantly on the kitchen screen the moment placed. No shouting across the counter.",
      },
      {
        icon: "⚡",
        title: "One-tap status updates",
        desc: "Kitchen marks orders preparing → ready. Counter and riders see the update instantly.",
      },
      {
        icon: "🎯",
        title: "Order type separation",
        desc: "Dine-in, takeaway, delivery orders are colour-coded. Kitchen always knows what goes where.",
      },
    ],
  },
  pos: {
    items: [
      {
        icon: "💳",
        title: "Full POS terminal",
        desc: "Take dine-in, takeaway, and delivery orders from one screen. Fast, clean, no training needed.",
      },
      {
        icon: "📱",
        title: "Easypaisa + JazzCash",
        desc: "Accept cash, card, and digital payments. Every method tracked and reported separately.",
      },
      {
        icon: "🏷️",
        title: "Deals and discounts",
        desc: "Apply offers and combos at checkout in one tap. No calculator needed.",
      },
    ],
  },
  riders: {
    items: [
      {
        icon: "🛵",
        title: "Rider mobile app",
        desc: "Each rider gets their own app. See active orders, mark deliveries, track earnings.",
      },
      {
        icon: "📊",
        title: "Per-rider reporting",
        desc: "See every rider's deliveries, collected cash, and unpaid orders at a glance.",
      },
      {
        icon: "✅",
        title: "Cash reconciliation",
        desc: "Know exactly who collected what. No end-of-day surprises or missing cash.",
      },
    ],
  },
  reports: {
    items: [
      {
        icon: "📈",
        title: "Real-time dashboard",
        desc: "Revenue, orders, and profit updated live throughout the day. Always know where you stand.",
      },
      {
        icon: "🏆",
        title: "Top selling items",
        desc: "See your best performers by day, week, or month. Adjust your menu with confidence.",
      },
      {
        icon: "💾",
        title: "Business day reports",
        desc: "End-of-day summary with payment breakdown. Export to CSV whenever you need it.",
      },
    ],
  },
};

function parseFaqBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function CmpCell({ value, col }) {
  if (typeof value === "string") {
    const cls =
      value === "Priority"
        ? "cmp-text-priority"
        : col === "growth"
          ? "cmp-support-growth"
          : "cmp-support-starter";
    return <span className={cls}>{value}</span>;
  }
  if (value === true) {
    return (
      <span className={col === "growth" ? "cmp-orange" : "cmp-tick"}>✓</span>
    );
  }
  return <span className="cmp-cross">–</span>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("kds");
  const [billingMode, setBillingMode] = useState("daily");

  useEffect(() => {
    const mqNarrow = window.matchMedia("(max-width: 900px)");
    let cursorCleanup = () => {};

    const bindCustomCursor = () => {
      cursorCleanup();
      cursorCleanup = () => {};
      if (mqNarrow.matches) return;

      const cursor = document.getElementById("cursor");
      const ring = document.getElementById("cursorRing");
      if (!cursor || !ring) return;

      let mx = 0;
      let my = 0;
      let rx = 0;
      let ry = 0;
      let rafId = 0;
      let ringActive = true;

      const onMove = (e) => {
        mx = e.clientX;
        my = e.clientY;
        cursor.style.transform = `translate(${mx - 5}px,${my - 5}px)`;
      };

      function animRing() {
        if (!ringActive) return;
        rx += (mx - rx) * 0.12;
        ry += (my - ry) * 0.12;
        ring.style.transform = `translate(${rx - 18}px,${ry - 18}px)`;
        rafId = requestAnimationFrame(animRing);
      }
      animRing();

      const onEnter = () => {
        cursor.style.transform += " scale(1.8)";
        ring.style.width = "54px";
        ring.style.height = "54px";
        ring.style.borderColor = "rgba(255,84,0,0.8)";
      };
      const onLeave = () => {
        ring.style.width = "36px";
        ring.style.height = "36px";
        ring.style.borderColor = "rgba(255,84,0,0.5)";
      };

      document.addEventListener("mousemove", onMove);
      const hoverEls = document.querySelectorAll(
        "a,button,.pain-card,.testi-card",
      );
      hoverEls.forEach((el) => {
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
      });

      cursorCleanup = () => {
        ringActive = false;
        cancelAnimationFrame(rafId);
        document.removeEventListener("mousemove", onMove);
        hoverEls.forEach((el) => {
          el.removeEventListener("mouseenter", onEnter);
          el.removeEventListener("mouseleave", onLeave);
        });
      };
    };

    bindCustomCursor();
    mqNarrow.addEventListener("change", bindCustomCursor);

    const nav = document.getElementById("nav");
    const onScroll = () => {
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll);

    const bars = document.getElementById("chartBars");
    const heights = [
      8, 10, 15, 18, 22, 35, 48, 62, 80, 95, 100, 88, 72, 65, 70, 85, 95, 78,
      55, 42, 30, 20, 12, 8,
    ];
    if (bars) {
      bars.innerHTML = "";
      heights.forEach((h, i) => {
        const b = document.createElement("div");
        b.className =
          "bar" +
          (i >= 10 && i <= 16 ? " active" : i >= 7 && i <= 9 ? " semi" : "");
        b.style.height = h + "%";
        bars.appendChild(b);
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.opacity = "1";
            e.target.style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.1 },
    );

    document
      .querySelectorAll(".pain-card,.hiw-step,.price-card")
      .forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(24px)";
        el.style.transition = "opacity 0.6s ease,transform 0.6s ease";
        observer.observe(el);
      });

    return () => {
      cursorCleanup();
      mqNarrow.removeEventListener("change", bindCustomCursor);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <Head>
        <title>EatsDesk — Restaurant OS for Fast Food</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
      </Head>
      <div className="eatsdesk-landing">
      <div className="cursor" id="cursor" />
      <div className="cursor-ring" id="cursorRing" />

      <nav id="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <img
              className="nav-logo-mark"
              src="/favicon.png"
              alt="EatsDesk"
              width={34}
              height={34}
            />
            <span className="nav-logo-text">EatsDesk</span>
          </Link>
          <ul className="nav-links">
            <li>
              <Link href="/#features">Features</Link>
            </li>
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/#how">How it works</Link>
            </li>
            <li>
              <Link href="/#testimonials">Reviews</Link>
            </li>
            <li>
              <Link href="/#compare">Compare</Link>
            </li>
            <li>
              <Link href="/#faq">FAQ</Link>
            </li>
          </ul>
          <div className="nav-cta">
            <Link href="/login" className="btn btn-ghost">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary">
              <span className="nav-trial-long">Start free trial →</span>
              <span className="nav-trial-short">Free trial →</span>
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-label fade-up">Restaurant OS · Fast food</div>
            <h1 className="fade-up delay-1">
              Stop losing
              <br />
              money every
              <br />
              <span className="orange">rush hour.</span>
            </h1>
            <p className="hero-sub fade-up delay-2">
              Every missed order, every paper slip, every rider you can&apos;t
              track — it all costs you money. EatsDesk gives your fast food
              restaurant one screen for everything. POS, kitchen, riders, and
              inventory — live, all day.
            </p>
            <div className="hero-actions fade-up delay-3">
              <Link href="/signup" className="btn btn-primary-dark">
                Start free — 30 days →
              </Link>
            </div>
            <p className="hero-note fade-up delay-4">
              No credit card. No hardware. Setup in <span>one day.</span>
            </p>
          </div>
          <div className="hero-visual fade-up delay-3">
            <div className="dashboard-frame">
              <div className="frame-bar">
                <div className="frame-dot" />
                <div className="frame-dot" />
                <div className="frame-dot" />
                <div className="frame-url">app.eatsdesk.com · Overview</div>
              </div>
              <div className="dash-content">
                <div className="dash-header">
                  <div className="dash-title">Today&apos;s Overview</div>
                  <div className="dash-live">6 live orders</div>
                </div>
                <div className="dash-stats">
                  <div className="stat-card">
                    <div className="stat-label">Revenue</div>
                    <div className="stat-val orange">Rs 162k</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Orders</div>
                    <div className="stat-val white">180</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Net Profit</div>
                    <div className="stat-val green">Rs 161k</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Avg Order</div>
                    <div className="stat-val white">Rs 905</div>
                  </div>
                </div>
                <div className="dash-row">
                  <div className="chart-card">
                    <div className="chart-label">Sales by hour</div>
                    <div className="chart-bars" id="chartBars" />
                  </div>
                  <div className="orders-card">
                    <div className="chart-label">Live orders</div>
                    <div className="order-item">
                      <span className="order-name">Order #204</span>
                      <span className="order-badge badge-new">New</span>
                    </div>
                    <div className="order-item">
                      <span className="order-name">Order #203</span>
                      <span className="order-badge badge-prep">Preparing</span>
                    </div>
                    <div className="order-item">
                      <span className="order-name">Order #202</span>
                      <span className="order-badge badge-ready">Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="stats-strip">
        <div className="stats-strip-inner">
          <div className="strip-stat">
            <div className="strip-num">
              180<span>+</span>
            </div>
            <div className="strip-desc">Orders tracked daily</div>
          </div>
          <div className="strip-stat">
            <div className="strip-num">
              Rs <span>160k</span>
            </div>
            <div className="strip-desc">Revenue tracked in one day</div>
          </div>
          <div className="strip-stat">
            <div className="strip-num">
              <span>0</span>
            </div>
            <div className="strip-desc">Hardware required</div>
          </div>
          <div className="strip-stat">
            <div className="strip-num">
              1<span>day</span>
            </div>
            <div className="strip-desc">To go fully live</div>
          </div>
        </div>
      </div>

      <section className="pain-section" id="pain">
        <div className="section-inner">
          <div className="section-label">Sound familiar?</div>
          <h2 className="section-title">
            Your restaurant bleeds money in ways you don&apos;t even notice.
          </h2>
          <p className="section-sub">
            It&apos;s not one big problem. It&apos;s ten small ones happening
            every shift.
          </p>
          <div className="pain-grid">
            <div className="pain-card">
              <div className="pain-icon">🔥</div>
              <div className="pain-title">Rush hour chaos</div>
              <div className="pain-desc">
                When orders stack up, kitchen loses track, riders wait outside,
                and wrong items go out. Your most profitable hour becomes your
                most expensive mistake.
              </div>
            </div>
            <div className="pain-card">
              <div className="pain-icon">📋</div>
              <div className="pain-title">Paper everywhere</div>
              <div className="pain-desc">
                Notebook tallies, WhatsApp screenshots, hand-written slips. You
                can&apos;t run a business on paper and actually know what you
                made today.
              </div>
            </div>
            <div className="pain-card">
              <div className="pain-icon">🛵</div>
              <div className="pain-title">Riders you can&apos;t track</div>
              <div className="pain-desc">
                Four riders, no visibility. Who has which order? Who collected
                the cash? Who&apos;s been paid? EatsDesk gives every rider an
                app and gives you the answer instantly.
              </div>
            </div>
            <div className="pain-card">
              <div className="pain-icon">📦</div>
              <div className="pain-title">Stock surprises</div>
              <div className="pain-desc">
                Running out of chicken on a Friday at 7pm is not bad luck —
                it&apos;s a system problem. Connect your inventory to your POS
                and it never happens again.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-inner">
          <div className="section-label" style={{ color: "var(--orange)" }}>
            Everything included
          </div>
          <h2 className="section-title">
            One system.
            <br />
            Every moving part.
          </h2>
          <p className="section-sub">
            Not a POS that bolted on extras. Built as a complete restaurant OS
            from the ground up.
          </p>

          <div className="features-tabs">
            <button
              type="button"
              className={`tab-btn${activeTab === "kds" ? " active" : ""}`}
              onClick={() => setActiveTab("kds")}
            >
              Kitchen Display
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === "pos" ? " active" : ""}`}
              onClick={() => setActiveTab("pos")}
            >
              Point of Sale
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === "riders" ? " active" : ""}`}
              onClick={() => setActiveTab("riders")}
            >
              Riders App
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === "reports" ? " active" : ""}`}
              onClick={() => setActiveTab("reports")}
            >
              Reports
            </button>
          </div>

          <div className="features-body">
            <ul className="feature-list" id="featureList">
              {TAB_DATA[activeTab].items.map((i) => (
                <li key={i.title} className="feature-item">
                  <div className="fi-icon">{i.icon}</div>
                  <div>
                    <div className="fi-title">{i.title}</div>
                    <div className="fi-desc">{i.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="feature-visual">
              <div className="fv-header">
                <div className="frame-dot" style={{ background: "#FF5F57" }} />
                <div className="frame-dot" style={{ background: "#FFBD2E" }} />
                <div className="frame-dot" style={{ background: "#28CA41" }} />
                <div className="fv-title">Kitchen Display</div>
                <div className="fv-live">Live</div>
              </div>
              <div className="fv-body">
                <div className="kds-grid">
                  <div className="kds-ticket">
                    <div className="kds-num">#201</div>
                    <div className="kds-items">
                      2× Chicken Shawarma
                      <br />
                      1× Small Fries
                      <br />
                      1× 7Up 1Ltr
                    </div>
                    <span className="kds-status kds-new">New</span>
                  </div>
                  <div className="kds-ticket">
                    <div className="kds-num">#202</div>
                    <div className="kds-items">
                      1× Zinger Burger
                      <br />
                      1× Beef Burger
                      <br />
                      2× Cold Drink
                    </div>
                    <span className="kds-status kds-prep">Preparing</span>
                  </div>
                  <div className="kds-ticket">
                    <div className="kds-num">#203</div>
                    <div className="kds-items">
                      3× Fried Chicken
                      <br />
                      1× Cheese Slice
                      <br />
                      1× Platter
                    </div>
                    <span className="kds-status kds-ready">Ready ✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hiw-section" id="how">
        <div className="section-inner">
          <div className="section-label">Setup</div>
          <h2 className="section-title">
            From zero to first order in one day.
          </h2>
          <p className="section-sub">
            We set everything up for you. You start taking orders the same day.
          </p>
          <div className="hiw-steps">
            <div className="hiw-step">
              <div className="step-num">1</div>
              <div className="step-title">Sign up free</div>
              <div className="step-desc">
                Create your account in 2 minutes. No payment, no card, no
                paperwork.
              </div>
            </div>
            <div className="hiw-step">
              <div className="step-num">2</div>
              <div className="step-title">We build your menu</div>
              <div className="step-desc">
                Share your menu with us — we add every category, item, and price
                for you.
              </div>
            </div>
            <div className="hiw-step">
              <div className="step-num">3</div>
              <div className="step-title">Add your team</div>
              <div className="step-desc">
                Set up cashier, waiter, kitchen, and rider accounts with one
                click each.
              </div>
            </div>
            <div className="hiw-step">
              <div className="step-num">4</div>
              <div className="step-title">Start taking orders</div>
              <div className="step-desc">
                Open your browser. Your restaurant is live. First order in under
                5 minutes.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-inner">
          <div className="section-label">Simple launch pricing</div>
          <h2 className="section-title">
            Run your restaurant
            <br />
            <span className="orange">from Rs 100 a day</span>
          </h2>
          <p className="section-sub">
            Full restaurant OS — POS, kitchen display, riders, inventory,
            website, and more. No hardware. No long contracts.
          </p>

          <div className="pricing-billing-wrap" style={{ textAlign: "center" }}>
            <div className="billing-toggle">
              <button
                type="button"
                className={billingMode === "daily" ? "active" : ""}
                onClick={() => setBillingMode("daily")}
              >
                Daily
              </button>
              <button
                type="button"
                className={billingMode === "monthly" ? "active" : ""}
                onClick={() => setBillingMode("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={billingMode === "yearly" ? "active" : ""}
                onClick={() => setBillingMode("yearly")}
              >
                Yearly
                <span className="save-badge">−17%</span>
              </button>
            </div>
          </div>

          <div className="pricing-grid">
            <div className="price-card">
              <div className="pc-name">Starter</div>
              <p className="pc-tagline">Small café or takeaway counter</p>
              <div
                className={`pricing-billing-wrap billing-${billingMode}`}
              >
                <div className="pc-price-tier pc-price-tier--daily">
                  <div className="pc-price">Rs 100</div>
                  <div className="pc-unit">per day</div>
                  <div className="pc-equiv">~Rs 3,000 / month</div>
                </div>
                <div className="pc-price-tier pc-price-tier--monthly">
                  <div className="pc-price">Rs 2,900</div>
                  <div className="pc-unit">per month</div>
                  <div className="pc-equiv">Save Rs 100 vs daily</div>
                </div>
                <div className="pc-price-tier pc-price-tier--yearly">
                  <div className="pc-price">Rs 29,000</div>
                  <div className="pc-unit">per year</div>
                  <div className="pc-equiv">Save Rs 6,000 · 2 months free</div>
                </div>
              </div>
              <Link href="/signup" className="pc-cta">
                Start free trial
              </Link>
              <div className="pc-features-label">What&apos;s included</div>
              <div className="pc-section-label">Core operations</div>
              <ul className="pc-features">
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Point of Sale (POS)
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Order management board
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Menu management
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Dine-in, takeaway, delivery
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Customer database
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Cash + Easypaisa / JazzCash
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Daily sales reports
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Basic analytics dashboard
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Deals &amp; discounts
                </li>
              </ul>
              <div className="pc-divider" />
              <div className="pc-section-label">Not included</div>
              <ul className="pc-features">
                <li className="pc-feat no">
                  <span className="dot">–</span>Kitchen Display System
                </li>
                <li className="pc-feat no">
                  <span className="dot">–</span>Riders app
                </li>
                <li className="pc-feat no">
                  <span className="dot">–</span>Staff scheduling
                </li>
                <li className="pc-feat no">
                  <span className="dot">–</span>Inventory management
                </li>
                <li className="pc-feat no">
                  <span className="dot">–</span>Restaurant website
                </li>
                <li className="pc-feat no">
                  <span className="dot">–</span>Reservations
                </li>
                <li className="pc-feat no">
                  <span className="dot">–</span>Foodpanda integration
                </li>
              </ul>
            </div>

            <div className="price-card featured">
              <div className="pc-name">Growth</div>
              <p className="pc-tagline">Full-service fast food restaurant</p>
              <div
                className={`pricing-billing-wrap billing-${billingMode}`}
              >
                <div className="pc-price-tier pc-price-tier--daily">
                  <div className="pc-price">Rs 250</div>
                  <div className="pc-unit">per day</div>
                  <div className="pc-equiv">~Rs 7,500 / month</div>
                </div>
                <div className="pc-price-tier pc-price-tier--monthly">
                  <div className="pc-price">Rs 7,000</div>
                  <div className="pc-unit">per month</div>
                  <div className="pc-equiv">Save Rs 500 vs daily</div>
                </div>
                <div className="pc-price-tier pc-price-tier--yearly">
                  <div className="pc-price">Rs 70,000</div>
                  <div className="pc-unit">per year</div>
                  <div className="pc-equiv">
                    Save Rs 20,000 · 2.5 months free
                  </div>
                </div>
              </div>
              <Link href="/signup" className="pc-cta primary">
                Start free trial
              </Link>
              <div className="pc-features-label">Everything in Starter, plus</div>
              <div className="pc-section-label">Kitchen &amp; delivery</div>
              <ul className="pc-features">
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Kitchen Display System (KDS)
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Riders app + live tracking
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Per-rider earnings &amp; history
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Foodpanda integration
                </li>
              </ul>
              <div className="pc-divider" />
              <div className="pc-section-label">Staff &amp; operations</div>
              <ul className="pc-features">
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Staff scheduling
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>
                  Role-based access (cashier, waiter, manager)
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Waiter &amp; cashier apps
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Inventory management
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Table &amp; reservation management
                </li>
              </ul>
              <div className="pc-divider" />
              <div className="pc-section-label">Growth tools</div>
              <ul className="pc-features">
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Restaurant website + CMS
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Custom domain support
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Advanced reports &amp; analytics
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Business day reports
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Export to CSV
                </li>
              </ul>
            </div>

            <div className="price-card">
              <div className="pc-name">Pro</div>
              <p className="pc-tagline">Chain or multi-location operator</p>
              <div
                className={`pricing-billing-wrap billing-${billingMode}`}
              >
                <div className="pc-price-tier pc-price-tier--daily">
                  <div className="pc-price">Rs 400</div>
                  <div className="pc-unit">per day · per location</div>
                  <div className="pc-equiv">~Rs 12,000 / month</div>
                </div>
                <div className="pc-price-tier pc-price-tier--monthly">
                  <div className="pc-price">Rs 11,000</div>
                  <div className="pc-unit">per month · per location</div>
                  <div className="pc-equiv">Save Rs 1,000 vs daily</div>
                </div>
                <div className="pc-price-tier pc-price-tier--yearly">
                  <div className="pc-price">Rs 1,10,000</div>
                  <div className="pc-unit">per year · per location</div>
                  <div className="pc-equiv">
                    Save Rs 34,000 · 3 months free
                  </div>
                </div>
              </div>
              <a href={WHATSAPP_DEMO_URL} className="pc-cta">
                Book a demo
              </a>
              <div className="pc-features-label">Everything in Growth, plus</div>
              <div className="pc-section-label">Multi-location</div>
              <ul className="pc-features">
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Multi-branch dashboard
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Cross-location reporting
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Centralised menu management
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Branch-level access control
                </li>
              </ul>
              <div className="pc-divider" />
              <div className="pc-section-label">Support &amp; extras</div>
              <ul className="pc-features">
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Priority WhatsApp support
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Dedicated onboarding session
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>Custom report builder
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>API access
                </li>
                <li className="pc-feat yes">
                  <span className="dot">✓</span>AI agents (coming soon)
                </li>
              </ul>
            </div>
          </div>

          <h3 className="pricing-detail-title">Save more, worry less</h3>
          <p className="pricing-detail-sub">
            Switch to yearly and get up to 3 months free — locked in at launch
            pricing forever.
          </p>
          <div className="savings-strip">
            <div className="savings-card">
              <div className="savings-amount">Rs 6,000</div>
              <div className="savings-label">saved per year on Starter</div>
            </div>
            <div className="savings-card highlight">
              <div className="savings-amount">Rs 20,000</div>
              <div className="savings-label">saved per year on Growth</div>
            </div>
            <div className="savings-card">
              <div className="savings-amount">Rs 34,000</div>
              <div className="savings-label">saved per year on Pro</div>
            </div>
          </div>

          <div id="compare">
            <h3 className="pricing-detail-title">Full feature comparison</h3>
            <p className="pricing-detail-sub">
              Every feature, every plan — no surprises.
            </p>
            <div className="cmp-wrap">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th style={{ width: "42%" }}>Feature</th>
                    <th className="plan-col" style={{ width: "19%" }}>
                      Starter
                      <br />
                      <span style={{ fontSize: 10, fontWeight: 400 }}>
                        Rs 100/day
                      </span>
                    </th>
                    <th className="plan-col featured-col" style={{ width: "19%" }}>
                      Growth
                      <br />
                      <span style={{ fontSize: 10, fontWeight: 400 }}>
                        Rs 250/day
                      </span>
                    </th>
                    <th className="plan-col" style={{ width: "19%" }}>
                      Pro
                      <br />
                      <span style={{ fontSize: 10, fontWeight: 400 }}>
                        Rs 400/day
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_SECTIONS.map((section) => (
                    <Fragment key={section.title}>
                      <tr className="cmp-cat">
                        <td colSpan={4}>{section.title}</td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr key={`${section.title}-${row.name}`}>
                          <td>
                            <div className="cmp-feat-name">{row.name}</div>
                            {row.desc ? (
                              <div className="cmp-feat-desc">{row.desc}</div>
                            ) : null}
                          </td>
                          <td className="center">
                            <CmpCell value={row.s} col="starter" />
                          </td>
                          <td className="center">
                            <CmpCell value={row.g} col="growth" />
                          </td>
                          <td className="center">
                            <CmpCell value={row.p} col="pro" />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div id="faq">
            <h3 className="faq-section-title">Common questions</h3>
            <p className="faq-section-sub">
              Everything you need to know before getting started.
            </p>
            <div className="faq-grid">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q} className="faq-item">
                  <div className="faq-q">{item.q}</div>
                  <div className="faq-a">{parseFaqBold(item.a)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="testimonials-section" id="testimonials">
        <div className="section-inner">
          <div className="section-label" style={{ color: "var(--orange)" }}>
            Real results
          </div>
          <h2
            className="section-title"
            style={{ color: "var(--light-text)" }}
          >
            Restaurant owners
            <br />
            who made the switch.
          </h2>
          <div className="testi-grid">
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-text">
                &quot;We were running everything on WhatsApp and paper. First
                week on EatsDesk, we caught Rs 15,000 in orders that would have
                been missed during Friday rush. The kitchen display alone paid
                for itself.&quot;
              </p>
              <div className="testi-author">
                <div className="testi-avatar">MK</div>
                <div>
                  <div className="testi-name">Mohsin Khan</div>
                  <div className="testi-role">Owner, Eatout</div>
                </div>
              </div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-text">
                &quot;I have 4 riders and I had no idea who collected what money
                each day. Now I open the reports and everything is there — each
                rider, each delivery, paid and unpaid. No more arguments.&quot;
              </p>
              <div className="testi-author">
                <div className="testi-avatar">AR</div>
                <div>
                  <div className="testi-name">Ahmed Raza</div>
                  <div className="testi-role">Owner, Fast Bites</div>
                </div>
              </div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-text">
                &quot;Setup was one day. The EatsDesk team added our entire menu
                and showed the kitchen staff how to use the display. We went
                live on a Friday — busiest day of the week — no issues.&quot;
              </p>
              <div className="testi-author">
                <div className="testi-avatar">SB</div>
                <div>
                  <div className="testi-name">Sufi Biryani</div>
                  <div className="testi-role">Restaurant owner</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-inner">
          <h2 className="cta-title">
            Your restaurant deserves
            <br />
            better than paper.
          </h2>
          <p className="cta-sub">
            30 days free. We set everything up. You start taking orders the
            same day.
          </p>
          <Link href="/signup" className="btn btn-white">
            Start free — 30 days →
          </Link>
          <p className="cta-note">
            No credit card · No hardware · Cancel anytime
          </p>
        </div>
      </section>

      <MarketingFooter />
      </div>
    </>
  );
}
