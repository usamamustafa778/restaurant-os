import { Fragment, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { FAQ_ITEMS } from "../lib/landingPricingData";
import {
  PRICING_COPY,
  PRICING_COUNTRIES,
  PLAN_DEFINITIONS,
  VALUE_COMPARISON,
  FEATURE_COMPARISON_GROUPS,
  formatMoney,
} from "../lib/pricingConfig";
import MarketingFooter from "../components/MarketingFooter";

const WHATSAPP_DEMO_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/923166222269";

const ENTERPRISE_WHATSAPP_URL = "https://wa.me/923231557988";

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
    if (value === "Soon") {
      return <span className="cmp-support-starter">Soon</span>;
    }
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
  const [country, setCountry] = useState("PK"); // PK | US
  const [hasManualCountry, setHasManualCountry] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const [calcOrders, setCalcOrders] = useState(180);
  const [calcAvg, setCalcAvg] = useState(905);
  const [calcSystem, setCalcSystem] = useState("whatsapp");

  const calcDailyRev = (Number(calcOrders) || 0) * (Number(calcAvg) || 0);
  const calcMonthlyRev = calcDailyRev * 30;
  const LOSS_RATES = { whatsapp: 0.2, basic: 0.12, multi: 0.15 };
  const calcMonthlyLoss = calcMonthlyRev * (LOSS_RATES[calcSystem] ?? 0.2);
  const calcPayoffX =
    calcMonthlyLoss > 0 ? (calcMonthlyLoss / 10500).toFixed(1) : "0.0";
  const fmtRs = (n) => "Rs " + Math.round(n).toLocaleString("en-PK");

  useEffect(() => {
    if (hasManualCountry) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000);

    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.country_code || hasManualCountry) return;
        if (data.country_code === "PK") setCountry("PK");
        else setCountry("US");
      })
      .catch(() => {
        if (!hasManualCountry) {
          setCountry("PK");
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [hasManualCountry]);

  const handleCountrySelect = (code) => {
    setHasManualCountry(true);
    setCountry(code);
  };

  const countryOptions = [PRICING_COUNTRIES.PK, PRICING_COUNTRIES.US];

  const getPrice = (plan, mode = "daily") => {
    const p = PLAN_DEFINITIONS[plan];
    if (!p || p.custom) return "Custom pricing";
    if (mode === "daily")
      return `${formatMoney(country, p.daily[country], true)}/day`;
    return `~${formatMoney(country, p.monthlyApprox[country])}/month`;
  };

  const valueRows = VALUE_COMPARISON[country] || VALUE_COMPARISON.PK;
  const valueTotal = valueRows.reduce((sum, row) => sum + row[1], 0);
  const growthMonthly = PLAN_DEFINITIONS.growth.monthlyApprox[country];
  const valueSave = valueTotal - growthMonthly;
  const compactComparisonRows = [
    ["POS terminal", true, true, true],
    ["Kitchen Display System (KDS)", false, true, true],
    ["Riders app + live tracking", false, true, true],
    ["Inventory management", false, true, true],
    ["Full accounting (P&L, Balance Sheet)", false, true, true],
    ["Restaurant website + online ordering", false, true, true],
    ["Tables & reservations", false, true, true],
    ["Role-based staff access", false, true, true],
    ["Advanced reports & analytics", false, true, true],
    ["Deals & discount engine", true, true, true],
  ];

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
        <title>Cloud-Based Restaurant POS & Online Ordering System</title>
        <meta
          name="description"
          content="EatsDesk offers cloud-based restaurant POS software with commission-free online ordering, kitchen display system (KDS), rider tracking, and inventory management for restaurants across the world."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
              <div className="hero-label fade-up">
                The Future of Restaurant Sales is Digital
              </div>
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
                <a
                  href="https://wa.me/923136224778?text=Hi, I'd like to book a demo of EatsDesk"
                  className="btn btn-ghost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Book a Demo
                </a>
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
                        <span className="order-badge badge-prep">
                          Preparing
                        </span>
                      </div>
                      <div className="order-item">
                        <span className="order-name">Order #202</span>
                        <span className="order-badge badge-ready">Ready</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hero-ph fade-up delay-4">
                <a
                  href="https://www.producthunt.com/products/eatsdesk-restaurant-os-for-fast-food?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-eatsdesk-restaurant-os-for-fast-food"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    alt="EatsDesk — Restaurant OS for Fast Food - Run your fast food restaurant from one screen | Product Hunt"
                    width="250"
                    height="54"
                    src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1110659&theme=dark&t=1775018843944"
                  />
                </a>
                <div className="ph-card">
                  <div className="ph-card-top">
                    <img
                      className="ph-card-logo"
                      alt="EatsDesk — Restaurant OS for Fast Food"
                      src="https://ph-files.imgix.net/f2778948-0fe4-43f2-81f6-1c697de94cbd.png?auto=format&fit=crop&w=80&h=80"
                    />
                    <div className="ph-card-info">
                      <h3 className="ph-card-name">
                        EatsDesk — Restaurant OS for Fast Food
                      </h3>
                      <p className="ph-card-tagline">
                        Run your fast food restaurant from one screen
                      </p>
                    </div>
                  </div>
                  <a
                    className="ph-card-btn"
                    href="https://www.producthunt.com/products/eatsdesk-restaurant-os-for-fast-food?embed=true&utm_source=embed&utm_medium=post_embed"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Check it out on Product Hunt →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="stats-strip">
          <div className="stats-strip-inner">
            <div className="strip-stat">
              <div className="strip-num">
                Rs <span>179,000</span>
              </div>
              <div className="strip-desc">tracked in a single day</div>
            </div>
            <div className="strip-stat">
              <div className="strip-num">
                <span>189</span>
              </div>
              <div className="strip-desc">orders managed in one day</div>
            </div>
            <div className="strip-stat">
              <div className="strip-num">
                Rs <span>0</span>
              </div>
              <div className="strip-desc">hardware required</div>
            </div>
            <div className="strip-stat">
              <div className="strip-num">
                1<span> day</span>
              </div>
              <div className="strip-desc">to go fully live</div>
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
                  When orders stack up, kitchen loses track, riders wait
                  outside, and wrong items go out. Your most profitable hour
                  becomes your most expensive mistake.
                </div>
              </div>
              <div className="pain-card">
                <div className="pain-icon">📋</div>
                <div className="pain-title">Paper everywhere</div>
                <div className="pain-desc">
                  Notebook tallies, WhatsApp screenshots, hand-written slips.
                  You can&apos;t run a business on paper and actually know what
                  you made today.
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
                  <div
                    className="frame-dot"
                    style={{ background: "#FF5F57" }}
                  />
                  <div
                    className="frame-dot"
                    style={{ background: "#FFBD2E" }}
                  />
                  <div
                    className="frame-dot"
                    style={{ background: "#28CA41" }}
                  />
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

        <section className="feat-cards-section">
          <div className="section-inner">
            <div className="feat-cards-grid">
              <div className="feat-card">
                <div className="fc-icon">📺</div>
                <div className="fc-title">Kitchen Display System (KDS)</div>
                <div className="fc-desc">
                  Reduce missed orders during rush hour. Every order appears on
                  the kitchen screen the moment it&apos;s placed — no paper
                  slip, no shouting, no wrong items going out.
                </div>
              </div>
              <div className="feat-card">
                <div className="fc-icon">🛵</div>
                <div className="fc-title">Riders app + live tracking</div>
                <div className="fc-desc">
                  Know exactly what every rider collected at end of day. Zero
                  cash disputes. Zero missing money. Every delivery logged,
                  every rupee accounted for.
                </div>
              </div>
              <div className="feat-card">
                <div className="fc-icon">📦</div>
                <div className="fc-title">Inventory management</div>
                <div className="fc-desc">
                  Stop losing money to stock surprises. Your inventory updates
                  with every sale — so you never run out of chicken on a Friday
                  night again.
                </div>
              </div>
              <div className="feat-card">
                <div className="fc-icon">👥</div>
                <div className="fc-title">Staff scheduling &amp; roles</div>
                <div className="fc-desc">
                  Every team member sees only what they need. Cashier, waiter,
                  kitchen, rider, manager — each with their own screen. No
                  confusion, no overlap, no security gaps.
                </div>
              </div>
              <div className="feat-card">
                <div className="fc-icon">🌐</div>
                <div className="fc-title">Restaurant website + CMS</div>
                <div className="fc-desc">
                  Your own restaurant website with online ordering — built in,
                  no developer needed. Take direct orders without paying
                  Foodpanda commission on every sale.
                </div>
              </div>
              <div className="feat-card">
                <div className="fc-icon">📈</div>
                <div className="fc-title">Advanced analytics &amp; reports</div>
                <div className="fc-desc">
                  Know what you made, what you sold, and what you wasted —
                  before you go to sleep. Daily reports, top items, payment
                  breakdown, and rider performance in one view.
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
              We set everything up for you. You start taking orders the same
              day.
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
                  Share your menu with us — we add every category, item, and
                  price for you.
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
                  Open your browser. Your restaurant is live. First order in
                  under 5 minutes.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="calc-section">
          <div className="section-inner">
            <div className="section-label">Revenue calculator</div>
            <h2 className="section-title">
              How much is your restaurant
              <br />
              <span className="orange">losing right now?</span>
            </h2>
            <p className="section-sub">
              Most restaurants lose 15–25% of potential revenue every day.
              Calculate yours.
            </p>
            <div className="calc-card">
              <div className="calc-left">
                <div className="calc-field">
                  <label className="calc-label">Daily orders</label>
                  <input
                    type="number"
                    className="calc-input"
                    placeholder="180"
                    value={calcOrders}
                    onChange={(e) => setCalcOrders(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="calc-field">
                  <label className="calc-label">Average order value (Rs)</label>
                  <input
                    type="number"
                    className="calc-input"
                    placeholder="905"
                    value={calcAvg}
                    onChange={(e) => setCalcAvg(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="calc-field">
                  <label className="calc-label">
                    How do you manage orders?
                  </label>
                  <select
                    className="calc-input calc-select"
                    value={calcSystem}
                    onChange={(e) => setCalcSystem(e.target.value)}
                  >
                    <option value="whatsapp">WhatsApp + paper</option>
                    <option value="basic">Basic POS only</option>
                    <option value="multi">Multiple disconnected systems</option>
                  </select>
                </div>
              </div>
              <div className="calc-right">
                <div className="calc-results-grid">
                  <div className="calc-result-card">
                    <div className="cr-label">Estimated daily revenue</div>
                    <div className="cr-value cr-orange">
                      {fmtRs(calcDailyRev)}
                    </div>
                  </div>
                  <div className="calc-result-card">
                    <div className="cr-label">Estimated monthly revenue</div>
                    <div className="cr-value cr-white">
                      {fmtRs(calcMonthlyRev)}
                    </div>
                  </div>
                  <div className="calc-result-card">
                    <div className="cr-label">Estimated monthly loss</div>
                    <div className="cr-value cr-red">
                      {fmtRs(calcMonthlyLoss)}
                    </div>
                  </div>
                  <div className="calc-result-card">
                    <div className="cr-label">EatsDesk cost vs loss</div>
                    <div className="cr-payoff-detail">
                      <span>
                        EatsDesk Growth plan costs{" "}
                        <strong>Rs 10,500/month</strong>
                      </span>
                      <span>
                        Your estimated loss:{" "}
                        <strong>{fmtRs(calcMonthlyLoss)}/month</strong>
                      </span>
                      <span className="cr-payoff-bold">
                        EatsDesk pays for itself{" "}
                        <span className="cr-orange">{calcPayoffX}×</span> over
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/signup"
                  className="btn btn-primary-dark calc-cta-btn"
                >
                  Start free trial — recover your revenue →
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="pricing-section" id="pricing">
          <div className="section-inner">
            <div className="section-label">Simple launch pricing</div>
            <h2 className="section-title">
              Run your entire restaurant
              <br />
              <span className="orange">from {getPrice("growth", "daily")}</span>
            </h2>
            <p className="section-sub">{PRICING_COPY.subheadline}</p>

            <div
              className="pricing-billing-wrap"
              style={{ textAlign: "center" }}
            >
              <div className="country-toggle-row">
                <div className="country-dropdown">
                  <select
                    className="country-select"
                    value={country}
                    onChange={(e) => handleCountrySelect(e.target.value)}
                  >
                    {countryOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.flag} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
              </div>
            </div>

            <div className="pricing-grid">
              <div className="price-card">
                <div className="pc-name">{PLAN_DEFINITIONS.starter.name}</div>
                <p className="pc-tagline">{PLAN_DEFINITIONS.starter.target}</p>
                <div className="pc-price">
                  {getPrice("starter", billingMode)}
                </div>
                <div className="pc-equiv">
                  {billingMode === "daily"
                    ? getPrice("starter", "monthly")
                    : "30 day equivalent shown above"}
                </div>
                <p className="pc-year-note">
                  or Rs 45,000/year (save 2 months)
                </p>
                <Link href="/signup" className="pc-cta">
                  Start free trial
                </Link>
                <ul className="pc-features">
                  {[
                    "Full POS system",
                    "Menu & order management",
                    "Customer database",
                    "Daily sales reports",
                    "Free website subdomain",
                    "WhatsApp support + free setup",
                  ].map((f) => (
                    <li key={f} className="pc-feat yes">
                      <span className="dot">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="pc-feature-link">
                  <a href="#compare">See full feature list ↓</a>
                </p>
              </div>

              <div className="price-card featured">
                <div className="pc-name">{PLAN_DEFINITIONS.growth.name}</div>
                <p className="pc-tagline">{PLAN_DEFINITIONS.growth.target}</p>
                <div className="pc-price">
                  {getPrice("growth", billingMode)}
                </div>
                <div className="pc-equiv">
                  {billingMode === "daily"
                    ? getPrice("growth", "monthly")
                    : "30 day equivalent shown above"}
                </div>
                <p className="pc-year-note">
                  or Rs 75,000/year (save 2 months)
                </p>
                <div className="pc-lock-tag">
                  🔒 Launch pricing — locked forever
                </div>
                <p className="pc-normal-price">
                  Normally Rs 350/day after launch
                </p>
                <p className="pc-save-line">
                  Save{" "}
                  {country === "PK"
                    ? "Rs 11,500"
                    : formatMoney(country, valueSave)}{" "}
                  /month vs buying separately
                </p>
                <Link href="/signup" className="pc-cta primary">
                  Start free trial
                </Link>
                <ul className="pc-features">
                  {[
                    "Everything in Starter",
                    "KDS + Riders app + live tracking",
                    "Full inventory management",
                    "Complete accounting suite",
                    "Restaurant website + online ordering",
                    "Tables, reservations & staff roles",
                  ].map((f) => (
                    <li key={f} className="pc-feat yes">
                      <span className="dot">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="pc-feature-link">
                  <a href="#compare">See full feature list ↓</a>
                </p>
              </div>

              <div className="price-card price-card--enterprise">
                <div className="pc-name">
                  {PLAN_DEFINITIONS.enterprise.name}
                </div>
                <p className="pc-tagline">
                  {PLAN_DEFINITIONS.enterprise.target}
                </p>
                <div className="pc-price">Custom pricing</div>
                <p className="pc-year-note">
                  Tailored to your number of branches
                </p>
                <a
                  href={ENTERPRISE_WHATSAPP_URL}
                  className="pc-cta"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact us →
                </a>
                <ul className="pc-features">
                  {[
                    "Everything in Growth",
                    "Unlimited branches",
                    "Multi-location dashboard",
                    "API access & white-label",
                    "Dedicated account manager",
                    "Priority support + SLA guarantee",
                  ].map((f) => (
                    <li key={f} className="pc-feat yes">
                      <span className="dot">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="pc-feature-link">
                  <a href="#compare">See full feature list ↓</a>
                </p>
              </div>
            </div>
            <p className="pricing-detail-sub" style={{ marginTop: 16 }}>
              Pay yearly and get 2 months free — locked in at launch pricing
              forever.
            </p>

            <div id="compare">
              <h3 className="pricing-detail-title">Full feature comparison</h3>
              <p className="pricing-detail-sub">
                Exact plan-level feature breakdown.
              </p>
              <div
                style={{
                  maxHeight: showAllFeatures ? "5000px" : "620px",
                  overflow: "hidden",
                  transition: "max-height 420ms ease",
                }}
              >
                <div className="cmp-wrap">
                  <table className="cmp-table">
                    <thead>
                      <tr>
                        <th style={{ width: "42%" }}>Feature</th>
                        <th className="plan-col" style={{ width: "19%" }}>
                          Starter
                          <br />
                          <span style={{ fontSize: 10, fontWeight: 400 }}>
                            {getPrice("starter", "daily")}
                          </span>
                        </th>
                        <th
                          className="plan-col featured-col"
                          style={{ width: "19%" }}
                        >
                          Growth
                          <br />
                          <span style={{ fontSize: 10, fontWeight: 400 }}>
                            {getPrice("growth", "daily")}
                          </span>
                        </th>
                        <th className="plan-col" style={{ width: "19%" }}>
                          Enterprise
                          <br />
                          <span style={{ fontSize: 10, fontWeight: 400 }}>
                            Custom
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {showAllFeatures
                        ? FEATURE_COMPARISON_GROUPS.map((section) => (
                            <Fragment key={section.title}>
                              <tr className="cmp-cat">
                                <td colSpan={4}>{section.title}</td>
                              </tr>
                              {section.rows.map((row) => (
                                <tr key={`${section.title}-${row[0]}`}>
                                  <td>
                                    <div className="cmp-feat-name">
                                      {row[0]}
                                    </div>
                                  </td>
                                  <td className="center">
                                    <CmpCell value={row[1]} col="starter" />
                                  </td>
                                  <td className="center">
                                    <CmpCell value={row[2]} col="growth" />
                                  </td>
                                  <td className="center">
                                    <CmpCell value={row[3]} col="pro" />
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))
                        : compactComparisonRows.map((match) => {
                            return (
                              <tr key={match[0]}>
                                <td>
                                  <div className="cmp-feat-name">
                                    {match[0]}
                                  </div>
                                </td>
                                <td className="center">
                                  <CmpCell value={match[1]} col="starter" />
                                </td>
                                <td className="center">
                                  <CmpCell value={match[2]} col="growth" />
                                </td>
                                <td className="center">
                                  <CmpCell value={match[3]} col="pro" />
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ marginTop: 20, textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowAllFeatures((v) => !v)}
                  className="cmp-toggle-btn"
                >
                  {showAllFeatures ? "Show less ▲" : "See all 60+ features ▼"}
                </button>
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
            <div className="ea-layout">
              <div className="ea-left">
                <div className="section-label">Early Access</div>
                <h2 className="section-title">
                  Be one of our
                  <br />
                  first <span className="orange">restaurants.</span>
                </h2>
                <div className="ea-spots-row">
                  <div className="ea-spot-dot" />
                  <span className="ea-spots-text">Only 20 spots available</span>
                </div>
              </div>
              <div className="ea-right">
                <p className="section-sub">
                  The first 20 restaurants that sign up get launch pricing
                  locked forever — even when we raise prices for new clients.
                </p>
                <p className="section-sub ea-detail-sub">
                  We work closely with each restaurant — setting up their
                  system, training their staff, and improving the product based
                  on their feedback.
                </p>
                <div className="ea-actions">
                  <a
                    href="https://wa.me/923136224778?text=Hi, I'd like to book a demo of EatsDesk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary-dark"
                  >
                    Apply for early access →
                  </a>
                  <p className="ea-spots-remaining">13 spots remaining</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="guarantee-section">
          <div className="section-inner">
            <div className="section-label">Risk free</div>
            <h2 className="section-title">
              Zero risk.
              <br />
              <span className="orange">Seriously.</span>
            </h2>
            <p className="section-sub">Every reason to say no — eliminated.</p>
            <div className="guarantee-grid guarantee-grid--2col">
              <div className="guarantee-item">
                <span className="gi-icon gi-icon--emoji">🗓️</span>
                <div className="gi-title">30 days free</div>
                <div className="gi-desc">
                  Full access to every feature for 30 days. No credit card. No
                  commitment. If you don&apos;t love it, you walk away owing
                  nothing.
                </div>
              </div>
              <div className="guarantee-item">
                <span className="gi-icon gi-icon--emoji">⚡</span>
                <div className="gi-title">We set it up</div>
                <div className="gi-desc">
                  We add your menu, configure your team, and get your system
                  ready. You take your first order the same day we set it up.
                </div>
              </div>
              <div className="guarantee-item">
                <span className="gi-icon gi-icon--emoji">📱</span>
                <div className="gi-title">No hardware</div>
                <div className="gi-desc">
                  EatsDesk runs on any phone, tablet, or laptop you already own.
                  No expensive POS terminals. No installation. Just a browser.
                </div>
              </div>
              <div className="guarantee-item">
                <span className="gi-icon gi-icon--emoji">🔓</span>
                <div className="gi-title">Cancel anytime</div>
                <div className="gi-desc">
                  Month-to-month. No annual contracts forced on you. Cancel from
                  your dashboard in one click. Your data is always yours to
                  export.
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
            <a
              href="https://wa.me/923136224778?text=Hi, I'd like to book a demo of EatsDesk"
              className="btn btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: 10,
                borderColor: "rgba(255,255,255,0.45)",
                color: "#fff",
              }}
            >
              Book a Demo
            </a>
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
