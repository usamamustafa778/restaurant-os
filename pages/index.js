import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, MonitorSmartphone, Globe2, Store } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top nav */}
      <header className="border-b border-neutral-900/80 bg-black/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold">
              EO
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">RestaurantOS</div>
              <div className="text-[11px] text-neutral-400">POS • Inventory • Website</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-neutral-300">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How it works
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs border border-neutral-700 text-neutral-200 hover:bg-neutral-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-secondary transition-colors"
            >
              Start free trial
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <section className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center mb-16">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/40 px-2 py-1 rounded-full mb-4">
              <ShieldCheck className="w-3 h-3" />
              Built for Islamabad / Pakistan restaurants
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Run your entire restaurant from{" "}
              <span className="text-primary">one modern system</span>.
            </h1>
            <p className="text-sm text-neutral-300 mb-5 max-w-xl">
              RestaurantOS combines POS, inventory and a professional website into a single, easy‑to‑use
              platform. Every restaurant gets a free branded website the moment they come on board.
            </p>

            <div className="flex flex-wrap gap-3 mb-6">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-secondary transition-colors"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-900 transition-colors"
              >
                View pricing
              </a>
            </div>

            <ul className="space-y-2 text-xs text-neutral-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                POS designed for fast‑moving counters
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Real‑time inventory deduction from every order
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Free restaurant website with auto‑synced menu
              </li>
            </ul>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 bg-primary/10 blur-3xl rounded-3xl" />
            <div className="relative rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 p-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] text-neutral-400">Today&apos;s revenue</p>
                  <p className="text-2xl font-semibold">PKR 128,450</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-[11px] text-neutral-300">
                  <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
                    Live POS
                  </span>
                  <span className="px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/40 flex items-center gap-1">
                    <Globe2 className="w-3 h-3" />
                    Website orders (future)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-3">
                  <p className="text-neutral-400 mb-1 text-[11px]">Orders today</p>
                  <p className="text-lg font-semibold">74</p>
                  <p className="text-[11px] text-emerald-300">+18% vs yesterday</p>
                </div>
                <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-3">
                  <p className="text-neutral-400 mb-1 text-[11px]">Low‑stock items</p>
                  <p className="text-lg font-semibold">5</p>
                  <p className="text-[11px] text-amber-300">Restock before dinner</p>
                </div>
                <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-3">
                  <p className="text-neutral-400 mb-1 text-[11px]">Active staff</p>
                  <p className="text-lg font-semibold">3</p>
                  <p className="text-[11px] text-neutral-300">1 owner • 2 cashiers</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-neutral-950/80 border border-dashed border-neutral-800 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  <div className="text-[11px]">
                    <p className="text-neutral-200">Taste Bistro</p>
                    <p className="text-neutral-500">tastebistro.yourdomain.com</p>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-300">Website auto‑generated</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mb-16">
          <h2 className="text-lg font-semibold mb-2">Everything a modern restaurant needs</h2>
          <p className="text-sm text-neutral-400 mb-6 max-w-2xl">
            RestaurantOS is built for busy counters, small teams and owners who want clear numbers —
            not spreadsheets. Three core modules work together out of the box.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MonitorSmartphone className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Fast POS</h3>
              </div>
              <p className="text-xs text-neutral-300 mb-3">
                Dine‑in / takeaway, discounts, cash or card, instant receipts and end‑of‑day summaries.
              </p>
              <ul className="space-y-1 text-[11px] text-neutral-300">
                <li>• 2‑tap order creation</li>
                <li>• Staff‑friendly interface</li>
                <li>• Auto‑synced with menu</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Inventory that actually updates</h3>
              </div>
              <p className="text-xs text-neutral-300 mb-3">
                Link every menu item to ingredients. Each completed order reduces stock automatically.
              </p>
              <ul className="space-y-1 text-[11px] text-neutral-300">
                <li>• Units in kg / liter / piece</li>
                <li>• Low‑stock alerts</li>
                <li>• Manual adjustments & refills</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Free restaurant website</h3>
              </div>
              <p className="text-xs text-neutral-300 mb-3">
                Every tenant gets a sub‑domain website with live menu and branding. Zero setup cost.
              </p>
              <ul className="space-y-1 text-[11px] text-neutral-300">
                <li>• Auto‑generated on onboarding</li>
                <li>• Managed from the admin dashboard</li>
                <li>• Ready for future online ordering</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mb-16">
          <h2 className="text-lg font-semibold mb-2">How RestaurantOS fits into your day</h2>
          <p className="text-sm text-neutral-400 mb-6 max-w-2xl">
            A simple, repeatable flow that matches how Pakistani restaurants already operate.
          </p>

          <ol className="space-y-4 text-xs text-neutral-300">
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">
                1
              </span>
              <div>
                <p className="font-semibold text-neutral-100">Set up restaurant profile & menu</p>
                <p className="text-neutral-400 mt-1">
                  Add logo, description, categories and items. Your POS and public website use the same data.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              <div>
                <p className="font-semibold text-neutral-100">Link ingredients to dishes</p>
                <p className="text-neutral-400 mt-1">
                  Map burgers, platters and drinks to inventory items. RestaurantOS will take care of stock
                  deduction.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">
                3
              </span>
              <div>
                <p className="font-semibold text-neutral-100">Use POS during service</p>
                <p className="text-neutral-400 mt-1">
                  Staff log in, create orders and close bills. Owners watch revenue and low‑stock in real time.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">
                4
              </span>
              <div>
                <p className="font-semibold text-neutral-100">Review reports at the end of the day</p>
                <p className="text-neutral-400 mt-1">
                  Daily and monthly sales, top‑selling items and stock levels — all from the dashboard.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mb-16">
          <h2 className="text-lg font-semibold mb-2">Transparent pricing for every stage</h2>
          <p className="text-sm text-neutral-400 mb-6 max-w-2xl">
            Simple monthly plans in PKR. All include POS, inventory, menu management and your free restaurant
            website.
          </p>

          <div className="grid gap-4 md:grid-cols-3 text-xs">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 flex flex-col">
              <p className="text-[11px] text-neutral-400 mb-1">Essential</p>
              <p className="text-xl font-semibold mb-1">PKR 9,999</p>
              <p className="text-[11px] text-neutral-500 mb-3">per outlet / month</p>
              <ul className="space-y-1 text-neutral-300 mb-4 flex-1">
                <li>• 1 POS counter</li>
                <li>• Inventory & menu management</li>
                <li>• Free restaurant website</li>
                <li>• 1 admin + 2 staff users</li>
                <li>• Standard support</li>
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-100 hover:bg-neutral-900 transition-colors"
              >
                Start Essential
              </Link>
            </div>

            <div className="rounded-2xl border border-primary bg-neutral-950 p-4 flex flex-col relative">
              <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-semibold">
                Most popular
              </span>
              <p className="text-[11px] text-neutral-400 mb-1">Professional</p>
              <p className="text-xl font-semibold mb-1">PKR 17,999</p>
              <p className="text-[11px] text-neutral-500 mb-3">for high‑volume outlets</p>
              <ul className="space-y-1 text-neutral-300 mb-4 flex-1">
                <li>• Up to 3 POS counters</li>
                <li>• Unlimited staff users</li>
                <li>• Low‑stock alerts</li>
                <li>• Website branding & SEO basics</li>
                <li>• Priority support</li>
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition-colors"
              >
                Start Professional
              </Link>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 flex flex-col">
              <p className="text-[11px] text-neutral-400 mb-1">Enterprise</p>
              <p className="text-xl font-semibold mb-1">PKR 29,999</p>
              <p className="text-[11px] text-neutral-500 mb-3">for chains & serious operators</p>
              <ul className="space-y-1 text-neutral-300 mb-4 flex-1">
                <li>• Multiple branches</li>
                <li>• Centralized analytics</li>
                <li>• Custom domain & branding</li>
                <li>• Dedicated account support</li>
              </ul>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-100 hover:bg-neutral-900 transition-colors"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ / final CTA */}
        <section id="faq" className="mb-16">
          <h2 className="text-lg font-semibold mb-2">Frequently asked questions</h2>
          <div className="grid gap-4 md:grid-cols-2 text-xs text-neutral-300">
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-neutral-100">Is my data safe and separated?</p>
                <p className="text-neutral-400 mt-1">
                  Yes. RestaurantOS is multi‑tenant. Each restaurant has its own isolated data space and
                  role‑based access for owners and staff.
                </p>
              </div>
              <div>
                <p className="font-semibold text-neutral-100">Do I get a website immediately?</p>
                <p className="text-neutral-400 mt-1">
                  As soon as your restaurant is onboarded, a website is generated on a sub‑domain. You control
                  branding and which menu items appear.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <p className="font-semibold text-neutral-100">Can staff access reports?</p>
                <p className="text-neutral-400 mt-1">
                  Staff use the POS only. Owners and managers get access to dashboards, inventory and reports.
                </p>
              </div>
              <div>
                <p className="font-semibold text-neutral-100">Do you support online ordering?</p>
                <p className="text-neutral-400 mt-1">
                  Not in the MVP. The architecture is ready for online ordering and delivery integrations in
                  the next phase.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-100">
                Ready to centralize your restaurant operations?
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Sign in to RestaurantOS to manage POS, inventory and your website from one secure dashboard.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900/80 py-4">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-neutral-500">
          <p>© {new Date().getFullYear()} RestaurantOS. All rights reserved.</p>
          <p>Made for restaurants in Islamabad & Pakistan.</p>
        </div>
      </footer>
    </div>
  );
}

