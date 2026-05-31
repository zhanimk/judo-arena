import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 1800, startOnMount = false) {
  const [value, setValue] = useState(startOnMount ? 0 : target);
  const [started, setStarted] = useState(startOnMount);
  const ref = useRef<HTMLElement | null>(null);

  // Trigger via IntersectionObserver when element enters viewport
  useEffect(() => {
    if (startOnMount) { setStarted(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [startOnMount]);

  useEffect(() => {
    if (!started) return;
    if (target === 0) { setValue(0); return; }
    let startTime: number | null = null;
    const startVal = 0;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);

  return { value, ref };
}
