"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { ClaimTable, Panel } from "@/components/ui";
import type { ApiList, ClaimRow } from "@/types";

const filters = [
  { value: "ALL", label: "Semua" }, { value: "SUBMITTED", label: "Klaim Masuk" }, { value: "IN_REVIEW", label: "Dalam Review" }, { value: "REVISION_REQUIRED", label: "Perlu Revisi" }, { value: "APPROVED", label: "Disetujui" }, { value: "REJECTED", label: "Ditolak" },
];
const categories = [
  { value: "ALL", label: "Semua kategori" }, { value: "SLA_URGENT", label: "SLA mendesak" }, { value: "EXECUTIVE_INPATIENT", label: "Rawat inap eksekutif" },
];

export default function ClaimsPage() {
  return <Suspense fallback={<div className="rounded-lg border border-[#e5ebf3] bg-white p-10 text-center text-xs text-slate-500">Menyiapkan antrean klaim…</div>}><ClaimsQueue /></Suspense>;
}

function ClaimsQueue() {
  const searchParams = useSearchParams();
  const [claims, setClaims] = React.useState<ClaimRow[]>([]);
  const [filter, setFilter] = React.useState(searchParams.get("status") || "ALL");
  const [category, setCategory] = React.useState(searchParams.get("filter") || "ALL");
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") || "");
  const [query, setQuery] = React.useState(searchParams.get("q") || "");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const limit = 10;

  React.useEffect(() => {
    setFilter(searchParams.get("status") || "ALL");
    setCategory(searchParams.get("filter") || "ALL");
    const queryParam = searchParams.get("q") || "";
    setQuery(queryParam);
    setQueryInput(queryParam);
    setPage(1);
  }, [searchParams]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filter !== "ALL") params.set("status", filter);
    if (category !== "ALL") params.set("filter", category);
    if (query) params.set("q", query);
    api.get<ApiList<ClaimRow>>(`/api/claims?${params.toString()}`)
      .then((response) => { if (active) { setClaims(response.data); setTotal(response.meta.total); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Antrean klaim gagal dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, filter, page, query]);

  function search(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return <div className="space-y-4">
    <div><p className="mb-1.5 text-[9px] font-semibold text-slate-500">Payer Workspace <span className="px-1 text-slate-300">›</span> BPJS Kesehatan <span className="px-1 text-slate-300">›</span> Klaim Masuk</p><h1 className="text-[22px] font-extrabold tracking-tight text-[#123f59]">Antrean Klaim BPJS</h1><p className="mt-1 text-[10px] text-slate-500">Cari dan tinjau pengajuan subklaim JKN dari fasilitas kesehatan mitra.</p></div>
    <Panel title="Klaim Masuk" eyebrow={`${total.toLocaleString("id-ID")} pengajuan`} action={<SlidersHorizontal size={13} className="text-slate-400" />}>
      <div className="flex flex-col gap-2 border-b border-[#edf1f6] p-3 xl:flex-row xl:items-center">
        <form onSubmit={search} className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} /><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Cari ID subklaim, pasien, kasus, faskes…" className="h-8 w-full rounded-md border border-[#e4e9f1] bg-[#fbfcff] pl-8 pr-3 text-[9px] outline-none focus:border-[#3e7d9c]" /><button className="sr-only">Cari klaim</button></form>
        <div className="flex flex-wrap gap-1">{filters.map((option) => <button key={option.value} onClick={() => { setFilter(option.value); setPage(1); }} className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold ${filter === option.value ? "border-[#164e6b] bg-[#164e6b] text-white" : "border-[#e4eaf3] bg-white text-slate-600 hover:bg-slate-50"}`}>{option.label}</button>)}</div>
        <select aria-label="Filter kategori" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="h-8 rounded-md border border-[#e4e9f1] bg-white px-2 text-[9px] font-semibold text-slate-600 outline-none focus:border-[#3e7d9c]">{categories.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
      </div>
      {error && <div role="alert" className="m-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{error}</div>}
      {loading ? <div className="px-5 py-10 text-center text-[10px] text-slate-500">Memuat antrean dari backend…</div> : <ClaimTable claims={claims} empty="Tidak ada klaim yang sesuai filter." />}
      <div className="flex flex-col gap-2 border-t border-[#edf1f6] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><span className="text-[9px] text-slate-500">Halaman {page} dari {totalPages} · {total.toLocaleString("id-ID")} klaim</span><div className="flex gap-1.5"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border border-[#e1e8f0] px-2.5 py-1.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Sebelumnya</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-md border border-[#e1e8f0] px-2.5 py-1.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Berikutnya</button></div></div>
    </Panel>
  </div>;
}
