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
    thumbnail:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop&q=80",
  },
  {
    id: "modern",
    name: "Modern",
    category: "restaurant",
    description:
      "Sleek glass navbar, full-bleed hero, card grid menu, and modern typography.",
    isComingSoon: false,
    thumbnail:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=500&fit=crop&q=80",
  },
  {
    id: "minimal",
    name: "Minimal",
    category: "restaurant",
    description:
      "Editorial typography, wine-list menu style, serif headings. Elegant and fast.",
    isComingSoon: false,
    thumbnail:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop&q=80",
  },
  {
    id: "lounge",
    name: "Lounge",
    category: "lounge",
    description:
      "Dark, cinematic, premium lounge experience for sheesha cafes and nightlife dining.",
    isComingSoon: false,
    thumbnail:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&h=500&fit=crop&q=80",
  },
  {
    id: "poster",
    name: "Poster",
    category: "bold",
    description:
      "Kinetic display typography, grainy poster aesthetic, and punchy motion-first storefront.",
    isComingSoon: false,
    thumbnail:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=500&fit=crop&q=80",
  },
  {
    id: "olea",
    name: "Olea",
    category: "refined",
    description:
      "Refined Mediterranean-inspired layout with editorial serif hero, market menu tabs, and elegant ordering flow.",
    isComingSoon: false,
    thumbnail:
      "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&h=500&fit=crop&q=80",
  },
];
