import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X, Loader2, FileText, ZoomIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UserDocument } from "@/lib/api-types";
import { EmptyState } from "@/components/dashboard/DashboardShell";

export function documentTypeLabel(type: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    BIRTH_CERTIFICATE: "documents.birth_certificate",
    STUDY_CERTIFICATE: "documents.study_certificate",
    COACH_ID: "documents.coach_id",
  };
  const key = map[type];
  if (!key) return t("documents.unknown") || "Құжат";

  const val = t(key);
  if (val === key) {
    if (type === "BIRTH_CERTIFICATE") return "Туу туралы куәлік";
    if (type === "STUDY_CERTIFICATE") return "Оқу орнынан анықтама";
    if (type === "COACH_ID") return "Тренер куәлігі";
  }
  return val;
}

export function DocumentList({ documents }: { documents: UserDocument[] }) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<UserDocument | null>(null);

  const ordered = ["BIRTH_CERTIFICATE", "STUDY_CERTIFICATE", "COACH_ID"]
    .map((type) => documents.find((document) => document.type === type))
    .filter((document): document is UserDocument => Boolean(document));

  if (ordered.length === 0) {
    return (
      <EmptyState title={t("documents.no_documents")} hint={t("documents.no_documents_hint")} />
    );
  }

  return (
    <>
      <div className="space-y-2">
        {ordered.map((document: UserDocument) => (
          <button
            type="button"
            key={document.id}
            onClick={(e) => {
              e.stopPropagation();
              setViewing(document);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/35 p-3 text-sm hover:border-gold/40 text-left"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4 shrink-0 text-gold" />
                {documentTypeLabel(document.type, t)}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {document.originalName || t("documents.open_file")}
              </span>
            </span>
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {viewing && (
        <DocumentViewer
          document={viewing}
          documents={ordered}
          onClose={() => setViewing(null)}
          onNavigate={setViewing}
          t={t}
        />
      )}
    </>
  );
}

export function DocumentViewer({
  document,
  documents,
  onClose,
  onNavigate,
  t,
}: {
  document: UserDocument;
  documents: UserDocument[];
  onClose: () => void;
  onNavigate: (d: UserDocument) => void;
  t: (k: string) => string;
}) {
  const idx = documents.indexOf(document);
  const isPdf = document.mimeType === "application/pdf" || document.url?.endsWith(".pdf");
  const isImage = document.mimeType?.startsWith("image/") || (!isPdf && document.url);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) onNavigate(documents[idx - 1]);
      if (e.key === "ArrowRight" && idx < documents.length - 1) onNavigate(documents[idx + 1]);
    };
    globalThis.document.addEventListener("keydown", handler);
    return () => globalThis.document.removeEventListener("keydown", handler);
  }, [document, documents, idx, onClose, onNavigate]);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState(false);

  useEffect(() => {
    setObjectUrl(null);
    setDocLoading(true);
    setDocError(false);
    const ctrl = new AbortController();

    import("@/lib/api").then(({ apiBaseUrl, getAccessToken }) => {
      fetch(`${apiBaseUrl}/api/auth/documents/${document.id}/download`, {
        credentials: "include",
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
        signal: ctrl.signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error("load failed");
          return r.blob();
        })
        .then((blob) => {
          const typedBlob = new Blob([blob], {
            type: document.mimeType || (isPdf ? "application/pdf" : "application/octet-stream"),
          });
          setObjectUrl(URL.createObjectURL(typedBlob));
          setDocLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setDocError(true);
          setDocLoading(false);
        });
    });

    return () => {
      ctrl.abort();
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [document.id, document.mimeType, isPdf]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur" onClick={onClose}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 p-3 bg-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-white/50">
            {documentTypeLabel(document.type, t)}
          </div>
          <div className="truncate text-sm font-medium text-white">
            {document.originalName || t("documents.open_file")}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {documents.length > 1 && (
            <div className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(documents[idx - 1]);
                }}
                className="p-1 text-white/70 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-white/60">
                {idx + 1}/{documents.length}
              </span>
              <button
                type="button"
                disabled={idx === documents.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(documents[idx + 1]);
                }}
                className="p-1 text-white/70 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              import("@/lib/api").then(({ apiBaseUrl, getAccessToken }) => {
                const url = `${apiBaseUrl}/api/auth/documents/${document.id}/download?token=${getAccessToken()}`;
                const a = globalThis.document.createElement("a");
                a.href = url;
                a.download = document.originalName || `document-${document.id}`;
                a.target = "_blank";
                a.click();
              });
            }}
            title={t("documents.download")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white/70 hover:text-white"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {docLoading && (
          <div className="flex flex-col items-center gap-3 text-white/60">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        )}
        {docError && (
          <div className="text-center text-white/60">
            <FileText className="mx-auto h-10 w-10 mb-2 opacity-40" />
            <div className="text-sm">{t("documents.load_error")}</div>
          </div>
        )}
        {!docLoading && !docError && objectUrl && (
          <>
            {isPdf ? (
              <div className="flex flex-col items-center gap-4 text-white/60">
                <FileText className="h-16 w-16 text-gold opacity-80" />
                <div className="text-center">
                  <div className="text-sm font-medium text-white">
                    {document.originalName || "PDF Document"}
                  </div>
                  <div className="mt-1 text-xs">PDF format</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    import("@/lib/api").then(({ apiBaseUrl, getAccessToken }) => {
                      const url = `${apiBaseUrl}/api/auth/documents/${document.id}/download?token=${getAccessToken()}`;
                      const a = globalThis.document.createElement("a");
                      a.href = url;
                      a.download = document.originalName || `document-${document.id}`;
                      a.target = "_blank";
                      a.click();
                    });
                  }}
                  className="mt-2 rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                >
                  {t("documents.download")}
                </button>
              </div>
            ) : isImage ? (
              <img
                src={objectUrl}
                alt={document.originalName || "document"}
                className="max-h-full max-w-full object-contain rounded"
              />
            ) : (
              <div className="text-center text-white/60">
                <FileText className="mx-auto h-10 w-10 mb-2 opacity-40" />
                <div className="text-sm">{t("documents.unsupported_format")}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    globalThis.document.body,
  );
}
