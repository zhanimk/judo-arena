import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function ErrorFallback({ error }: { error: Error }) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-xl font-semibold">{t("error.generic")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={() => router.invalidate()}
        className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
