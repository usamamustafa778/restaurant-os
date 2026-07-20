#!/usr/bin/env node
/**
 * Generates expanded EatsDesk blog post files (900–1100 words each).
 * Skips ai-receptionist-for-restaurants.js (existing pillar content).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POST_DEFINITIONS } from "./blogPostContent.mjs";
import { getExpansionPool } from "./blogPostExpansions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "lib/blogPosts/posts");
const INDEX_PATH = path.join(ROOT, "lib/blogPosts/index.js");
const BLOG_POSTS_PATH = path.join(ROOT, "lib/blogPosts.js");
const SKIP_SLUG = "ai-receptionist-for-restaurants";

const ALL_SLUGS = [
  "ai-receptionist-for-restaurants",
  "best-restaurant-pos-system-pakistan",
  "biryani-restaurant-pos-features",
  "cloud-kitchen-pos-system-pakistan",
  "easypaisa-jazzcash-restaurant-pos",
  "fast-food-franchise-pos-requirements",
  "food-cost-percentage-restaurant-guide",
  "kitchen-display-system-fast-food",
  "multi-branch-restaurant-management-software",
  "online-ordering-without-foodpanda-commission",
  "qr-code-menu-restaurant-pakistan",
  "reduce-order-errors-fast-food",
  "restaurant-crm-repeat-customers-pakistan",
  "restaurant-delivery-rider-management-app",
  "restaurant-end-of-day-report-cash-reconciliation",
  "restaurant-inventory-management-tips",
  "restaurant-management-software-vs-excel",
  "restaurant-pos-software-lahore-karachi-islamabad",
  "restaurant-website-with-online-ordering-free",
  "whatsapp-ai-receptionist-restaurants",
];

function p(text) {
  return { type: "p", text };
}
function h2(text) {
  return { type: "h2", text };
}
function h3(text) {
  return { type: "h3", text };
}
function ul(items) {
  return { type: "ul", items };
}
function cta(text, href, buttonLabel) {
  return { type: "cta", text, href, buttonLabel };
}

function countPostWords(post) {
  let n = 0;
  const add = (s) => {
    n += s.split(/\s+/).filter(Boolean).length;
  };
  for (const sec of post.sections) {
    if (sec.text) add(sec.text);
    if (sec.items) add(sec.items.join(" "));
  }
  for (const f of post.faq) {
    add(f.question);
    add(f.answer);
  }
  return n;
}

function finalizePost(post) {
  const words = countPostWords(post);
  post.readMinutes = Math.max(7, Math.ceil(words / 140));
  return post;
}

function padPost(post, minWords = 900, maxWords = 1100) {
  const pool = [...(post._padPool || []), ...getExpansionPool(post.slug)];
  const fallback =
    "EatsDesk helps fast food and QSR operators run counter, kitchen display, inventory, riders, storefront ordering, and WhatsApp AI receptionist from one restaurant OS—so tickets, menus, and reports stay aligned across every channel and branch.";
  let guard = 0;
  while (countPostWords(post) < minWords && guard < 80) {
    const insertAt = post.sections.findIndex((s) => s.type === "cta" && s.href === "/signup");
    const idx = insertAt >= 0 ? insertAt : post.sections.length;
    if (guard % 4 === 0 && guard > 0) {
      post.sections.splice(idx, 0, h2("Operational detail worth getting right"));
    }
    const text = pool[guard] ?? fallback;
    post.sections.splice(idx, 0, p(text));
    guard++;
  }
  while (countPostWords(post) > maxWords && guard < 200) {
    const removable = post.sections.findIndex(
      (s, i) => s.type === "p" && i > 4 && s.text.length > 120,
    );
    if (removable < 0) break;
    post.sections.splice(removable, 1);
  }
  delete post._padPool;
  return finalizePost(post);
}

function serializePost(post) {
  const { _padPool, ...clean } = post;
  return `export default ${JSON.stringify(clean, null, 2)};\n`;
}

function slugToImportVar(slug) {
  return slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function writeIndex() {
  const imports = ALL_SLUGS.map(
    (slug) => `import ${slugToImportVar(slug)} from './posts/${slug}.js';`,
  ).join("\n");
  const list = ALL_SLUGS.map((slug) => `  ${slugToImportVar(slug)},`).join("\n");
  const content = `/**
 * EatsDesk marketing blog — static posts for SEO.
 * Generated/maintained via scripts/generateExpandedBlogPosts.mjs
 */

${imports}

const posts = [
${list}
];

export function getAllBlogPosts() {
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  );
}

export function getBlogPost(slug) {
  return posts.find((p) => p.slug === slug) || null;
}

export function getBlogSlugs() {
  return posts.map((p) => p.slug);
}
`;
  fs.writeFileSync(INDEX_PATH, content, "utf8");
}

function writeBlogPostsReexport() {
  fs.writeFileSync(
    BLOG_POSTS_PATH,
    `export { getAllBlogPosts, getBlogPost, getBlogSlugs } from './blogPosts/index.js';\n`,
    "utf8",
  );
}

function printWordTable(results) {
  const header = ["Slug", "Words", "Status"];
  const rows = results.map(({ slug, words, ok }) => [slug, String(words), ok ? "OK" : "SHORT"]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const line = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log("\nBlog post word counts (sections + FAQ):\n");
  console.log(line(header));
  console.log(line(widths.map((w) => "-".repeat(w))));
  for (const row of rows) console.log(line(row));
  const shorts = results.filter((r) => !r.ok);
  if (shorts.length) {
    console.log(`\n⚠ ${shorts.length} post(s) under 900 words — re-run after fix.`);
  } else {
    console.log(`\n✓ All ${results.length} posts meet the 900-word minimum.`);
  }
}

async function main() {
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  const results = [];

  for (const [slug, builder] of Object.entries(POST_DEFINITIONS)) {
    if (slug === SKIP_SLUG) continue;
    const post = padPost(builder());
    const words = countPostWords(post);
    const filePath = path.join(POSTS_DIR, `${slug}.js`);
    fs.writeFileSync(filePath, serializePost(post), "utf8");
    results.push({ slug, words, ok: words >= 900 });
    console.log(`Wrote ${slug}.js (${words} words)`);
  }

  writeIndex();
  writeBlogPostsReexport();
  console.log(`\nWrote ${INDEX_PATH}`);
  console.log(`Updated ${BLOG_POSTS_PATH}`);

  for (const slug of ALL_SLUGS) {
    if (results.some((r) => r.slug === slug)) continue;
    const mod = await import(`file://${path.join(POSTS_DIR, `${slug}.js`)}`);
    const words = countPostWords(mod.default);
    results.push({ slug, words, ok: words >= 900 });
  }

  results.sort((a, b) => a.slug.localeCompare(b.slug));
  printWordTable(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
