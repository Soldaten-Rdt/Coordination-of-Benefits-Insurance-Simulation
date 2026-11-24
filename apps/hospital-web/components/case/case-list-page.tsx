"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search } from "lucide-react";
import { useWorkspace } from "@/components/layout";
import { Button } from "@/components/ui";
import { listCases } from "@/lib/api/cases";
import { getAccessToken } from "@/lib/auth/token";
import type { CaseListItem } from "@/types/case";
import {
  EmptyState,
  ErrorState,
  formatDate,
  formatRupiah,
  LoadingState,
  Panel,
  paymentStatusLabel,
  StatusBadge,
} from "./case-ui";

const TABS = [
  { value: "ALL", label: "Semua kasus" },
  { value: "NEEDS_DOCUMENTS", label: "Dokumen kurang" },
  { value: "IN_REVIEW", label: "Dalam review" },
  { value: "READY_RECONCILE", label: "Rekonsiliasi" },
];

export function CaseListPage({ claimsOnly = false }: { claimsOnly?: boolean }) {
  const { searchQuery } = useWorkspace();
  const [tab, setTab] = React.useState(claimsOnly ? "IN_REVIEW" : "ALL");
  const [paymentStatus, setPaymentStatus] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<CaseListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const pageSize = 10;

  React.useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      setError("Silakan masuk ke Hospital Workspace untuk melihat data kasus.");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      listCases({
        page,
        limit: pageSize,
        tab,
        status: paymentStatus,
        q: searchQuery,
      })
        .then((response) => {
          if (!active) return;
          setRows(response.data ?? []);
          setTotal(response.meta?.total ?? 0);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(
            cause instanceof Error ? cause.message : "Kasus gagal dimuat."
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, searchQuery ? 250 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [page, paymentStatus, searchQuery, tab, reloadKey]);

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, tab, paymentStatus]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const title = claimsOnly ? "Koordinasi Klaim" : "Kasus Perawatan";

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#668098]">
            Hospital Ops / {claimsOnly ? "Koordinasi" : "Kasus"}
          </div>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-[#0B3A5B]">
            {title}
          </h1>
          <p className="mt-1 text-xs text-[#5B6B7B]">
            {claimsOnly
              ? "Pantau pengajuan dan tindak lanjut klaim ke penjamin."
              : "Kelola siklus perawatan, kelengkapan dokumen, klaim, dan pembayaran."}
          </p>
        </div>
        {!claimsOnly && (
          <Link href="/cases/new">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Buat kasus</Button>
          </Link>
        )}
      </div>

      <Panel
        title={claimsOnly ? "Daftar klaim rumah sakit" : "Daftar kasus"}
        description="Data dan status dimuat langsung dari sistem rumah sakit."
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-[#F3F6FB] p-1">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`shrink-0 rounded-md px-3 py-2 text-[11px] font-bold transition ${
                  tab === item.value
                    ? "bg-white text-[#154B6B] shadow-sm"
                    : "text-[#657A8C] hover:text-[#0B3A5B]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-[190px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7990A2]" />
              <input
                value={searchQuery}
                readOnly
                aria-label="Pencarian dari bilah atas"
                placeholder="Gunakan pencarian di bagian atas"
                className="h-9 w-full rounded-lg border border-[#E3EAF5] bg-[#F9FBFE] pl-9 pr-3 text-[11px] text-[#5B6B7B]"
              />
            </label>
            <select
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
              aria-label="Filter status pembayaran"
              className="h-9 rounded-lg border border-[#E3EAF5] bg-white px-3 text-[11px] font-semibold text-[#34566E]"
            >
              <option value="ALL">Semua pembayaran</option>
              <option value="UNPAID">Belum dibayar</option>
              <option value="PARTIAL">Pembayaran sebagian</option>
              <option value="PAID">Lunas</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#E3EAF5]">
          {loading ? (
            <LoadingState label="Memuat daftar kasus..." />
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Belum ada kasus yang cocok"
              description="Ubah filter atau buat kasus baru untuk memulai alur koordinasi manfaat."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left">
                  <thead className="bg-[#F7F9FC] text-[10px] font-bold uppercase tracking-wide text-[#71869A]">
                    <tr>
                      <th className="px-4 py-3">Kasus / Pasien</th>
                      <th className="px-4 py-3">Perawatan</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3 text-right">Tagihan</th>
                      <th className="px-4 py-3">Pembayaran</th>
                      <th className="px-4 py-3">Dibuat</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E9EEF5]">
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="text-xs transition-colors hover:bg-[#F9FBFE]"
                      >
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/cases/${row.id}`}
                            className="font-extrabold text-[#154B6B] hover:underline"
                          >
                            {row.case_number}
                          </Link>
                          <div className="mt-1 text-[11px] text-[#0B3A5B]">
                            {row.patient_name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-[#7C8FA0]">
                            {row.patient_code}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[#34566E]">
                            {row.care_type === "RAWAT_JALAN"
                              ? "Rawat jalan"
                              : "Rawat inap"}
                          </div>
                          <div className="mt-1 text-[10px] text-[#7C8FA0]">
                            {row.room_name || "Ruang belum ditentukan"}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={row.simulation_mode} />
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-[#0B3A5B]">
                          {formatRupiah(row.total_hospital_bill)}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={row.payment_status}>
                            {paymentStatusLabel(row.payment_status)}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3.5 text-[11px] text-[#657A8C]">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/cases/${row.id}`}
                            aria-label={`Buka ${row.case_number}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#4C718A] hover:bg-[#EAF0FB]"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 border-t border-[#E3EAF5] px-4 py-3 text-[11px] text-[#6A7E90] sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Menampilkan {total === 0 ? 0 : (page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, total)} dari {total} kasus
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <span>
                    Halaman {page} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
