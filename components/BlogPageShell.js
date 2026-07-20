import Link from "next/link";
import MarketingFooter from "./MarketingFooter";

export default function BlogPageShell({
  title,
  eyebrow = "Blog",
  meta,
  backHref = "/blog",
  backLabel = "← All articles",
  variant = "index",
  children,
  toolbar = null,
}) {
  const isArticle = variant === "article";

  return (
    <div className={`ed-home ed-blog${isArticle ? " ed-blog--article" : ""}`}>
      <nav className="ed-nav">
        <div className="ed-nav-inner">
          <Link href="/" className="ed-logo">
            <img src="/favicon.png" alt="" width={30} height={30} />
            EatsDesk
          </Link>
          <ul className="ed-nav-links">
            <li>
              <Link href="/#features">Features</Link>
            </li>
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/#how">Setup</Link>
            </li>
            <li>
              <Link href="/blog" className="is-active">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/#faq">FAQ</Link>
            </li>
          </ul>
          <div className="ed-nav-cta">
            <Link href="/login" className="ed-link-quiet">
              Sign in
            </Link>
            <Link href="/signup" className="ed-btn ed-btn-primary ed-btn-sm">
              Start free trial →
            </Link>
          </div>
        </div>
      </nav>

      <section className="ed-blog-hero">
        <div
          className={`ed-wrap ed-blog-hero-inner${isArticle ? " ed-blog-hero-inner--narrow" : ""}`}
        >
          <Link href={backHref} className="ed-blog-back">
            {backLabel}
          </Link>
          <div className="ed-badge ed-blog-badge">
            <span className="ed-badge-dot" />
            {eyebrow}
          </div>
          <h1 className="ed-blog-title">{title}</h1>
          {meta ? <div className="ed-blog-meta">{meta}</div> : null}
          {toolbar}
        </div>
      </section>

      <div className="ed-blog-body">
        <div
          className={`ed-wrap ed-blog-inner${isArticle ? " ed-blog-inner--narrow" : ""}`}
        >
          {children}
        </div>
      </div>

      <section className="ed-final">
        <div className="ed-wrap">
          <h2>
            Ready to run your restaurant
            <br />
            on <em>one system?</em>
          </h2>
          <p>
            30 days free on eligible modules. POS, kitchen, riders, inventory,
            and more — no credit card required.
          </p>
          <div className="ed-final-actions">
            <Link href="/signup" className="ed-btn ed-btn-primary">
              Start free — 30 days →
            </Link>
            <Link href="/#pricing" className="ed-btn ed-btn-ghost-dark">
              See pricing
            </Link>
          </div>
          <div className="ed-final-note">
            No credit card · No hardware · Cancel anytime
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
