import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Globe2,
  HandHelping,
  Lock,
  MessageCircle,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

const AI_RECEPTIONIST_FEATURES = [
  {
    icon: MessageCircle,
    title: "Answer customers 24/7",
    desc: "Menu, hours, and location — answered instantly in Urdu or English.",
  },
  {
    icon: ShoppingBag,
    title: "Take orders on WhatsApp",
    desc: "Customers order in chat. Confirmed orders go straight to your kitchen.",
  },
  {
    icon: HandHelping,
    title: "Hand off to staff",
    desc: "AI transfers to a manager when a human is needed — no dropped chats.",
  },
  {
    icon: Sparkles,
    title: "Live menu & deals",
    desc: "Responses stay in sync with your menu, deals, and branch availability.",
  },
  {
    icon: Globe2,
    title: "Branch-aware replies",
    desc: "Route customers to the right location and hours without extra scripts.",
  },
  {
    icon: Clock3,
    title: "Configurable AI hours",
    desc: "Run always-on or set custom hours so nights and rushes stay covered.",
  },
];

/**
 * Marketing presentation shown when the restaurant has not subscribed to AI Receptionist.
 * Route stays available — WhatsApp setup and conversations unlock with the module.
 */
export default function AiReceptionistLockedPresentation() {
  return (
    <div className="flex h-full min-h-[inherit] w-full flex-col overflow-hidden bg-white dark:bg-neutral-950">
      {/* Hero */}
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-gray-100 dark:border-neutral-800">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url(/images/whatsapp/ai-receptionist-hero.jpg)",
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
                AI Receptionist
              </span>
              <span className="mt-1 block text-xl font-semibold text-orange-300 sm:text-2xl xl:text-3xl">
                Orders and answers on WhatsApp
              </span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300 sm:text-base">
              Let AI greet guests, answer menu questions, and take orders on
              WhatsApp — so your team spends less time on the phone and more time
              on service.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-5 text-sm font-semibold text-white shadow-lg shadow-orange-900/40 transition hover:-translate-y-0.5"
              >
                Enable AI Receptionist
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-stone-400">
                Or ask your restaurant admin to turn on AI Receptionist in
                Subscription.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-orange-400" />
                Instant answers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-orange-400" />
                WhatsApp orders
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HandHelping className="h-3.5 w-3.5 text-orange-400" />
                Human handoff
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-3">
        {AI_RECEPTIONIST_FEATURES.map((feature) => (
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
          Your AI Receptionist page stays here — unlock to connect WhatsApp and go
          live.
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
