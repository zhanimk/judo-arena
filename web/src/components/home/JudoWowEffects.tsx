/**
 * Three "wow" visual sections for the homepage.
 *
 * BeltUniverse   — CSS 3D armillary sphere из поясов дзюдо
 * IPPONParticles — Canvas-частицы формируют текст IPPON, рассыпаются от мыши
 * IPPONImpact    — Анимированный удар: текст падает + ударные волны + искры
 */

import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Award, ChevronRight, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

// ─────────────────────────────────────────────────────────────
// 1. BELT UNIVERSE — CSS 3D armillary sphere
// ─────────────────────────────────────────────────────────────

const BELT_RINGS = [
  { color: "#f5f5e8", label: "Ақ",      rotateX: 0   },
  { color: "#fbbf24", label: "Сары",    rotateX: 36  },
  { color: "#f97316", label: "Қызғылт", rotateX: 72  },
  { color: "#22c55e", label: "Жасыл",   rotateX: 108 },
  { color: "#38bdf8", label: "Көк",     rotateX: 144 },
  { color: "#92400e", label: "Қоңыр",   rotateX: 90  },
] as const;

export function BeltUniverse() {
  const { t } = useTranslation();
  return (
    <section className="relative py-20 sm:py-28 border-y border-gold/20 bg-navy-deep/70 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-15" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full conic-gold opacity-8 blur-3xl animate-spin-conic pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">

          {/* Left — text */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-4">
              {t("home.belt_tagline")}
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
              {t("home.belt_title")}<br />
              <span className="text-gradient-gold italic">{t("home.belt_title_accent")}</span>
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed max-w-md">
              {t("home.belt_desc")}
            </p>

            {/* Belt color chips */}
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              {[
                { key: "home.belt_white",  bg: "bg-white border border-zinc-300" },
                { key: "home.belt_yellow", bg: "bg-yellow-400" },
                { key: "home.belt_orange", bg: "bg-orange-500" },
                { key: "home.belt_green",  bg: "bg-emerald-500" },
                { key: "home.belt_blue",   bg: "bg-sky-500" },
                { key: "home.belt_brown",  bg: "bg-amber-800" },
                { key: "home.belt_black",  bg: "bg-zinc-900 border border-gold/40" },
              ].map((b) => (
                <div key={b.key} className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded-sm shadow ${b.bg}`} />
                  <span className="text-[10px] text-muted-foreground">{t(b.key)}</span>
                </div>
              ))}
            </div>

            <Link
              to="/rankings"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm text-gold hover:border-gold/60 transition-colors"
            >
              {t("home.belt_cta")} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Right — 3D sphere */}
          <div className="flex justify-center" style={{ perspective: "900px" }}>
            <div
              className="relative w-72 h-72 animate-belt-orbit"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Centre glow */}
              <div className="absolute inset-[28%] rounded-full bg-gold/25 blur-2xl" />
              {/* Centre orb */}
              <div className="absolute inset-[38%] rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_0_40px_10px_oklch(0.78_0.14_85/0.5)]" />

              {/* Rings */}
              {BELT_RINGS.map(({ color, rotateX }, i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `2.5px solid ${color}`,
                    opacity: 0.75,
                    transform: `rotateX(${rotateX}deg)`,
                  }}
                />
              ))}

              {/* Extra polar ring (slightly larger) */}
              <div
                className="absolute rounded-full"
                style={{
                  inset: "-10px",
                  border: "1.5px solid rgba(212,175,55,0.35)",
                  transform: "rotateX(90deg)",
                }}
              />

              {/* Floating dots in 3D space */}
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={`dot${i}`}
                  className="absolute w-1.5 h-1.5 rounded-full bg-gold/70 animate-float"
                  style={{
                    top: `${15 + (i * 41) % 70}%`,
                    left: `${10 + (i * 57) % 80}%`,
                    animationDelay: `${(i * 0.6) % 5}s`,
                    transform: `translateZ(${70 + i * 12}px)`,
                    opacity: 0.3 + (i % 4) * 0.15,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. IPPON PARTICLES — canvas text particles
// ─────────────────────────────────────────────────────────────

export function IPPONParticles() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Sample "IPPON" from offscreen canvas
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d")!;
    const fontSize = Math.min(W / 4.5, 120);
    octx.fillStyle = "white";
    octx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText("IPPON", W / 2, H / 2);

    const imgData = octx.getImageData(0, 0, W, H).data;
    const targets: { x: number; y: number }[] = [];
    const step = 5;
    for (let x = 0; x < W; x += step) {
      for (let y = 0; y < H; y += step) {
        if (imgData[(y * W + x) * 4 + 3] > 120) {
          targets.push({ x, y });
        }
      }
    }

    type P = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; r: number; a: number };
    const particles: P[] = targets.map((t) => ({
      x: Math.random() * W,
      y: Math.random() < 0.5 ? -20 : H + 20,
      tx: t.x,
      ty: t.y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      r: 1.2 + Math.random() * 1.4,
      a: 0.55 + Math.random() * 0.45,
    }));

    let mouse = { x: -999, y: -999 };
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(212,175,55,0.7)";

      for (const p of particles) {
        // Spring towards target
        p.vx += (p.tx - p.x) * 0.045;
        p.vy += (p.ty - p.y) * 0.045;

        // Mouse repulsion
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const d = Math.sqrt(mdx * mdx + mdy * mdy);
        if (d < 85 && d > 0) {
          const f = ((85 - d) / 85) * 5.5;
          p.vx += (mdx / d) * f;
          p.vy += (mdy / d) * f;
        }

        p.vx *= 0.83;
        p.vy *= 0.83;
        p.x += p.vx;
        p.y += p.vy;

        ctx.fillStyle = `rgba(212,175,55,${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse = {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    };
    const onLeave = () => { mouse = { x: -999, y: -999 }; };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section className="relative py-20 border-y border-gold/20 bg-navy-deep/85 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      <div className="absolute -left-32 top-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-gold/8 blur-3xl pointer-events-none" />
      <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/8 blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-10">
          <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-3">{t("home.particles_tagline")}</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            {t("home.particles_title")}{" "}
            <span className="text-gradient-gold italic">{t("home.particles_title_accent")}</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("home.particles_hint")}
          </p>
        </div>

        <div className="relative mx-auto max-w-2xl">
          <canvas
            ref={canvasRef}
            width={700}
            height={210}
            className="w-full rounded-2xl border border-gold/15 bg-background/10 backdrop-blur cursor-crosshair"
          />
          {/* Glow frame */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_-20px_oklch(0.78_0.14_85/0.2)]" />
        </div>

        <div className="mt-8 flex justify-center gap-8 text-center">
          {[
            { label: "IPPON",    descKey: "home.ippon_score_victory" },
            { label: "WAZA-ARI", descKey: "home.ippon_score_half" },
            { label: "SHIDO",    descKey: "home.ippon_score_penalty" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-display text-sm font-bold text-gold">{s.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t(s.descKey)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. IPPON IMPACT — drop animation + shockwaves + sparks
// ─────────────────────────────────────────────────────────────

const SPARKS = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2;
  const dist = 65 + (i % 3) * 35;
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist),
    delay: `${((i * 0.09) % 0.6).toFixed(2)}s`,
    size: 2 + (i % 3),
  };
});

export function IPPONImpact() {
  const { t } = useTranslation();
  return (
    <section className="relative py-24 border-y border-gold/25 bg-navy-deep overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-20" />
      {/* radial glow from center */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_70%_50%,oklch(0.78_0.14_85/0.07),transparent)] pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

          {/* Left — text */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-4">
              {t("home.ippon_tagline")}
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
              {t("home.ippon_title")}<br />
              <span className="text-gradient-gold italic">{t("home.ippon_title_accent")}</span>
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed max-w-md">
              {t("home.ippon_desc")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { icon: Zap, label: "Real-time", subKey: "home.ippon_realtime_sub" },
                { icon: Award, label: t("home.ippon_auto_label"), subKey: "home.ippon_auto_sub" },
              ].map(({ icon: Icon, label, subKey }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl border border-gold/20 bg-card/50 px-4 py-2.5">
                  <Icon className="h-4 w-4 text-gold" />
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-[10px] text-muted-foreground">{t(subKey)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — animated impact visual */}
          <div className="flex justify-center">
            <div className="relative w-80 h-80 flex items-center justify-center">

              {/* Shockwave rings (3 staggered) */}
              {[0, 0.93, 1.86].map((delay, i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-full border border-gold/50 animate-shockwave"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}

              {/* Inner glow circle */}
              <div className="absolute w-28 h-28 rounded-full bg-gold/10 blur-2xl animate-gold-pulse" />

              {/* Gold sparks */}
              {SPARKS.map((s, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-gold animate-spark"
                  style={{
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    "--spark-dx": `${s.dx}px`,
                    "--spark-dy": `${s.dy}px`,
                    animationDelay: s.delay,
                  } as React.CSSProperties}
                />
              ))}

              {/* IPPON text drop */}
              <div className="relative z-10 text-center animate-ippon-drop">
                <div className="font-display text-[4.5rem] sm:text-8xl font-black text-gradient-gold tracking-tighter text-3d leading-none">
                  IPPON
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.45em] text-gold/60">
                  {t("home.ippon_win_kanji")}
                </div>
              </div>

              {/* Ground shimmer line */}
              <div className="absolute bottom-6 left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent animate-shimmer" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
