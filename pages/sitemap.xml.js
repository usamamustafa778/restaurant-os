import { getAllBlogPosts } from "../lib/blogPosts";

const BASE_URL = "https://eatsdesk.com";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function generateSiteMap() {
  const today = new Date().toISOString().split("T")[0];
  const posts = getAllBlogPosts();

  const staticPages = [
    { path: "", priority: "1.0", changefreq: "weekly" },
    { path: "/blog", priority: "0.9", changefreq: "weekly" },
    { path: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
    { path: "/terms-and-conditions", priority: "0.3", changefreq: "yearly" },
  ];

  const staticEntries = staticPages.map((p) =>
    urlEntry(`${BASE_URL}${p.path}`, today, p.changefreq, p.priority),
  );

  const blogEntries = posts.map((post) =>
    urlEntry(
      `${BASE_URL}/blog/${post.slug}`,
      post.publishedAt,
      "monthly",
      "0.8",
    ),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...blogEntries].join("\n")}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  const sitemap = generateSiteMap();
  res.setHeader("Content-Type", "text/xml");
  res.write(sitemap);
  res.end();
  return { props: {} };
}

export default function SiteMap() {
  return null;
}
