import { useState } from "react";
import {
  X,
  Sparkles,
  Bot,
  Zap,
  BarChart3,
  MessageCircle,
  ShoppingCart,
  Users,
  Bell,
  CheckCircle,
} from "lucide-react";

const AI_FEATURES = [
  {
    icon: MessageCircle,
    title: "WhatsApp Order Taker",
    description:
      "AI takes orders on WhatsApp automatically. No human needed.",
    status: "live",
    badge: "Beta",
  },
  {
    icon: BarChart3,
    title: "AI Sales Analyst",
    description:
      "Daily sales summary on WhatsApp. Ask anything about your business.",
    status: "coming",
    badge: "Coming Soon",
  },
  {
    icon: Bell,
    title: "AI Kitchen Manager",
    description: "Real-time inventory alerts. Know before you run out.",
    status: "coming",
    badge: "Coming Soon",
  },
  {
    icon: Users,
    title: "AI Customer Service",
    description:
      "Handles complaints and follow-ups automatically on WhatsApp.",
    status: "coming",
    badge: "Coming Soon",
  },
  {
    icon: Zap,
    title: "AI Marketing Agent",
    description:
      "Win back lost customers with personalized WhatsApp campaigns.",
    status: "coming",
    badge: "Coming Soon",
  },
  {
    icon: ShoppingCart,
    title: "AI Inventory Purchaser",
    description: "Automatically contacts suppliers when stock runs low.",
    status: "coming",
    badge: "Coming Soon",
  },
  {
    icon: Bot,
    title: "Voice AI Receptionist",
    description: "Answers phone calls and takes orders in Urdu & English.",
    status: "coming",
    badge: "Coming Soon",
  },
];

export default function AISidebar({ isOpen, onClose, restaurantName }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleWaitlist(e) {
    e.preventDefault();
    if (!email.trim()) return;
    // TODO: wire to actual waitlist API
    setSubmitted(true);
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-[95vw] bg-white dark:bg-neutral-950 shadow-2xl flex flex-col border-l border-gray-200 dark:border-neutral-800 animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                EatsDesk AI
              </h2>
              <p className="text-xs text-gray-500 dark:text-neutral-500">
                Intelligent restaurant operations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-neutral-500 leading-relaxed">
            AI agents that run your restaurant automatically — orders,
            inventory, marketing, and more.
          </p>

          {AI_FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            const isLive = feature.status === "live";
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  isLive
                    ? "border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10"
                    : "border-gray-100 bg-gray-50/50 dark:border-neutral-800 dark:bg-neutral-900/50"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isLive
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-violet-100 dark:bg-violet-900/30"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isLive
                        ? "text-green-600 dark:text-green-400"
                        : "text-violet-600 dark:text-violet-400"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                      {feature.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        isLive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
                      }`}
                    >
                      {feature.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-neutral-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Waitlist footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-800 bg-gradient-to-b from-transparent to-violet-50/50 dark:to-violet-900/10 flex-shrink-0">
          {!submitted ? (
            <>
              <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300 mb-1">
                🚀 Get early access
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mb-3">
                Join the waitlist — we&apos;ll notify you when AI features go
                live for{restaurantName ? ` ${restaurantName}` : " your restaurant"}.
              </p>
              <form onSubmit={handleWaitlist} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-800 dark:text-neutral-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 transition-all flex-shrink-0"
                >
                  Join
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center gap-2.5 py-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                  You&apos;re on the list!
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-500">
                  We&apos;ll email you when AI features launch.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
