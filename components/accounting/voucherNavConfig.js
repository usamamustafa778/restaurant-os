/** Base path for voucher UI routes (matches `pages/dashboard/accounting/vouchers/`). */
export const VOUCHER_PAGES_PREFIX = "/dashboard/accounting/vouchers";

/**
 * Ordered links for the voucher topbar + “New voucher” dropdown.
 * `key` matches voucher `type` where applicable; `list` is the index page.
 */
export const VOUCHER_PAGE_LINKS = [
  {
    key: "cash_payment",
    href: `${VOUCHER_PAGES_PREFIX}/cash-payment`,
    label: "Cash Payment",
    shortLabel: "Cash Pay",
  },
  {
    key: "cash_receipt",
    href: `${VOUCHER_PAGES_PREFIX}/cash-receipt`,
    label: "Cash Receipt",
    shortLabel: "Cash Rec",
  },
  {
    key: "bank_payment",
    href: `${VOUCHER_PAGES_PREFIX}/bank-payment`,
    label: "Bank Payment",
    shortLabel: "Bank Pay",
  },
  {
    key: "bank_receipt",
    href: `${VOUCHER_PAGES_PREFIX}/bank-receipt`,
    label: "Bank Receipt",
    shortLabel: "Bank Rec",
  },
  {
    key: "journal",
    href: `${VOUCHER_PAGES_PREFIX}/journal`,
    label: "Journal Entry",
    shortLabel: "Journal",
  },
  {
    key: "list",
    href: VOUCHER_PAGES_PREFIX,
    label: "All Vouchers",
    shortLabel: "All",
  },
];

/** Links shown in the vouchers list “New Voucher” menu (no index entry). */
export const NEW_VOUCHER_MENU_LINKS = VOUCHER_PAGE_LINKS.filter(
  (l) => l.key !== "list",
).map(({ href, label }) => ({ href, label }));
