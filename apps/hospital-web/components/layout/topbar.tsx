"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronsUpDown, Menu, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SimulationMode } from "@/types/api";

export interface TopbarProps {
  onOpenMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  simulationMode: SimulationMode;
  notificationCount?: number;
}

export function Topbar({
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
  simulationMode,
  notificationCount = 3,
}: TopbarProps) {
  const pathname = usePathname();
  const isPatientProfileRoute =
    pathname.startsWith("/patients/") && pathname !== "/patients/new";

  return (
    <header className="sticky top-0 z-40 flex h-[50px] shrink-0 items-center border-b border-[#E3EAF5] bg-white">
      <div className="hidden h-full w-[250px] shrink-0 items-center justify-end border-r border-[#E3EAF5] px-5 lg:flex">
        <button
          type="button"
          className="inline-flex items-center gap-[5px] text-[15px] font-extrabold tracking-[-0.01em] text-[#0B3A5B] hover:opacity-80"
        >
          <span>Flow</span>
          <ChevronsUpDown className="h-[13px] w-[13px] text-[#5B6B7B]" />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-[14px] sm:px-[22px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Buka navigasi"
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] border border-[#E3EAF5] text-[#0B3A5B] hover:bg-[#EAF0FB] lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-[6px] whitespace-nowrap text-[11px]"
          >
            <span className="font-semibold text-[#0B3A5B]">Hospital Ops</span>
            <span className="text-[#5B6B7B]">&rsaquo;</span>
            <span className="font-medium text-[#5B6B7B]">Ruang Kerja</span>
          </nav>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <div className="relative w-full max-w-[420px]">
            <Search className="pointer-events-none absolute left-[10px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[#5B6B7B]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari pasien, ID kasus, atau tagihan..."
              className={cn(
                "h-[32px] w-full rounded-[8px] pl-[30px] pr-[12px] text-[11px] font-medium text-[#0B3A5B] placeholder:text-[#7E8E9C] focus:outline-none focus:ring-1 focus:ring-[#154B6B]/40",
                isPatientProfileRoute
                  ? "border border-[#E3EAF5] bg-white"
                  : "bg-[#F3F6FB]"
              )}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-[8px] sm:gap-[10px]">
          <span className="hidden items-center gap-[6px] rounded-full bg-[#EAF0FB] px-[10px] py-[5px] text-[10px] font-bold leading-none text-[#0B3A5B] xl:inline-flex">
            <span className="h-[5px] w-[5px] rounded-full bg-[#D0214F]" />
            {simulationMode === "COB"
              ? "Simulasi Mode COB Aktif"
              : "Simulasi Mode Non-COB"}
          </span>
          <button
            type="button"
            aria-label="Notifikasi"
            className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full text-[#5B6B7B] transition-colors hover:bg-[#EAF0FB] hover:text-[#0B3A5B]"
          >
            <Bell className="h-[15px] w-[15px]" />
            {notificationCount > 0 && (
              <span className="absolute right-[1px] top-[1px] flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#D0214F] px-[3px] text-[8.5px] font-bold leading-none text-white">
                {notificationCount}
              </span>
            )}
          </button>
          <Link
            href="/cases/new"
            className="inline-flex h-[32px] items-center gap-[5px] rounded-[8px] bg-[#154B6B] px-[10px] text-[10px] font-bold text-white transition-colors hover:bg-[#0B3A5B] sm:px-[12px] sm:text-[11px]"
          >
            <Plus className="h-[13px] w-[13px]" />
            <span>+ Buat Kasus</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
