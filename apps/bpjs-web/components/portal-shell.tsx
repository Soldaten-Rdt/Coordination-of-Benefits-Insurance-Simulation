"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, Bell, BriefcaseMedical, ChevronDown, CircleHelp, ClipboardCheck,
  ClipboardList, FileClock, LayoutDashboard, LogOut, Search, ShieldCheck,
} from "lucide-react";
import { ApiError, type ApiEnvelope, type PayerUser } from "@/types";
import { api, clearToken, getToken } from "@/lib/api";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/claims?status=SUBMITTED", label: "Klaim Masuk", icon: ClipboardList, status: "SUBMITTED" },
  { href: "/claims?status=IN_REVIEW", label: "Dalam Review", icon: FileClock, status: "IN_REVIEW" },
  { href: "/claims?status=APPROVED", label: "Riwayat Keputusan", icon: ClipboardCheck, status: "APPROVED" },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<PayerUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [claimFilter, setClaimFilter] = React.useState("");

  React.useEffect(() => {
    setClaimFilter(new URLSearchParams(window.location.search).get("status") || "");
  }, [pathname]);

  React.useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      router.replace("/login");
      return;
    }
    api.get<ApiEnvelope<PayerUser>>("/api/me")
      .then((response) => setUser(response.data))
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) {
          clearToken();
          router.replace("/login");
        } else {
          setError(cause instanceof Error ? cause.message : "Profil tidak dapat dimuat.");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await api.post("/api/auth/logout");
      clearToken();
      router.replace("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal keluar dari portal.");
    } finally {
      setLoggingOut(false);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(search.trim() ? `/claims?q=${encodeURIComponent(search.trim())}` : "/claims");
  }

  const name = user?.full_name || "Reviewer BPJS";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const organization = user?.branch_name || "BPJS Kesehatan";

  if (loading) return <div className="grid min-h-screen place-items-center text-sm font-semibold text-slate-500">Memverifikasi sesi reviewer…</div>;
  if (!user) return <div className="grid min-h-screen place-items-center p-6"><div className="max-w-md rounded-2xl border border-rose-100 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto mb-3 text-rose-500" /><h1 className="font-bold text-slate-800">Portal tidak dapat dimuat</h1><p className="mt-2 text-sm text-slate-500">{error || "Sesi login tidak ditemukan."}</p><button className="mt-5 rounded-xl bg-[#0b4562] px-4 py-2 text-sm font-bold text-white" onClick={() => router.replace("/login")}>Kembali ke login</button></div></div>;

  return <div className="min-h-screen bg-[#f6f8ff] text-[#173c53]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[206px] flex-col border-r border-[#e5ebf5] bg-white lg:flex">
      <Link href="/dashboard" className="flex h-[62px] items-center gap-2.5 border-b border-[#edf1f7] px-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0b4562] text-white"><Activity size={17} /></span>
        <span><span className="block text-[13px] font-extrabold tracking-tight text-[#0b3e58]">KAPJ Flow</span><span className="block text-[9px] font-semibold text-slate-500">Payer Adjudication</span></span>
      </Link>
      <div className="p-3">
        <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">Konteks entitas</p>
        <div className="flex items-center justify-between rounded-md bg-[#eff4fd] px-2.5 py-2 text-[10px] font-bold text-[#264b66]"><span className="truncate">{organization}</span><ChevronDown size={12} /></div>
      </div>
      <nav className="px-2 pt-1">
        {navigation.map(({ href, label, icon: Icon, status }) => {
          const active = label === "Dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith("/claims") && claimFilter === status;
          return <Link key={label} href={href} onClick={() => setClaimFilter(status || "")} className={`mb-1 flex h-9 items-center gap-2 rounded-md px-2.5 text-[11px] font-semibold transition ${active ? "bg-[#0d4c6a] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-[#0d4c6a]"}`}><Icon size={15} />{label}{status === "SUBMITTED" && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] ${active ? "bg-white/20 text-white" : "bg-rose-100 text-rose-600"}`}>•</span>}</Link>;
        })}
        <div className="mt-1 flex h-9 items-center gap-2 rounded-md px-2.5 text-[11px] font-semibold text-slate-400" aria-disabled="true" title="Notifikasi penjamin belum tersedia di API"><Bell size={15} />Notifikasi<span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose-500" /></div>
      </nav>
      <div className="mt-auto p-2.5">
        <div className="mb-2 rounded-lg border border-[#e7edf5] bg-[#f8faff] p-2.5"><div className="flex items-center gap-1.5 text-[10px] font-bold text-[#345f7a]"><CircleHelp size={13} /> Panduan reviewer</div><p className="mt-1.5 text-[9px] leading-relaxed text-slate-500">Periksa dokumen dan kepatuhan sebelum mengirim keputusan.</p></div>
        <div className="flex items-center gap-2 border-t border-[#edf1f7] py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e6eefb] text-[10px] font-extrabold text-[#0b4562]">{initials}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-bold text-slate-700">{name}</span><span className="block truncate text-[9px] text-slate-400">{user.role_title}</span></span></div>
        <div className="flex items-center justify-between text-[9px]"><span className="flex items-center gap-1 font-semibold text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Sandbox Aktif</span><button onClick={logout} disabled={loggingOut} className="flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"><LogOut size={11} />{loggingOut ? "Keluar…" : "Keluar Sistem"}</button></div>
      </div>
    </aside>

    <div className="lg:pl-[206px]">
      <header className="sticky top-0 z-20 flex h-[62px] items-center gap-3 border-b border-[#e8edf5] bg-white/95 px-4 backdrop-blur md:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0b4562] text-white"><Activity size={17} /></span><span className="text-xs font-extrabold text-[#0b3e58]">KAPJ Flow</span></Link>
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-[#e4ebf4] bg-[#f8faff] px-2.5 py-1.5 text-[9px] font-bold text-[#395970] md:flex"><BriefcaseMedical size={12} />{organization}<ChevronDown size={11} /></div>
        <form onSubmit={submitSearch} className="relative min-w-0 max-w-[390px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Cari klaim" placeholder="Cari ID subklaim, ID kasus, atau pasien…" className="h-8 w-full rounded-md border border-[#e5eaf2] bg-[#f8faff] pl-8 pr-3 text-[10px] outline-none focus:border-[#3a7895] focus:ring-2 focus:ring-[#3a7895]/10" />
        </form>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-[#edf6ff] px-2.5 py-1.5 text-[9px] font-bold text-[#315d7e] sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Simulasi Reviewer Aktif</span>
        <div className="hidden text-right sm:block"><p className="text-[9px] font-bold text-[#314c60]">{name}</p><p className="text-[8px] text-slate-500">{user.role_title}</p></div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0b4562] text-[10px] font-bold text-white">{initials}</span>
      </header>
      {error && <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 md:mx-6">{error}</div>}
      <main className="mx-auto max-w-[1500px] px-4 pb-20 pt-5 md:px-6 md:pt-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#e5eaf2] bg-white lg:hidden">{navigation.slice(0, 4).map(({ href, label, icon: Icon, status }) => {
        const active = label === "Dashboard"
          ? pathname === "/dashboard"
          : pathname.startsWith("/claims") && claimFilter === status;
        return <Link key={label} href={href} onClick={() => setClaimFilter(status || "")} className={`flex flex-1 flex-col items-center gap-1 py-2 text-[9px] font-bold ${active ? "text-[#0d4c6a]" : "text-slate-500"}`}><Icon size={16} />{label}</Link>;
      })}</nav>
    </div>
  </div>;
}
