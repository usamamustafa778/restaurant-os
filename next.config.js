/** @type {import('next').NextConfig} */
const MARKETING_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL || "https://eatsdesk.com";

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
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
