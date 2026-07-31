import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""
).trim();

const AUTH_PATHS = new Set(["/login", "/signup"]);
const CONSENT_COOKIE = "eatsdesk_analytics_consent";

function hasAnalyticsConsent() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((item) => item === `${CONSENT_COOKIE}=granted`);
}

export function trackAuthEvent(name, params = {}) {
  if (
    typeof window === "undefined" ||
    !GA_MEASUREMENT_ID ||
    typeof window.gtag !== "function"
  ) {
    return;
  }
  window.gtag("event", name, params);
}

/**
 * GA4 is intentionally limited to public auth pages so restaurant dashboard
 * activity does not inflate marketing traffic.
 */
export default function AuthAnalytics() {
  const router = useRouter();
  const [consented, setConsented] = useState(false);
  const enabled = consented && AUTH_PATHS.has(router.pathname);

  useEffect(() => {
    setConsented(hasAnalyticsConsent());
  }, []);

  useEffect(() => {
    if (!enabled || !GA_MEASUREMENT_ID) return undefined;
    const handleRouteChange = (url) => {
      const path = String(url || "").split("?")[0];
      if (!AUTH_PATHS.has(path) || typeof window.gtag !== "function") return;
      window.gtag("config", GA_MEASUREMENT_ID, {
        page_path: url,
        page_location: window.location.href,
        page_title: document.title,
      });
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [enabled, router.events]);

  if (!enabled || !GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="auth-ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('set', 'linker', {
            domains: ['eatsdesk.com', 'app.eatsdesk.com', 'eatsdesk.app'],
            accept_incoming: true
          });
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname + window.location.search,
            page_location: window.location.href,
            page_title: document.title,
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}
