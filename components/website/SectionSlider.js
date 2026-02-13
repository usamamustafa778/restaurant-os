import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Section Slider – horizontal carousel with auto-slide.
 * Shared by live website and dashboard preview.
 */
export default function SectionSlider({
  items,
  visibleDesktop,
  visibleMobile,
  renderItem,
  primaryColor,
  autoSlideDelay = 3000,
  forceMobile = false,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const autoRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (forceMobile) return;
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [forceMobile]);

  const effectiveMobile = forceMobile || isMobile;
  const visibleCount = effectiveMobile ? visibleMobile : visibleDesktop;
  const needsSlider = items.length > visibleCount;
  const totalDots = needsSlider ? items.length - visibleCount + 1 : 0;

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    const card = el.querySelector(`[data-slide-item]`);
    if (card) {
      const cardW = card.offsetWidth + 20;
      const idx = Math.round(el.scrollLeft / cardW);
      setActiveIndex(idx);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, items, mounted]);

  const smoothScrollTo = useCallback((el, target, duration = 800) => {
    const start = el.scrollLeft;
    const distance = target - start;
    let startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      el.scrollLeft = start + distance * ease;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  const startAutoSlide = useCallback(() => {
    if (!needsSlider) return;
    if (autoRef.current) clearInterval(autoRef.current);
    const el = scrollRef.current;
    if (!el) return;
    autoRef.current = setInterval(() => {
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
      if (atEnd) {
        smoothScrollTo(el, 0);
      } else {
        const card = el.querySelector(`[data-slide-item]`);
        const gap = 20;
        const cardW = card ? card.offsetWidth + gap : 240;
        smoothScrollTo(el, el.scrollLeft + cardW);
      }
    }, autoSlideDelay);
  }, [needsSlider, autoSlideDelay, smoothScrollTo]);

  useEffect(() => {
    startAutoSlide();
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [startAutoSlide]);

  const pauseAuto = () => {
    if (autoRef.current) clearInterval(autoRef.current);
  };
  const resumeAuto = () => startAutoSlide();

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector(`[data-slide-item]`);
    const gap = 20;
    const cardW = card ? card.offsetWidth + gap : 240;
    smoothScrollTo(el, el.scrollLeft + dir * cardW);
  };

  const scrollToDot = (dotIdx) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector(`[data-slide-item]`);
    const gap = 20;
    const cardW = card ? card.offsetWidth + gap : 240;
    smoothScrollTo(el, dotIdx * cardW);
  };

  const gapPx = 20;
  const mobileWidth = `calc((100% - ${(visibleMobile - 1) * gapPx}px) / ${visibleMobile})`;
  const desktopWidth = `calc((100% - ${(visibleDesktop - 1) * gapPx}px) / ${visibleDesktop})`;
  const itemWidth = mounted ? (effectiveMobile ? mobileWidth : desktopWidth) : mobileWidth;

  return (
    <div className="relative group/slider" onMouseEnter={pauseAuto} onMouseLeave={resumeAuto}>
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 -ml-4 opacity-0 group-hover/slider:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 -mr-4 opacity-0 group-hover/slider:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      )}

      <div
        ref={scrollRef}
        className={`flex gap-5 scroll-smooth sl-hide-sb pb-12 -my-4 ${needsSlider ? "overflow-x-auto" : "overflow-x-hidden justify-center"}`}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <style>{`.sl-hide-sb::-webkit-scrollbar { display: none; }
@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.animate-spin-slow { animation: spin-slow 12s linear infinite; }`}</style>
        {items.map((item, i) => (
          <div key={item.id || i} data-slide-item style={{ width: itemWidth, flexShrink: 0 }}>
            {renderItem(item)}
          </div>
        ))}
      </div>

      {needsSlider && totalDots > 1 && (
        <div className="flex justify-center gap-2 mt-0">
          {Array.from({ length: totalDots }).map((_, dotIdx) => (
            <button
              key={dotIdx}
              onClick={() => scrollToDot(dotIdx)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: activeIndex === dotIdx ? 24 : 8,
                height: 8,
                backgroundColor:
                  activeIndex === dotIdx ? (primaryColor || "#ef4444") : "#d1d5db",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
