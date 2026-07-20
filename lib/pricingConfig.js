import {
  MODULE_LIST,
  PRICING_BUNDLES,
  formatModuleRate,
  sumModuleRates,
} from "./moduleCatalog";

export const PRICING_COPY = {
  headline: "Pay only for the modules you need",
  subheadline:
    "EatsDesk is modular. Start with POS Core, then add kitchen display, riders, inventory, accounting, website, or AI receptionist — billed per branch, per month.",
  socialProof: "Built for high volume and multi-branch restaurant operators",
  urgency:
    "Pick modules that match how you run. Turn features on when you’re ready — no forced all-in package.",
  guarantee:
    "30 days free on eligible modules. No credit card. Cancel anytime. We set everything up for you.",
  pricingSubtext:
    "All rates are monthly USD, per branch. All ten modules together are $105. POS Core is required. Dependencies unlock automatically when you add a module.",
  trialNote:
    "Most modules include a 30-day trial. AI Receptionist is paid from day one (no trial).",
};

export { MODULE_LIST, PRICING_BUNDLES, formatModuleRate, sumModuleRates };

export function formatMoney(countryCode, amount, withDecimals = false) {
  const n = Number(amount || 0);
  return `$${withDecimals ? n.toFixed(2) : n.toLocaleString("en-US")}`;
}
