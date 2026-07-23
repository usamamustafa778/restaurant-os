import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Lock,
  MapPin,
  Route,
  Smartphone,
  Wallet,
  DollarSign,
} from "lucide-react";

const RIDER_FEATURES = [
  {
    icon: Smartphone,
    title: "Rider mobile app",
    desc: "Riders see assigned deliveries, addresses, and payment details on their phone.",
  },
  {
    icon: MapPin,
    title: "Live delivery status",
    desc: "Track what’s out for delivery and what’s overdue from one operations board.",
  },
  {
    icon: Wallet,
    title: "Cash reconciliation",
    desc: "Capture COD and wallet collections per stop so end-of-day totals match.",
  },
  {
    icon: DollarSign,
    title: "Per-rider earnings",
    desc: "Fees, payouts, and hand-ins stay clear — fewer disputes at shift close.",
  },
  {
    icon: Route,
    title: "Assignment workflow",
    desc: "Assign or reassign riders from POS and keep the kitchen–dispatch handoff tight.",
  },
  {
    icon: Bike,
    title: "Fleet overview",
    desc: "See who’s on delivery, idle, or blocked from taking new orders at a glance.",
  },
];

/**
 * Marketing presentation shown when the restaurant has not subscribed to Riders.
 * Route stays available — access to the live riders portal is withheld until active.
 */
export default function RidersLockedPresentation() {
  return (
    <div className="flex h-full min-h-[inherit] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-gray-100 dark:border-neutral-800">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(12,10,9,0.97) 0%, rgba(28,25,23,0.94) 42%, rgba(67,20,7,0.88) 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 30%, rgba(249,115,22,0.32), transparent 40%), radial-gradient(circle at 85% 15%, rgba(251,146,60,0.18), transparent 36%)",
          }}
          aria-hidden
        />

        <div className="relative flex flex-1 items-center px-6 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
              <Lock className="h-3 w-3" />
              Module not active
            </span>
            <h2 className="mt-4 font-black tracking-tight text-white">
              <span className="block text-3xl sm:text-4xl xl:text-5xl">
                Riders portal and app
              </span>
              <span className="mt-1 block text-xl font-semibold text-orange-300 sm:text-2xl xl:text-3xl">
                Dispatch, collect, reconcile
              </span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300 sm:text-base">
              Give every rider a live order list and give managers a fleet view for
              assignments, COD, and payouts — without end-of-night spreadsheets.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:-translate-y-0.5"
              >
                Enable Riders
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-stone-400">
                Or ask your restaurant admin to turn on Riders in Subscription.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-orange-400" />
                Rider app
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-orange-400" />
                Live status
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-orange-400" />
                COD clarity
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
        {RIDER_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex gap-3 bg-white p-5 dark:bg-neutral-950 sm:p-6 lg:px-8 lg:py-7"
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

      <div className="flex flex-col gap-3 border-t border-gray-100 bg-stone-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Your Riders page stays here — unlock the module to manage fleet, COD,
          and payouts.
        </p>
        <Link
          href="/subscription"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-2"
        >
          View subscription options
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
