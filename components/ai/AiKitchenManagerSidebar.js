import { X, ChefHat, Sparkles } from "lucide-react";

/**
 * Lightweight coming-soon drawer for kitchen staff (AI Kitchen Manager).
 */
export default function AiKitchenManagerSidebar({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl dark:bg-neutral-950 dark:shadow-black/50 animate-[aiKitchenSlideIn_0.22s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-kitchen-manager-title"
      >
        <style jsx>{`
          @keyframes aiKitchenSlideIn {
            from {
              transform: translateX(100%);
              opacity: 0.85;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>

        <header className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <ChefHat className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="ai-kitchen-manager-title"
              className="text-base font-bold text-gray-900 dark:text-white"
            >
              AI Kitchen Manager
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">
              Smart kitchen assistance
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
            <Sparkles className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              Coming soon
            </p>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-neutral-400">
              AI Kitchen Manager will help with prep timing, inventory alerts,
              and kitchen insights — right from this screen.
            </p>
          </div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
            Coming soon
          </span>
        </div>
      </aside>
    </div>
  );
}
