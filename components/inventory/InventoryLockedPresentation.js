import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardList,
  Lock,
  Package,
  PackageSearch,
  TrendingDown,
  Upload,
} from "lucide-react";

const INVENTORY_FEATURES = [
  {
    icon: Boxes,
    title: "Stock by branch",
    desc: "Track on-hand quantities per location so every branch knows what’s available.",
  },
  {
    icon: AlertTriangle,
    title: "Low-stock alerts",
    desc: "Set thresholds and spot what’s running out before service is interrupted.",
  },
  {
    icon: ClipboardList,
    title: "Quick adjustments",
    desc: "Add, remove, or correct stock in a few taps — with a clear audit trail.",
  },
  {
    icon: PackageSearch,
    title: "Movement history",
    desc: "See who changed what and when, so counts stay trustworthy across shifts.",
  },
  {
    icon: Upload,
    title: "CSV import & export",
    desc: "Bulk load items from a spreadsheet or export reports for purchasing.",
  },
  {
    icon: TrendingDown,
    title: "Cost visibility",
    desc: "Keep cost prices next to stock so purchasing and menu costing stay aligned.",
  },
];

/**
 * Marketing presentation shown when the restaurant has not subscribed to Inventory.
 * Route stays available — access to stock management is withheld until the module is active.
 */
export default function InventoryLockedPresentation() {
  return (
    <div className="flex h-full min-h-[inherit] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      {/* Hero */}
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-gray-100 dark:border-neutral-800">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url(/images/inventory/inventory-hero.jpg)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(12,10,9,0.92) 0%, rgba(28,25,23,0.82) 38%, rgba(28,25,23,0.55) 62%, rgba(67,20,7,0.35) 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 30%, rgba(249,115,22,0.28), transparent 40%), radial-gradient(circle at 85% 15%, rgba(251,146,60,0.16), transparent 36%)",
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
                Inventory
              </span>
              <span className="mt-1 block text-xl font-semibold text-orange-300 sm:text-2xl xl:text-3xl">
                Know what’s on the shelf
              </span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300 sm:text-base">
              Track stock items, low-stock thresholds, and adjustments in one place
              — so purchasing stays ahead of service and nothing runs out mid-rush.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:-translate-y-0.5"
              >
                Enable Inventory
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-stone-400">
                Or ask your restaurant admin to turn on Inventory in Subscription.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-orange-400" />
                Live stock counts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                Low-stock alerts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-orange-400" />
                Clear audit trail
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
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

      {/* Footer CTA */}
      <div className="flex flex-col gap-3 border-t border-gray-100 bg-stone-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Your inventory page stays here — unlock Inventory to manage stock items
          and thresholds.
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
