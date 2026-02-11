/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Role-specific staff login URLs map onto shared tenant login page
      // e.g. /r/urbanspoon/cashier/login → /r/urbanspoon/login?role=cashier
      {
        source: "/r/:tenantSlug/:role/login",
        destination: "/r/:tenantSlug/login?role=:role"
      }
    ];
  }
};

module.exports = nextConfig;
