import { useEffect, useState } from "react";
import { useRouter } from "next/router";

/**
 * Thin top progress bar for Pages Router soft navigations.
 * Makes slow chunk loads feel intentional instead of "stuck".
 */
export default function RouteProgressBar() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let trickleTimer;
    let hideTimer;

    const clearTimers = () => {
      if (trickleTimer) clearInterval(trickleTimer);
      if (hideTimer) clearTimeout(hideTimer);
      trickleTimer = null;
      hideTimer = null;
    };

    const start = () => {
      clearTimers();
      setVisible(true);
      setWidth(12);
      trickleTimer = setInterval(() => {
        setWidth((w) => {
          if (w >= 88) return w;
          return w + Math.max(1, (90 - w) * 0.08);
        });
      }, 200);
    };

    const done = () => {
      clearTimers();
      setWidth(100);
      hideTimer = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 180);
    };

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", done);
    router.events.on("routeChangeError", done);
    return () => {
      clearTimers();
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", done);
      router.events.off("routeChangeError", done);
    };
  }, [router.events]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5"
    >
      <div
        className="h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-200 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
