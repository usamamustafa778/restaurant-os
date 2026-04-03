import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
  Landmark,
  BookOpen,
  List,
} from "lucide-react";
import { VOUCHER_PAGE_LINKS, VOUCHER_PAGES_PREFIX } from "./voucherNavConfig";

const ICONS = {
  cash_payment: ArrowUpCircle,
  cash_receipt: ArrowDownCircle,
  bank_payment: Building2,
  bank_receipt: Landmark,
  journal: BookOpen,
  list: List,
};

function normalizePath(p) {
  if (!p) return "";
  return p.split("?")[0].replace(/\/$/, "") || "";
}

export default function VoucherPagesNav({ className = "" }) {
  const router = useRouter();
  const current = normalizePath(router.pathname);
  const prefixNorm = normalizePath(VOUCHER_PAGES_PREFIX);

  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 shadow-sm backdrop-blur-sm ${className}`.trim()}
    >
      <nav
        className="flex flex-wrap sm:flex-nowrap items-stretch gap-1 p-1 sm:p-1.5 overflow-x-auto"
        aria-label="Voucher entry types"
      >
        {VOUCHER_PAGE_LINKS.map((item) => {
          const Icon = ICONS[item.key] || List;
          const target = normalizePath(item.href);
          const isActive =
            item.key === "list"
              ? current === prefixNorm
              : current === target;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`
                inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-2 text-xs font-semibold transition-all min-h-[2.5rem] sm:min-h-0
                ${
                  isActive
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-orange-400/30"
                    : "text-gray-600 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white border border-transparent hover:border-gray-200 dark:hover:border-neutral-700"
                }
              `}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${isActive ? "opacity-95" : "opacity-70"}`}
                aria-hidden
              />
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.shortLabel || item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
