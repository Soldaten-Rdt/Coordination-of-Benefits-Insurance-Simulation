"use client";

import * as React from "react";
import { Bell, Check, MessageSquare, Send, RotateCw } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import {
  listNotifications,
  markNotificationRead,
  resubmitSubclaim,
  sendCaseMessage,
  submitSubclaims,
} from "@/lib/api/cases";
import { getAccessToken } from "@/lib/auth/token";
import type { CaseDetail } from "@/types/case";
import type { NotificationItem } from "@/lib/api/cases";
import {
  EmptyState,
  formatDate,
  formatRupiah,
  Panel,
  StatusBadge,
  subclaimStatusLabel,
} from "./case-ui";

export function ClaimsPanel({
  caseData,
  onRefresh,
}: {
  caseData: CaseDetail;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [resubmittingId, setResubmittingId] = React.useState<number | null>(null);
  const [sending, setSending] = React.useState(false);
  const [selectedSubclaim, setSelectedSubclaim] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const loadNotifications = React.useCallback(() => {
    if (!getAccessToken()) {
      setLoadingNotifications(false);
      return;
    }
    setLoadingNotifications(true);
    listNotifications()
      .then((response) =>
        setNotifications(
          (response.data.notifications ?? []).filter(
            (notification) => notification.case_id === caseData.id
          )
        )
      )
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Notifikasi kasus gagal dimuat."
        );
      })
      .finally(() => setLoadingNotifications(false));
  }, [caseData.id]);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  React.useEffect(() => {
    if (!selectedSubclaim && caseData.subclaims.length > 0) {
      setSelectedSubclaim(String(caseData.subclaims[0].id));
    }
  }, [caseData.subclaims, selectedSubclaim]);

  const handleSubmitClaims = async () => {
    setSubmitting(true);
    setError("");
    try {
      await submitSubclaims(caseData.id);
      await onRefresh();
      toast({
        title: "Klaim berhasil diajukan",
        description: "Status pengajuan diperbarui dari backend.",
        variant: "success",
      });
    } catch (cause: unknown) {
      const description =
        cause instanceof Error ? cause.message : "Pengajuan klaim gagal.";
      setError(description);
      toast({ title: "Klaim belum dapat diajukan", description, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = async (subclaimId: number) => {
    setResubmittingId(subclaimId);
    setError("");
    try {
      await resubmitSubclaim(caseData.id, subclaimId, "Dokumen revisi telah dilengkapi.");
      await Promise.all([onRefresh(), Promise.resolve(loadNotifications())]);
      toast({
        title: "Klaim berhasil diajukan ulang",
        variant: "success",
      });
    } catch (cause: unknown) {
      const description =
        cause instanceof Error ? cause.message : "Pengajuan ulang gagal.";
      setError(description);
      toast({ title: "Klaim gagal diajukan ulang", description, variant: "error" });
    } finally {
      setResubmittingId(null);
    }
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      await sendCaseMessage(
        caseData.id,
        selectedSubclaim ? Number(selectedSubclaim) : null,
        message.trim()
      );
      setMessage("");
      await onRefresh();
      toast({
        title: "Pesan dikirim",
        description: "Pesan ditambahkan ke riwayat komunikasi kasus.",
        variant: "success",
      });
    } catch (cause: unknown) {
      const description =
        cause instanceof Error ? cause.message : "Pesan gagal dikirim.";
      setError(description);
      toast({ title: "Pesan gagal dikirim", description, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  const handleRead = async (notificationId: number) => {
    try {
      await markNotificationRead(notificationId);
      loadNotifications();
    } catch (cause: unknown) {
      const description =
        cause instanceof Error ? cause.message : "Notifikasi gagal diperbarui.";
      setError(description);
      toast({ title: "Gagal menandai notifikasi", description, variant: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#E3EAF5] bg-[#F8FAFD] p-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-xs font-extrabold text-[#234B66]">
            Validasi kesiapan pengajuan
          </div>
          <div className="mt-1 text-[10px] leading-4 text-[#71869A]">
            Subklaim hanya dapat diajukan jika split bill sudah diterapkan dan
            dokumen wajib tervalidasi. Backend akan memeriksa seluruh prasyarat.
          </div>
        </div>
        <Button
          onClick={() => void handleSubmitClaims()}
          isLoading={submitting}
          leftIcon={<Send className="h-3.5 w-3.5" />}
        >
          Ajukan klaim
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Status subklaim"
          description="Lihat status dari masing-masing penjamin dan kirim ulang jika revisi sudah dilengkapi."
        >
          {caseData.subclaims.length === 0 ? (
            <EmptyState
              title="Belum ada subklaim untuk diajukan"
              description="Terapkan hasil split bill terlebih dahulu. Mode NON_COB hanya membentuk klaim BPJS."
            />
          ) : (
            <div className="space-y-3">
              {caseData.subclaims.map((claim) => (
                <article
                  key={claim.id}
                  className="rounded-lg border border-[#E7EDF4] p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-extrabold text-[#234B66]">
                        {claim.payer_name}
                      </h3>
                      <p className="mt-1 text-[10px] text-[#8293A2]">
                        {claim.subclaim_code} · Pengajuan{" "}
                        {formatRupiah(claim.requested_amount)}
                      </p>
                    </div>
                    <StatusBadge status={claim.status}>
                      {subclaimStatusLabel(claim.status)}
                    </StatusBadge>
                  </div>
                  {claim.status === "REVISION_REQUIRED" && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-rose-50 px-3 py-2">
                      <span className="text-[10px] font-semibold text-rose-800">
                        Lengkapi dokumen revisi sebelum mengirim ulang.
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={resubmittingId === claim.id}
                        leftIcon={<RotateCw className="h-3 w-3" />}
                        onClick={() => void handleResubmit(claim.id)}
                      >
                        Ajukan ulang
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Notifikasi penjamin"
          description="Permintaan revisi dan pembaruan status yang diterima untuk kasus ini."
          action={<Bell className="h-4 w-4 text-[#65839A]" />}
        >
          {loadingNotifications ? (
            <div className="py-6 text-center text-xs text-[#71869A]">
              Memuat notifikasi…
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              title="Tidak ada notifikasi"
              description="Pemberitahuan dari penjamin akan muncul di sini."
              icon="check"
            />
          ) : (
            <div className="space-y-2.5">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-lg border p-3 ${
                    notification.is_read
                      ? "border-[#E8EDF4] bg-white"
                      : "border-blue-100 bg-blue-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-extrabold text-[#234B66]">
                        {notification.title}
                      </div>
                      <div className="mt-1 text-[10px] leading-4 text-[#667E91]">
                        {notification.message}
                      </div>
                      <div className="mt-2 text-[9px] text-[#8798A7]">
                        {notification.source_payer} · {formatDate(notification.created_at)}
                      </div>
                    </div>
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => void handleRead(notification.id)}
                        aria-label="Tandai notifikasi dibaca"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#2B6385] hover:bg-white"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Panel
          title="Riwayat komunikasi"
          description="Catatan pesan dan klarifikasi terkait klaim."
        >
          {caseData.communications.length === 0 ? (
            <EmptyState
              title="Belum ada komunikasi"
              description="Pesan yang dikirim ke penjamin akan tampil di sini."
              icon="clock"
            />
          ) : (
            <div className="space-y-3">
              {caseData.communications.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-[#E8EDF4] bg-[#FBFCFE] p-3"
                >
                  <div className="flex flex-wrap justify-between gap-1">
                    <span className="text-[10px] font-extrabold text-[#315D7A]">
                      {item.sender_name} · {item.sender_role}
                    </span>
                    <time className="text-[9px] text-[#8798A7]">
                      {formatDate(item.created_at)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#49667B]">
                    {item.message}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Kirim klarifikasi"
          description="Kirim pesan ke BPJS atau asuransi swasta melalui backend."
        >
          <form onSubmit={handleSendMessage} className="space-y-3">
            {caseData.subclaims.length > 0 && (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-[#34566E]">
                  Penjamin
                </label>
                <select
                  value={selectedSubclaim}
                  onChange={(event) => setSelectedSubclaim(event.target.value)}
                  className="h-9 w-full rounded-lg border border-[#DCE5F0] bg-white px-3 text-[11px] text-[#0B3A5B]"
                >
                  {caseData.subclaims.map((claim) => (
                    <option key={claim.id} value={claim.id}>
                      {claim.payer_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label
                htmlFor="case-message"
                className="mb-1.5 block text-[10px] font-bold text-[#34566E]"
              >
                Pesan
              </label>
              <textarea
                id="case-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Tuliskan klarifikasi atau informasi pendukung..."
                required
                className="w-full resize-y rounded-lg border border-[#DCE5F0] bg-white px-3 py-2.5 text-[11px] leading-5 text-[#0B3A5B] outline-none focus:border-[#3B789F] focus:ring-2 focus:ring-[#3B789F]/15"
              />
              <div className="mt-1 text-right text-[9px] text-[#8293A2]">
                {message.length} / 2000
              </div>
            </div>
            <Button
              type="submit"
              isLoading={sending}
              disabled={!message.trim()}
              leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
            >
              Kirim pesan
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
