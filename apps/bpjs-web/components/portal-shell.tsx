"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, ChevronDown, CircleHelp, ClipboardList, LayoutDashboard, LogOut, Search, ShieldCheck } from "lucide-react";
import { ApiError, type ApiEnvelope, type PayerUser } from "@/types";
import { api, clearToken, getToken } from "@/lib/api";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = React.useState<PayerUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
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

  const nav = [{ href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard }, { href: "/claims", label: "Antrean klaim", icon: ClipboardList }];
  const initials = user?.full_name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "BP";

  if (loading) return <div className="grid min-h-screen place-items-center text-sm font-semibold text-slate-500">Memverifikasi sesi reviewer…</div>;
  if (!user) return <div className="grid min-h-screen place-items-center p-6"><div className="max-w-md rounded-2xl border border-rose-100 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto mb-3 text-rose-500" /><h1 className="font-bold text-slate-800">Portal tidak dapat dimuat</h1><p className="mt-2 text-sm text-slate-500">{error || "Sesi login tidak ditemukan."}</p><button className="mt-5 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white" onClick={() => router.replace("/login")}>Kembali ke login</button></div></div>;

  return <div className="min-h-screen">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[252px] flex-col bg-[#103f46] text-white lg:flex">
      <Link href="/dashboard" className="flex h-[78px] items-center gap-3 border-b border-white/10 px-6"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-300 text-teal-950"><Activity size={21} /></div><div><div className="font-extrabold tracking-tight">KAPJ <span className="text-teal-300">FLOW</span></div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-[.16em] text-teal-100/60">BPJS Verifier</div></div></Link>
      <div className="px-4 pt-7"><p className="px-3 pb-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-teal-100/50">Workspace</p>{nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === "/claims" && pathname.startsWith("/claims/"));
        return <Link key={href} href={href} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-white text-[#103f46] shadow-sm" : "text-teal-50/75 hover:bg-white/10 hover:text-white"}`}><Icon size={18} />{label}{href === "/claims" && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-teal-50 text-teal-800" : "bg-white/10 text-white"}`}>JKN</span>}</Link>;
      })}</div>
      <div className="mt-auto p-4"><div className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center gap-2 text-xs font-bold text-teal-100"><CircleHelp size={15} /> Pusat bantuan</div><p className="mt-2 text-[11px] leading-relaxed text-teal-50/60">Periksa kelengkapan dokumen sebelum mengirim keputusan klaim.</p></div><div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-200 text-xs font-extrabold text-teal-950">{initials}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{user.full_name}</p><p className="mt-0.5 truncate text-[10px] text-teal-100/60">{user.role_title}</p></div></div></div>
    </aside>
    <div className="lg:pl-[252px]">
      <header className="sticky top-0 z-10 flex h-[70px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur md:px-8">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-800 lg:hidden"><Activity size={19} /></div><div><div className="hidden text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400 sm:block">Portal verifikator</div><div className="text-sm font-bold text-slate-700">{user.branch_name || "BPJS Cabang Utama"}</div></div></div>
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400 md:flex"><Search size={14} /> Pencarian klaim ada di menu antrean</div>
        <div className="flex items-center gap-3"><button aria-label="Notifikasi" className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-500" /></button><div className="hidden h-8 w-px bg-slate-200 sm:block" /><button onClick={logout} disabled={loggingOut} className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><LogOut size={15} /><span className="hidden sm:inline">{loggingOut ? "Keluar…" : "Keluar"}</span><ChevronDown className="hidden sm:block" size={13} /></button></div>
      </header>
      {error && <div role="alert" className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 md:mx-8">{error}</div>}
      <main className="mx-auto max-w-[1500px] px-5 py-7 pb-24 md:px-8 md:py-9">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white lg:hidden">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-bold ${pathname.startsWith(href) ? "text-teal-800" : "text-slate-500"}`}><Icon size={19} />{label}</Link>)}</nav>
    </div>
  </div>;
}
