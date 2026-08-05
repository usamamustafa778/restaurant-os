import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Boxes,
  CalendarClock,
  Crown,
  Globe,
  LayoutGrid,
  Lock,
  MessageCircle,
  MonitorSmartphone,
  Truck,
} from "lucide-react";
import { getTenantSubscriptionSummary } from "../../lib/apiClient";

/** Upsell order — highest-value add-ons first.
 *  Dedicated Overview slots handle Accounts, WhatsApp, Inventory,
 *  Kitchen, Website Analytics, and Reservations. */
const UPSSELL_ORDER = ["rider", "waiterApp"];

const MODULE_META = {
  aiReceptionist: {
    key: "aiReceptionist",
    label: "WhatsApp Receptionist",
    icon: Bot,
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/25",
    cta: "Unlock to go live",
    href: "/whatsapp",
  },
  inventory: {
    key: "inventory",
    label: "Inventory",
    icon: Boxes,
    gradient: "from-sky-500 to-blue-600",
    shadow: "shadow-sky-500/25",
    cta: "Unlock stock health",
    href: "/dashboard/inventory",
  },
  kds: {
    key: "kds",
    label: "Kitchen Display",
    icon: LayoutGrid,
    gradient: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/25",
    cta: "Unlock kitchen board",
    href: "/kitchen",
  },
  rider: {
    key: "rider",
    label: "Riders Portal",
    icon: Truck,
    gradient: "from-cyan-500 to-teal-600",
    shadow: "shadow-cyan-500/25",
    cta: "Unlock rider ops",
    href: "/riders",
  },
  reservations: {
    key: "reservations",
    label: "Reservations",
    icon: CalendarClock,
    gradient: "from-fuchsia-500 to-pink-600",
    shadow: "shadow-fuchsia-500/25",
    cta: "Unlock bookings",
    href: "/reservations",
  },
  websiteAnalytics: {
    key: "websiteAnalytics",
    label: "Website Analytics",
    icon: Globe,
    gradient: "from-indigo-500 to-blue-600",
    shadow: "shadow-indigo-500/25",
    cta: "Unlock web insights",
    href: "/website-settings?section=analytics",
  },
  waiterApp: {
    key: "waiterApp",
    label: "Waiter App",
    icon: MonitorSmartphone,
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/25",
    cta: "Unlock waiter app",
    href: "/subscription",
  },
};

function StatCell({ label, value, tone = "text-gray-900 dark:text-white" }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900/70">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-extrabold tabular-nums leading-tight ${tone}`}>
        {value}
      </p>
    </div>
  );
}

const DASH = "—";

function EmptyBar() {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800" />
  );
}

function PreviewBody({ moduleKey }) {
  switch (moduleKey) {
    case "aiReceptionist":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell label="Open chats" value={DASH} tone="text-emerald-600 dark:text-emerald-400" />
            <StatCell label="Orders today" value={DASH} />
            <StatCell label="Avg reply" value={DASH} tone="text-sky-600 dark:text-sky-400" />
          </div>
          <div className="space-y-1.5 rounded-xl border border-gray-100 p-2 dark:border-neutral-800">
            {["Latest chat", "Active order", "AI reply"].map((label) => (
              <div key={label} className="flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-500 dark:text-neutral-400">
                  {label}
                </p>
                <span className="shrink-0 text-[10px] font-bold text-gray-400 dark:text-neutral-500">
                  {DASH}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case "inventory":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-4 gap-1.5">
            <StatCell label="Items" value={DASH} tone="text-sky-600 dark:text-sky-400" />
            <StatCell label="Healthy" value={DASH} tone="text-emerald-600 dark:text-emerald-400" />
            <StatCell label="Low" value={DASH} tone="text-amber-600 dark:text-amber-400" />
            <StatCell label="Out" value={DASH} tone="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="rounded-xl border border-dashed border-gray-200 px-3 py-2 text-[11px] text-gray-400 dark:border-neutral-700 dark:text-neutral-500">
            Needs attention · {DASH}
          </div>
        </div>
      );

    case "kds":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell label="Preparing" value={DASH} tone="text-amber-600 dark:text-amber-400" />
            <StatCell label="Ready" value={DASH} tone="text-emerald-600 dark:text-emerald-400" />
            <StatCell label="Avg bump" value={DASH} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {["Ticket", "Ticket", "Ticket", "Ticket"].map((t, i) => (
              <div
                key={`${t}-${i}`}
                className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-[10px] font-bold text-gray-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500"
              >
                {t} · {DASH}
              </div>
            ))}
          </div>
        </div>
      );

    case "rider":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell label="On road" value={DASH} tone="text-cyan-600 dark:text-cyan-400" />
            <StatCell label="Delivered" value={DASH} />
            <StatCell label="Revenue" value={DASH} />
          </div>
          <div className="space-y-1.5">
            {["Rider 1", "Rider 2", "Rider 3"].map((name) => (
              <div key={name}>
                <div className="mb-0.5 flex justify-between text-[10px] font-semibold">
                  <span className="text-gray-500 dark:text-neutral-400">{name}</span>
                  <span className="text-gray-400">{DASH}</span>
                </div>
                <EmptyBar />
              </div>
            ))}
          </div>
        </div>
      );

    case "reservations":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell label="Today" value={DASH} tone="text-fuchsia-600 dark:text-fuchsia-400" />
            <StatCell label="Covers" value={DASH} />
            <StatCell label="Next" value={DASH} />
          </div>
          <div className="space-y-1.5 rounded-xl border border-gray-100 p-2 dark:border-neutral-800">
            {["Next booking", "Following", "Later"].map((label) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-fuchsia-600/70 dark:text-fuchsia-400/70">
                  {DASH}
                </span>
                <span className="truncate text-[11px] font-semibold text-gray-400 dark:text-neutral-500">
                  {label} · {DASH}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case "websiteAnalytics":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell label="Visitors" value={DASH} tone="text-indigo-600 dark:text-indigo-400" />
            <StatCell label="Orders" value={DASH} />
            <StatCell label="Revenue" value={DASH} />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-semibold text-gray-500">
              <span>Mobile</span>
              <span>{DASH}</span>
            </div>
            <EmptyBar />
            <div className="flex justify-between text-[10px] font-semibold text-gray-500">
              <span>Desktop</span>
              <span>{DASH}</span>
            </div>
            <EmptyBar />
          </div>
          <p className="text-[10px] font-semibold text-indigo-600/80 dark:text-indigo-400/80">
            Top add-on · {DASH}
          </p>
        </div>
      );

    case "waiterApp":
      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <StatCell label="Active" value={DASH} tone="text-amber-600 dark:text-amber-400" />
            <StatCell label="Orders" value={DASH} />
            <StatCell label="Avg ticket" value={DASH} />
          </div>
          <div className="space-y-1.5">
            {["Waiter 1", "Waiter 2", "Waiter 3"].map((name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-2 py-1.5 dark:border-neutral-800"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-500 dark:text-neutral-400">
                    {name}
                  </p>
                  <p className="truncate text-[10px] text-gray-400">Tables · {DASH}</p>
                </div>
                <span className="text-[11px] font-extrabold text-amber-600/70 dark:text-amber-400/70">
                  {DASH}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function PremiumModuleCard({ moduleKey, unlocked = false, href }) {
  const meta = MODULE_META[moduleKey];
  if (!meta) return null;
  return (
    <PreviewCard
      meta={meta}
      unlocked={Boolean(unlocked)}
      href={href || meta.href || "/subscription"}
    />
  );
}

function PreviewCard({ meta, unlocked = false, href }) {
  const Icon = meta.icon;
  const openHref = href || meta.href || "/subscription";

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${meta.gradient}`}
      />

      {/* Card header — same language as live dashboard sections */}
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-3 dark:border-neutral-800 sm:px-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} shadow-md ${meta.shadow}`}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {meta.label}
            </h3>
            {!unlocked && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300">
                <Crown className="h-3 w-3" />
                Premium
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-neutral-500">
            {unlocked ? "Module active" : "Unlock to see live stats"}
          </p>
        </div>
      </div>

      <div className="relative flex-1 p-3.5 sm:p-4">
        <div
          className={unlocked ? undefined : "pointer-events-none select-none"}
          aria-hidden={!unlocked}
        >
          <PreviewBody moduleKey={meta.key} />
        </div>

        {!unlocked && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-neutral-950 dark:via-neutral-950/90" />
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:bottom-4">
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shadow-sm dark:border-amber-500/30 dark:bg-neutral-950/95 dark:text-amber-300">
                <Lock className="h-3 w-3" />
                Locked preview
              </span>
              <Link
                href="/subscription"
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-amber-500/30 transition hover:-translate-y-0.5"
              >
                {meta.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        )}

        {unlocked && (
          <div className="mt-3 flex justify-end">
            <Link
              href={openHref}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
            >
              Open
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Overview upsell: only unpaid modules, shown as report previews
 * (what the owner would see if subscribed), not marketing pitch cards.
 */
export default function PremiumModulesPanel() {
  const [loading, setLoading] = useState(true);
  const [lockedKeys, setLockedKeys] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await getTenantSubscriptionSummary();
        const modules = response?.summary?.billing?.modules;
        if (cancelled) return;
        if (!Array.isArray(modules)) {
          setLockedKeys([]);
          return;
        }
        const active = new Set(
          modules.filter((m) => m?.active && m?.key).map((m) => m.key),
        );
        setLockedKeys(UPSSELL_ORDER.filter((key) => !active.has(key)));
      } catch {
        if (!cancelled) setLockedKeys([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-3 grid gap-3 sm:mb-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
          />
        ))}
      </div>
    );
  }

  const cards = lockedKeys.map((key) => MODULE_META[key]).filter(Boolean);
  if (cards.length === 0) return null;

  return (
    <section className="mb-3 grid gap-3 sm:mb-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((meta) => (
        <PreviewCard key={meta.key} meta={meta} />
      ))}
    </section>
  );
}
