"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, setToken } from "@/lib/api";
import type { ApiEnvelope, PayerUser } from "@/types";

const demoAccount = { email: "triana.mayasari@bpjs-kesehatan.go.id", password: "reviewerBpjs2025!" };
interface LoginResult { access_token: string; user: PayerUser }

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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

  return <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden overflow-hidden bg-[#103f46] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
      <div className="absolute -right-24 -top-20 h-96 w-96 rounded-full border border-white/10" /><div className="absolute -right-4 -top-2 h-72 w-72 rounded-full border border-white/10" /><div className="absolute -bottom-36 -left-20 h-96 w-96 rounded-full bg-teal-300/10 blur-2xl" />
      <div className="relative flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300 text-teal-950"><Activity size={23} /></div><div><div className="text-lg font-extrabold">KAPJ <span className="text-teal-300">FLOW</span></div><div className="text-[10px] font-bold uppercase tracking-[.17em] text-teal-100/60">Healthcare settlement</div></div></div>
      <div className="relative max-w-xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-teal-100"><ShieldCheck size={14} /> Portal verifikator JKN</div><h1 className="text-4xl font-extrabold leading-tight xl:text-5xl">Review klaim dengan <span className="text-teal-300">lebih terarah.</span></h1><p className="mt-5 max-w-lg text-sm leading-7 text-teal-50/65">Satu ruang kerja untuk memeriksa dokumen, mengevaluasi kepatuhan, dan mengirim keputusan klaim BPJS secara transparan.</p><div className="mt-10 flex gap-8"><div><p className="text-2xl font-extrabold">JKN</p><p className="mt-1 text-[11px] text-teal-50/50">Verifikasi primer</p></div><div className="h-10 w-px bg-white/15" /><div><p className="text-2xl font-extrabold">SLA</p><p className="mt-1 text-[11px] text-teal-50/50">Antrean terpantau</p></div></div></div>
      <p className="relative text-[11px] text-teal-50/40">KAPJ Flow · Simulator koordinasi antarpenjamin</p>
    </section>
    <section className="flex items-center justify-center px-6 py-12 sm:px-12">
      <div className="w-full max-w-[410px]">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-800 text-white"><Activity size={21} /></div><p className="font-extrabold">KAPJ FLOW <span className="font-medium text-slate-400">/ BPJS</span></p></div>
        <div className="mb-8"><p className="text-xs font-extrabold uppercase tracking-[.17em] text-teal-700">Selamat datang kembali</p><h2 className="mt-2 text-3xl font-extrabold text-slate-900">Masuk ke portal</h2><p className="mt-2 text-sm text-slate-500">Gunakan akun reviewer BPJS Anda untuk melanjutkan.</p></div>
        <button type="button" onClick={() => { setEmail(demoAccount.email); setPassword(demoAccount.password); setError(""); }} className="mb-6 flex w-full items-center justify-between rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50"><span><span className="block text-xs font-extrabold text-teal-900">Isi akun demo reviewer</span><span className="mt-1 block text-[11px] text-teal-800/65">Kredensial sandbox BPJS</span></span><ArrowRight size={17} className="text-teal-700" /></button>
        <form onSubmit={submit} className="space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-bold text-slate-700">Email</span><input autoComplete="username" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@bpjs-kesehatan.go.id" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-300 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-slate-700">Kata sandi</span><span className="relative block"><LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="current-password" required minLength={1} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm outline-none transition placeholder:text-slate-300 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" /><button type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}
          <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 text-sm font-bold text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60">{loading ? "Memverifikasi…" : "Masuk ke portal"} {!loading && <ArrowRight size={16} />}</button>
        </form>
        <p className="mt-7 text-center text-[11px] leading-relaxed text-slate-400">Akses terbatas bagi petugas berwenang. Aktivitas review dan keputusan tercatat pada sistem.</p>
      </div>
    </section>
  </main>;
}
