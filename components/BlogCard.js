import Link from "next/link";

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

export default function BlogCard({ post }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card">
      <span className="blog-card-category">{post.category}</span>
      <h2 className="blog-card-title">{post.title}</h2>
      <p className="blog-card-desc">{post.description}</p>
      <div className="blog-card-footer">
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        <span>{post.readMinutes} min read</span>
      </div>
    </Link>
  );
}
