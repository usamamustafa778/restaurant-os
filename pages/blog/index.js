import SEO, { generateBreadcrumbSchema } from "../../components/SEO";
import BlogPageShell from "../../components/BlogPageShell";
import BlogCard from "../../components/BlogCard";
import { getAllBlogPosts } from "../../lib/blogPosts";

const BASE_URL = "https://eatsdesk.com";

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "EatsDesk Blog",
    description:
      "Restaurant operations, POS, kitchen display, online ordering, and AI tips for fast food businesses.",
    url: `${BASE_URL}/blog`,
    publisher: {
      "@type": "Organization",
      name: "EatsDesk",
      url: BASE_URL,
    },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      url: `${BASE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt,
      author: { "@type": "Organization", name: post.author },
    })),
  };

  const breadcrumbs = generateBreadcrumbSchema([
    { name: "Home", url: BASE_URL },
    { name: "Blog", url: `${BASE_URL}/blog` },
  ]);

  return (
    <>
      <SEO
        title="Restaurant POS, KDS & Operations Blog"
        description="Guides on restaurant POS, kitchen display systems, commission-free online ordering, WhatsApp AI, and inventory for fast food operators."
        keywords="restaurant blog, POS tips Pakistan, kitchen display system, online ordering restaurant, fast food operations, cloud kitchen POS, Easypaisa JazzCash restaurant, restaurant software Lahore Karachi, EatsDesk guides"
        canonical={`${BASE_URL}/blog`}
        structuredData={[structuredData, breadcrumbs]}
      />
      <BlogPageShell
        title="Insights for restaurant operators"
        eyebrow="EatsDesk Blog"
        meta={
          <p>
            Practical guides on POS, kitchen operations, online ordering, and AI
            — written for fast food and QSR teams.
          </p>
        }
        backHref="/"
        backLabel="← Back to home"
      >
        <div className="blog-grid">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </BlogPageShell>
    </>
  );
}
