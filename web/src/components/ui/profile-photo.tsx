import { useState } from "react";
import { User } from "lucide-react";

interface ProfilePhotoProps {
  src?: string | null;
  name?: string | null;
  /** Width in px. Height is auto 4:3 portrait ratio. Default: 120 */
  width?: number;
  className?: string;
}

export function ProfilePhoto({ src, name, width = 120, className = "" }: ProfilePhotoProps) {
  const [imgError, setImgError] = useState(false);
  const height = Math.round(width * 1.333); // 3:4 portrait

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : null;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border-2 border-border/60 bg-white shadow-md ${className}`}
      style={{ width, height }}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={name ?? ""}
          className="h-full w-full object-cover object-top"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white">
          <User
            className="text-gray-300"
            style={{ width: width * 0.45, height: width * 0.45 }}
            strokeWidth={1.2}
          />
          {initials && (
            <span className="text-xs font-semibold text-gray-400 tracking-wide">{initials}</span>
          )}
        </div>
      )}
    </div>
  );
}
