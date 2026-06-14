/**
 * EmailVerificationBanner — показывается когда пользователь
 * зарегистрирован, но ещё не подтвердил email.
 *
 * Скрывается:
 *   • после успешного повторного запроса письма (показывает успех-сообщение)
 *   • если пользователь закрыл баннер (до перезагрузки страницы)
 */

import { useState } from "react";
import { MailWarning, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { api } from "@/lib/api";

const DISMISSED_KEY = "email_banner_dismissed";

export function EmailVerificationBanner() {
  const { user, status } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "1",
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function dismiss() {
    if (typeof localStorage !== "undefined") localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  // Показываем только если: аутентифицирован, не ADMIN, email НЕ подтверждён, не закрыт
  if (
    status !== "authenticated" ||
    !user ||
    user.role === "ADMIN" ||
    user.emailVerified !== false ||
    dismissed
  ) {
    return null;
  }

  async function handleResend() {
    setError(null);
    setSending(true);
    try {
      await api.auth.resendVerification();
      setSent(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Қате орын алды. Қайталап көріңіз.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="alert"
      className="relative flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />

      <div className="flex-1">
        {sent ? (
          <span className="text-amber-300">
            Растау хаты жіберілді — жәшігіңізді тексеріңіз.
          </span>
        ) : (
          <>
            <span className="text-amber-200">
              Email-адресіңіз расталмаған.{" "}
            </span>
            <button
              onClick={handleResend}
              disabled={sending}
              className="inline-flex items-center gap-1 font-medium text-amber-400 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {sending && (
                <RefreshCw className="h-3 w-3 animate-spin" />
              )}
              Растау хатын қайта жіберу
            </button>
            {error && (
              <span className="ml-2 text-red-400">{error}</span>
            )}
          </>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Жабу"
        className="text-amber-400/70 hover:text-amber-400 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
