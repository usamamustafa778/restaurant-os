import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Clock3,
  Globe2,
  Lock,
  MessageCircle,
  Moon,
  ShoppingBag,
  Sparkles,
  UserX,
} from "lucide-react";

const AI_RECEPTIONIST_FEATURES = [
  {
    icon: UserX,
    title: "No human needed on the line",
    desc: "AI greets guests, answers questions, and takes orders — your team stays on the floor, not the phone.",
  },
  {
    icon: Moon,
    title: "Works nights, rushes & holidays",
    desc: "While one staffer can take one call, AI keeps 100+ WhatsApp chats moving at the same time — even at 2 AM.",
  },
  {
    icon: ShoppingBag,
    title: "Orders straight to your kitchen",
    desc: "Confirmed WhatsApp orders land in EatsDesk — no retyping, no missed details.",
  },
  {
    icon: MessageCircle,
    title: "Urdu & English, instantly",
    desc: "Menu, hours, location, and deals — answered in the language your guests actually use.",
  },
  {
    icon: Sparkles,
    title: "Always in sync with your menu",
    desc: "Live items, deals, and branch hours — so AI never promises what you can’t serve.",
  },
  {
    icon: Globe2,
    title: "Branch-aware & handoff-ready",
    desc: "Route to the right location. Escalate to a manager only when you want a human in the loop.",
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
          className="absolute inset-0 bg-cover bg-[center_right] bg-no-repeat"
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
              "linear-gradient(105deg, rgba(12,10,9,0.92) 0%, rgba(28,25,23,0.78) 40%, rgba(28,25,23,0.45) 68%, rgba(67,20,7,0.25) 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 32%, rgba(249,115,22,0.22), transparent 44%), radial-gradient(circle at 88% 40%, rgba(16,185,129,0.14), transparent 40%)",
          }}
          aria-hidden
        />

        <div className="relative flex flex-1 items-center px-6 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-14">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                <Lock className="h-3 w-3" />
                Module not active
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                <Bot className="h-3 w-3" />
                100+ chats at once · No staff needed
              </span>
            </div>

            <h2 className="mt-4 font-black tracking-tight text-white">
              <span className="block text-3xl sm:text-4xl xl:text-5xl">
                Receptionist that never sleeps
              </span>
              <span className="mt-1.5 block text-xl font-semibold text-emerald-300 sm:text-2xl xl:text-3xl">
                Talks to 100+ customers at once
              </span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-300 sm:text-base">
              One human can take one call. AI Receptionist handles a hundred
              WhatsApp chats in parallel — answering questions, taking orders, and
              sending tickets to your kitchen with no hold music and no missed
              messages.
            </p>

            <ul className="mt-4 space-y-1.5 text-sm text-stone-200">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                100+ guests at once — rush hour never overwhelms the front desk
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                No extra receptionist hire — AI covers the line 24/7
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                Urdu + English replies that stay in sync with your menu
              </li>
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/subscription"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition hover:-translate-y-0.5 hover:shadow-emerald-900/50"
              >
                Unlock AI Receptionist
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="max-w-[14rem] text-xs leading-snug text-stone-400">
                Ask your restaurant admin to enable it in Subscription — go live
                on WhatsApp in days, not weeks.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              <span className="inline-flex items-center gap-1.5">
                <UserX className="h-3.5 w-3.5 text-emerald-400" />
                No human on chat
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                100+ at once
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-emerald-400" />
                Never sleeps
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
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
      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gradient-to-r from-emerald-50/80 to-stone-50 px-6 py-4 dark:border-neutral-800 dark:from-emerald-950/30 dark:to-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p className="text-xs text-gray-600 dark:text-neutral-400">
          Stop losing orders to unanswered WhatsApp messages — unlock AI
          Receptionist and let automation run the front desk.
        </p>
        <Link
          href="/subscription"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline underline-offset-2 dark:text-emerald-400"
        >
          See subscription options
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
