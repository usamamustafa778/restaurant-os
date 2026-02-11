/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Tenant website settings: keep nice URL, serve internal tenant-website page
      {
        source: "/r/:tenantSlug/dashboard/website",
        destination: "/dashboard/tenant-website?tenantSlug=:tenantSlug"
      },
      // Role-scoped tenant dashboard website settings
      {
        source: "/r/:tenantSlug/:role/dashboard/website",
        destination: "/dashboard/tenant-website?tenantSlug=:tenantSlug&role=:role"
      },
      // Tenant dashboard root → overview page (keeps tenantSlug in URL)
      {
        source: "/r/:tenantSlug/dashboard",
        destination: "/dashboard/overview?tenantSlug=:tenantSlug"
      },
      // Role-scoped tenant dashboard root
      {
        source: "/r/:tenantSlug/:role/dashboard",
        destination: "/dashboard/overview?tenantSlug=:tenantSlug&role=:role"
      },
      // All other tenant dashboard pages
      {
        source: "/r/:tenantSlug/dashboard/:path*",
        destination: "/dashboard/:path*?tenantSlug=:tenantSlug"
      },
      // All other tenant dashboard pages with explicit role segment
      {
        source: "/r/:tenantSlug/:role/dashboard/:path*",
        destination: "/dashboard/:path*?tenantSlug=:tenantSlug&role=:role"
      },
      // Role-specific staff login URLs map onto shared tenant login page
      {
        source: "/r/:tenantSlug/:role/login",
        destination: "/r/:tenantSlug/login?role=:role"
      }
    ];
  }
};

module.exports = nextConfig;
