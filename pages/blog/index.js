import { useMemo, useState } from "react";
import SEO, { generateBreadcrumbSchema } from "../../components/SEO";
import BlogPageShell from "../../components/BlogPageShell";
import BlogCard from "../../components/BlogCard";
import { getAllBlogPosts } from "../../lib/blogPosts";

const BASE_URL = "https://eatsdesk.com";

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = useMemo(() => {
    const set = new Set(posts.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [posts]);

  const filtered = useMemo(() => {
    if (activeCategory === "All") return posts;
    return posts.filter((p) => p.category === activeCategory);
  }, [posts, activeCategory]);

  const featured = activeCategory === "All" ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "EatsDesk Blog",
    description:
      "Restaurant operations, POS, kitchen display, online ordering, and AI tips for high volume restaurants.",
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
        description="Guides on restaurant POS, kitchen display systems, commission-free online ordering, WhatsApp AI, and inventory for high volume operators."
        keywords="restaurant blog, POS tips, kitchen display system, online ordering restaurant, fast food operations, cloud kitchen POS, restaurant software, EatsDesk guides"
        canonical={`${BASE_URL}/blog`}
        structuredData={[structuredData, breadcrumbs]}
      />
      <BlogPageShell
        title="Insights for high volume restaurants"
        eyebrow="EatsDesk Blog"
        meta={
          <p>
            Practical guides on POS, kitchen operations, online ordering, and AI
            — written for teams that run on rush hour.
          </p>
        }
        backHref="/"
        backLabel="← Back to home"
        toolbar={
          <div className="ed-blog-filters" role="tablist" aria-label="Categories">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                className={`ed-blog-filter${activeCategory === cat ? " is-active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        }
      >
        {featured ? (
          <div className="ed-blog-featured-wrap">
            <BlogCard post={featured} featured />
          </div>
        ) : null}

        {rest.length > 0 ? (
          <div className="ed-blog-grid">
            {rest.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="ed-blog-empty">No articles in this category yet.</p>
        )}
      </BlogPageShell>
    </>
  );
}
