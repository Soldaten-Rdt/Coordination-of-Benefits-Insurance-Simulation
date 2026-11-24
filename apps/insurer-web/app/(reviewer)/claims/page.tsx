"use client";

import * as React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { ClaimTable, Panel } from "@/components/ui";
import type { ApiList, ClaimRow } from "@/types";

const filters = [
  { value: "ALL", label: "Semua status" }, { value: "SUBMITTED", label: "Masuk" }, { value: "IN_REVIEW", label: "Sedang ditinjau" }, { value: "REVISION_REQUIRED", label: "Perlu revisi" }, { value: "APPROVED", label: "Disetujui" }, { value: "REJECTED", label: "Ditolak" },
];

export default function ClaimsPage() {
  const [claims, setClaims] = React.useState<ClaimRow[]>([]);
  const [filter, setFilter] = React.useState("ALL");
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const limit = 10;

  React.useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filter !== "ALL") params.set("status", filter);
    if (query) params.set("q", query);
    api.get<ApiList<ClaimRow>>(`/api/claims?${params.toString()}`)
      .then((response) => { if (active) { setClaims(response.data); setTotal(response.meta.total); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Antrean klaim gagal dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, page, query]);

  function search(event: React.FormEvent) {
    event.preventDefault(); setPage(1); setQuery(queryInput.trim());
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return <div className="space-y-7">
    <div><p className="mb-2 flex items-center gap-2 text-xs font-bold text-violet-800"><SlidersHorizontal size={14} /> ADJUDICATION / CLAIM QUEUE</p><h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Klaim sekunder CoB</h1><p className="mt-2 text-sm text-slate-500">Cari dan saring klaim berdasarkan status, pasien, fasilitas kesehatan, atau kode klaim.</p></div>
    <Panel title="Daftar pengajuan" eyebrow={`${total.toLocaleString("id-ID")} klaim terdaftar`}>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><form onSubmit={search} className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Cari pasien, kode, nomor kasus, atau faskes…" className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-xs outline-none focus:border-violet-600 focus:ring-4 focus:ring-violet-600/10" /><button className="sr-only">Cari klaim</button></form>
        <select aria-label="Filter status" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-violet-600">{filters.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></div>
      {error && <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {loading ? <div className="px-6 py-14 text-center text-sm text-slate-500">Memuat antrean dari backend…</div> : <ClaimTable claims={claims} empty="Tidak ada klaim yang sesuai filter." />}
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-500">Halaman {page} dari {totalPages} · {total.toLocaleString("id-ID")} klaim</span><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Sebelumnya</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Berikutnya</button></div></div>
    </Panel>
  </div>;
}
