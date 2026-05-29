import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { Sentry } from "@/lib/sentry";

function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  Sentry.captureException(error);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold">Қате орын алды</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 bg-gradient-gold text-gold-foreground px-5 py-2.5 rounded-md font-medium"
        >Қайталау</button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/athlete")({
  component: AthleteLayout,
  errorComponent: DashboardError,
});

function AthleteLayout() {
  return <Outlet />;
}
