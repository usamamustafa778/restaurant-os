import Link from "next/link";

export default function BlogPostBody({ sections = [] }) {
  return (
    <article className="ed-blog-article">
      {sections.map((block, i) => {
        if (block.type === "h2") {
          return <h2 key={i}>{block.text}</h2>;
        }
        if (block.type === "h3") {
          return <h3 key={i}>{block.text}</h3>;
        }
        if (block.type === "ul") {
          return (
            <ul key={i}>
              {(block.items || []).map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "cta") {
          return (
            <div key={i} className="ed-blog-inline-cta">
              <p>{block.text}</p>
              {block.href ? (
                <Link href={block.href} className="ed-btn ed-btn-primary ed-btn-sm">
                  {block.buttonLabel || "Start free trial →"}
                </Link>
              ) : null}
            </div>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </article>
  );
}
