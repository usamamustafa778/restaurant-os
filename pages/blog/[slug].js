import Link from "next/link";
import SEO, { generateBreadcrumbSchema } from "../../components/SEO";
import BlogPageShell from "../../components/BlogPageShell";
import BlogPostBody from "../../components/BlogPostBody";
import {
  getAllBlogPosts,
  getBlogPost,
  getBlogSlugs,
} from "../../lib/blogPosts";

const BASE_URL = "https://eatsdesk.com";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function BlogPostPage({ post }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "EatsDesk",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/favicon.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${post.slug}`,
    },
    keywords: post.keywords,
  };

  const breadcrumbs = generateBreadcrumbSchema([
    { name: "Home", url: BASE_URL },
    { name: "Blog", url: `${BASE_URL}/blog` },
    { name: post.title, url: `${BASE_URL}/blog/${post.slug}` },
  ]);

  return (
    <>
      <SEO
        title={post.title}
        description={post.description}
        keywords={post.keywords}
        canonical={`${BASE_URL}/blog/${post.slug}`}
        ogType="article"
        structuredData={[structuredData, breadcrumbs]}
      />
      <BlogPageShell
        title={post.title}
        eyebrow={post.category}
        meta={
          <>
            <time dateTime={post.publishedAt}>
              {formatDate(post.publishedAt)}
            </time>
            <span className="blog-meta-dot" aria-hidden>
              ·
            </span>
            <span>{post.readMinutes} min read</span>
            <span className="blog-meta-dot" aria-hidden>
              ·
            </span>
            <span>{post.author}</span>
          </>
        }
      >
        <BlogPostBody sections={post.sections} />
        <div className="blog-post-cta">
          <h3>Try EatsDesk on your next dinner rush</h3>
          <p>
            POS, kitchen display, riders, inventory, website ordering, and
            WhatsApp AI Receptionist — one platform. 30-day free trial.
          </p>
          <Link href="/signup" className="btn btn-primary">
            Start free trial →
          </Link>
        </div>
      </BlogPageShell>
    </>
  );
}

export async function getStaticPaths() {
  return {
    paths: getBlogSlugs().map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const post = getBlogPost(params.slug);
  if (!post) {
    return { notFound: true };
  }
  return {
    props: { post },
    revalidate: 86400,
  };
}
