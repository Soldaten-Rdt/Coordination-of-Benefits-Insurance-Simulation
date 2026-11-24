import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAPJ Flow — Hospital Workspace",
  description:
    "Healthcare Settlement Infrastructure — Simulator Koordinasi Antar Penyelenggara Jaminan (CoB).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#F6F8FE] font-sans text-[#0B3A5B] antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
