"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, BadgeCheck, Eye, EyeOff, FileCheck2, Landmark, LockKeyhole, Shield, ShieldCheck, UserRound } from "lucide-react";
import { api, setToken } from "@/lib/api";
import type { ApiEnvelope, PayerUser } from "@/types";

const demoAccount = { email: "bambang.sudarsono@sehatsentosa.co.id", password: "SecurityToken@2025!" };
interface LoginResult { access_token: string; user: PayerUser }

const features = [
  { icon: ShieldCheck, title: "Pemeriksaan Batas Manfaat Polis", body: "Evaluasi limit kamar, pembebanan, dan plafon tahunan member." },
  { icon: FileCheck2, title: "Adjudikasi Selisih Biaya (CoB)", body: "Simulasikan potongan non-cover serta dampaknya pada ekses pasien." },
  { icon: Landmark, title: "Log Audit Multi-Tier", body: "Keputusan dan klarifikasi klaim tercatat sebagai jejak audit." },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState(demoAccount.email);
  const [password, setPassword] = React.useState(demoAccount.password);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.login<ApiEnvelope<LoginResult>>({ email: email.trim(), password });
      if (!response.data.access_token) throw new Error("Respons login tidak memuat access token.");
      setToken(response.data.access_token);
      router.replace("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login tidak berhasil. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-[#f7f9ff] text-[#103c55]">
    <header className="flex h-[54px] items-center justify-between border-b border-[#e8edf5] bg-white px-5 md:px-8">
      <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0b4562] text-white"><Activity size={17} /></span><span className="text-sm font-extrabold tracking-tight">KAPJ Flow</span><span className="hidden rounded-full bg-[#eff4fb] px-2.5 py-1 text-[9px] font-semibold text-slate-500 sm:inline-flex">Healthcare Settlement Infrastructure</span></div>
      <div className="hidden items-center gap-5 text-[10px] font-semibold text-slate-500 md:flex"><span className="text-[#0b4562]">Sign In</span><span>Institutional SSO</span><span>Security Verification</span><span>Audit Status</span></div>
      <span className="flex items-center gap-1.5 rounded-full bg-[#eff5ff] px-2.5 py-1.5 text-[9px] font-bold text-[#3d6381]"><Shield size={12} /> TLS 1.3 <span className="text-slate-300">|</span> ISO 27001</span>
    </header>

    <div className="mx-auto max-w-[1440px] px-5 pt-4 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e4ebf6] bg-[#edf3ff] px-4 py-2.5 text-[9px] text-slate-600">
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><strong className="uppercase tracking-wider">Portal penjamin sekunder</strong><span className="text-slate-300">•</span> Adjudikasi manfaat polis CoB</span>
        <span className="hidden items-center gap-2 sm:flex"><ShieldCheck size={12} /> Entitas asuransi dari profil akun reviewer</span>
      </div>
    </div>

    <div className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-8 md:px-8 lg:min-h-[calc(100vh-138px)] lg:grid-cols-[1.3fr_.9fr] lg:gap-10 lg:py-7">
      <section>
        <div className="mb-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#164e6b] px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Insurance Reviewer Console</span><span className="rounded-full border border-[#d6e4f2] bg-white px-3 py-1 text-[9px] font-bold text-[#446781]">TPA & Commercial CoB Gateway</span></div>
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#dce8f3] bg-white px-2.5 py-1 text-[9px] font-semibold text-[#41617a]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> PT Asuransi Sehat Sentosa <span className="text-slate-300">•</span> Sandbox</div>
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-[#0c3f5b] md:text-[38px]">Masuk ke Portal Review Asuransi</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Periksa pengajuan klaim asuransi tambahan, verifikasi batas manfaat polis per kasus, dan kelola keputusan review dalam proses koordinasi KAPJ.</p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">{features.map(({ icon: Icon, title, body }) => <article key={title} className="min-h-[132px] rounded-xl border border-[#e7edf5] bg-white p-4 shadow-[0_3px_12px_rgba(29,66,100,.04)]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef4ff] text-[#285c7b]"><Icon size={16} /></span><h2 className="mt-3 text-xs font-extrabold text-[#143e57]">{title}</h2><p className="mt-1.5 text-[10px] leading-4 text-slate-500">{body}</p></article>)}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce8f8] bg-[#edf4ff] px-4 py-3"><div className="flex items-center gap-2 text-[10px] font-bold text-[#345b75]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#1e5979]"><BadgeCheck size={15} /></span>Manfaat polis dikelola per entitas</div><span className="text-[9px] font-semibold text-slate-500">CoB Sekunder · Preview dihitung oleh API</span></div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[9px] font-semibold text-slate-500"><span className="flex items-center gap-1"><ShieldCheck size={12} className="text-[#386a89]" />Integrasi penjamin primer</span><span>•</span><span>Audit multi-tier</span><span>•</span><span>Keputusan terukur</span></div>
      </section>

      <section className="mx-auto w-full max-w-[470px] rounded-2xl border border-[#e9edf4] bg-white p-5 shadow-[0_12px_42px_rgba(25,58,87,.09)] sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf3ff] px-2.5 py-1 text-[9px] font-bold text-[#315d7e]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Portal Adjudikator Terverifikasi</span><h2 className="mt-3 text-xl font-extrabold tracking-tight text-[#103f59]">Masuk sebagai Reviewer Asuransi</h2><p className="mt-1 text-[11px] text-slate-500">Gunakan akun korporasi yang terdaftar pada layanan penjamin.</p></div><span className="mt-1 flex items-center gap-1 text-[9px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Sandbox</span></div>
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-[#edf4ff] p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#0b4562] text-white"><UserRound size={17} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-[#234c67]">Bambang Sudarsono, S.E., AAK</strong><span className="block text-[9px] text-slate-500">Senior Claim Underwriter & CoB Lead</span></span><button type="button" onClick={() => { setEmail(demoAccount.email); setPassword(demoAccount.password); setError(""); }} className="rounded-md px-2 py-1 text-[9px] font-extrabold text-[#245f84] hover:bg-white">Isi preset</button></div>
        <form onSubmit={submit} className="mt-5 space-y-3.5">
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-slate-700">Email Korporasi Penjamin</span><span className="relative block"><UserRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="username" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.co.id" className="h-10 w-full rounded-lg border border-[#e4e9f1] bg-[#fbfcff] pl-9 pr-3 text-[11px] outline-none focus:border-[#3e7d9c] focus:ring-2 focus:ring-[#3e7d9c]/10" /></span></label>
          <label className="block"><span className="mb-1.5 block text-[10px] font-bold text-slate-700">Kata Sandi Akses Reviewer</span><span className="relative block"><LockKeyhole size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="current-password" required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" className="h-10 w-full rounded-lg border border-[#e4e9f1] bg-[#fbfcff] pl-9 pr-10 text-[11px] outline-none focus:border-[#3e7d9c] focus:ring-2 focus:ring-[#3e7d9c]/10" /><button type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100">{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button></span></label>
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{error}</p>}
          <button disabled={loading} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0b4562] text-[11px] font-bold text-white transition hover:bg-[#07384f] disabled:cursor-wait disabled:opacity-60"><ShieldCheck size={15} />{loading ? "Memverifikasi…" : "Masuk ke Reviewer Asuransi"} {!loading && <ArrowRight size={14} />}</button>
        </form>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#e6edf7] bg-[#f5f8ff] px-3 py-2.5"><BadgeCheck size={13} className="mt-0.5 shrink-0 text-[#345d79]" /><p className="text-[9px] leading-4 text-slate-500">Koneksi ke portal klaim memakai sesi reviewer. Entitas dan batas otorisasi mengikuti profil akun dari backend.</p></div>
        <p className="mt-3 text-center text-[9px] text-slate-400">KAPJ Flow — Insurance Reviewer Workspace • Protected Healthcare Network</p>
      </section>
    </div>
    <div className="mx-auto mb-4 flex max-w-[1440px] flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e7edf5] bg-white px-5 py-3 md:px-8"><div><strong className="text-[11px] text-[#164b68]">KAPJ Flow — Insurance Reviewer Workspace</strong><p className="mt-0.5 text-[9px] text-slate-500">Enterprise CoB Settlement Module • Multi-Tenant Healthcare Adjudication Engine</p></div><div className="flex gap-5 text-right"><span className="text-[8px] font-bold uppercase text-slate-400">Proses keputusan<span className="mt-1 block text-[10px] normal-case text-[#204d68]">Terekam pada audit</span></span><span className="text-[8px] font-bold uppercase text-slate-400">Akses reviewer<span className="mt-1 block text-[10px] normal-case text-[#204d68]">Berbasis sesi</span></span></div></div>
    <footer className="flex flex-wrap justify-between gap-2 border-t border-[#e5eaf2] bg-white px-5 py-3 text-[9px] text-slate-500 md:px-8"><span>© 2025 KAPJ Flow Financial Adjudication Systems.</span><span>Protected Healthcare Network · Insurance Interoperable Node</span></footer>
  </main>;
}
