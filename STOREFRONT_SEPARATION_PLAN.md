# Separate Restaurant Storefront from Dashboard

> **Goal:** Separate the public-facing restaurant website (storefront) from the dashboard into its own repo/service, following a Shopify-like headless architecture where the storefront consumes a public Storefront API from the backend. This isolates traffic, enables independent scaling, and opens the door for a multi-template system.

---

## Current Architecture (Problem)

Today, both the **admin dashboard** and the **public restaurant website** live in a single Next.js app (`restaurant-os`):

- `pages/r/[subdomain].js` (1,381 lines) — the full public storefront
- `middleware.js` — routes `*.eatsdesk.com` subdomains to the storefront, `eatsdesk.com/*` to the dashboard
- Both share the same deployment, same server resources, same failure domain

**Current data flow:**
```
Customer visits urbanspoon.eatsdesk.com
  → middleware.js extracts subdomain "urbanspoon"
  → rewrites to /r/urbanspoon
  → pages/r/[subdomain].js renders via getServerSideProps
  → calls GET /api/menu?subdomain=urbanspoon (Express backend)
  → calls GET /api/deals/active?subdomain=urbanspoon
  → renders full storefront (hero, menu, cart, checkout)
  → POST /api/orders/website for order placement
```

**Problems:**
- A restaurant running ads with huge traffic hits the same server as all dashboard users
- Cannot scale storefronts independently from the dashboard
- Cannot swap templates per restaurant
- Single deployment = single failure domain

---

## Proposed Architecture (3 Independent Services)

```
┌─────────────────────────────────┐
│   Storefront Service (NEW REPO) │
│   Next.js 15 + App Router       │
│   Serves: *.eatsdesk.com        │
│   Behind CDN with ISR caching   │
│   Template-based rendering       │
└──────────────┬──────────────────┘
               │ Storefront API calls
               ▼
┌─────────────────────────────────┐
│   Express Backend               │
│   /api/storefront/:slug/*       │  ← NEW public API (no auth, rate-limited)
│   /api/admin/*                  │  ← Existing admin API (JWT auth)
│   MongoDB Atlas                 │
└──────────────┬──────────────────┘
               ▲ Admin API calls
               │
┌─────────────────────────────────┐
│   Dashboard Service (THIS REPO) │
│   Next.js (current)             │
│   Serves: eatsdesk.com/*        │
│   Admin panel only              │
└─────────────────────────────────┘
```

---

## DNS and Routing Split

| Domain | Service | Purpose |
|---|---|---|
| `eatsdesk.com/*` | Dashboard (this repo) | Admin panel, login, POS, etc. |
| `*.eatsdesk.com` | Storefront (new repo) | Public restaurant websites |
| Custom domains (future) | Storefront | e.g., `urbanspoon.pk` |

**DNS setup:**
- `eatsdesk.com` → A record → Dashboard deployment
- `*.eatsdesk.com` → wildcard CNAME → Storefront deployment
- Each service has its own Vercel project (or equivalent hosting)

---

## Backend Changes (restaurnat-os-backend)

### A. New Storefront API Router

Create `routes/storefront.js` with dedicated public endpoints:

```
GET  /api/storefront/:slug/config     → restaurant name, logo, banner, theme, hero slides,
                                        social media, opening hours, sections, visibility, template
GET  /api/storefront/:slug/menu       → menu items, categories (optional ?branchId=)
GET  /api/storefront/:slug/deals      → active deals with showOnWebsite=true
GET  /api/storefront/:slug/branches   → branch list (name, address, id)
POST /api/storefront/:slug/orders     → place order (COD)
```

**Rate limiting:**

```javascript
router.get("/:slug/config",   rateLimit({ windowMs: 60000, max: 100 }), getStorefrontConfig);
router.get("/:slug/menu",     rateLimit({ windowMs: 60000, max: 100 }), getStorefrontMenu);
router.get("/:slug/deals",    rateLimit({ windowMs: 60000, max: 60 }),  getStorefrontDeals);
router.get("/:slug/branches", rateLimit({ windowMs: 60000, max: 60 }),  getStorefrontBranches);
router.post("/:slug/orders",  rateLimit({ windowMs: 60000, max: 10 }),  createStorefrontOrder);
```

**Key behaviors:**
- Resolve restaurant by `website.subdomain` matching `:slug`
- Return 404 if `isPublic === false`
- Set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on GET responses
- Return only public-safe fields (no admin user IDs, no revenue data)

**Why a separate namespace instead of reusing `/api/menu?subdomain=`:**
- Clean separation of concerns (public vs admin)
- Independent rate limiting per slug/IP
- Different caching strategies (config cached 60s, menu 30s, orders never)
- Admin API remains untouched and unaffected by storefront traffic
- Easier to version independently (`/api/v1/storefront/...` later)

### B. Schema Addition

Add to `websiteSettingsSchema` in the Restaurant model:

```javascript
template:     { type: String, default: "classic", enum: ["classic", "modern", "minimal"] },
customDomain: { type: String, default: null },  // future: urbanspoon.pk
```

### C. CORS Configuration

Update Express CORS to allow the storefront origin:

```javascript
const allowedOrigins = [
  process.env.DASHBOARD_ORIGIN,     // https://eatsdesk.com
  process.env.STOREFRONT_ORIGIN,    // pattern for *.eatsdesk.com
];
```

### D. Storefront Config Response Shape

```json
{
  "slug": "urbanspoon",
  "name": "Urban Spoon",
  "template": "classic",
  "isPublic": true,
  "logoUrl": "https://...",
  "bannerUrl": "https://...",
  "description": "...",
  "tagline": "...",
  "contactPhone": "03XX-XXXXXXX",
  "contactEmail": "contact@urbanspoon.pk",
  "address": "...",
  "heroSlides": [
    { "title": "...", "subtitle": "...", "imageUrl": "...", "buttonText": "Order Now", "isActive": true }
  ],
  "socialMedia": { "facebook": "...", "instagram": "..." },
  "themeColors": { "primary": "#EF4444", "secondary": "#FFA500" },
  "openingHoursText": "Mon-Fri 9am-10pm",
  "allowWebsiteOrders": true,
  "websiteSections": [
    { "title": "Popular Items", "subtitle": "...", "isActive": true, "items": ["itemId1", "itemId2"] }
  ]
}
```

### E. Storefront Menu Response Shape

```json
{
  "restaurant": { "name": "Urban Spoon", "logoUrl": "..." },
  "menu": [
    { "id": "...", "name": "Burger", "price": 500, "description": "...", "imageUrl": "...", "categoryId": "..." }
  ],
  "categories": [
    { "id": "...", "name": "Burgers", "imageUrl": "..." }
  ],
  "branches": [
    { "id": "...", "name": "Main Branch", "address": "..." }
  ]
}
```

---

## New Storefront Repo Structure (restaurant-storefront)

### Tech Stack
- Next.js 15 (App Router for ISR/streaming)
- React 19 with Server Components
- Tailwind CSS

### Folder Structure

```
restaurant-storefront/
├── app/
│   ├── [slug]/
│   │   ├── page.js              # Dynamic route — loads template by config.template
│   │   └── layout.js            # Slug-level layout (SEO, fonts)
│   ├── layout.js                # Root layout
│   └── not-found.js
├── templates/
│   ├── classic/                 # Port of current pages/r/[subdomain].js
│   │   ├── StorefrontPage.js    # Main page component
│   │   └── components/
│   │       ├── Hero.js          # Hero carousel
│   │       ├── MenuSection.js   # Menu with category filters
│   │       ├── WebsiteSections.js
│   │       ├── DealsSection.js
│   │       ├── Cart.js          # Cart drawer
│   │       ├── Checkout.js      # Checkout flow
│   │       ├── ItemDetailModal.js
│   │       ├── BranchPicker.js
│   │       ├── Navbar.js
│   │       └── Footer.js
│   ├── modern/                  # Future template
│   │   ├── StorefrontPage.js
│   │   └── components/
│   └── minimal/                 # Future template
│       ├── StorefrontPage.js
│       └── components/
├── lib/
│   ├── storefront-api.js        # API client for /api/storefront/:slug/*
│   └── utils.js
├── components/
│   └── shared/                  # Shared across templates (e.g., SectionSlider)
│       ├── SectionSlider.js
│       └── WebsiteSectionsView.js
├── middleware.js                 # Subdomain → slug resolution
├── tailwind.config.js
├── next.config.js
├── package.json
└── .env.example
```

### Middleware (subdomain resolution)

```javascript
import { NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

export function middleware(request) {
  const host = request.headers.get("host") || "";
  const slug = getSubdomainFromHost(host);

  if (slug) {
    // Rewrite urbanspoon.eatsdesk.com → /urbanspoon
    return NextResponse.rewrite(new URL(`/${slug}${request.nextUrl.pathname}`, request.url));
  }

  // No subdomain → show a "restaurant not found" page
  return NextResponse.next();
}

function getSubdomainFromHost(host) {
  if (!ROOT_DOMAIN) return null;
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];
  if (!hostname.endsWith(rootHostname)) return null;
  const prefix = hostname.slice(0, -(rootHostname.length + 1));
  if (!prefix || prefix === "www" || prefix.includes(".")) return null;
  return prefix;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api).*)"],
};
```

### Dynamic Template Loading

```javascript
// app/[slug]/page.js
import { fetchStorefrontConfig } from "@/lib/storefront-api";
import { notFound } from "next/navigation";

export const revalidate = 60; // ISR: revalidate every 60 seconds

export default async function StorefrontPage({ params }) {
  const { slug } = await params;
  const config = await fetchStorefrontConfig(slug);

  if (!config || !config.isPublic) return notFound();

  const templateName = config.template || "classic";

  // Dynamic import based on template
  const { default: TemplatePage } = await import(`@/templates/${templateName}/StorefrontPage`);

  return <TemplatePage config={config} slug={slug} />;
}
```

### API Client

```javascript
// lib/storefront-api.js
const API_BASE = process.env.NEXT_PUBLIC_STOREFRONT_API_URL || "http://localhost:5001";

export async function fetchStorefrontConfig(slug) {
  const res = await fetch(`${API_BASE}/api/storefront/${slug}/config`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStorefrontMenu(slug, branchId) {
  const url = new URL(`${API_BASE}/api/storefront/${slug}/menu`);
  if (branchId) url.searchParams.set("branchId", branchId);
  const res = await fetch(url.toString(), {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStorefrontDeals(slug) {
  const res = await fetch(`${API_BASE}/api/storefront/${slug}/deals`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function placeStorefrontOrder(slug, orderData) {
  const res = await fetch(`${API_BASE}/api/storefront/${slug}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to place order");
  }
  return res.json();
}
```

### Environment Variables (.env.example)

```bash
# Storefront API (Express backend)
NEXT_PUBLIC_STOREFRONT_API_URL=http://localhost:5001

# Root domain for subdomain resolution
# Local:  NEXT_PUBLIC_ROOT_DOMAIN=localhost:3001
# Live:   NEXT_PUBLIC_ROOT_DOMAIN=eatsdesk.com
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3001
```

---

## Dashboard Changes (this repo: restaurant-os)

### A. Files to Remove (after storefront repo is live)

| File | Reason |
|---|---|
| `pages/r/[subdomain].js` (1,381 lines) | Moved to storefront repo |
| `pages/public/[slug]/index.js` | Legacy, replaced by storefront repo |
| `components/website/SectionSlider.js` | Only used by storefront |

### B. Files to Keep

| File | Reason |
|---|---|
| `components/website/WebsiteSectionsView.js` | Used by dashboard preview in website-content.js |

### C. Middleware Simplification

Remove from `middleware.js`:
- `getSubdomain()` function
- Subdomain rewrite logic (rewriting to `/r/{subdomain}`)
- The `/{slug}` catch-all that rewrites to `/r/{slug}`

The middleware should only handle dashboard routing after the split.

### D. Add Template Selector

In `pages/dashboard/website-content.js`, add a template selection UI:
- Add a "Template" tab or a dropdown in the header
- Shows available templates with previews
- Saves `template` field via `updateWebsiteSettings()`

### E. Update Website Preview

The dashboard preview in `website-content.js` can either:
- Keep using the admin API for preview (simpler, current behavior)
- Add an iframe that loads the actual storefront URL for a true preview
- Show a note: "Preview shows the classic layout. Actual appearance depends on selected template."

---

## Migration Steps (Phased Rollout)

### Phase 1: Backend Storefront API
**No user-facing changes. Safe to deploy.**
- Create `/api/storefront/:slug/*` endpoints on Express backend
- Add rate limiting, caching headers, CORS
- Add `template` and `customDomain` fields to Restaurant schema
- Test: verify all storefront data is accessible via new API

### Phase 2: New Storefront Repo
**Parallel deployment. Old storefront still works.**
- Create `restaurant-storefront` repo
- Port `pages/r/[subdomain].js` as the "classic" template
- Wire up to Storefront API
- Deploy to separate hosting (e.g., Vercel project on port 3001 locally)
- Test: verify storefront works at a test subdomain

### Phase 3: DNS Cutover
**The switch.**
- Point `*.eatsdesk.com` wildcard to the new storefront deployment
- Keep `eatsdesk.com` pointing to dashboard
- Monitor traffic and performance
- Keep old storefront code in dashboard as fallback (don't delete yet)

### Phase 4: Dashboard Cleanup
**After storefront is stable.**
- Remove `pages/r/`, `pages/public/`, storefront routing from middleware
- Add template selector to Website Settings
- Update preview to reflect template choice

### Phase 5: New Templates (future)
- Design and build "modern" and "minimal" templates
- Each restaurant picks their template from the dashboard

---

## Traffic Isolation Result

After this split:
- A restaurant running ads gets traffic on the **storefront service** only
- Storefront is behind CDN with ISR (60s revalidate), so most requests never hit the backend
- Dashboard remains on its own deployment, completely unaffected
- Backend has separate rate limits: storefront API vs admin API
- Each service can be scaled independently (more storefront instances during peak traffic)
- Future: restaurants can get custom domains pointing to the storefront service

---

## Key Files Reference (Current Codebase)

| File | What to do with it |
|---|---|
| `pages/r/[subdomain].js` | Port to storefront repo as "classic" template, then delete |
| `pages/public/[slug]/index.js` | Delete (legacy) |
| `components/website/SectionSlider.js` | Copy to storefront repo, then delete from dashboard |
| `components/website/WebsiteSectionsView.js` | Keep in dashboard (preview), also copy to storefront |
| `middleware.js` | Simplify after cutover (remove subdomain/storefront routing) |
| `lib/routes.js` | Remove `buildTenantWebsiteUrl` and subdomain helpers after cutover |
| `pages/dashboard/website-content.js` | Add template selector |
| `.env.example` | Remove `NEXT_PUBLIC_ROOT_DOMAIN` after cutover (only needed by storefront) |

---

## Current Backend API Endpoints Used by Storefront

These are the endpoints the current `pages/r/[subdomain].js` calls. The new Storefront API should provide equivalent data:

| Current Endpoint | Method | New Storefront Equivalent |
|---|---|---|
| `/api/menu?subdomain={slug}` | GET | `/api/storefront/:slug/menu` + `/api/storefront/:slug/config` |
| `/api/menu?subdomain={slug}&branchId={id}` | GET | `/api/storefront/:slug/menu?branchId={id}` |
| `/api/deals/active?subdomain={slug}` | GET | `/api/storefront/:slug/deals` |
| `/api/orders/website` (body: `{ subdomain, ... }`) | POST | `/api/storefront/:slug/orders` |
