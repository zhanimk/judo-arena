import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

const TILE_SIZE = 256;
const MAP_HEIGHT = 320;
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;

const CITY_CENTERS: Record<string, [number, number]> = {
  алматы: [43.238949, 76.889709],
  астана: [51.169392, 71.449074],
  шымкент: [42.3417, 69.5901],
  қарағанды: [49.8064, 73.0855],
  караганда: [49.8064, 73.0855],
  ақтөбе: [50.2839, 57.166],
  актобе: [50.2839, 57.166],
};

interface Coordinates {
  lat: number;
  lng: number;
}

interface MapLocationPickerProps {
  city?: string | null;
  mapUrl: string;
  onChange: (url: string) => void;
}

function longitudeToWorldX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latitudeToWorldY(lat: number, zoom: number): number {
  const bounded = Math.max(-85.0511, Math.min(85.0511, lat));
  const radians = (bounded * Math.PI) / 180;
  return (
    (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) /
    2 *
    TILE_SIZE *
    2 ** zoom
  );
}

function worldXToLongitude(x: number, zoom: number): number {
  return (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180;
}

function worldYToLatitude(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function parseCoordinates(url: string): Coordinates | null {
  const match = url.match(
    /(?:[?&](?:q|query)=|@)(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/,
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function mapLink({ lat, lng }: Coordinates): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function MapLocationPicker({ city, mapUrl, onChange }: MapLocationPickerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = useMemo<Coordinates>(() => {
    const fromUrl = parseCoordinates(mapUrl);
    if (fromUrl) return fromUrl;
    const key = city?.trim().toLocaleLowerCase("ru") ?? "";
    const [lat, lng] = CITY_CENTERS[key] ?? CITY_CENTERS.алматы;
    return { lat, lng };
  }, [city, mapUrl]);
  const [center, setCenter] = useState(initial);
  const [selected, setSelected] = useState<Coordinates | null>(() => parseCoordinates(mapUrl));
  const [zoom, setZoom] = useState(13);
  const [width, setWidth] = useState(640);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => setWidth(element.clientWidth || 640);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const centerWorld = {
    x: longitudeToWorldX(center.lng, zoom),
    y: latitudeToWorldY(center.lat, zoom),
  };
  const tileMinX = Math.floor((centerWorld.x - width / 2) / TILE_SIZE);
  const tileMaxX = Math.floor((centerWorld.x + width / 2) / TILE_SIZE);
  const tileMinY = Math.floor((centerWorld.y - MAP_HEIGHT / 2) / TILE_SIZE);
  const tileMaxY = Math.floor((centerWorld.y + MAP_HEIGHT / 2) / TILE_SIZE);
  const maxTile = 2 ** zoom;
  const tiles: Array<{ x: number; y: number; displayX: number; key: string }> = [];

  for (let y = tileMinY; y <= tileMaxY; y += 1) {
    if (y < 0 || y >= maxTile) continue;
    for (let x = tileMinX; x <= tileMaxX; x += 1) {
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      tiles.push({ x: wrappedX, y, displayX: x, key: `${zoom}-${x}-${y}` });
    }
  }

  const markerPosition = selected
    ? {
        left: longitudeToWorldX(selected.lng, zoom) - centerWorld.x + width / 2,
        top: latitudeToWorldY(selected.lat, zoom) - centerWorld.y + MAP_HEIGHT / 2,
      }
    : null;

  const choose = (coordinates: Coordinates) => {
    setSelected(coordinates);
    onChange(mapLink(coordinates));
  };

  const pan = (xFactor: number, yFactor: number) => {
    const x = centerWorld.x + width * xFactor;
    const y = centerWorld.y + MAP_HEIGHT * yFactor;
    setCenter({
      lat: worldYToLatitude(y, zoom),
      lng: worldXToLongitude(x, zoom),
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { lat: coords.latitude, lng: coords.longitude };
        setCenter(coordinates);
        choose(coordinates);
        setZoom(16);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{t("tournament.map_picker_title")}</div>
          <div className="text-xs text-muted-foreground">{t("tournament.map_picker_hint")}</div>
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs hover:border-gold/50 disabled:opacity-50"
        >
          <LocateFixed className="h-4 w-4" />
          {t("tournament.use_current_location")}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative h-80 w-full cursor-crosshair overflow-hidden rounded-xl border border-border/60 bg-muted"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          choose({
            lng: worldXToLongitude(centerWorld.x + event.clientX - rect.left - rect.width / 2, zoom),
            lat: worldYToLatitude(centerWorld.y + event.clientY - rect.top - rect.height / 2, zoom),
          });
        }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute h-64 w-64 max-w-none select-none"
            style={{
              left: tile.displayX * TILE_SIZE - centerWorld.x + width / 2,
              top: tile.y * TILE_SIZE - centerWorld.y + MAP_HEIGHT / 2,
            }}
          />
        ))}

        {markerPosition && (
          <MapPin
            className="pointer-events-none absolute h-9 w-9 -translate-x-1/2 -translate-y-full fill-gold text-gold-foreground drop-shadow-lg"
            style={markerPosition}
          />
        )}

        <div className="absolute left-2 top-2 flex flex-col overflow-hidden rounded-md border border-border bg-background/90 shadow">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setZoom((value) => Math.min(MAX_ZOOM, value + 1));
            }}
            className="grid h-9 w-9 place-items-center hover:bg-muted"
            aria-label={t("tournament.map_zoom_in")}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setZoom((value) => Math.max(MIN_ZOOM, value - 1));
            }}
            className="grid h-9 w-9 place-items-center border-t border-border hover:bg-muted"
            aria-label={t("tournament.map_zoom_out")}
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        <div className="absolute bottom-7 right-2 grid grid-cols-3 gap-1">
          <span />
          <PanButton label="↑" onClick={() => pan(0, -0.4)} />
          <span />
          <PanButton label="←" onClick={() => pan(-0.4, 0)} />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (selected) setCenter(selected);
            }}
            className="grid h-9 w-9 place-items-center rounded-md border border-border bg-background/90 shadow hover:bg-muted"
            aria-label={t("tournament.center_selected_location")}
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <PanButton label="→" onClick={() => pan(0.4, 0)} />
          <span />
          <PanButton label="↓" onClick={() => pan(0, 0.4)} />
        </div>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="absolute bottom-0 right-0 bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          © OpenStreetMap
        </a>
      </div>
    </div>
  );
}

function PanButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="grid h-9 w-9 place-items-center rounded-md border border-border bg-background/90 text-sm shadow hover:bg-muted"
    >
      {label}
    </button>
  );
}
