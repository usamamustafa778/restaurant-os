/** Shared helpers for blog post content modules */

export function p(text) {
  return { type: "p", text };
}
export function h2(text) {
  return { type: "h2", text };
}
export function h3(text) {
  return { type: "h3", text };
}
export function ul(items) {
  return { type: "ul", items };
}
export function cta(text, href, buttonLabel) {
  return { type: "cta", text, href, buttonLabel };
}

export function baseMeta(slug, title, description, keywords, category, publishedAt) {
  return { slug, title, description, keywords, category, publishedAt, author: "EatsDesk Team" };
}

export function finish(meta, bodySections, faq, related, padPool = []) {
  return () => ({
    ...meta,
    faq,
    sections: [
      ...bodySections,
      cta(related.text, related.href, related.buttonLabel),
      h2("Putting it into practice"),
      p(
        "Pick one bottleneck this week, measure it for seven days, then change one control—modifiers, handoff rules, or reporting cadence. Restaurants that improve fastest run tight feedback loops, not annual overhauls.",
      ),
      cta(
        "Run counter, kitchen, and delivery on one system with EatsDesk.",
        "/signup",
        "Start free trial →",
      ),
    ],
    _padPool: padPool,
  });
}
