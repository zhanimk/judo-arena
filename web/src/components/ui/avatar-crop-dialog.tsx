import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Move, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const OUTPUT_WIDTH = 384;
const OUTPUT_HEIGHT = 512;
const CROP_WIDTH = 240;
const CROP_HEIGHT = 320;

interface AvatarCropDialogProps {
  file: File | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

interface Point {
  x: number;
  y: number;
}

function clampOffset(
  offset: Point,
  image: HTMLImageElement,
  zoom: number,
): Point {
  const baseScale = Math.max(CROP_WIDTH / image.naturalWidth, CROP_HEIGHT / image.naturalHeight);
  const renderedWidth = image.naturalWidth * baseScale * zoom;
  const renderedHeight = image.naturalHeight * baseScale * zoom;
  const maxX = Math.max(0, (renderedWidth - CROP_WIDTH) / 2);
  const maxY = Math.max(0, (renderedHeight - CROP_HEIGHT) / 2);

  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };
}

export function AvatarCropDialog({
  file,
  busy = false,
  onCancel,
  onConfirm,
}: AvatarCropDialogProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; start: Point; offset: Point } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
  }, [file]);

  const updateZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    const image = imageRef.current;
    if (image) setOffset((current) => clampOffset(current, image, nextZoom));
  };

  const createCroppedFile = async () => {
    const image = imageRef.current;
    if (!image || !file) return;

    setProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("CANVAS_NOT_SUPPORTED");

      const baseScale = Math.max(
        CROP_WIDTH / image.naturalWidth,
        CROP_HEIGHT / image.naturalHeight,
      );
      const displayScale = baseScale * zoom;
      const sourceWidth = CROP_WIDTH / displayScale;
      const sourceHeight = CROP_HEIGHT / displayScale;
      const sourceX =
        image.naturalWidth / 2 - sourceWidth / 2 - offset.x / displayScale;
      const sourceY =
        image.naturalHeight / 2 - sourceHeight / 2 - offset.y / displayScale;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("CROP_FAILED"))),
          "image/webp",
          0.9,
        );
      });
      const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      // Safari may return a PNG even when WebP was requested. Preserve the
      // actual blob type so multipart metadata matches the file signature.
      const mimeType = blob.type === "image/webp" ? "image/webp" : "image/png";
      const extension = mimeType === "image/webp" ? "webp" : "png";
      onConfirm(
        new File([blob], `${baseName}-avatar.${extension}`, {
          type: mimeType,
        }),
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="max-h-[95vh] w-[calc(100%_-_1rem)] max-w-md overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{t("profile.crop_title")}</DialogTitle>
          <DialogDescription>{t("profile.crop_description")}</DialogDescription>
        </DialogHeader>

        <div
          className="relative mx-auto h-[320px] w-[240px] touch-none cursor-grab overflow-hidden rounded-xl bg-black active:cursor-grabbing"
          onPointerDown={(event) => {
            if (!loaded) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              pointerId: event.pointerId,
              start: { x: event.clientX, y: event.clientY },
              offset,
            };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const image = imageRef.current;
            if (!drag || !image || drag.pointerId !== event.pointerId) return;
            setOffset(
              clampOffset(
                {
                  x: drag.offset.x + event.clientX - drag.start.x,
                  y: drag.offset.y + event.clientY - drag.start.y,
                },
                image,
                zoom,
              ),
            );
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          {objectUrl && (
            <img
              ref={imageRef}
              src={objectUrl}
              alt=""
              draggable={false}
              onLoad={() => setLoaded(true)}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: imageRef.current
                  ? imageRef.current.naturalWidth *
                    Math.max(
                      CROP_WIDTH / imageRef.current.naturalWidth,
                      CROP_HEIGHT / imageRef.current.naturalHeight,
                    )
                  : "auto",
                height: "auto",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-white/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]" />
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="h-7 w-7 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={([value]) => updateZoom(value ?? 1)}
              aria-label={t("profile.crop_zoom")}
            />
          </div>
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Move className="h-3.5 w-3.5" />
            {t("profile.crop_move_hint")}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy || processing}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={createCroppedFile}
            disabled={!loaded || busy || processing}
            className="bg-gradient-gold text-gold-foreground"
          >
            {(busy || processing) && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("profile.crop_apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
