import Link from "next/link";
import { useRouter } from "next/router";
import {
  CalendarDays,
  BookMarked,
  TrendingDown,
  Wallet,
  FileText,
  Scale,
} from "lucide-react";

const REPORTS_PREFIX = "/dashboard/accounting/reports";

const REPORT_LINKS = [
  { key: "day-book",       href: `${REPORTS_PREFIX}/day-book`,       label: "Day Book",       shortLabel: "Day Book",  Icon: CalendarDays },
  { key: "ledger",         href: `${REPORTS_PREFIX}/ledger`,         label: "Ledger",         shortLabel: "Ledger",    Icon: BookMarked   },
  { key: "profit-loss",    href: `${REPORTS_PREFIX}/profit-loss`,    label: "P&L Statement",  shortLabel: "P&L",       Icon: TrendingDown },
  { key: "cash-statement", href: `${REPORTS_PREFIX}/cash-statement`, label: "Cash Statement", shortLabel: "Cash",      Icon: Wallet       },
  { key: "payables",       href: `${REPORTS_PREFIX}/payables`,       label: "Payables",       shortLabel: "Payables",  Icon: FileText     },
  { key: "balance-sheet",  href: `${REPORTS_PREFIX}/balance-sheet`,  label: "Balance Sheet",  shortLabel: "BS",        Icon: Scale        },
];

function normalizePath(p) {
  if (!p) return "";
  return p.split("?")[0].replace(/\/$/, "") || "";
}

export default function ReportsNav({ className = "" }) {
  const router = useRouter();
  const current = normalizePath(router.pathname);

  return (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 shadow-sm backdrop-blur-sm ${className}`.trim()}
    >
      <nav
        className="flex flex-wrap sm:flex-nowrap items-stretch gap-1 p-1 sm:p-1.5 overflow-x-auto"
        aria-label="Accounting reports"
      >
        {REPORT_LINKS.map(({ key, href, label, shortLabel, Icon }) => {
          const isActive = current === normalizePath(href);
          return (
            <Link
              key={key}
              href={href}
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
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
