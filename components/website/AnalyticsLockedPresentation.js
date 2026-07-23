import Link from "next/link";
import {
  ArrowRight,
  Eye,
  Globe,
  Lock,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

const OUTCOME_BULLETS = [
  "See which pages bring orders — and which ones waste attention",
  "Prove add-on revenue from modifiers and upsells on your storefront",
  "Stop guessing mobile vs desktop — fix the experience guests actually use",
];

const ANALYTICS_FEATURES = [
  {
    icon: Eye,
    title: "Traffic At A Glance",
    desc: "Page views, unique visitors, and daily trends — so you know if the storefront is working before lunch rush.",
  },
  {
    icon: ShoppingBag,
    title: "Add-On Revenue Proof",
    desc: "See how modifiers and upsells lift online order value. Marketing spend gets a clearer return story.",
  },
  {
    icon: Globe,
    title: "Top Pages & Sources",
    desc: "Know which pages convert and where guests arrive from — then double down on what pays.",
  },
  {
    icon: Smartphone,
    title: "Device Breakdown",
    desc: "Mobile vs desktop mix so you optimize the experience that drives most of your orders.",
  },
  {
    icon: Users,
    title: "Visitor Clarity",
    desc: "Understand repeat interest vs one-time browsers — and shape promotions around real behavior.",
  },
  {
    icon: TrendingUp,
    title: "Period Comparisons",
    desc: "Compare weeks and months so campaign wins (and drops) are obvious — not buried in feelings.",
  },
];

/**
 * Full-bleed marketing presentation when Website Analytics is not subscribed.
 */
export default function AnalyticsLockedPresentation() {
  return (
    <div className="flex h-full min-h-[inherit] w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-gray-100 dark:border-neutral-800 min-h-[22rem] sm:min-h-[26rem]">
        <div
          className="absolute inset-0 bg-cover bg-[center_right] bg-no-repeat"
          style={{
            backgroundImage: "url(/images/analytics/analytics-hero.jpg)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(12,10,9,0.94) 0%, rgba(28,25,23,0.82) 38%, rgba(41,37,36,0.48) 68%, rgba(67,20,7,0.2) 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "radial-gradient(circle at 16% 30%, rgba(249,115,22,0.24), transparent 44%), radial-gradient(circle at 88% 40%, rgba(251,146,60,0.12), transparent 40%)",
          }}
          aria-hidden
        />

        <div className="relative flex flex-1 items-center px-6 py-8 sm:px-8 lg:px-10">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                <Lock className="h-3 w-3" />
                Available Add-On
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                <Wallet className="h-3 w-3" />
                Turns Visits Into Decisions
              </span>
            </div>

            <h2 className="mt-4 font-black tracking-tight text-white">
              <span className="block text-3xl sm:text-4xl xl:text-5xl">
                Website Analytics
              </span>
              <span className="mt-1.5 block text-xl font-semibold text-orange-300 sm:text-2xl xl:text-3xl">
                Stop Guessing What Your Storefront Earns
              </span>
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-stone-300 sm:text-base">
              Website Analytics shows traffic, top pages, devices, and add-on
              revenue from your own ordering site — so menu and marketing choices
              are backed by numbers, not hunches.
            </p>

            <ul className="mt-4 space-y-1.5 text-sm text-stone-200">
              {OUTCOME_BULLETS.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 text-sm font-bold text-white shadow-lg shadow-orange-950/45 transition hover:-translate-y-0.5 hover:shadow-orange-950/55"
              >
                Unlock Website Analytics
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="max-w-[14rem] text-xs leading-snug text-stone-400">
                Enable it in Subscription — or ask your restaurant admin to
                activate Analytics.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-orange-400" />
                Live Traffic
              </span>
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
                Add-On Proof
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                Smarter Promos
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
        {ANALYTICS_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex gap-3 bg-white p-5 dark:bg-neutral-950 sm:p-6"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <feature.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-neutral-400 sm:text-[13px]">
                {feature.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gradient-to-r from-orange-50/90 to-stone-50 px-6 py-4 dark:border-neutral-800 dark:from-orange-950/30 dark:to-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-xs text-gray-600 dark:text-neutral-400">
          A storefront without analytics is a menu you can’t measure. Unlock
          Website Analytics and invest in what actually converts.
        </p>
        <Link
          href="/subscription"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-orange-700 hover:underline underline-offset-2 dark:text-orange-300"
        >
          See Subscription Options
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
