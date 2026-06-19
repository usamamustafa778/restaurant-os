/**
 * Storefront template catalog (dashboard metadata only).
 *
 * When adding a new template, also update:
 * 1. eatsdesk-temp1/app/page.js — TEMPLATE_LOADERS
 * 2. eatsdesk-temp1/app/[slug]/page.js — TEMPLATE_LOADERS
 * 3. restaurnat-os-backend/models/Restaurant.js — websiteSettings.template enum
 */

export const STOREFRONT_TEMPLATES = [
  {
    id: "classic",
    name: "Classic",
    category: "restaurant",
    description:
      "Traditional restaurant layout with hero carousel, menu grid, and full-width sections.",
    isComingSoon: false,
    thumbnail: null,
  },
  {
    id: "modern",
    name: "Modern",
    category: "restaurant",
    description:
      "Sleek glass navbar, full-bleed hero, card grid menu, and modern typography.",
    isComingSoon: false,
    thumbnail: null,
  },
  {
    id: "minimal",
    name: "Minimal",
    category: "restaurant",
    description:
      "Editorial typography, wine-list menu style, serif headings. Elegant and fast.",
    isComingSoon: false,
    thumbnail: null,
  },
  {
    id: "lounge",
    name: "Lounge",
    category: "lounge",
    description:
      "Dark, cinematic, premium lounge experience for sheesha cafes and nightlife dining.",
    isComingSoon: false,
    thumbnail: null,
  },
];
