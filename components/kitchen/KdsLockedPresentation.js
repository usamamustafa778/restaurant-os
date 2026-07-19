import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ChefHat,
  Clock3,
  LayoutGrid,
  Lock,
  MonitorSmartphone,
  Timer,
  Volume2,
  Zap,
} from "lucide-react";

const KDS_FEATURES = [
  {
    icon: LayoutGrid,
    title: "Live ticket board",
    desc: "New, cooking, and ready columns update in real time so every station knows what’s next.",
  },
  {
    icon: Timer,
    title: "Urgency that can’t be missed",
    desc: "Aging tickets change color and rise in priority before service slows down.",
  },
  {
    icon: BellRing,
    title: "Instant new-order alerts",
    desc: "Sound and visual cues when something hits the kitchen — no more missed chits.",
  },
  {
    icon: MonitorSmartphone,
    title: "Built for the pass",
    desc: "Large touch targets, filter presets, and a layout that works on tablets or kitchen screens.",
  },
  {
    icon: Volume2,
    title: "Station-ready controls",
    desc: "Mute, dismiss stale ready tickets, and tune filters without leaving the board.",
  },
  {
    icon: Zap,
    title: "Faster handoffs",
    desc: "One tap moves tickets from new → cooking → ready so runners and cashiers stay in sync.",
  },
];

const SAMPLE_TICKETS = [
  {
    col: "New",
    tone: "border-amber-400/50 bg-amber-500/10",
    items: [
      { token: "0142", meta: "Dine-in · Table 4", age: "0:42" },
      { token: "0143", meta: "Takeaway", age: "1:08" },
    ],
  },
  {
    col: "Cooking",
    tone: "border-orange-500/50 bg-orange-500/10",
    items: [
      { token: "0139", meta: "Delivery", age: "6:15" },
      { token: "0140", meta: "Dine-in · Table 2", age: "4:02" },
    ],
  },
  {
    col: "Ready",
    tone: "border-emerald-500/50 bg-emerald-500/10",
    items: [{ token: "0137", meta: "Takeaway", age: "11:20" }],
  },
];

/**
 * Marketing presentation shown when the restaurant has not subscribed to KDS.
 * Route stays available — access to the live board is withheld until the module is active.
 */
export default function KdsLockedPresentation() {
  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-gray-100 dark:border-neutral-800">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #1c1917 0%, #292524 42%, #431407 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 30%, rgba(249,115,22,0.35), transparent 40%), radial-gradient(circle at 85% 15%, rgba(251,146,60,0.22), transparent 36%)",
          }}
          aria-hidden
        />

        <div className="relative grid gap-8 px-6 py-9 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-11">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
              <Lock className="h-3 w-3" />
              Module not active
            </span>
            <h2 className="mt-4 font-black tracking-tight text-white">
              <span className="block text-3xl sm:text-4xl">Kitchen Display</span>
              <span className="mt-1 block text-xl font-semibold text-orange-300 sm:text-2xl">
                Run a calmer, faster kitchen
              </span>
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-300">
              Replace paper tickets and shouted updates with a live board your
              whole kitchen can trust — so tickets move, food leaves on time, and
              nothing gets lost on the pass.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:-translate-y-0.5"
              >
                Enable Kitchen Display
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-stone-400">
                Or ask your restaurant admin to turn on KDS in Subscription.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-orange-400" />
                Less ticket chaos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ChefHat className="h-3.5 w-3.5 text-orange-400" />
                Clear station view
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-orange-400" />
                Faster handoffs
              </span>
            </div>
          </div>

          {/* Simulated board */}
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-2xl backdrop-blur-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
                <ChefHat className="h-4 w-4 text-orange-400" />
                Live preview
              </div>
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                Sample board
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_TICKETS.map((column) => (
                <div key={column.col} className="min-w-0 space-y-2">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    {column.col}
                  </p>
                  {column.items.map((ticket, idx) => (
                    <div
                      key={ticket.token}
                      className={`rounded-xl border px-2.5 py-2 transition ${column.tone} ${
                        idx === 0 ? "ring-2 ring-orange-400/30" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-black tabular-nums text-white">
                          #{ticket.token}
                        </span>
                        <span className="text-[10px] font-semibold tabular-nums text-orange-200">
                          {ticket.age}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-stone-300">
                        {ticket.meta}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
        {KDS_FEATURES.map((feature) => (
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
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-neutral-400">
                {feature.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="flex flex-col gap-3 border-t border-gray-100 bg-stone-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Your kitchen page stays here — unlock KDS to replace this preview with
          the live ticket board.
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
