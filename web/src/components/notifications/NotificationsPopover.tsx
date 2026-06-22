import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { PopoverClose } from "@radix-ui/react-popover";
import { Bell, Check, CalendarDays, Megaphone, Info, X } from "lucide-react";
import { api } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Notification } from "@/lib/api-types";
import { formatDistanceToNow } from "date-fns";
import { ru, kk, enUS } from "date-fns/locale";

export function NotificationsPopover({
  unreadCount,
  notifUrl,
}: {
  unreadCount: number;
  notifUrl: string;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "popover"],
    queryFn: () => api.notifications.list({ limit: 5 }),
    staleTime: 60 * 1000,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const getDateLocale = () => {
    if (i18n.language === "ru") return ru;
    if (i18n.language === "kk") return kk;
    return enUS;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "match_scheduled":
        return <CalendarDays className="h-4 w-4 text-blue-500" />;
      case "announcement":
        return <Megaphone className="h-4 w-4 text-gold" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          aria-label={t("dashboard.notifications")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-gold/10" align="end">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="font-semibold">{t("dashboard.notifications")}</div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                {t("notification.mark_all_read", { defaultValue: "Прочитать всё" })}
              </button>
            )}
            <PopoverClose className="text-muted-foreground hover:text-foreground transition-colors rounded-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </PopoverClose>
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("notification.empty", { defaultValue: "Нет уведомлений" })}
            </div>
          ) : (
            notifications.map((n: Notification) => (
              <div
                key={n.id}
                className={`flex gap-3 rounded-md p-3 text-sm transition-colors hover:bg-muted/50 cursor-pointer ${
                  !n.read ? "bg-muted/30" : ""
                }`}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                }}
              >
                <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {t(n.titleKey, { defaultValue: n.titleKey })}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {t(n.bodyKey, { defaultValue: n.bodyKey })}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(n.createdAt), {
                      addSuffix: true,
                      locale: getDateLocale(),
                    })}
                  </p>
                </div>
                {!n.read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/50 p-2">
          <Link
            to={notifUrl}
            className="block rounded-md p-2 text-center text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
          >
            {t("common.view_all", { defaultValue: "Посмотреть все" })}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
