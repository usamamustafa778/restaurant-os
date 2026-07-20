import Link from "next/link";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function BlogCard({ post, featured = false }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`ed-blog-card${featured ? " ed-blog-card--featured" : ""}`}
    >
      <div className="ed-blog-card-top">
        <span className="ed-blog-card-category">{post.category}</span>
        <span className="ed-blog-card-mins">{post.readMinutes} min</span>
      </div>
      <h2 className="ed-blog-card-title">{post.title}</h2>
      <p className="ed-blog-card-desc">{post.description}</p>
      <div className="ed-blog-card-footer">
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        <span className="ed-blog-card-more">
          Read article
          <span aria-hidden> →</span>
        </span>
      </div>
    </Link>
  );
}
