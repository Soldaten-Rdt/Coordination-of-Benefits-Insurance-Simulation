import * as React from "react";
import { HospitalShell } from "@/components/layout";

export default function HospitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HospitalShell>{children}</HospitalShell>;
}

