/**
 * First path segments for tenant dashboard pages that live under pages/dashboard/
 * and are served at clean URLs (e.g. /tables → /dashboard/tables).
 *
 * Keep middleware auth checks and next.config rewrites in sync via this list.
 */
const DASHBOARD_TOP_SEGMENTS = [
  "overview",
  "pos",
  "orders",
  "kitchen",
  "reservations",
  "categories",
  "menu-items",
  "menu",
  "modifier-groups",
  "customers",
  "inventory",
  "deals",
  "users",
  "business-settings",
  "settings",
  "tables",
  "history",
  "website-settings",
  "website-analytics",
  "integrations",
  "whatsapp",
  "subscription",
  "profile",
  "day-report",
  "order-taker",
  "rider",
  "migrate-pending",
  "sales-report",
  "riders",
  "rider-payouts",
  "accounting",
  "vouchers",
];

module.exports = {
  DASHBOARD_TOP_SEGMENTS,
};
