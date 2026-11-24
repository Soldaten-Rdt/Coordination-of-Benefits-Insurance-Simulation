import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAPJ Flow | Portal Verifikator BPJS",
  description: "Portal verifikasi dan adjudikasi klaim BPJS Kesehatan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
