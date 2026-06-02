import { useEffect, useRef } from "react";

export function useScrollReveal(rootMargin = "0px 0px -40px 0px") {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = el.querySelectorAll<HTMLElement>(".reveal, .reveal-left, .reveal-right");
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );

    for (const t of targets) {
      // Already in viewport on mount → make visible immediately, no animation needed
      const rect = t.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        t.classList.add("visible");
      } else {
        observer.observe(t);
      }
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  return ref;
}
