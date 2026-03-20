import AdminLayout from "../../components/layout/AdminLayout";
import { Bot, MessageCircle, Phone, Sparkles, Zap } from "lucide-react";

export default function AiAgentsPage() {
  return (
    <AdminLayout title="AI Agents">
      <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden px-4 py-10 md:py-14">
        {/* Ambient background */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-90 dark:opacity-100"
          aria-hidden
        >
          <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/25" />
          <div className="absolute -right-10 bottom-20 h-80 w-80 rounded-full bg-secondary/25 blur-3xl dark:bg-secondary/20" />
          <div className="absolute left-1/2 top-1/3 h-px w-[min(100%,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>

        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {/* Icon cluster */}
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 blur-xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-secondary p-[2px] shadow-2xl shadow-primary/30">
              <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-white dark:bg-neutral-950">
                <Bot className="h-12 w-12 text-primary" strokeWidth={1.75} aria-hidden />
              </div>
            </div>
            <div className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg ring-4 ring-white dark:ring-neutral-950">
              <Sparkles className="h-4 w-4" aria-hidden />
            </div>
          </div>

          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary dark:border-primary/30 dark:bg-primary/15 dark:text-primary">
            <Zap className="h-3.5 w-3.5" />
            On the way
          </div>

          <h1 className="max-w-xl text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-4xl lg:text-5xl lg:max-w-2xl">
            <span className="block">Turn more guests into orders</span>
            <span className="mt-1 block bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              with AI on chat &amp; phone
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-gray-600 dark:text-neutral-300">
            Answer faster, catch guests before they bounce, and keep the rush under control &mdash; so
            the same traffic rings more sales without piling work on your crew.
          </p>

          <p className="mt-2 text-sm font-semibold text-primary dark:text-primary">
            Coming soon &mdash; be first in line when it drops.
          </p>

          {/* Feature cards */}
          <div className="mt-12 grid w-full gap-4 text-left sm:grid-cols-2">
            <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 p-5 shadow-lg shadow-primary/5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 dark:border-neutral-800 dark:bg-neutral-900/90">
              <div className="absolute right-3 top-3 opacity-10 transition group-hover:opacity-20">
                <MessageCircle className="h-16 w-16 text-primary" />
              </div>
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h2 className="relative mt-4 text-lg font-bold text-gray-900 dark:text-white">
                Website chat
              </h2>
              <p className="relative mt-1 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
                Catch guests while they&apos;re hungry: instant answers, fewer drop-offs, and a clearer
                path to checkout on your public site.
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 p-5 shadow-lg shadow-secondary/5 transition hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-xl hover:shadow-secondary/10 dark:border-neutral-800 dark:bg-neutral-900/90">
              <div className="absolute right-3 top-3 opacity-10 transition group-hover:opacity-20">
                <Phone className="h-16 w-16 text-secondary" />
              </div>
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-primary/10 text-secondary">
                <Phone className="h-5 w-5" />
              </div>
              <h2 className="relative mt-4 text-lg font-bold text-gray-900 dark:text-white">
                Voice &amp; call agent
              </h2>
              <p className="relative mt-1 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
                Never miss a ring: capture reservations and order calls, answer FAQs, and route to
                staff when it&apos;s time to close the sale.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
              Coming soon
            </span>
            <span className="text-sm text-gray-500 dark:text-neutral-500">
              Settings &amp; conversation history will land here.
            </span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
