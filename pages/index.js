import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MonitorSmartphone,
  Globe2,
  Package,
  BarChart3,
  Users,
  ShieldCheck,
  Star,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  Clock,
  Zap,
  TrendingUp,
  ShoppingBag,
  ChefHat,
  Utensils,
} from "lucide-react";
import SEO, {
  generateOrganizationSchema,
  generateSoftwareAppSchema,
} from "../components/SEO";
import { submitContact } from "../lib/apiClient";

/* ─── Scroll-reveal hook ──────────────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, className = "", delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── FAQ Accordion Item ──────────────────────────────────────────────── */
function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Animated Counter ────────────────────────────────────────────────── */
function Counter({ end, suffix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useReveal();
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [visible, end, duration]);
  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   LANDING PAGE
   ═════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      generateOrganizationSchema(),
      generateSoftwareAppSchema(),
      {
        "@type": "WebSite",
        url: "https://eatsdesk.com",
        name: "Eats Desk",
        description: "Restaurant management platform for Pakistan",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://eatsdesk.com/search?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <SEO
        title="Eats Desk - Complete Restaurant Management System for Pakistan | POS, Inventory & Free Website"
        description="Transform your restaurant with Eats Desk. Lightning-fast POS, smart inventory tracking, and free branded website. Trusted by 500+ restaurants in Pakistan. Start your 14-day free trial today!"
        keywords="restaurant POS system Pakistan, restaurant management software, POS system for restaurants, inventory management restaurant, online ordering system, restaurant website builder, cafe management software, food business software Islamabad Lahore Karachi, restaurant billing software, kitchen management system"
        structuredData={structuredData}
      />
      <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
        {/* ──────────── HEADER ──────────── */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm">
                  ED
                </span>
                <div>
                  <div className="text-sm font-bold tracking-tight text-gray-900">
                    Eats Desk
                  </div>
                  <div className="text-[10px] text-gray-500 -mt-0.5">
                    Restaurant & Cafe Operations Desk
                  </div>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
                <a
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  className="hover:text-primary transition-colors"
                >
                  How it works
                </a>
                <a
                  href="#pricing"
                  className="hover:text-primary transition-colors"
                >
                  Pricing
                </a>
                <a
                  href="#testimonials"
                  className="hover:text-primary transition-colors"
                >
                  Testimonials
                </a>
                <a
                  href="#contact"
                  className="hover:text-primary transition-colors"
                >
                  Contact
                </a>
              </nav>

              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="hidden md:inline-flex text-sm font-medium text-gray-700 hover:text-primary transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                >
                  Start Free Trial
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={
                        mobileMenuOpen
                          ? "M6 18L18 6M6 6l12 12"
                          : "M4 6h16M4 12h16M4 18h16"
                      }
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile menu */}
            {mobileMenuOpen && (
              <div className="md:hidden pb-4 border-t border-gray-100 mt-2 pt-4 space-y-3">
                {[
                  "features",
                  "how-it-works",
                  "pricing",
                  "testimonials",
                  "contact",
                ].map((id) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-sm text-gray-600 hover:text-primary capitalize"
                  >
                    {id.replace(/-/g, " ")}
                  </a>
                ))}
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm font-medium text-gray-700"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* ──────────── HERO ──────────── */}
        <section className="relative overflow-hidden">
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div>
                <Reveal>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/5 border border-primary/15 px-3 py-1.5 rounded-full mb-6">
                    <Zap className="w-3.5 h-3.5" />
                    Built for Pakistani Restaurants
                  </span>
                </Reveal>

                <Reveal delay={100}>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                    Run your restaurant
                    <br />
                    from <span className="text-primary">one place</span>.
                  </h1>
                </Reveal>

                <Reveal delay={200}>
                  <p className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">
                    Eats Desk combines POS, inventory tracking, and a free
                    branded website — all in one platform designed for how you
                    actually work.
                  </p>
                </Reveal>

                <Reveal delay={300}>
                  <div className="flex flex-wrap gap-4 mb-10">
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                    >
                      Start Free 14-Day Trial
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                      href="#how-it-works"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 text-base font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all"
                    >
                      See how it works
                    </a>
                  </div>
                </Reveal>

                <Reveal delay={400}>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      No credit card required
                    </span>
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Free restaurant website
                    </span>
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Set up in 10 minutes
                    </span>
                  </div>
                </Reveal>
              </div>

              {/* Hero visual: dashboard mockup */}
              <Reveal delay={200}>
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent rounded-3xl blur-2xl" />
                  <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/50 p-6 space-y-4">
                    {/* Header bar */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">
                          Today&apos;s Revenue
                        </p>
                        <p className="text-3xl font-bold text-gray-900">
                          PKR 128,450
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live POS
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold flex items-center gap-1">
                          <Globe2 className="w-3 h-3" />
                          Website Active
                        </span>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                        <p className="text-[11px] text-gray-500 mb-1">
                          Orders Today
                        </p>
                        <p className="text-xl font-bold text-gray-900">74</p>
                        <p className="text-[11px] text-emerald-600 font-medium">
                          +18% ↑
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                        <p className="text-[11px] text-gray-500 mb-1">
                          Low Stock
                        </p>
                        <p className="text-xl font-bold text-gray-900">5</p>
                        <p className="text-[11px] text-amber-600 font-medium">
                          Restock soon
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                        <p className="text-[11px] text-gray-500 mb-1">
                          Active Staff
                        </p>
                        <p className="text-xl font-bold text-gray-900">3</p>
                        <p className="text-[11px] text-gray-500">
                          1 admin · 2 staff
                        </p>
                      </div>
                    </div>

                    {/* Mini chart bar */}
                    <div className="flex items-end gap-1 h-12 px-2">
                      {[
                        35, 50, 42, 60, 55, 72, 68, 80, 75, 90, 85, 95, 88, 70,
                        60, 50, 45, 55, 65, 78, 85, 92, 88, 75,
                      ].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm bg-primary/20 hover:bg-primary/40 transition-colors"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 text-center">
                      Hourly sales trend
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ──────────── STATS BAR ──────────── */}
        <section className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">
                  <Counter end={500} suffix="+" />
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Restaurants Onboarded
                </p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">
                  <Counter end={50000} suffix="+" />
                </p>
                <p className="text-sm text-gray-600 mt-1">Orders Processed</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">
                  <Counter end={99} suffix="%" />
                </p>
                <p className="text-sm text-gray-600 mt-1">Uptime Reliability</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-bold text-primary">
                  <Counter end={24} suffix="/7" />
                </p>
                <p className="text-sm text-gray-600 mt-1">Customer Support</p>
              </div>
            </div>
          </div>
        </section>

        {/* ──────────── FEATURES ──────────── */}
        <section id="features" className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-2xl mx-auto mb-16">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full mb-4">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Core Features
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Everything your restaurant needs
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Three powerful modules that work together seamlessly —
                  designed for busy counters, small teams, and owners who want
                  clarity.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: MonitorSmartphone,
                  color: "bg-blue-50 text-blue-600",
                  title: "Lightning-Fast POS",
                  desc: "Create orders in 2 taps. Supports dine-in, takeaway & delivery with cash, card, or online payments.",
                  points: [
                    "Instant order creation",
                    "Discount & coupon support",
                    "Auto-synced with your menu",
                    "End-of-day sales reports",
                  ],
                },
                {
                  icon: Package,
                  color: "bg-amber-50 text-amber-600",
                  title: "Smart Inventory",
                  desc: "Link every dish to its ingredients. Stock updates automatically with every completed order.",
                  points: [
                    "Auto stock deduction",
                    "Low-stock alerts",
                    "Cost price tracking",
                    "Units in kg, liter, piece",
                  ],
                },
                {
                  icon: Globe2,
                  color: "bg-emerald-50 text-emerald-600",
                  title: "Free Restaurant Website",
                  desc: "Every restaurant gets a professional website on their own subdomain — instantly, at zero extra cost.",
                  points: [
                    "Auto-generated on signup",
                    "Live menu always in sync",
                    "Online ordering ready",
                    "Custom branding & colors",
                  ],
                },
              ].map((feature, i) => (
                <Reveal key={feature.title} delay={i * 150}>
                  <div className="group h-full rounded-2xl border border-gray-200 bg-white p-6 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
                    <div
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.color} mb-5`}
                    >
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                      {feature.desc}
                    </p>
                    <ul className="space-y-2">
                      {feature.points.map((p) => (
                        <li
                          key={p}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Secondary features grid */}
            <div className="grid gap-6 md:grid-cols-3 mt-8">
              {[
                {
                  icon: BarChart3,
                  title: "Daily Reports & Analytics",
                  desc: "Revenue, profit, cost breakdown, and top-selling items — all in real-time dashboards.",
                },
                {
                  icon: Users,
                  title: "Multi-Role Staff Access",
                  desc: "Owner, admin, cashier, kitchen staff — each role sees only what they need.",
                },
                {
                  icon: ShoppingBag,
                  title: "Online Orders",
                  desc: "Accept orders directly from your website. Customers browse, order, and pay online.",
                },
              ].map((f, i) => (
                <Reveal key={f.title} delay={i * 100}>
                  <div className="flex gap-4 p-5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-md transition-all duration-300">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                      <f.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-1">
                        {f.title}
                      </h4>
                      <p className="text-sm text-gray-600">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── ABOUT ──────────── */}
        <section id="about" className="py-20 md:py-28 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <Reveal>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full mb-4">
                    <Utensils className="w-3.5 h-3.5" />
                    About Us
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                    Built by people who understand restaurants
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    Eats Desk was born from a simple frustration: most
                    restaurant software is either too complex, too expensive, or
                    not built for how Pakistani restaurants actually work.
                    We&apos;re changing that.
                  </p>
                  <p className="text-gray-600 leading-relaxed mb-8">
                    Our platform is designed from the ground up for fast-food
                    counters, dine-in restaurants, and delivery kitchens across
                    Pakistan. From Islamabad to Karachi, we help restaurant
                    owners focus on food — not spreadsheets.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: ChefHat, text: "Restaurant-first design" },
                      { icon: Zap, text: "Fast & lightweight" },
                      { icon: ShieldCheck, text: "Secure multi-tenant" },
                      { icon: TrendingUp, text: "Grow with confidence" },
                    ].map((item) => (
                      <div
                        key={item.text}
                        className="flex items-center gap-3 text-sm text-gray-700"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                          <item.icon className="w-4 h-4" />
                        </div>
                        {item.text}
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={200}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                      <p className="text-3xl font-bold text-primary mb-1">
                        10min
                      </p>
                      <p className="text-sm text-gray-600">
                        Average setup time
                      </p>
                    </div>
                    <div className="rounded-2xl bg-primary text-white p-6">
                      <p className="text-3xl font-bold mb-1">3x</p>
                      <p className="text-sm text-white/80">
                        Faster order processing
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-8">
                    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                      <p className="text-3xl font-bold text-primary mb-1">
                        40%
                      </p>
                      <p className="text-sm text-gray-600">
                        Less inventory waste
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gray-900 text-white p-6">
                      <p className="text-3xl font-bold mb-1">Free</p>
                      <p className="text-sm text-gray-400">
                        Restaurant website included
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ──────────── HOW IT WORKS ──────────── */}
        <section id="how-it-works" className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-2xl mx-auto mb-16">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full mb-4">
                  <Clock className="w-3.5 h-3.5" />
                  How It Works
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Up and running in 4 simple steps
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  A simple, repeatable flow that matches how your restaurant
                  already operates.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-8 md:grid-cols-4">
              {[
                {
                  step: "01",
                  title: "Create Your Account",
                  desc: "Sign up, add your restaurant name and basic details. Your free website is generated instantly.",
                  icon: ShoppingBag,
                },
                {
                  step: "02",
                  title: "Set Up Your Menu",
                  desc: "Add categories, items, prices and images. Link each dish to inventory ingredients.",
                  icon: Utensils,
                },
                {
                  step: "03",
                  title: "Start Taking Orders",
                  desc: "Staff log in to POS, create orders and close bills. Inventory updates automatically.",
                  icon: MonitorSmartphone,
                },
                {
                  step: "04",
                  title: "Track & Grow",
                  desc: "Review daily reports, monitor costs and profits. Make data-driven decisions.",
                  icon: TrendingUp,
                },
              ].map((item, i) => (
                <Reveal key={item.step} delay={i * 150}>
                  <div className="relative text-center group">
                    {/* Connector line */}
                    {i < 3 && (
                      <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gray-200 group-hover:bg-primary/30 transition-colors" />
                    )}
                    <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/5 text-primary mb-5 group-hover:bg-primary group-hover:text-white transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:-translate-y-1">
                      <item.icon className="w-8 h-8" />
                      <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow-lg">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── TESTIMONIALS ──────────── */}
        <section id="testimonials" className="py-20 md:py-28 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-2xl mx-auto mb-16">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full mb-4">
                  <Star className="w-3.5 h-3.5" />
                  Testimonials
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Loved by restaurant owners
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Hear from business owners who transformed their operations
                  with Eats Desk.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  name: "Ahmed Khan",
                  role: "Owner, Taste Bistro",
                  city: "Islamabad",
                  text: "Eats Desk replaced our paper system completely. The POS is incredibly fast and my staff picked it up in one day. The automatic inventory tracking alone saves us hours every week.",
                  stars: 5,
                },
                {
                  name: "Fatima Riaz",
                  role: "Manager, Spice Garden",
                  city: "Lahore",
                  text: "We used to lose track of stock constantly. Now every order automatically deducts ingredients. The low-stock alerts mean we never run out during dinner rush anymore.",
                  stars: 5,
                },
                {
                  name: "Omar Siddiqui",
                  role: "Owner, Burger Station",
                  city: "Karachi",
                  text: "The free website was a huge bonus. Customers found us on Google and started ordering online. Our revenue went up 30% in the first month. Incredible value for the price.",
                  stars: 5,
                },
              ].map((t, i) => (
                <Reveal key={t.name} delay={i * 150}>
                  <div className="h-full rounded-2xl bg-white border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star
                          key={j}
                          className="w-4 h-4 text-amber-400 fill-amber-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-6 flex-1">
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {t.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {t.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t.role} · {t.city}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── PRICING ──────────── */}
        <section id="pricing" className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-2xl mx-auto mb-16">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full mb-4">
                  Pricing
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Simple, transparent pricing
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Flexible pricing plans for restaurants of all sizes. All
                  include POS, inventory, menu management and a free restaurant
                  website. Start with a <span className="font-semibold">3&nbsp;month</span> free trial.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-3 md:grid-cols-4 max-w-5xl mx-auto">
              {[
                {
                  plan: "Free Trial",
                  price: "Free",
                  currency: "",
                  period: "for 3 months",
                  desc: "Try every feature of Eats Desk free for 3 full months.",
                  features: [
                    "All features included",
                    "Full access for 3 months",
                    "Everything in Enterprise",
                    "Unlimited branches",
                    "Advanced analytics & reports",
                    "POS, KDS & reservations",
                  ],
                  cta: "Start Free Trial",
                  popular: false,
                },
                {
                  plan: "Starter",
                  price: "39",
                  currency: "$",
                  period: "per month",
                  desc: "Perfect for small restaurants getting started.",
                  features: [
                    "Single branch support",
                    "Basic POS system",
                    "Order management",
                    "Menu & inventory tracking",
                    "Customer database",
                    "Free restaurant website",
                    "Sales reports",
                    "Email support",
                  ],
                  cta: "Start Free Trial",
                  popular: false,
                },
                {
                  plan: "Professional",
                  price: "79",
                  currency: "$",
                  period: "per month",
                  desc: "Everything you need to grow your restaurant.",
                  features: [
                    "Up to 5 branches",
                    "Full POS + Kitchen Display System",
                    "Advanced inventory management",
                    "Deals & promotions engine",
                    "Reservations management",
                    "Multi-user with role permissions",
                    "Day-end reports & analytics",
                    "Foodpanda integration",
                    "Custom branded website",
                    "Priority support",
                  ],
                  cta: "Start Free Trial",
                  popular: true,
                },
                {
                  plan: "Enterprise",
                  price: "Contact for pricing",
                  currency: "$",
                  period: "per month (billed quarterly)",
                  desc: "Advanced features for multi-location operations.",
                  features: [
                    "Unlimited branches",
                    "Everything in Professional",
                    "Advanced analytics dashboard",
                    "Custom deal configurations",
                    "API access for integrations",
                    "White-label options",
                    "Dedicated account manager",
                    "Custom feature development",
                    "24/7 priority support",
                  ],
                  cta: "Contact Sales",
                  popular: false,
                },
              ].map((plan, index, i) => (
                <Reveal key={plan.plan} delay={i * 150}>
                  <div
                    className={`relative h-full rounded-2xl p-4 flex flex-col ${
                      plan.popular
                        ? "bg-primary text-white border-2 border-primary shadow-xl shadow-primary/20 scale-[1.02]"
                        : "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300"
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-secondary text-white text-xs font-bold shadow-lg">
                        Most Popular
                      </span>
                    )}
                    <p
                      className={`text-sm font-semibold mb-1 ${plan.popular ? "text-white/80" : "text-gray-500"}`}
                    >
                      {plan.plan}
                    </p>
                    <p className="text-3xl font-bold mb-1">
                     {index === 3 ? "" : plan.currency}
                      {plan.price}
                    </p>
                    <p
                      className={`text-xs mb-3 ${plan.popular ? "text-white/60" : "text-gray-400"}`}
                    >
                      {plan.period}
                    </p>
                    <p
                      className={`text-sm mb-6 ${plan.popular ? "text-white/80" : "text-gray-600"}`}
                    >
                      {plan.desc}
                    </p>

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${plan.popular ? "text-emerald-300" : "text-emerald-500"}`}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href="/signup"
                      className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        plan.popular
                          ? "bg-white text-primary hover:bg-gray-100"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────── FAQ ──────────── */}
        <section id="faq" className="py-20 md:py-28 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Frequently asked questions
                </h2>
                <p className="text-gray-600">
                  Everything you need to know about Eats Desk.
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div>
                <FAQItem
                  question="Is my data safe and separated from other restaurants?"
                  answer="Absolutely. Eats Desk is a multi-tenant platform where each restaurant has its own isolated data space. Your data is never shared with or accessible to other tenants. We use industry-standard encryption and secure authentication."
                />
                <FAQItem
                  question="Do I get a website immediately?"
                  answer="Yes! As soon as you sign up and create your restaurant, a professional website is automatically generated on your subdomain (e.g., yourrestaurant.eatsdesk.com). Your menu syncs in real-time and you can customize branding, colors, and content."
                />
                <FAQItem
                  question="Can staff access reports and analytics?"
                  answer="Staff roles like cashiers only see the POS. Owners, admins, and managers get full access to dashboards, inventory, day reports, and analytics. You control exactly who sees what."
                />
                <FAQItem
                  question="Do you support online ordering?"
                  answer="Yes! Customers can browse your auto-generated website, add items to cart, and place orders with cash-on-delivery. Orders appear instantly in your dashboard alongside POS orders."
                />
                <FAQItem
                  question="What happens when inventory runs low?"
                  answer="The system automatically shows low-stock alerts on your dashboard. Menu items with insufficient inventory are automatically hidden from your website and marked as 'Out of Stock' on POS, so you never sell what you can't make."
                />
                <FAQItem
                  question="Can I try it before paying?"
                  answer="Yes — every new restaurant gets a full 14-day free trial with all features unlocked. No credit card required to start. You can upgrade to a paid plan anytime during or after the trial."
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ──────────── CONTACT ──────────── */}
        <section id="contact" className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2">
              <Reveal>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full mb-4">
                    <Mail className="w-3.5 h-3.5" />
                    Contact Us
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    Get in touch
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-8">
                    Have a question, need a demo, or want to discuss a custom
                    plan for your chain? We&apos;d love to hear from you.
                  </p>

                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Email
                        </p>
                        <p className="text-sm text-gray-600">
                          info.reddev@gmail.com
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Phone / WhatsApp
                        </p>
                        <p className="text-sm text-gray-600">+92 323 155 7988</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Office
                        </p>
                        <p className="text-sm text-gray-600">
                          Islamabad, Pakistan
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={200}>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-5">
                    Send us a message
                  </h3>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setContactError("");
                      setContactSuccess(false);
                      const name = contactName.trim();
                      const phone = contactPhone.trim();
                      const email = contactEmail.trim();
                      const message = contactMessage.trim();
                      if (!name) {
                        setContactError("Name is required.");
                        return;
                      }
                      if (!phone) {
                        setContactError("Phone is required.");
                        return;
                      }
                      if (!email) {
                        setContactError("Email is required.");
                        return;
                      }
                      if (!message) {
                        setContactError("Message is required.");
                        return;
                      }
                      setContactSubmitting(true);
                      try {
                        await submitContact({ name, phone, email, message });
                        setContactSuccess(true);
                        setContactName("");
                        setContactPhone("");
                        setContactEmail("");
                        setContactMessage("");
                      } catch (err) {
                        setContactError(err.message || "Failed to send message. Please try again.");
                      } finally {
                        setContactSubmitting(false);
                      }
                    }}
                  >
                    {contactError && (
                      <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2 rounded-lg">
                        {contactError}
                      </p>
                    )}
                    {contactSuccess && (
                      <p className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-2 rounded-lg">
                        Thank you! Your message has been sent.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Your name"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="03XX-XXXXXXX"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Tell us about your restaurant and how we can help..."
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={contactSubmitting}
                      className="w-full px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {contactSubmitting ? "Sending..." : "Send Message"}
                    </button>
                  </form>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ──────────── CTA BANNER ──────────── */}
        <section className="py-16 bg-primary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Reveal>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to transform your restaurant?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                Join hundreds of restaurant owners who manage their POS,
                inventory, and website — all from one dashboard.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-primary text-base font-bold hover:bg-gray-100 transition-all shadow-lg hover:-translate-y-0.5"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/30 text-white text-base font-semibold hover:bg-white/10 transition-all"
                >
                  Sign In
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ──────────── FOOTER ──────────── */}
        <footer className="bg-gray-900 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-5 mb-12">
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm">
                    ED
                  </span>
                  <div className="text-sm font-bold">Eats Desk</div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  The all-in-one restaurant management platform for Pakistan.
                  POS, inventory, and a free website — from one dashboard.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-4">Product</h4>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li>
                    <a
                      href="#features"
                      className="hover:text-white transition-colors"
                    >
                      Features
                    </a>
                  </li>
                  <li>
                    <a
                      href="#pricing"
                      className="hover:text-white transition-colors"
                    >
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a
                      href="#how-it-works"
                      className="hover:text-white transition-colors"
                    >
                      How it works
                    </a>
                  </li>
                  <li>
                    <a
                      href="#faq"
                      className="hover:text-white transition-colors"
                    >
                      FAQ
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-4">Company</h4>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li>
                    <a
                      href="#about"
                      className="hover:text-white transition-colors"
                    >
                      About us
                    </a>
                  </li>
                  <li>
                    <a
                      href="#contact"
                      className="hover:text-white transition-colors"
                    >
                      Contact
                    </a>
                  </li>
                  <li>
                    <a
                      href="#testimonials"
                      className="hover:text-white transition-colors"
                    >
                      Testimonials
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-4">Legal</h4>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li>
                    <Link
                      href="/privacy-policy"
                      className="hover:text-white transition-colors"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms-and-conditions"
                      className="hover:text-white transition-colors"
                    >
                      Terms & Conditions
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-4">Get Started</h4>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  <li>
                    <Link
                      href="/signup"
                      className="hover:text-white transition-colors"
                    >
                      Start free trial
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="hover:text-white transition-colors"
                    >
                      Sign in
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
              <p>
                &copy; {new Date().getFullYear()} Eats Desk. All rights
                reserved.
              </p>
              <p>Made with ❤️ for restaurants in Pakistan.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
