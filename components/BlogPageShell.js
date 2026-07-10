"use client";

import Link from "next/link";
import { useEffect } from "react";
import MarketingFooter from "./MarketingFooter";

export default function BlogPageShell({
  title,
  eyebrow = "Blog",
  meta,
  backHref = "/blog",
  backLabel = "← All articles",
  children,
}) {
  useEffect(() => {
    const nav = document.getElementById("nav");
    const onScroll = () =>
      nav?.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="eatsdesk-landing blog-page">
      <nav id="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <img
              className="nav-logo-mark"
              src="/favicon.png"
              alt="EatsDesk"
              width={34}
              height={34}
            />
            <span className="nav-logo-text">EatsDesk</span>
          </Link>
          <ul className="nav-links">
            <li>
              <Link href="/#features">Features</Link>
            </li>
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/blog">Blog</Link>
            </li>
            <li>
              <Link href="/#faq">FAQ</Link>
            </li>
          </ul>
          <div className="nav-cta">
            <Link href="/login" className="btn btn-ghost">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary">
              <span className="nav-trial-long">Start free trial →</span>
              <span className="nav-trial-short">Free trial →</span>
            </Link>
          </div>
        </div>
      </nav>

      <section className="blog-hero">
        <div className="blog-hero-inner">
          <Link href={backHref} className="blog-back">
            {backLabel}
          </Link>
          <p className="blog-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {meta ? <div className="blog-meta">{meta}</div> : null}
        </div>
      </section>

      <div className="blog-body">
        <div className="blog-inner">{children}</div>
      </div>

      <section className="cta-section">
        <div className="section-inner">
          <h2 className="cta-title">
            Ready to run your restaurant
            <br />
            on one screen?
          </h2>
          <p className="cta-sub">
            30 days free. POS, kitchen, riders, inventory, and your website —
            no credit card required.
          </p>
          <Link href="/signup" className="btn btn-white">
            Start free — 30 days →
          </Link>
          <p className="cta-note">
            No credit card · No hardware · Cancel anytime
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
