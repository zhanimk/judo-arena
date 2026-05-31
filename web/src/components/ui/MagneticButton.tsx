import { useRef } from "react";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
  as?: "button" | "a";
  href?: string;
}

export function MagneticButton({
  children, className = "", strength = 0.35, onClick, as: Tag = "button", href,
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * strength;
    const y = (e.clientY - r.top - r.height / 2) * strength;
    el.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0,0) scale(1)";
    el.style.transition = "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)";
    setTimeout(() => { if (el) el.style.transition = ""; }, 400);
  };

  const props = {
    ref: (node: HTMLElement | null) => { (ref as React.MutableRefObject<HTMLElement | null>).current = node; },
    className,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onClick,
    style: { transition: "transform 0.1s ease-out", willChange: "transform" },
    ...(href ? { href } : {}),
  };

  if (Tag === "a") {
    return <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)} ref={props.ref as React.RefCallback<HTMLAnchorElement>}>{children}</a>;
  }
  return <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)} ref={props.ref as React.RefCallback<HTMLButtonElement>} type="button">{children}</button>;
}
