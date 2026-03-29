"use client";

import Link from "next/link";
import { useEffect } from "react";
import MarketingFooter from "./MarketingFooter";

export default function LegalPageShell({ title, lastUpdated, children }) {
  useEffect(() => {
    const nav = document.getElementById("nav");
    const onScroll = () =>
      nav?.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="eatsdesk-landing legal-doc-page">
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
              <Link href="/#how">How it works</Link>
            </li>
            <li>
              <Link href="/#testimonials">Reviews</Link>
            </li>
            <li>
              <Link href="/#compare">Compare</Link>
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

      <section className="legal-doc-hero">
        <div className="legal-doc-hero-inner">
          <Link href="/" className="legal-doc-back">
            ← Back to home
          </Link>
          <h1>{title}</h1>
          <p className="legal-doc-updated">Last updated: {lastUpdated}</p>
        </div>
      </section>

      <div className="legal-doc-body">
        <div className="legal-doc-inner">{children}</div>
      </div>

      <section className="cta-section">
        <div className="section-inner">
          <h2 className="cta-title">
            Your restaurant deserves
            <br />
            better than paper.
          </h2>
          <p className="cta-sub">
            30 days free. We set everything up. You start taking orders the
            same day.
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
