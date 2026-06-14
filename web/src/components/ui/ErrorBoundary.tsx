/**
 * ErrorBoundary — перехватывает React ошибки рендера.
 *
 * Использование:
 *   <RouteErrorBoundary>
 *     <MyPage />
 *   </RouteErrorBoundary>
 *
 *   Или в TanStack Router:
 *   export const Route = createFileRoute("/tournaments/$id")({
 *     errorComponent: RouteErrorUI,
 *     component: TournamentDetail,
 *   });
 */

import React from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
    // Явная отправка в Sentry с контекстом компонента
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
      tags: { source: "ErrorBoundary" },
    });
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultErrorUI error={this.state.error} onRetry={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

/** Стандартный UI ошибки — можно переопределить через fallback prop */
function DefaultErrorUI({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12,
          padding: "32px 24px",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ fontWeight: 700, fontSize: 18, color: "#dc2626", marginBottom: 8 }}>
          Что-то пошло не так
        </h3>
        {error && (
          <p
            style={{
              fontSize: 13,
              color: "#6b7280",
              fontFamily: "monospace",
              background: "#f9fafb",
              borderRadius: 6,
              padding: "8px 12px",
              marginBottom: 16,
              wordBreak: "break-word",
              textAlign: "left",
            }}
          >
            {error.message}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onRetry}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "8px 20px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Попробовать снова
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#f3f4f6",
              color: "#374151",
              border: "1px solid #e5e7eb",
              borderRadius: 7,
              padding: "8px 20px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Компонент для использования в TanStack Router errorComponent.
 * Использование:
 *   export const Route = createFileRoute("/foo")({
 *     errorComponent: RouteErrorUI,
 *   });
 */
export function RouteErrorUI({ error }: { error: Error }) {
  return (
    <DefaultErrorUI
      error={error}
      onRetry={() => window.history.back()}
    />
  );
}

/** Обёртка-компонент для удобного wrapping страниц */
export function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
