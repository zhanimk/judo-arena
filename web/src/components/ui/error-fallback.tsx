import { useRouter } from "@tanstack/react-router";

export function ErrorFallback({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-xl font-semibold">Что-то пошло не так</h2>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={() => router.invalidate()}
        className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
      >
        Попробовать снова
      </button>
    </div>
  );
}
