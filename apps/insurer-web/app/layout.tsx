import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAPJ Flow | Portal Asuransi",
  description: "Portal adjudikasi klaim asuransi swasta dan koordinasi manfaat.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
