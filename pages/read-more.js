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
  AlertTriangle,
  XCircle,
  Gift,
  Timer,
  Target,
  ArrowDown,
  DollarSign,
  HeartHandshake,
  BadgeCheck,
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
   SALES FUNNEL PAGE
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
        "No lock-in contracts. You can cancel anytime with zero cancellation fees. Your first 3 months are just $1/month, then plans start at $49/month. We offer monthly and annual billing (with a discount). We earn your business every single month.",
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
                <img
                  src="/favicon.png"
                  alt="Eats Desk"
                  className="h-9 w-9 shrink-0 rounded-xl object-cover"
                  width={36}
                  height={36}
                />
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
                <a href="#problem" className="hover:text-primary transition-colors">The Problem</a>
                <a href="#solution" className="hover:text-primary transition-colors">Solution</a>
                <a href="#results" className="hover:text-primary transition-colors">Results</a>
                <a href="#offer" className="hover:text-primary transition-colors">What You Get</a>
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
                {["problem", "solution", "results", "offer", "faq"].map((id) => (
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
            1. HERO — Pain-Focused Headline + Bold Promise
        ══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/5 border border-primary/15 px-3 py-1.5 rounded-full mb-6">
                <Zap className="w-3.5 h-3.5" />
                Trusted by 500+ restaurants across Pakistan
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto">
                Your restaurant is{" "}
                <span className="text-red-500 line-through decoration-red-300/60 decoration-[3px]">
                  bleeding money
                </span>{" "}
                every day you run it{" "}
                <span className="text-primary">manually.</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-3 leading-relaxed">
                Wrong orders. Wasted food. Cash that doesn&apos;t add up. Staff you can&apos;t track.
                And at the end of the month — you still don&apos;t know if you made a profit.
              </p>
              <p className="text-base font-medium text-gray-800 max-w-xl mx-auto mb-10">
                It doesn&apos;t have to be this way. And 500+ restaurant owners already proved it.
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
                  href="#problem"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:border-primary/40 hover:text-primary transition-all text-sm"
                >
                  See What You&apos;re Losing
                  <ArrowDown className="w-4 h-4" />
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <p className="mt-5 text-xs text-gray-400 flex items-center justify-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Just $1/mo for 3 months
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Setup in 48 hours
                </span>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2. SOCIAL PROOF BAR
        ══════════════════════════════════════════════════════════ */}
        <section className="border-y border-gray-100 bg-gray-50/60 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: "500+", label: "Restaurants Onboarded" },
                { value: "$8M+", label: "Orders Processed" },
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
            3. PROBLEM AGITATION — "Is this your restaurant?"
        ══════════════════════════════════════════════════════════ */}
        <section id="problem" className="py-20 bg-gray-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full mb-5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  The Hidden Cost of &ldquo;Running It Manually&rdquo;
                </span>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                  Does any of this sound familiar?
                </h2>
                <p className="text-gray-400 text-sm max-w-xl mx-auto">
                  If you recognize even 3 of these, your restaurant is leaving lakhs on the table every month.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto mb-14">
              {[
                {
                  pain: "End-of-day cash never matches your sales",
                  cost: "Average restaurant loses $200–500/month to untracked cash leakage.",
                },
                {
                  pain: "You find out about a missing ingredient mid-service",
                  cost: "Stockouts cause 12% of customer complaints and lost repeat business.",
                },
                {
                  pain: "Wrong orders go to the kitchen — then get remade on your cost",
                  cost: "Manual order errors waste 5–8% of food cost every single week.",
                },
                {
                  pain: "You have no idea which menu items actually make you money",
                  cost: "Without item-level P&L, most restaurants unknowingly push low-margin dishes.",
                },
                {
                  pain: "You're tracking everything in spreadsheets — or not at all",
                  cost: "Owners spend 10+ hours/week on admin that software handles in seconds.",
                },
                {
                  pain: "Customers order from food apps and you pay 30% commission",
                  cost: "A restaurant doing $5,000/month in delivery loses $1,500 to platform fees alone.",
                },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 60}>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-red-500/30 transition-colors">
                    <div className="flex gap-3 mb-2">
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-semibold text-white">{item.pain}</p>
                    </div>
                    <p className="text-xs text-gray-400 ml-8">{item.cost}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200}>
              <div className="text-center">
                <div className="inline-block bg-red-500/10 border border-red-500/20 rounded-2xl px-8 py-6 max-w-2xl">
                  <p className="text-2xl md:text-3xl font-bold text-white mb-2">
                    Conservative estimate: You&apos;re losing $500–$2,000 every month.
                  </p>
                  <p className="text-sm text-gray-400">
                    Not because your food is bad. Because your <span className="text-red-400 font-semibold">systems</span> are broken.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            4. VSL — "Watch how it works"
        ══════════════════════════════════════════════════════════ */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-12">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  See It In Action
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                  Watch how restaurants fixed this in{" "}
                  <span className="text-primary">48 hours</span>
                </h2>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div
                className="relative rounded-2xl overflow-hidden bg-gray-950 border border-gray-800 aspect-video max-w-4xl mx-auto flex items-center justify-center group cursor-pointer"
                onClick={() => setVslPlaying(true)}
              >
                {!vslPlaying ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/10" />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                      <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                      </div>
                      <p className="text-sm text-white/70 font-medium">
                        Watch: How Eats Desk Stops the Bleeding (3 min)
                      </p>
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
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            5. SOLUTION BRIDGE — "What if..." + Introduce Eats Desk
        ══════════════════════════════════════════════════════════ */}
        <section id="solution" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  The Solution
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-5 max-w-3xl mx-auto">
                  What if you could see every rupee, every order, and every kitchen ticket —{" "}
                  <span className="text-primary">from one screen?</span>
                </h2>
                <p className="text-gray-500 text-base max-w-2xl mx-auto leading-relaxed">
                  Eats Desk replaces your notebooks, spreadsheets, and guesswork with a
                  single operations platform built specifically for restaurants in Pakistan.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
              {[
                {
                  icon: Zap,
                  title: "30-Second Order Processing",
                  desc: "Touch-optimised POS that your staff learns in hours, not days. Bills, splits, discounts, and prints — faster than any manual system.",
                },
                {
                  icon: BarChart3,
                  title: "Real-Time P&L Dashboard",
                  desc: "Know your profit before you close for the night. Top sellers, slow movers, staff performance, and cash reconciliation — all live.",
                },
                {
                  icon: TrendingUp,
                  title: "Smart Inventory Tracking",
                  desc: "Every menu item tied to its ingredients. Automatic stock deduction, low-stock alerts, and wastage reports that pay for the subscription.",
                },
                {
                  icon: Globe2,
                  title: "Free Website + Online Orders",
                  desc: "Your own branded website with an online ordering page. Zero commission. Keep 100% of your delivery revenue.",
                },
              ].map((usp, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all h-full">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <usp.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm mb-2">{usp.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{usp.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200}>
              <div className="text-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Book a Free Demo to See This Live
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            6. CASE STUDIES — Before / After Proof
        ══════════════════════════════════════════════════════════ */}
        <section id="results" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Real Results — Not Promises
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                  These restaurants made the switch.{" "}
                  <span className="text-primary">Here&apos;s what happened.</span>
                </h2>
                <p className="text-gray-500 text-sm max-w-xl mx-auto">
                  Real restaurants. Real numbers. Before and after Eats Desk.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {caseStudies.map((cs, i) => (
                <CaseStudyCard key={i} {...cs} delay={i * 100} />
              ))}
            </div>

            <Reveal delay={200}>
              <div className="text-center">
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
            7. THE OFFER STACK — Everything You Get
        ══════════════════════════════════════════════════════════ */}
        <section id="offer" className="py-20 bg-gray-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full mb-5">
                  <Gift className="w-3.5 h-3.5" />
                  The Complete Package
                </span>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                  Here&apos;s everything you get with Eats Desk
                </h2>
                <p className="text-gray-400 text-sm max-w-xl mx-auto">
                  Most restaurants pay for 4–5 separate tools. With Eats Desk, everything is included in one platform.
                </p>
              </div>
            </Reveal>

            <div className="max-w-3xl mx-auto mb-14">
              {[
                { item: "Full POS System (touch-optimised for speed)", value: "$30/mo value" },
                { item: "Kitchen Display System (KDS) for kitchen staff", value: "$20/mo value" },
                { item: "Real-Time Inventory & Wastage Tracking", value: "$25/mo value" },
                { item: "Customer Management & Order History", value: "$15/mo value" },
                { item: "Multi-Branch Dashboard & Comparison Reports", value: "$25/mo value" },
                { item: "Daily P&L, Sales Reports & Analytics", value: "$20/mo value" },
                { item: "Free Branded Website with Online Ordering", value: "$50/mo value" },
                { item: "Staff Roles & Performance Tracking", value: "$10/mo value" },
                { item: "Dedicated Onboarding + Staff Training", value: "$100 one-time value" },
                { item: "WhatsApp & Email Support (< 2hr response)", value: "Included" },
              ].map((row, i) => (
                <Reveal key={i} delay={i * 40}>
                  <div className={`flex items-center justify-between py-4 px-5 ${i !== 0 ? "border-t border-white/10" : ""}`}>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-sm text-white">{row.item}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">{row.value}</span>
                  </div>
                </Reveal>
              ))}

              <Reveal delay={300}>
                <div className="mt-8 bg-gradient-to-r from-primary/20 to-secondary/15 border border-primary/30 rounded-2xl p-6 text-center">
                  <p className="text-sm text-gray-300 mb-1">Total value if you bought these separately:</p>
                  <p className="text-2xl font-bold text-white line-through decoration-red-400 mb-3">$295+/month</p>
                  <p className="text-sm text-gray-300 mb-1">Your investment with Eats Desk:</p>
                  <p className="text-4xl font-bold text-primary">Just $1/month for 3 months</p>
                  <p className="text-xs text-gray-400 mt-2">Then plans start from just $49/month. Cancel anytime.</p>
                </div>
              </Reveal>
            </div>

            <Reveal delay={350}>
              <div className="text-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-2xl shadow-primary/40 hover:shadow-primary/50 hover:-translate-y-0.5 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Start for $1/Month
                </Link>
                <p className="mt-4 text-xs text-gray-500">
                  $1/mo for 3 months. No contract. Cancel anytime.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            8. HOW IT WORKS — Simple 4-Step Process
        ══════════════════════════════════════════════════════════ */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

            {[
              {
                step: "01",
                icon: Phone,
                title: "Free Discovery Call",
                desc: "We learn your restaurant's setup — branches, menu size, pain points. 20 minutes. Zero pressure.",
              },
              {
                step: "02",
                icon: MonitorSmartphone,
                title: "We Set Everything Up",
                desc: "Our team configures your menu, tables, branches, and staff roles. You don't touch a line of code.",
              },
              {
                step: "03",
                icon: Users,
                title: "Staff Training",
                desc: "We train your cashiers, managers, and kitchen staff live. Most teams are confident within 2 hours.",
              },
              {
                step: "04",
                icon: TrendingUp,
                title: "Go Live & Grow",
                desc: "Start taking orders on day one. We monitor your first week and optimize based on real data.",
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
            9. TESTIMONIALS — Social Proof
        ══════════════════════════════════════════════════════════ */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Don&apos;t Take Our Word For It
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                  Hear it from owners who made the switch
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
            10. COST OF INACTION — "Every day you wait..."
        ══════════════════════════════════════════════════════════ */}
        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full mb-5">
                  <Timer className="w-3.5 h-3.5" />
                  The Cost of Waiting
                </span>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                  Every week you delay costs your restaurant real money
                </h2>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {[
                {
                  period: "This Week",
                  loss: "$200+",
                  desc: "In billing errors, food waste, and missed online orders",
                },
                {
                  period: "This Month",
                  loss: "$800+",
                  desc: "In untracked cash, over-ordered inventory, and zero data insights",
                },
                {
                  period: "This Year",
                  loss: "$10,000+",
                  desc: "In lost revenue that goes straight to competitors who run smarter",
                },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">{item.period}</p>
                    <p className="text-3xl font-bold text-red-600 mb-2">{item.loss}</p>
                    <p className="text-xs text-gray-600">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200}>
              <div className="bg-gradient-to-r from-primary/5 to-green-50 border border-primary/20 rounded-2xl p-8 text-center">
                <p className="text-sm text-gray-600 mb-2">Meanwhile, the cost of fixing all of this?</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">
                  $1/month for your first 3 months. Then $49/mo.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  That&apos;s less than what you spend on one wrong order.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 text-sm"
                >
                  Stop the Bleeding — Book Your Free Demo
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            11. THE GUARANTEE — Risk Reversal
        ══════════════════════════════════════════════════════════ */}
        <section className="py-16 bg-primary">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-10">
                <HeartHandshake className="w-10 h-10 text-white mx-auto mb-4" />
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Our &ldquo;Zero Risk&rdquo; Promise to You
                </h2>
                <p className="text-white/70 text-sm max-w-xl mx-auto">
                  We know switching systems feels risky. So we removed every possible risk.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8 text-white text-center">
              {[
                {
                  icon: ShieldCheck,
                  title: "No Lock-In Contract",
                  desc: "Cancel anytime with zero fees. Monthly or annual billing — your choice. We earn your business every single month.",
                },
                {
                  icon: Clock,
                  title: "< 2 Hour Support",
                  desc: "Reach us on WhatsApp or email. Dedicated account manager on Professional and Enterprise plans.",
                },
                {
                  icon: BadgeCheck,
                  title: "$1/Month for 3 Months",
                  desc: "Full features for just $1/mo. Try everything risk-free. If it's not for you, cancel — no questions asked.",
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
            12. WHO IS THIS FOR — Qualification
        ══════════════════════════════════════════════════════════ */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Is This Right For You?
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                  Eats Desk is built for a specific type of restaurant
                </h2>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Reveal>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Target className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-green-800">This IS for you if...</h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "You run a restaurant, café, fast food outlet, or cloud kitchen in Pakistan",
                      "You process 50+ orders per day and want to scale",
                      "You're tired of guessing your numbers at the end of the month",
                      "You want your own online ordering website (no 30% commissions)",
                      "You manage multiple branches and need one dashboard",
                      "You want a system your staff can learn in hours, not weeks",
                    ].map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal delay={100}>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <XCircle className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-gray-600">This is NOT for you if...</h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "You run a home-based food business with under 10 orders/day",
                      "You're looking for a free app with no support or onboarding",
                      "You don't want to change anything about how you currently operate",
                      "You're outside Pakistan (we're optimized for local payment methods & workflows)",
                    ].map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-gray-500">
                        <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>

            <Reveal delay={200}>
              <p className="text-center mt-10 text-sm text-gray-500">
                Not sure if you fit?{" "}
                <Link href="/signup" className="text-primary font-semibold hover:underline">
                  Book a free call
                </Link>{" "}
                — we&apos;ll tell you honestly.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            13. TRUSTED BY — Restaurant Types
        ══════════════════════════════════════════════════════════ */}
        <section className="py-14 bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            14. FAQ — Objection Handling
        ══════════════════════════════════════════════════════════ */}
        <section id="faq" className="py-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                FAQ
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
                Still have questions?
              </h2>
              <p className="text-gray-500 text-sm">
                Every objection we&apos;ve heard — answered honestly.
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
            15. FINAL CTA — Urgency + Last Push
        ══════════════════════════════════════════════════════════ */}
        <section className="py-24 bg-gray-950 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full mb-6">
                <Zap className="w-3.5 h-3.5" />
                Limited onboarding slots available each month
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
                You read this far for a reason.{" "}
                <span className="text-primary">Your restaurant deserves better.</span>
              </h2>
            </Reveal>

            <Reveal delay={160}>
              <p className="text-gray-400 text-base mb-4 leading-relaxed">
                Every day you run on manual systems, you&apos;re losing money you could be keeping.
                The restaurants that switched to Eats Desk aren&apos;t smarter — they just stopped waiting.
              </p>
              <p className="text-white font-medium text-lg mb-10">
                Book your free 20-minute demo. See exactly what Eats Desk would look like for your restaurant.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-2xl shadow-primary/40 hover:shadow-primary/50 hover:-translate-y-0.5 text-sm"
                >
                  <Calendar className="w-4 h-4" />
                  Book Your Free Demo Call Now
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-xl border border-white/15 text-white/80 hover:border-white/30 hover:text-white transition-all text-sm"
                >
                  Back to Home
                </Link>
              </div>
              <div className="mt-6 flex flex-col items-center gap-2">
                <p className="text-xs text-gray-500 flex items-center justify-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> $1/mo for 3 months
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> No commitment
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Cancel anytime
                  </span>
                </p>
                <p className="text-[11px] text-gray-600">
                  We only onboard a limited number of restaurants per month to ensure quality setup.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ──────────── FOOTER ──────────── */}
        <footer className="bg-gray-950 border-t border-white/5 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/favicon.png"
                alt="Eats Desk"
                className="h-8 w-8 shrink-0 rounded-xl object-cover"
                width={32}
                height={32}
              />
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
