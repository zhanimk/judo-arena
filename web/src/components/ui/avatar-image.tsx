/**
 * Avatar — круглый аватар пользователя с lazy loading и fallback-инициалами.
 *
 * Всегда lazy (loading="lazy", decoding="async").
 * Если изображение не загружается или URL отсутствует — показывает инициалы на
 * золотом фоне.
 *
 * Usage:
 *   <Avatar src={user.avatarUrl} name="Алия Қалиева" size={36} />
 */

import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  /** Full name for initials fallback. E.g. "Алия Қалиева" → "АҚ" */
  name?: string | null;
  /** Pixel size (width & height). Default: 36 */
  size?: number;
  className?: string;
  /** Override alt text. Default: name or "" */
  alt?: string;
  /** Use "high" for above-the-fold avatars (e.g. current user in nav) */
  fetchpriority?: "high" | "low" | "auto";
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export function Avatar({
  src,
  name,
  size = 36,
  className = "",
  alt,
  fetchpriority = "auto",
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(src) && !imgError;

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: Math.max(10, Math.floor(size * 0.35)),
    fontWeight: 600,
    lineHeight: 1,
    userSelect: "none",
  };

  if (showImage) {
    return (
      <img
        src={src!}
        alt={alt ?? name ?? ""}
        width={size}
        height={size}
        loading={fetchpriority === "high" ? "eager" : "lazy"}
        decoding="async"
        // @ts-ignore — fetchpriority is a valid HTML attribute
        fetchpriority={fetchpriority}
        onError={() => setImgError(true)}
        style={{ ...baseStyle, objectFit: "cover" }}
        className={className}
      />
    );
  }

  // Initials fallback
  return (
    <span
      style={{
        ...baseStyle,
        background: "linear-gradient(135deg, #C9A84C 0%, #8B6914 100%)",
        color: "#0F1117",
        letterSpacing: "0.5px",
      }}
      className={className}
      aria-label={name ?? ""}
    >
      {getInitials(name)}
    </span>
  );
}

/**
 * LazyImage — обёртка для не-аватарных изображений с lazy loading.
 *
 * Usage:
 *   <LazyImage src={poster.url} alt="Турнир постері" className="h-full w-full object-cover" />
 */
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  priority?: boolean; // true = eager + fetchpriority=high (for LCP images)
}

export function LazyImage({ src, alt, priority = false, ...props }: LazyImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      // @ts-ignore
      fetchpriority={priority ? "high" : "auto"}
      {...props}
    />
  );
}
