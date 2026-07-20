import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Clock3,
  Lock,
  Phone,
  Table2,
  Users,
  UserCheck,
  Zap,
} from "lucide-react";

const RESERVATIONS_FEATURES = [
  {
    icon: CalendarDays,
    title: "Booking calendar",
    desc: "See today’s covers, tomorrow’s rush, and the full week at a glance — so the floor never gets surprised.",
  },
  {
    icon: Users,
    title: "Guest & party details",
    desc: "Capture name, phone, party size, and special requests so hosts are ready before guests arrive.",
  },
  {
    icon: Table2,
    title: "Table-aware seating",
    desc: "Assign tables, mark seated, and free the floor when parties leave — walk-ins and reservations stay in sync.",
  },
  {
    icon: UserCheck,
    title: "Status that moves with service",
    desc: "Pending → confirmed → seated → completed (or no-show) so every shift knows who’s next.",
  },
  {
    icon: Phone,
    title: "Fewer no-show surprises",
    desc: "Keep contact info and notes on every booking so follow-ups and confirmations are easy.",
  },
  {
    icon: Zap,
    title: "Built for the host stand",
    desc: "Fast filters, quick adds, and a clean board that works on tablet or desktop at the door.",
  },
];

/**
 * Marketing presentation shown when the restaurant has not subscribed to Reservations.
 * Route stays available — booking tools are withheld until the module is active.
 */
export default function ReservationsLockedPresentation() {
  return (
    <div className="flex h-full min-h-[inherit] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      {/* Hero */}
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-gray-100 dark:border-neutral-800">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #0c1a1a 0%, #134e4a 42%, #0f766e 68%, #115e59 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, rgba(45,212,191,0.35), transparent 42%), radial-gradient(circle at 88% 12%, rgba(251,191,36,0.18), transparent 36%), radial-gradient(circle at 70% 80%, rgba(15,118,110,0.45), transparent 40%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />

        <div className="relative flex flex-1 items-center px-6 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-100">
              <Lock className="h-3 w-3" />
              Module not active
            </span>
            <h2 className="mt-4 font-black tracking-tight text-white">
              <span className="block text-3xl sm:text-4xl xl:text-5xl">
                Reservations
              </span>
              <span className="mt-1 block text-xl font-semibold text-teal-200 sm:text-2xl xl:text-3xl">
                Fill tables with confidence
              </span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-teal-50/85 sm:text-base">
              Take bookings, manage covers, and keep the host stand ready for
              walk-ins and reserved parties — so every table turn is planned,
              not guessed.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 text-sm font-semibold text-white shadow-lg shadow-teal-950/40 transition hover:-translate-y-0.5"
              >
                Enable Reservations
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-teal-100/70">
                Or ask your EatsDesk admin to turn on Reservations in Module
                Entitlements.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-teal-100/70">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-amber-300" />
                Smoother seatings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-amber-300" />
                Clear cover plan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                Faster host stand
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
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

      {/* Footer CTA */}
      <div className="flex flex-col gap-3 border-t border-gray-100 bg-stone-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Your reservations page stays here — unlock the module to replace this
          preview with the live booking board.
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
