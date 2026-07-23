import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  Lock,
  Package,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Upload,
  Wallet,
} from "lucide-react";

const OUTCOME_BULLETS = [
  "Stop mid-rush stockouts that force 86s and lost tickets",
  "Know what’s on the shelf before you place the next purchase order",
  "Catch shrinkage early with adjustments and a clear movement trail",
];

const INVENTORY_FEATURES = [
  {
    icon: Boxes,
    title: "Stock You Can Trust By Branch",
    desc: "Live on-hand counts per location — so managers order from reality, not memory.",
  },
  {
    icon: AlertTriangle,
    title: "Low-Stock Alerts That Protect Service",
    desc: "Set thresholds and spot what’s running out before the dinner rush hits an empty bin.",
  },
  {
    icon: ClipboardList,
    title: "Adjustments In Seconds",
    desc: "Receive, correct, or write off stock fast — every change leaves an audit trail.",
  },
  {
    icon: PackageSearch,
    title: "Movement History That Settles Debates",
    desc: "See who changed what and when across shifts. Counts stay trustworthy under pressure.",
  },
  {
    icon: Upload,
    title: "CSV Import & Export For Purchasing",
    desc: "Bulk load items from a spreadsheet or export reports your suppliers and accountants need.",
  },
  {
    icon: TrendingDown,
    title: "Cost Visibility Next To The Shelf",
    desc: "Keep cost prices beside stock so purchasing and menu costing stay aligned.",
  },
];

/**
 * Marketing presentation when Inventory is not subscribed.
 */
export default function InventoryLockedPresentation() {
  return (
    <div className="flex h-full min-h-[inherit] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-gray-100 dark:border-neutral-800">
        <div
          className="absolute inset-0 bg-cover bg-[center_right] bg-no-repeat"
          style={{
            backgroundImage: "url(/images/inventory/inventory-hero.jpg)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(12,10,9,0.94) 0%, rgba(28,25,23,0.82) 38%, rgba(41,37,36,0.5) 68%, rgba(67,20,7,0.22) 100%)",
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

        <div className="relative flex flex-1 items-center px-6 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                <Lock className="h-3 w-3" />
                Available Add-On
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100">
                <Wallet className="h-3 w-3" />
                Stops Waste & Stockouts
              </span>
            </div>

            <h2 className="mt-4 font-black tracking-tight text-white">
              <span className="block text-3xl sm:text-4xl xl:text-5xl">
                Inventory
              </span>
              <span className="mt-1.5 block text-xl font-semibold text-orange-300 sm:text-2xl xl:text-3xl">
                Know What’s On The Shelf
              </span>
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-stone-300 sm:text-base">
              Turn your storeroom into a controlled asset — live counts, low-stock
              alerts, and a clear trail of every adjustment so purchasing stays
              ahead of service.
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
                Unlock Inventory
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="max-w-[14rem] text-xs leading-snug text-stone-400">
                Enable it in Subscription — or ask your restaurant admin to turn
                on Inventory for this branch.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-orange-400" />
                Live Stock Counts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                Low-Stock Alerts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-400" />
                Shrinkage Control
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                Cleaner Purchasing
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
        {INVENTORY_FEATURES.map((feature) => (
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

      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gradient-to-r from-orange-50/90 to-stone-50 px-6 py-4 dark:border-neutral-800 dark:from-orange-950/30 dark:to-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p className="text-xs text-gray-600 dark:text-neutral-400">
          Food sitting uncounted is money you can’t see. Unlock Inventory and run
          purchasing from the shelf, not from guesswork.
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
