import type { MouseEvent } from "react";

export function useRipple() {
  const trigger = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.5;
    const dot = document.createElement("span");
    dot.className = "ripple-dot";
    dot.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${e.clientX - r.left - size / 2}px;
      top: ${e.clientY - r.top - size / 2}px;
    `;
    el.classList.add("ripple-container");
    el.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove(), { once: true });
  };
  return { trigger };
}
