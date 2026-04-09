import Link from "next/link";

const WHATSAPP_CONTACT_MESSAGE =
  "Hi EatsDesk! I found you online and I'm interested in learning more about your restaurant management system. Can you tell me more?";

function getWhatsAppContactHref() {
  const raw =
    process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/923166222269";
  const base = raw.split("?")[0].trim();
  return `${base}?text=${encodeURIComponent(WHATSAPP_CONTACT_MESSAGE)}`;
}

const SOCIAL_LINKS = [
  { label: "X (Twitter)", href: "https://x.com/eatsdesk" },
  { label: "Instagram", href: "https://instagram.com/eatsdesk.app" },
  { label: "LinkedIn", href: "https://linkedin.com/eatsdesk" },
  { label: "Facebook", href: "https://facebook.com/eatsdesk" },
];

export default function MarketingFooter() {
  const year = new Date().getFullYear();
  const whatsappHref = getWhatsAppContactHref();

  return (
    <footer className="site-footer">
      <div className="site-footer-accent" aria-hidden />
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" className="footer-brand-logo nav-logo">
            <img
              className="nav-logo-mark"
              src="/favicon.png"
              alt="EatsDesk"
              width={32}
              height={32}
            />
            <span className="nav-logo-text">EatsDesk</span>
          </Link>
          <p className="footer-brand-desc">
            Restaurant OS for fast food — POS, kitchen, riders, inventory, and
            your site in one place.
          </p>
        </div>

        <nav className="footer-col" aria-label="Product">
          <h4 className="footer-col-title">Product</h4>
          <ul className="footer-link-list">
            <li>
              <Link href="/#features">Features</Link>
            </li>
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/#compare">Compare plans</Link>
            </li>
            <li>
              <Link href="/#how">How it works</Link>
            </li>
            <li>
              <Link href="/#faq">FAQ</Link>
            </li>
          </ul>
        </nav>

        <nav className="footer-col" aria-label="Account and policies">
          <h4 className="footer-col-title">Account</h4>
          <ul className="footer-link-list">
            <li>
              <Link href="/login">Sign in</Link>
            </li>
            <li>
              <Link href="/signup">Start free trial</Link>
            </li>
            <li>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link-wa"
              >
                Contact
              </a>
            </li>
            <li>
              <Link href="/privacy-policy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms-and-conditions">Terms</Link>
            </li>
          </ul>
        </nav>

        <nav className="footer-col" aria-label="Social links">
          <h4 className="footer-col-title">Socials</h4>
          <ul className="footer-link-list">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.href}>
                <a href={social.href} target="_blank" rel="noopener noreferrer">
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="footer-bottom">
        <span className="footer-legal">© {year} EatsDesk</span>
        <span className="footer-domain" translate="no">
          eatsdesk.com
        </span>
      </div>
    </footer>
  );
}
