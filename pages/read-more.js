import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Star,
  Zap,
  TrendingUp,
  Users,
  Clock,
  BarChart3,
  ShieldCheck,
  Utensils,
  ChefHat,
  MonitorSmartphone,
  Globe2,
  Package,
  Play,
  Phone,
  Calendar,
} from "lucide-react";
import SEO from "../components/SEO";

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
      { threshold }
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
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── FAQ Accordion ───────────────────────────────────────────────────── */
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
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
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

/* ─── Star Rating ─────────────────────────────────────────────────────── */
function Stars({ count = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

/* ─── Case Study Card ─────────────────────────────────────────────────── */
function CaseStudyCard({ name, type, before, after, result, tag, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="bg-primary/5 border-b border-primary/10 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900 text-sm">{name}</p>
            <p className="text-xs text-gray-500">{type}</p>
          </div>
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {tag}
          </span>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">
              Before
            </p>
            {before.map((b, i) => (
              <p key={i} className="text-xs text-gray-600 mb-1 flex gap-1.5">
                <span className="text-red-400 mt-0.5">✕</span> {b}
              </p>
            ))}
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2">
              After
            </p>
            {after.map((a, i) => (
              <p key={i} className="text-xs text-gray-600 mb-1 flex gap-1.5">
                <span className="text-green-500 mt-0.5">✓</span> {a}
              </p>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5">
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-gray-500 mb-0.5">Key Result</p>
            <p className="font-bold text-gray-900 text-sm">{result}</p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ─── Testimonial Card ────────────────────────────────────────────────── */
function TestimonialCard({ name, role, quote, initials, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <Stars />
        <p className="mt-4 text-sm text-gray-700 leading-relaxed">
          &ldquo;{quote}&rdquo;
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500">{role}</p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   READ MORE PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export default function ReadMore() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [vslPlaying, setVslPlaying] = useState(false);

  const faqs = [
    {
      question: "How quickly can my restaurant be up and running on Eats Desk?",
      answer:
        "Most restaurants are fully operational within 48 hours. Our onboarding team walks you through menu setup, table configuration, and staff training at no extra cost. You'll take your first order on the system within the same week.",
    },
    {
      question: "Do I need to buy any special hardware?",
      answer:
        "No expensive hardware required. Eats Desk runs on any Android tablet, iPad, or laptop you already own. If you want a dedicated POS terminal, we can recommend affordable options — but it's entirely optional.",
    },
    {
      question: "What happens to my data if I cancel?",
      answer:
        "Your data always belongs to you. Before cancelling, you can export your full order history, customer list, and menu data in CSV format. We hold your data securely for 90 days post-cancellation in case you change your mind.",
    },
    {
      question: "Can I manage multiple branches from one account?",
      answer:
        "Yes. Eats Desk is built for multi-branch operations. You can monitor live orders, sales, inventory, and staff across all your branches from a single dashboard. Branch-level reports help you compare performance instantly.",
    },
    {
      question: "Is there a long-term contract or can I cancel anytime?",
      answer:
        "No lock-in contracts. You can cancel anytime with zero cancellation fees. We offer monthly billing and annual billing (with a discount). We earn your business every single month — that's our commitment.",
    },
    {
      question: "Does the free website work with online ordering?",
      answer:
        "Yes. Your branded website includes a fully functional online ordering page. Customers can browse your menu, place orders, and track their delivery — all without any third-party commission fees eating into your margins.",
    },
    {
      question: "How is Eats Desk different from other POS systems?",
      answer:
        "Most POS systems give you a billing machine. Eats Desk gives you a full operations platform: POS, inventory, customer management, kitchen display, analytics, and a free website — all in one place. Plus, it's built specifically for Pakistani restaurants and supports local payment methods.",
    },
    {
      question: "What kind of support do I get?",
      answer:
        "Every plan includes WhatsApp and email support. Professional and Enterprise plans get priority support with a dedicated account manager. Our average response time is under 2 hours during business hours.",
    },
    {
      question: "Is my restaurant's data secure?",
      answer:
        "Absolutely. All data is encrypted in transit and at rest. We run daily backups and our servers are hosted on enterprise-grade cloud infrastructure. Your sales data, customer records, and menu information are never shared with third parties.",
    },
    {
      question: "Who is this best suited for?",
      answer:
        "Eats Desk works best for dine-in restaurants, cafes, fast food outlets, and cloud kitchens in Pakistan that are doing at least 50+ orders per day and want to stop losing money to manual errors, slow service, and zero visibility into their numbers.",
    },
  ];

  const caseStudies = [
    {
      name: "Spice Garden Restaurant",
      type: "Dine-in · Lahore",
      tag: "45% Revenue Increase",
      before: [
        "Manual order-taking causing errors",
        "No inventory visibility",
        "15-min average table wait time",
      ],
      after: [
        "Digital POS with zero billing errors",
        "Real-time stock alerts",
        "8-min average table turn time",
      ],
      result: "Revenue up 45% in 3 months · Staff reduced errors by 90%",
    },
    {
      name: "The Coffee Lab",
      type: "Café Chain · 3 Branches · Islamabad",
      tag: "3× Faster Service",
      before: [
        "Separate systems per branch",
        "No consolidated reporting",
        "Customer re-orders from memory",
      ],
      after: [
        "Unified dashboard for all 3 branches",
        "Daily P&L report in one click",
        "Customer order history saved",
      ],
      result: "Saved 12 hrs/week in admin · Customer retention up 30%",
    },
    {
      name: "Burger Barn",
      type: "Fast Food · Karachi",
      tag: "Zero Food Waste",
      before: [
        "Over-ordering raw materials weekly",
        "No online ordering capability",
        "End-of-night cash reconciliation errors",
      ],
      after: [
        "Smart inventory consumption tracking",
        "Free branded website with online orders",
        "Automated daily cash reports",
      ],
      result: "Food wastage eliminated · Online orders = 28% of revenue",
    },
  ];

  const testimonials = [
    {
      name: "Ahmed Raza",
      role: "Owner, Spice Garden Restaurant · Lahore",
      initials: "AR",
      quote:
        "We were running on pen and paper for 6 years. After switching to Eats Desk, our billing errors dropped to zero and we can actually see which items are making us money. The free website alone paid for the subscription in the first month.",
    },
    {
      name: "Sara Khan",
      role: "Manager, The Coffee Lab · Islamabad",
      initials: "SK",
      quote:
        "Managing 3 branches was a nightmare before. Now I check everything from my phone before my morning coffee is done. The branch comparison report helped us realize one location was underperforming — and we fixed it within a week.",
    },
    {
      name: "Bilal Hussain",
      role: "Founder, Burger Barn · Karachi",
      initials: "BH",
      quote:
        "I was skeptical about switching from our old system. The onboarding team set everything up in 2 days and trained my entire staff. We started taking online orders through our free website within the same week. Game changer.",
    },
  ];

  return (
    <>
      <SEO
        title="How Eats Desk Transforms Restaurants | Real Results, Real Restaurants"
        description="See exactly how Eats Desk helps Pakistani restaurants increase revenue, eliminate errors, and run smoother operations. Book a free demo today."
        keywords="restaurant management system Pakistan, restaurant POS Lahore Karachi Islamabad, restaurant software demo, Eats Desk case studies"
      />
      <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

        {/* ──────────── HEADER ──────────── */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-sm">
                  ED
                </span>
                <div>
                  <div className="text-sm font-bold tracking-tight text-gray-900">
                    Eats Desk
                  </div>
                  <div className="text-[10px] text-gray-500 -mt-0.5">
                    Restaurant &amp; Cafe Operations Desk
                  </div>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
                <a href="#why-us" className="hover:text-primary transition-colors">Why Us</a>
                <a href="#results" className="hover:text-primary transition-colors">Results</a>
                <a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a>
                <a href="#testimonials" className="hover:text-primary transition-colors">Testimonials</a>
                <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
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
                  Book Free Demo
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                    />
                  </svg>
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <div className="md:hidden pb-4 border-t border-gray-100 mt-2 pt-4 space-y-3">
                {["why-us", "results", "how-it-works", "testimonials", "faq"].map((id) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-sm text-gray-600 hover:text-primary capitalize"
                  >
                    {id.replace(/-/g, " ")}
                  </a>
                ))}
                <Link href="/login" className="block text-sm font-medium text-gray-700">
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════════
            1. HERO — Headline + Sub-headline + CTAs
        ══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/5 border border-primary/15 px-3 py-1.5 rounded-full mb-6">
                <Zap className="w-3.5 h-3.5" />
                500+ Restaurants Already Running on Eats Desk
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
                Fill More Tables. Run Faster.{" "}
                <span className="text-primary">Keep More Profit.</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-3 leading-relaxed">
                The complete restaurant management system that replaces your manual chaos with
                a single, smart operations platform.
              </p>
              <p className="text-base text-gray-400 max-w-xl mx-auto mb-10">
                Without hiring extra staff, managing multiple spreadsheets, or losing sales
                to slow manual processes.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Book Your Free Demo Call
                </Link>
                <a
                  href="#results"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:border-primary/40 hover:text-primary transition-all text-sm"
                >
                  See Real Results
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <p className="mt-5 text-xs text-gray-400 flex items-center justify-center gap-4">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> 14-day free trial
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Setup in 48 hours
                </span>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2. SOCIAL PROOF BAR — Stats
        ══════════════════════════════════════════════════════════ */}
        <section className="border-y border-gray-100 bg-gray-50/60 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: "500+", label: "Restaurants Onboarded" },
                { value: "₨2.4B+", label: "Orders Processed" },
                { value: "48 hrs", label: "Average Go-Live Time" },
                { value: "4.9/5", label: "Average Client Rating" },
              ].map((stat, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            3. TRUSTED BY — Logos / Restaurant Types
        ══════════════════════════════════════════════════════════ */}
        <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">
              Trusted by restaurants, cafés &amp; cloud kitchens across Pakistan
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Utensils, label: "Dine-in Restaurants" },
              { icon: ChefHat, label: "Cloud Kitchens" },
              { icon: Package, label: "Fast Food Chains" },
              { icon: Globe2, label: "Café Groups" },
              { icon: Users, label: "Multi-Branch Outlets" },
              { icon: MonitorSmartphone, label: "Takeaway Counters" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 shadow-sm">
                  <item.icon className="w-4 h-4 text-primary" />
                  {item.label}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4. VSL SECTION
        ══════════════════════════════════════════════════════════ */}
        <section className="py-16 bg-gray-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* VSL Video Placeholder */}
              <Reveal>
                <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 aspect-video flex items-center justify-center group cursor-pointer"
                  onClick={() => setVslPlaying(true)}
                >
                  {!vslPlaying ? (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/10" />
                      <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 text-white fill-white ml-1" />
                        </div>
                        <p className="text-sm text-white/70">Watch: How Eats Desk Works (3 min)</p>
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                        <span className="text-xs text-white/40 bg-black/40 rounded px-2 py-1">3:12</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <div key={s} className={`h-1 rounded-full ${s <= 2 ? "bg-primary w-6" : "bg-white/20 w-4"}`} />
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-white/50 text-sm">Video would play here</p>
                    </div>
                  )}
                </div>
              </Reveal>

              {/* VSL Copy */}
              <Reveal delay={100}>
                <div>
                  <span className="inline-block text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mb-5">
                    THE #1 RESTAURANT OPERATIONS PLATFORM IN PAKISTAN
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-5">
                    See the full picture of your restaurant — in real time
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    Eats Desk is trusted by 500+ restaurants, cafés, and food businesses across
                    Pakistan. From a single outlet to a multi-branch chain, our platform gives you
                    complete visibility and control over every order, every rupee, and every
                    customer — all from one screen.
                  </p>
                  <ul className="space-y-3 mb-8">
                    {[
                      "Live POS + Kitchen Display System",
                      "Real-time inventory & wastage tracking",
                      "Free branded website with online ordering",
                      "Multi-branch management from one dashboard",
                    ].map((point, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/30"
                  >
                    Book a Free Demo
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5. WHY US — USP Section
        ══════════════════════════════════════════════════════════ */}
        <section id="why-us" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Why Choose Eats Desk
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                Not just a POS. A complete{" "}
                <span className="text-primary">operations upgrade.</span>
              </h2>
              <p className="text-gray-500 text-sm max-w-xl mx-auto">
                Most restaurant software gives you a billing screen and nothing else.
                Eats Desk gives your whole business a central nervous system.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: "Orders processed in under 30 seconds",
                desc: "Our touch-optimised POS is built for speed. Your staff takes orders, splits bills, and prints receipts faster than any traditional system — eliminating queue frustration and turning tables quicker.",
              },
              {
                icon: BarChart3,
                title: "Know your numbers before you close",
                desc: "Daily P&L, top-selling items, staff performance, and cash reconciliation — all available by the end of the night. No more guessing if you made a profit today.",
              },
              {
                icon: TrendingUp,
                title: "Stop losing money to food waste",
                desc: "Smart inventory tracking ties every menu item to its ingredients. You get real-time alerts when stock is low, consumption reports, and wastage tracking that pays for the subscription every month.",
              },
              {
                icon: Globe2,
                title: "Free website with zero commission online orders",
                desc: "Every Eats Desk account comes with a branded website and online ordering page. Keep 100% of your revenue — no third-party platform fees eating into your margins.",
              },
            ].map((usp, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <usp.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-2">{usp.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{usp.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6. CASE STUDIES — Portfolio / Results
        ══════════════════════════════════════════════════════════ */}
        <section id="results" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Real Results
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                  Restaurants that made the switch
                </h2>
                <p className="text-gray-500 text-sm max-w-xl mx-auto">
                  Numbers don&apos;t lie. Here&apos;s what happened when these restaurants
                  replaced manual systems with Eats Desk.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6">
              {caseStudies.map((cs, i) => (
                <CaseStudyCard key={i} {...cs} delay={i * 100} />
              ))}
            </div>

            <Reveal delay={200}>
              <div className="text-center mt-10">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 text-sm"
                >
                  Get Results Like These
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            7. HOW IT WORKS — Process Section
        ══════════════════════════════════════════════════════════ */}
        <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                How It Works
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                From sign-up to first order in{" "}
                <span className="text-primary">48 hours</span>
              </h2>
              <p className="text-gray-500 text-sm max-w-xl mx-auto">
                We don&apos;t drop a software link and disappear. Our team sets everything
                up and trains your staff — so you hit the ground running.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connector line (desktop) */}
            <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

            {[
              {
                step: "01",
                icon: Phone,
                title: "Discovery Call",
                desc: "We learn your restaurant's specific setup — branch structure, menu size, and pain points. This call is free and takes 20 minutes.",
              },
              {
                step: "02",
                icon: MonitorSmartphone,
                title: "System Setup & Configuration",
                desc: "Our team configures your menu, tables, branches, and staff roles. We handle the technical setup — you don't touch a line of code.",
              },
              {
                step: "03",
                icon: Users,
                title: "Staff Training",
                desc: "We train your cashiers, managers, and kitchen staff on the POS and kitchen display. Most teams are confident within 2 hours.",
              },
              {
                step: "04",
                icon: TrendingUp,
                title: "Go Live & Grow",
                desc: "Start taking orders on day one. We monitor your first week and optimise your setup based on real order flow data.",
              },
            ].map((step, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="relative bg-white border border-gray-200 rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="absolute -top-3.5 left-5 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {step.step}
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mt-2">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-2">{step.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            8. SOCIAL PROOF — Testimonials
        ══════════════════════════════════════════════════════════ */}
        <section id="testimonials" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Testimonials
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                  Restaurant owners who&apos;ve made the switch
                </h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Stars />
                  <span className="text-sm font-semibold text-gray-700">4.9/5</span>
                  <span className="text-sm text-gray-400">from 500+ restaurants</span>
                </div>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <TestimonialCard key={i} {...t} delay={i * 100} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            9. THE PROMISE — Trust Section
        ══════════════════════════════════════════════════════════ */}
        <section className="py-16 bg-primary">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 text-white text-center">
              {[
                {
                  icon: ShieldCheck,
                  title: "No Long-Term Contract",
                  desc: "Cancel anytime. No lock-in, no cancellation fees. We earn your business every month.",
                },
                {
                  icon: Clock,
                  title: "2-Hour Support Response",
                  desc: "Reach us on WhatsApp or email. We respond within 2 hours during business hours.",
                },
                {
                  icon: CheckCircle2,
                  title: "14-Day Free Trial",
                  desc: "Try Eats Desk with full features, no credit card needed. Cancel if it&apos;s not for you.",
                },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div>
                    <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-white/75 leading-relaxed">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            10. FAQ SECTION
        ══════════════════════════════════════════════════════════ */}
        <section id="faq" className="py-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                FAQ
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                Questions before you book?
              </h2>
              <p className="text-gray-500 text-sm">
                Everything restaurant owners want to know before switching systems.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden px-6">
              {faqs.map((faq, i) => (
                <FAQItem key={i} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="text-center mt-10">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 text-sm"
              >
                Still have questions? Book a free call
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ══════════════════════════════════════════════════════════
            11. FINAL CTA — Footer Push
        ══════════════════════════════════════════════════════════ */}
        <section className="py-24 bg-gray-950 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full mb-6">
                <Zap className="w-3.5 h-3.5" />
                Join 500+ restaurants running smarter
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
                Ready to stop running your restaurant{" "}
                <span className="text-primary">on guesswork?</span>
              </h2>
            </Reveal>

            <Reveal delay={160}>
              <p className="text-gray-400 text-base mb-10 leading-relaxed">
                Book a free 20-minute demo call. We&apos;ll show you exactly how Eats Desk works
                for your type of restaurant — and what results you can expect in 90 days.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-2xl shadow-primary/40 hover:shadow-primary/50 hover:-translate-y-0.5 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Book Your Free Demo Call
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-xl border border-white/15 text-white/80 hover:border-white/30 hover:text-white transition-all text-sm"
                >
                  Back to Home
                </Link>
              </div>
              <p className="mt-5 text-xs text-gray-500">
                No commitment. No credit card. Cancel anytime.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ──────────── FOOTER ──────────── */}
        <footer className="bg-gray-950 border-t border-white/5 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white font-bold text-xs">
                ED
              </span>
              <div>
                <div className="text-xs font-bold tracking-tight text-white">Eats Desk</div>
                <div className="text-[10px] text-gray-500 -mt-0.5">Restaurant Operations Platform</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <Link href="/privacy-policy" className="hover:text-gray-300 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms-and-conditions" className="hover:text-gray-300 transition-colors">
                Terms
              </Link>
              <Link href="/login" className="hover:text-gray-300 transition-colors">
                Sign In
              </Link>
            </div>
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} Eats Desk. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
