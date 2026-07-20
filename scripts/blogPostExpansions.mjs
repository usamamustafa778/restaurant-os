/** Topic-specific expansion paragraphs for word-count padding (850–1100 target). */

const generic = [
  "Operators who treat technology as a daily habit—not a one-time install—see compounding returns. A ten-minute morning review of yesterday's voids, stock alerts, and delivery delays prevents the fire drills that ruin guest experience during tonight's peak.",
  "Training is the multiplier on every feature you buy. POS buttons nobody uses, KDS screens nobody bumps, and reports nobody opens are indistinguishable from not having software at all. Short pre-shift huddles that reference real data beat lengthy manuals staff never read.",
  "Guest expectations keep rising even when your margins feel squeezed. Faster replies, clearer modifiers, and accurate bags are no longer premium service—they are the baseline that earns repeat orders and five-star reviews on busy weekends.",
  "When counter, kitchen, and delivery share one ticket path, managers stop mediating between systems. That coordination tax shows up as remakes, late riders, and owners stuck on the floor instead of growing the brand.",
  "Document one standard for each handoff—counter to kitchen, kitchen to expo, expo to rider—and review it when error rates spike. Most ops problems are broken handoffs, not broken recipes.",
  "Seasonality, school holidays, and local events shift volume faster than annual budgets predict. Weekly dashboards let you staff and prep for next Friday instead of reacting to last Friday.",
  "Direct channels you control—website, WhatsApp, QR—compound when CRM remembers who ordered. Aggregators rent you traffic; owned channels rent you nothing once the guest saves your link.",
  "Security and permissions matter even for small teams. Shared admin passwords and unaudited discount overrides create losses that look like shrink until someone reads the audit log.",
  "Pilot changes on one daypart before rolling site-wide. Lunch-only KDS trials, dinner-only wallet tender training, and soft-launches reduce rebellion from staff who already fear busy shifts.",
  "EatsDesk is designed as a modular restaurant OS: POS at the core, with kitchen display, inventory, riders, storefront, accounting, and AI receptionist added per branch so every module reads the same menu and orders.",
  "Measure before and after every change. Without a baseline, improvements feel invisible and regressions hide until guests complain publicly.",
  "Your menu is a living document. Prices, deals, and eighty-sixed items must flow to every channel the same day—counter, web, WhatsApp, and QR—or accuracy work upstream is wasted.",
];

export const EXPANSION_BY_SLUG = {
  "kitchen-display-system-fast-food": [
    "Expo stations that cannot see the KDS will revert to shouting within a week. Mount screens at eye level with glare-controlled angles; budget for one spare tablet ready to swap if hardware fails mid-service.",
    "Routing rules matter when grill and fry have different speeds. Some kitchens split tickets by station; others use one queue with item-level highlights. Choose the model that matches how your line actually walks—not how a consultant imagines it.",
    "Online orders often carry more modifiers than counter tickets. If web items look different on KDS, fix menu mapping before blaming kitchen discipline.",
    "Aging timers should trigger manager glance, not panic. Set thresholds based on your actual prep times for bestsellers, then tune after two weeks of data.",
  ],
  "reduce-order-errors-fast-food": [
    "Upsell prompts at POS must never hide required modifiers beneath optional add-ons. Cashiers racing through combos should still confirm spice level and protein swaps aloud for high-risk items.",
    "Label printers at expo that show order type and ticket number reduce rider grab-and-go mistakes. Numbers beat names when three Muhammad orders leave within five minutes.",
    "Aggregator tablets that sit beside POS need weekly menu parity checks. A missing modifier online becomes a remake in-store when the guest expected what they tapped on the app.",
    "Error rate reviews should include channel and cashier, not only kitchen. Patterns often start at the ordering moment even when guests blame food quality.",
  ],
  "restaurant-inventory-management-tips": [
    "Transfers between branches need digital records, not WhatsApp messages. Unlogged transfers make HQ think Lahore is wasting chicken while Karachi is simply borrowing stock.",
    "Waste logs with reasons—expired, dropped, overprep—turn garbage into actionable data. Without reasons, waste reports are just guilt without direction.",
    "Purchasing should see low-stock alerts before managers do when possible. Central buyers negotiating case prices save more than outlet managers panic-ordering retail rates.",
    "Cycle counts on fast movers beat full wall-to-wall counts every month for busy fast food. Focus precision where dollars move fastest.",
  ],
  "food-cost-percentage-restaurant-guide": [
    "Labour and rent matter, but food cost is the lever kitchen touches daily. A one-point improvement on Rs 2,000,000 monthly food sales is real money—track it visibly.",
    "Combo deals need margin math before marketing launches them. A popular bundle that loses money on every ticket is a volume trap.",
    "Vendor substitutions during shortages should trigger temporary recipe cost updates. Using premium oil for a week without repricing skews the month.",
    "Compare food cost by channel if packaging and free sides differ on delivery. Blended averages hide delivery promos eating margin.",
  ],
  "restaurant-website-with-online-ordering-free": [
    "Checkout abandonment often comes from surprise fees at the last step. Show delivery zone fees early; guests forgive honest totals more than hidden charges.",
    "Order tracking pages reduce where-is-my-food calls that interrupt counter staff. Status should mirror KDS bumps automatically.",
    "Promote direct ordering inside aggregator bags with a polite nudge—not aggressive anti-app messaging that confuses guests.",
    "Test your storefront on a mid-range Android phone on 4G, not only on office Wi‑Fi with a flagship iPhone.",
  ],
  "multi-branch-restaurant-management-software": [
    "New branch openings should clone settings from your best-performing outlet, not your first experimental one. Standardize what works; iterate deliberately.",
    "Inter-branch comparisons work best with normalized metrics—sales per square foot, delivery mix, void rate—not raw revenue alone.",
    "HQ dashboards nobody opens weekly are vanity. Schedule a recurring ten-minute review so data drives conversations.",
    "Franchisee buy-in grows when they see their own branch trends, not only league tables that feel punitive.",
  ],
  "restaurant-delivery-rider-management-app": [
    "Geofencing and ETA texts are nice; accurate addresses and phone numbers on rider screens are essential. Fix POS address capture before buying fancy maps.",
    "Batching two nearby orders saves minutes but increases swap risk. Train riders to confirm ticket numbers at pickup every time.",
    "Weather and traffic spikes are when dispatch discipline matters most. Live overdue flags beat post-shift arguments.",
    "Rider incentives tied to accurate tender recording—not only speed—reduce cash shorts that poison trust.",
  ],
  "restaurant-end-of-day-report-cash-reconciliation": [
    "Managers should sign digital close summaries with timestamps. Accountability beats verbal all-good when shorts appear next week.",
    "Petty cash and staff meals need tender types too, not off-system IOUs that never reconcile.",
    "Compare delivery charge totals against rider fee settings monthly. Misconfigured zones show up as slow revenue leaks.",
    "Accountants love consistent CSV columns more than creative PDF layouts. Export discipline speeds month-end.",
  ],
  "fast-food-franchise-pos-requirements": [
    "LTO calendars should auto-expire in POS so cashiers do not sell expired promos after marketing ends.",
    "Franchise training simulators on training mode POS beat PowerPoint for muscle memory on modifiers.",
    "Royalty reporting needs auditable sales definitions—what counts as net, which discounts HQ funds.",
    "New hire certification on POS should be tracked before first solo rush shift.",
  ],
  "restaurant-management-software-vs-excel": [
    "Version control on shared spreadsheets is a myth once more than two people edit live. Conflicting copies cause ordering disasters.",
    "Macros that only one person understands become single points of failure when they take leave.",
    "Real-time stock on a sheet is always stale; POS deduction is event-driven.",
    "Software ROI appears fastest on your busiest day—measure migration success on Friday, not Tuesday.",
  ],
  "best-restaurant-pos-system-pakistan": [
    "Ask Pakistani references specifically—payment mix and delivery culture differ from Gulf or US demos vendors reuse.",
    "Confirm Urdu or bilingual receipt options if your customer base expects them.",
    "Verify rider and wallet modules are included in quoted price, not surprise add-ons after contract.",
    "Electricity and internet blips happen—document vendor support hours including evenings.",
  ],
  "restaurant-pos-software-lahore-karachi-islamabad": [
    "Traffic patterns differ: Karachi longer dispatch windows, Islamabad office-lunch spikes, Lahore mixed dine-in evenings. Staffing templates should differ even with identical POS.",
    "Local influencer promos spike web orders—ensure hosting handles traffic without manual POS entry.",
    "Branch managers in each city should share one Slack or WhatsApp ops group with HQ for playbook updates.",
    "City-specific delivery fees should reflect rider cost, not copy-paste from a competitor list.",
  ],
  "cloud-kitchen-pos-system-pakistan": [
    "Packaging SKU costs belong in food cost per virtual brand when bags and boxes differ.",
    "Aggregator tablets cluttering expo need the same KDS destination as direct web orders.",
    "Shared prep for two brands requires ticket tags bold enough to see across steam.",
    "Cloud kitchens scaling brands should kill underperformers with data, not gut feel alone.",
  ],
  "easypaisa-jazzcash-restaurant-pos": [
    "QR stickers at counter for wallet pay speed up takeaway lines when configured as distinct tender.",
    "Rider wallet collections must match customer app screenshots disputes—train photo proof only when policy requires.",
    "Reconciliation day should be fixed weekly; daily micro-checks catch problems smaller.",
    "Wallet promos funded by telcos still need POS discount codes for clean reporting.",
  ],
  "online-ordering-without-foodpanda-commission": [
    "Loyalty on direct channels can be simple—fifth order free drink—without building an app first.",
    "Google Business posts with direct link outperform occasional Instagram stories for local SEO.",
    "Measure repeat rate on direct phones separately from one-time promo hunters.",
    "Packaging inserts with QR reorder codes cost little and remind guests you exist between cravings.",
  ],
  "whatsapp-ai-receptionist-restaurants": [
    "Set AI hours to match when staff cannot answer—not necessarily 24/7 if overnight kitchen is closed.",
    "Custom instructions for Ramadan hours, Eid closures, and delivery cutoffs reduce handoffs.",
    "Review chat transcripts for new FAQ candidates weekly; update AI before guests repeat the same question.",
    "Promote WhatsApp on delivery receipts once AI accuracy is proven—premature promotion floods staff with corrections.",
  ],
  "qr-code-menu-restaurant-pakistan": [
    "Wi‑Fi guest networks help tourists; local guests often use mobile data—optimize menu load for both.",
    "Table numbers in QR URLs route dine-in tickets correctly when you enable table ordering.",
    "Accessibility matters: font size and contrast on digital menus should beat tiny laminated cards.",
    "Seasonal menu photos can wait; accurate prices and sold-out states cannot.",
  ],
  "restaurant-crm-repeat-customers-pakistan": [
    "Birthday offers via SMS or WhatsApp work when genuine—not generic blasts that feel spammy.",
    "VIP flags for regulars with allergies protect guests and reduce liability.",
    "Segment by neighbourhood to promote branch-specific deals without confusing city-wide guests.",
    "Measure campaign lift with control weeks—skip blasting everyone during already-busy Eid weeks.",
  ],
  "biryani-restaurant-pos-features": [
    "Peak lunch prep for rice vessels should align with KDS ticket aging—expo prioritizes tickets about to breach SLA.",
    "Raita and salad attach prompts at POS lift margin on low-food-cost sides.",
    "Family pack modifiers for leg pieces versus breast pieces must kitchen-print clearly.",
    "Friday jummah lunch spikes need temporary staff templates saved in scheduling, not reinvented weekly.",
  ],
};

export function getExpansionPool(slug) {
  return [...(EXPANSION_BY_SLUG[slug] || []), ...generic];
}
