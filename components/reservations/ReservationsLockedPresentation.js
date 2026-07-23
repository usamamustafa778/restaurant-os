import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Clock3,
  Lock,
  PhoneCall,
  Sparkles,
  Table2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

const OUTCOME_BULLETS = [
  "Turn empty seats into booked covers — especially Friday and Saturday nights",
  "Cut no-shows with guest name, phone, and party size ready for a quick confirm",
  "Stop overbooking the same table while walk-ins wait at the door",
];

const RESERVATIONS_FEATURES = [
  {
    icon: TrendingUp,
    title: "More Covers, Less Guesswork",
    desc: "See tonight’s demand before the rush — open the right tables and stop leaving money on empty chairs.",
  },
  {
    icon: Users,
    title: "Every Guest Arrives Expected",
    desc: "Name, phone, party size, and notes on every booking so hosts greet with confidence.",
  },
  {
    icon: Table2,
    title: "Tables That Stay In Sync",
    desc: "Assign, seat, and free tables as parties move. Walk-ins and reservations share one floor.",
  },
  {
    icon: UserCheck,
    title: "Status That Matches The Door",
    desc: "Pending → confirmed → seated → done (or no-show). The shift knows who’s next.",
  },
  {
    icon: PhoneCall,
    title: "Protect The Night From No-Shows",
    desc: "Contact details live with the booking. One confirm call can save a whole table’s revenue.",
  },
  {
    icon: CalendarDays,
    title: "Plan The Week, Not Just Tonight",
    desc: "Spot busy nights early, staff accordingly, and fill soft nights with bookings.",
  },
];

/**
 * Marketing presentation when Reservations is not subscribed.
 */
export default function ReservationsLockedPresentation() {
  return (
    <div className="flex h-full min-h-[inherit] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-gray-100 dark:border-neutral-800">
        <div
          className="absolute inset-0 bg-cover bg-[center_right] bg-no-repeat"
          style={{
            backgroundImage: "url(/images/reservations/reservations-hero.jpg)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(4,47,46,0.94) 0%, rgba(15,118,110,0.78) 38%, rgba(19,78,74,0.42) 68%, rgba(19,78,74,0.18) 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 16% 30%, rgba(45,212,191,0.22), transparent 44%), radial-gradient(circle at 88% 40%, rgba(251,191,36,0.14), transparent 40%)",
          }}
          aria-hidden
        />

        <div className="relative flex flex-1 items-center px-6 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/35 bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-100">
                <Lock className="h-3 w-3" />
                Available Add-On
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                <TrendingUp className="h-3 w-3" />
                Pays For Itself In Covers
              </span>
            </div>

            <h2 className="mt-4 font-black tracking-tight text-white">
              <span className="block text-3xl sm:text-4xl xl:text-5xl">
                Reservations
              </span>
              <span className="mt-1.5 block text-xl font-semibold text-teal-200 sm:text-2xl xl:text-3xl">
                Stop Leaving Tables Empty
              </span>
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-teal-50/90 sm:text-base">
              Turn your host stand into a revenue tool — planned seatings, fewer
              double-books, and a clear picture of tonight before the first guest
              walks in.
            </p>

            <ul className="mt-4 space-y-1.5 text-sm text-teal-50/95">
              {OUTCOME_BULLETS.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 text-sm font-bold text-stone-950 shadow-lg shadow-teal-950/40 transition hover:-translate-y-0.5 hover:shadow-teal-950/50"
              >
                Unlock Reservations
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="max-w-[14rem] text-xs leading-snug text-teal-100/75">
                Enable it in Subscription — or ask your EatsDesk admin to activate
                it for this restaurant.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-teal-100/75">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-amber-300" />
                Full Cover Plan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-amber-300" />
                Calmer Seatings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Host-Ready Board
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
        {RESERVATIONS_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex gap-3 bg-white p-5 dark:bg-neutral-950 sm:p-6 lg:px-8 lg:py-7"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
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

      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gradient-to-r from-teal-50/90 to-stone-50 px-6 py-4 dark:border-neutral-800 dark:from-teal-950/35 dark:to-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p className="text-xs text-gray-600 dark:text-neutral-400">
          Empty chairs are the most expensive inventory you have. Unlock
          Reservations and turn the host stand into booked revenue.
        </p>
        <Link
          href="/subscription"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-teal-800 hover:underline underline-offset-2 dark:text-teal-300"
        >
          See Subscription Options
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
