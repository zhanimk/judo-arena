/**
 * HoldButton — кнопка с защитой от случайного нажатия.
 *
 * Требует удержания (hold) заданное время (по умолчанию 600ms) для срабатывания.
 * Показывает прогресс-дугу пока пользователь удерживает.
 * Используется для необратимых действий: IPPON, HANSOKU-MAKE, Finish match.
 *
 * Работает как с мышью так и с тач-событиями (pointerdown/pointerup/pointerleave/pointercancel).
 */

import { useRef, useState, useCallback, useEffect } from "react";

interface HoldButtonProps {
  /** Callback срабатывает только после успешного удержания */
  onHold: () => void;
  /** Время удержания в мс (по умолчанию 600ms) */
  holdMs?: number;
  disabled?: boolean;
  /** Дочерний контент кнопки */
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  /** Цвет прогресс-дуги (по умолчанию #fbbf24) */
  progressColor?: string;
  ariaLabel?: string;
}

export function HoldButton({
  onHold,
  holdMs = 600,
  disabled = false,
  children,
  style,
  className,
  progressColor = "#fbbf24",
  ariaLabel,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0); // 0..1
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;
    firedRef.current = false;
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    firedRef.current = false;
    startTimeRef.current = performance.now();

    const tick = () => {
      if (startTimeRef.current === null) return;
      const elapsed = performance.now() - startTimeRef.current;
      const p = Math.min(elapsed / holdMs, 1);
      setProgress(p);

      if (p >= 1 && !firedRef.current) {
        firedRef.current = true;
        startTimeRef.current = null;
        setProgress(0);
        // Haptic feedback on mobile
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(80);
        }
        onHold();
        return;
      }
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, holdMs, onHold]);

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const isActive = progress > 0;
  const SIZE = 44; // SVG canvas size
  const R = 18;    // circle radius
  const C = 2 * Math.PI * R;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      style={{
        position: "relative",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      // Prevent default click so we don't double-fire
      onClick={(e) => e.preventDefault()}
    >
      {children}

      {/* Progress ring overlay — only visible while holding */}
      {isActive && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          {/* Background ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={4}
          />
          {/* Progress arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={progressColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: "stroke-dashoffset 16ms linear" }}
          />
        </svg>
      )}
    </button>
  );
}
