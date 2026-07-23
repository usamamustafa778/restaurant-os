/** @type {import('next').NextConfig} */
const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL || "https://eatsdesk.com";

const { DASHBOARD_TOP_SEGMENTS } = require("./lib/dashboardPages");

/**
 * Client-router-aware rewrites.
 * Middleware rewrites alone update the address bar but often leave soft-nav
 * stuck because Pages Router cannot resolve /tables → pages/dashboard/tables.js.
 */
function buildDashboardRewrites() {
  const pageRewrites = DASHBOARD_TOP_SEGMENTS.flatMap((seg) => [
    { source: `/${seg}`, destination: `/dashboard/${seg}` },
    { source: `/${seg}/:path*`, destination: `/dashboard/${seg}/:path*` },
  ]);

  return [
    ...pageRewrites,
    { source: "/super", destination: "/dashboard/super" },
    { source: "/super/:path*", destination: "/dashboard/super/:path*" },
  ];
}

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return buildDashboardRewrites();
  },
  async redirects() {
    return [
      // Subscriptions console folded into Restaurants; keep old URLs working.
      {
        source: "/super/subscriptions",
        destination: "/super/restaurants",
        permanent: false,
      },
      {
        source: "/dashboard/super/subscriptions",
        destination: "/super/restaurants",
        permanent: false,
      },
      // App root (/) is handled in middleware: login vs dashboard.
      // Marketing pages that used to live here now redirect to eatsdesk.com.
      {
        source: "/blog",
        destination: `${MARKETING_URL}/blog`,
        permanent: false,
      },
      {
        source: "/blog/:slug*",
        destination: `${MARKETING_URL}/blog/:slug*`,
        permanent: false,
      },
      {
        source: "/locations",
        destination: `${MARKETING_URL}/locations`,
        permanent: false,
      },
      {
        source: "/locations/:path*",
        destination: `${MARKETING_URL}/locations/:path*`,
        permanent: false,
      },
      {
        source: "/privacy-policy",
        destination: `${MARKETING_URL}/privacy-policy`,
        permanent: false,
      },
      {
        source: "/terms-and-conditions",
        destination: `${MARKETING_URL}/terms-and-conditions`,
        permanent: false,
      },
      {
        source: "/sitemap.xml",
        destination: `${MARKETING_URL}/sitemap.xml`,
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
