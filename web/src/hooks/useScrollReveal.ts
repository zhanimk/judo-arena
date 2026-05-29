import { useEffect, useRef } from "react";

export function useScrollReveal(rootMargin = "0px 0px -60px 0px") {
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
      { rootMargin, threshold: 0.08 },
    );

    for (const t of targets) observer.observe(t);
    return () => observer.disconnect();
  }, [rootMargin]);

  return ref;
}
