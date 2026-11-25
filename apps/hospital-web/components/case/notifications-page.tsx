"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import { peekApiCache } from "@/lib/api";
import { listNotifications, markNotificationRead } from "@/lib/api/cases";
import { getAccessToken } from "@/lib/auth/token";
import type { ApiSuccessResponse } from "@/types/api";
import type { NotificationItem } from "@/lib/api/cases";
import {
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  Panel,
  StatusBadge,
} from "./case-ui";

export function NotificationsPage() {
  const initialCached = peekApiCache<
    ApiSuccessResponse<{
      unread_count: number;
      notifications: NotificationItem[];
    }>
  >("/api/notifications");

  const [items, setItems] = React.useState<NotificationItem[]>(
    () => initialCached?.data?.notifications ?? []
  );
  const [unreadCount, setUnreadCount] = React.useState(
    () => initialCached?.data?.unread_count ?? 0
  );
  const [loading, setLoading] = React.useState(
    () => Boolean(getAccessToken()) && !initialCached
  );
  const [error, setError] = React.useState("");
  const [markingId, setMarkingId] = React.useState<number | null>(null);
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!getAccessToken()) {
      setError("Silakan masuk ke Hospital Workspace untuk melihat notifikasi.");
      setLoading(false);
      return;
    }
    const cached = peekApiCache<
      ApiSuccessResponse<{
        unread_count: number;
        notifications: NotificationItem[];
      }>
    >("/api/notifications");
    if (cached?.data) {
      const notifications = cached.data.notifications ?? [];
      setUnreadCount(cached.data.unread_count);
      setItems(
        unreadOnly
          ? notifications.filter((notification) => !notification.is_read)
          : notifications
      );
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const response = await listNotifications();
      const notifications = response.data.notifications ?? [];
      setUnreadCount(response.data.unread_count);
      setItems(
        unreadOnly
          ? notifications.filter((notification) => !notification.is_read)
          : notifications
      );
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Notifikasi gagal dimuat."
      );
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRead = async (id: number) => {
    setMarkingId(id);
    try {
      await markNotificationRead(id);
      await load();
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Notifikasi gagal diperbarui."
      );
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#668098]">
          Hospital Ops / Notifikasi
        </div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#0B3A5B]">
              Notifikasi penjamin
            </h1>
            <p className="mt-1 text-xs text-[#5B6B7B]">
              Permintaan revisi, keputusan klaim, dan pembaruan kasus.
            </p>
          </div>
          <div className="rounded-lg border border-[#E3EAF5] bg-white px-3 py-2 text-[10px] font-bold text-[#315D7A]">
            {unreadCount} belum dibaca
          </div>
        </div>
      </div>

      <Panel
        title="Pemberitahuan terbaru"
        description="Daftar maksimum 50 notifikasi terbaru dari sistem."
        action={
          <button
            type="button"
            onClick={() => setUnreadOnly((value) => !value)}
            className={`rounded-md px-3 py-2 text-[10px] font-bold ${
              unreadOnly
                ? "bg-[#154B6B] text-white"
                : "border border-[#E3EAF5] bg-white text-[#315D7A]"
            }`}
          >
            {unreadOnly ? "Tampilkan semua" : "Belum dibaca"}
          </button>
        }
      >
        {loading ? (
          <LoadingState label="Memuat notifikasi..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={unreadOnly ? "Semua sudah dibaca" : "Belum ada notifikasi"}
            description={
              unreadOnly
                ? "Tidak ada notifikasi yang menunggu untuk dibaca."
                : "Pembaruan dari penjamin akan muncul di halaman ini."
            }
            icon="check"
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-4 ${
                  item.is_read
                    ? "border-[#E6ECF3] bg-white"
                    : "border-blue-100 bg-blue-50/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      item.is_read
                        ? "bg-[#EAF0FB] text-[#52758C]"
                        : "bg-white text-[#2B6385]"
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xs font-extrabold text-[#234B66]">
                        {item.title}
                      </h2>
                      <StatusBadge status={item.is_read ? "READ" : "UNREAD"}>
                        {item.is_read ? "Dibaca" : "Baru"}
                      </StatusBadge>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-[#587287]">
                      {item.message}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#8293A2]">
                      <span>{item.source_payer}</span>
                      <span>{item.category.replaceAll("_", " ")}</span>
                      <time>{formatDate(item.created_at)}</time>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.case_id && (
                        <Link
                          href={`/cases/${item.case_id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#DDE6EF] bg-white px-2.5 text-[9px] font-bold text-[#315D7A] hover:bg-[#F4F7FA]"
                        >
                          Buka kasus <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {!item.is_read && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={markingId === item.id}
                          leftIcon={<Check className="h-3 w-3" />}
                          onClick={() => void handleRead(item.id)}
                        >
                          Tandai dibaca
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
